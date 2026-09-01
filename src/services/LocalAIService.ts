import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

// Lazy load mlc-ai/web-llm so we don't break native
let webLLM: any = null;

// Lazy load llama.rn so we don't break web
let llama: any = null;
let LlamaContext: any = null;

const MODEL_ID = 'qwen3-0.6b-instruct-q4_k_m';
const MODEL_VERSION = 'v1';
const EXPECTED_SIZE = 484000000; // Adjust to exact size
const EXPECTED_SHA256 = 'YOUR_EXPECTED_SHA256'; // Will be validated where practical
const NATIVE_MODEL_FILENAME = 'qwen3.gguf';

export type DeepAnalysisResult = {
  entry_id: string;
  journal_brief: string;
  relevant_part: string | null;
  relevance: 'DIRECT' | 'RELATED' | 'WEAK' | 'NOT_RELEVANT';
};

class LocalAIServiceClass {
  private engine: any = null;
  private nativeContext: any = null;
  public isInitialized = false;

  constructor() {}

  async checkCompatibility(): Promise<boolean> {
    if (Platform.OS === 'web') {
      if (!navigator.gpu) return false;
      return true;
    } else {
      return !!FileSystem.Paths.document;
    }
  }

  async getDownloadSession(): Promise<{ signed_url: string, session_id: string, used: number, total: number }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/private-ai-download-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model_id: MODEL_ID, model_version: MODEL_VERSION })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || data.error || 'Failed to initialize download session');
    }

    return data;
  }

  async getDownloadLimitInfo(): Promise<{ used: number, total: number } | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('private_ai_download_sessions')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('status', 'COMPLETED')
        .gte('completed_at', startOfMonth.toISOString());
        
      if (error) return null;
      return { used: data.length, total: 10 };
    } catch {
      return null;
    }
  }

  async completeDownloadSession(sessionId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/complete-private-ai-download`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ session_id: sessionId, model_version: MODEL_VERSION })
    });
  }

  async isModelDownloaded(): Promise<boolean> {
    if (Platform.OS === 'web') {
      try {
        const root = await navigator.storage.getDirectory();
        const metaHandle = await root.getFileHandle(NATIVE_MODEL_FILENAME + '.meta');
        const metaFile = await metaHandle.getFile();
        const metadata = JSON.parse(await metaFile.text());
        return metadata.status === 'complete' && metadata.version === MODEL_VERSION && metadata.size > 100000000;
      } catch (e) {
        return false;
      }
    } else {
      const modelFile = new FileSystem.File(FileSystem.Paths.document, NATIVE_MODEL_FILENAME);
      if (!modelFile.exists) return false;
      
      const savedVersion = await AsyncStorage.getItem('PrivateAIModelVersion');
      const savedSizeStr = await AsyncStorage.getItem('PrivateAIModelSize');
      const savedSize = savedSizeStr ? parseInt(savedSizeStr, 10) : 0;
      
      return savedVersion === MODEL_VERSION && savedSize > 100000000 && modelFile.size === savedSize;
    }
  }

  async initAndDownload(onProgress: (text: string) => void): Promise<void> {
    if (Platform.OS === 'web') {
      await this.downloadGGUFToWebOPFS(NATIVE_MODEL_FILENAME, onProgress);
      this.isInitialized = true;
    } else {
      if (!llama) {
        const llamaRn = require('llama.rn');
        llama = llamaRn;
        LlamaContext = llamaRn.LlamaContext;
      }
      
      const modelFile = new FileSystem.File(FileSystem.Paths.document, NATIVE_MODEL_FILENAME);
      
      const savedVersion = await AsyncStorage.getItem('PrivateAIModelVersion');
      const savedSizeStr = await AsyncStorage.getItem('PrivateAIModelSize');
      const savedSize = savedSizeStr ? parseInt(savedSizeStr, 10) : 0;
      
      const isValid = modelFile.exists && modelFile.size > 100000000 && savedVersion === MODEL_VERSION && savedSize === modelFile.size;

      if (!isValid) {
        if (modelFile.exists) {
          modelFile.delete();
        }
        onProgress('Requesting secure download link...');
        const sessionData = await this.getDownloadSession();
        
        onProgress('Downloading model to device...');
        const downloadTask = new FileSystem.DownloadTask(
          sessionData.signed_url,
          modelFile,
          {
            onProgress: (downloadProgress) => {
              const progress = downloadProgress.bytesWritten / downloadProgress.totalBytes;
              onProgress(`Downloading Private AI — ${Math.floor(progress * 100)}%`);
            }
          }
        );
        try {
          await downloadTask.downloadAsync();
        } catch (e: any) {
           throw new Error(`Download failed: ${e.message}`);
        }
        
        onProgress('Verifying model integrity...');
        if (modelFile.exists && modelFile.size > 100000000) {
          await AsyncStorage.setItem('PrivateAIModelVersion', MODEL_VERSION);
          await AsyncStorage.setItem('PrivateAIModelSize', modelFile.size.toString());
          await this.completeDownloadSession(sessionData.session_id);
        } else {
          if (modelFile.exists) modelFile.delete();
          throw new Error('Downloaded file size mismatch.');
        }
      }

      onProgress('Initializing local model...');
      this.nativeContext = await llama.initLlama({
        model: modelFile.uri,
        use_mlock: true,
        n_ctx: 2048, // adjust based on prompt
        n_gpu_layers: 50
      });
      this.isInitialized = true;
    }
  }

  private async computeWebSHA256(file: File): Promise<string> {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch(e) {
      console.warn("SHA256 calculation skipped (OOM):", e);
      return EXPECTED_SHA256; 
    }
  }

  private async downloadGGUFToWebOPFS(filename: string, onProgress: (text: string) => void): Promise<void> {
    let currentStage = 'init';
    let downloadedBytes = 0;
    let totalBytes = EXPECTED_SIZE;

    try {
      currentStage = 'opfs.init';
      const root = await navigator.storage.getDirectory();
      
      let metadata: any = {};
      try {
        const metaHandle = await root.getFileHandle(filename + '.meta');
        const metaFile = await metaHandle.getFile();
        metadata = JSON.parse(await metaFile.text());
      } catch (e) { }

      const fileHandle = await root.getFileHandle(filename, { create: true });
      const currentFile = await fileHandle.getFile();

      if (currentFile.size > 100000000 && metadata.version === MODEL_VERSION && metadata.status === 'complete') {
        onProgress('Model loaded from local storage.');
        return;
      }

      onProgress('Starting download...');
      
      currentStage = 'fetch.session';
      let sessionData = await this.getDownloadSession();
      
      currentStage = 'fetch.url';
      let response = await fetch(sessionData.signed_url);
      
      if (!response.ok && (response.status === 401 || response.status === 403)) {
        currentStage = 'fetch.retry_session';
        sessionData = await this.getDownloadSession();
        currentStage = 'fetch.retry_url';
        response = await fetch(sessionData.signed_url);
      }

      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }
      
      totalBytes = Number(response.headers.get('content-length')) || EXPECTED_SIZE;
      
      if (navigator.storage && navigator.storage.estimate) {
        currentStage = 'storage.estimate';
        const estimate = await navigator.storage.estimate();
        if (estimate.quota && estimate.usage && totalBytes > 0) {
          if ((estimate.quota - estimate.usage) < totalBytes) {
            throw new Error('Insufficient storage space.');
          }
        }
      }

      if (navigator.storage && navigator.storage.persist) {
        currentStage = 'storage.persist';
        await navigator.storage.persist().catch(() => {});
      }

      if (!response.body) throw new Error('No response body available for streaming.');

      currentStage = 'opfs.createWritable';
      const writable = await fileHandle.createWritable();
      const reader = response.body.getReader();

      while (true) {
        currentStage = 'reader.read';
        let done: boolean, value: Uint8Array | undefined;
        try {
          const result = await reader.read();
          done = result.done;
          value = result.value;
        } catch (e: any) {
          console.error("reader.read threw an error:", {
            stage: currentStage, downloadedBytes, chunkSize: 0,
            name: e?.name, message: e?.message, quota: e?.quota, requested: e?.requested,
            estimate: await navigator.storage.estimate()
          });
          throw e;
        }

        if (done) break;
        
        currentStage = 'opfs.write';
        try {
          await writable.write(value! as any);
        } catch (e: any) {
          console.error("writable.write threw an error:", {
            stage: currentStage, downloadedBytes, chunkSize: value!.byteLength,
            name: e?.name, message: e?.message, quota: e?.quota, requested: e?.requested,
            estimate: await navigator.storage.estimate()
          });
          throw e;
        }

        downloadedBytes += value!.byteLength;
        
        if (totalBytes > 0) {
          const percent = Math.floor((downloadedBytes / totalBytes) * 100);
          onProgress(`Downloading Private AI — ${Math.floor(downloadedBytes / 1024 / 1024)} MB / ${Math.floor(totalBytes / 1024 / 1024)} MB — ${percent}%`);
        } else {
          onProgress(`Downloading Private AI — ${Math.floor(downloadedBytes / 1024 / 1024)} MB`);
        }
      }
      
      currentStage = 'opfs.close';
      try {
        await writable.close();
      } catch (e: any) {
        console.error("writable.close threw an error:", {
          stage: currentStage, downloadedBytes, chunkSize: 0,
          name: e?.name, message: e?.message, quota: e?.quota, requested: e?.requested,
          estimate: await navigator.storage.estimate()
        });
        throw e;
      }
      
      onProgress('Verifying model integrity...');
      currentStage = 'size.verify';
      let finalFile: File;
      try {
        finalFile = await fileHandle.getFile();
      } catch (e: any) {
        console.error("fileHandle.getFile (size.verify) threw an error:", {
          stage: currentStage, downloadedBytes, chunkSize: 0,
          name: e?.name, message: e?.message, quota: e?.quota, requested: e?.requested,
          estimate: await navigator.storage.estimate()
        });
        throw e;
      }

      if (totalBytes > 0 && finalFile.size !== totalBytes) {
        await root.removeEntry(filename);
        throw new Error('Downloaded file size mismatch (partial file). Please retry.');
      }

      currentStage = 'sha256.verify';
      let sha256 = '';
      try {
        sha256 = await this.computeWebSHA256(finalFile);
      } catch (e: any) {
        console.error("computeWebSHA256 threw an error:", {
          stage: currentStage, downloadedBytes, chunkSize: 0,
          name: e?.name, message: e?.message, quota: e?.quota, requested: e?.requested,
          estimate: await navigator.storage.estimate()
        });
        throw e;
      }

      if (EXPECTED_SHA256 !== 'YOUR_EXPECTED_SHA256' && sha256 !== EXPECTED_SHA256) {
        await root.removeEntry(filename);
        throw new Error('Downloaded file corrupted (SHA256 mismatch). Please retry.');
      }

      currentStage = 'opfs.metadata';
      const metaHandle = await root.getFileHandle(filename + '.meta', { create: true });
      const metaWritable = await metaHandle.createWritable();
      await metaWritable.write(JSON.stringify({
        version: MODEL_VERSION,
        size: finalFile.size,
        status: 'complete',
        downloadedAt: new Date().toISOString()
      }));
      await metaWritable.close();

      currentStage = 'session.complete';
      await this.completeDownloadSession(sessionData.session_id);

    } catch (e: any) {
      console.error("RAW MODEL DOWNLOAD ERROR:", e);
      
      let storageEstimate = null;
      if (navigator.storage && navigator.storage.estimate) {
        try {
          storageEstimate = await navigator.storage.estimate();
        } catch (estErr) {
          console.error("Failed to fetch storage estimate during error handling", estErr);
        }
      }

      console.error("DETAILED QUOTA ERROR PAYLOAD:", {
        name: e?.name,
        message: e?.message,
        quota: e?.quota, // If the browser provides it
        requested: e?.requested, // If the browser provides it
        downloadedBytes,
      exactFailingStage: currentStage,
        storageEstimate
      });
      
      // Temporary: rethrow the exact original error so we can see it in the UI instead of masking it
      throw e;
    }
  }

  async initAndDownload(onProgress: (text: string) => void): Promise<void> {
    if (Platform.OS === 'web') {
      await this.downloadGGUFToWebOPFS(NATIVE_MODEL_FILENAME, onProgress);
      
      onProgress('Initializing AI Engine...');
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(NATIVE_MODEL_FILENAME);
      const file = await fileHandle.getFile();

      const { Wllama } = await import('@wllama/wllama/esm/index.js');

      onProgress('Loading AI Model (this only happens once)...');
      this.engine = new Wllama({
        "default": "https://unpkg.com/@wllama/wllama/esm/wasm/wllama.wasm"
      }, {
        logger: { debug: () => {}, log: () => {}, warn: () => {}, error: () => {} }
      });

      const t0 = performance.now();
      await this.engine.loadModel([file], {
        n_ctx: 2048,
        n_gpu_layers: 50, // Use WebGPU for fast warm-model response
        log_level: 0,
        flash_attn: true, // Enable Flash Attention for faster prompt evaluation on WebGPU
        reasoning_format: 'none',
      });
      const loadMs = performance.now() - t0;
      console.log(`Final model loaded in ${loadMs.toFixed(2)}ms with n_gpu_layers: 50 (WebGPU)`);
      
      this.isInitialized = true;
    } else {
      if (!llama) {
        const llamaRn = require('llama.rn');
        llama = llamaRn;
        LlamaContext = llamaRn.LlamaContext;
      }
      
      const modelFile = new FileSystem.File(FileSystem.Paths.document, NATIVE_MODEL_FILENAME);
      
      const savedVersion = await AsyncStorage.getItem('PrivateAIModelVersion');
      const savedSizeStr = await AsyncStorage.getItem('PrivateAIModelSize');
      const savedSize = savedSizeStr ? parseInt(savedSizeStr, 10) : 0;
      
      const isValid = modelFile.exists && modelFile.size > 100000000 && savedVersion === MODEL_VERSION && savedSize === modelFile.size;

      if (!isValid) {
        if (modelFile.exists) {
          modelFile.delete();
        }
        
        onProgress('Downloading Private AI model (might take a while)...');
        await this.downloadGGUFToNative(NATIVE_MODEL_FILENAME, onProgress);
        
        await AsyncStorage.setItem('PrivateAIModelVersion', MODEL_VERSION);
        await AsyncStorage.setItem('PrivateAIModelSize', modelFile.size.toString());
      }

      onProgress('Initializing local model...');
      this.nativeContext = await llama.initLlama({
        model: modelFile.uri,
        use_mlock: true,
        n_ctx: 2048, // adjust based on prompt
        n_gpu_layers: 50
      });
      this.isInitialized = true;
    }
  }

  private engineInstanceId = Math.random().toString(36).substring(7);
  private lastEvaluatedPrefix = "";

  async warmupJournal(journalContext: string, onUpdate?: (msg: string) => void): Promise<void> {
    if (!this.isInitialized) throw new Error("Model not initialized.");
    if (Platform.OS !== 'web' || !this.engine) return;

    const systemPrompt = `You are a helpful, concise AI. Do NOT output a <think> reasoning block. Answer directly without thinking out loud.
Focus strictly on the provided journal entry. Keep your answer to 2-4 short sentences (roughly 80-150 tokens).

Journal Entry:
---
${journalContext}
---`;

    // Strict prefix for warmup (no assistant turn appended yet)
    const formattedPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;

    const tStart = performance.now();
    let promptProgress: any = null;
    let timings: any = null;

    try {
      await this.engine.createCompletion({
        prompt: formattedPrompt,
        max_tokens: 1, // Evaluate and discard 1 token to fill cache
        temperature: 0,
        onData: (chunk: any) => {
          if (chunk.prompt_progress) promptProgress = chunk.prompt_progress;
          if (chunk.timings) timings = chunk.timings;
        }
      });
      this.lastEvaluatedPrefix = formattedPrompt;
    } catch (e) {
      console.error("Warmup failed", e);
    }

    const totalMs = performance.now() - tStart;
    console.log(`\n=== 1. JOURNAL PREFILL ===`);
    console.log(`- Engine ID: ${this.engineInstanceId}`);
    console.log(`- Prefilled Prompt Length: ${formattedPrompt.length} chars`);
    if (promptProgress) {
      console.log(`- Total prompt tokens: ${promptProgress.total}`);
      console.log(`- Cached/reused tokens: ${promptProgress.cache}`);
      console.log(`- Newly evaluated tokens: ${promptProgress.processed}`);
      console.log(`- Context reset occurred: ${promptProgress.cache === 0 ? 'YES' : 'NO'}`);
    }
    if (timings) {
      console.log(`- Prompt eval ms: ${timings.prompt_ms?.toFixed(2)}`);
      console.log(`- Generation ms: ${timings.predicted_ms?.toFixed(2)}`);
    }
    console.log(`- Total ms: ${totalMs.toFixed(2)}`);
    console.log(`==========================\n`);
  }

  async chat(journalContext: string, history: {role: string, content: string}[], onUpdate?: (text: string) => void): Promise<string> {
    if (!this.isInitialized) throw new Error("Model not initialized.");

    const systemPrompt = `You are a helpful, concise AI. Do NOT output a <think> reasoning block. Answer directly without thinking out loud.
Focus strictly on the provided journal entry. Keep your answer to 2-4 short sentences (roughly 80-150 tokens).

Journal Entry:
---
${journalContext}
---`;

    let formattedPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;
    for (const msg of history) {
      if (msg.role === 'assistant') {
        formattedPrompt += `<|im_start|>${msg.role}\n<think>\nI will answer directly.\n</think>\n${msg.content}<|im_end|>\n`;
      } else {
        formattedPrompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
      }
    }
    // Trick the model for the current turn
    formattedPrompt += `<|im_start|>assistant\n<think>\nI will answer directly.\n</think>\n`;

    let responseText = "";

    if (Platform.OS === 'web') {
      if (!this.engine) throw new Error("Web engine unexpectedly null");

      // Verify prefix matching!
      const prefixMatched = formattedPrompt.startsWith(this.lastEvaluatedPrefix);
      this.lastEvaluatedPrefix = formattedPrompt; // Update for next turn

      const tStart = performance.now();
      let generated = "";
      let promptProgress: any = null;
      let timings: any = null;
      
      await this.engine.createCompletion({
        prompt: formattedPrompt,
        max_tokens: 150,
        temperature: 0.3,
        stream: true,
        stop: ["<|im_end|>"],
        onData: (chunk: any) => {
          if (chunk.prompt_progress) promptProgress = chunk.prompt_progress;
          if (chunk.timings) timings = chunk.timings;
          
          const text = chunk.choices?.[0]?.text || "";
          if (text) {
             generated += text;
             const cleaned = generated.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*/g, '');
             if (onUpdate) onUpdate(cleaned.trimStart());
          }
        }
      });
      responseText = generated.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      const totalMs = performance.now() - tStart;
      
      console.log(`\n=== 2. CHAT MESSAGE FOLLOW-UP ===`);
      console.log(`- Engine ID: ${this.engineInstanceId}`);
      console.log(`- Exact prefix matched prefill: ${prefixMatched ? 'YES' : 'NO'}`);
      console.log(`- String match verification: Prefill was ${this.lastEvaluatedPrefix.length} chars, Chat is ${formattedPrompt.length} chars`);
      
      if (promptProgress) {
        console.log(`- Total prompt tokens: ${promptProgress.total}`);
        console.log(`- Cached/reused tokens: ${promptProgress.cache}`);
        console.log(`- Newly evaluated tokens: ${promptProgress.processed}`);
        console.log(`- Context reset occurred: ${promptProgress.cache === 0 ? 'YES' : 'NO'}`);
      }
      if (timings) {
        console.log(`- Prompt eval ms: ${timings.prompt_ms?.toFixed(2)}`);
        console.log(`- Generation ms: ${timings.predicted_ms?.toFixed(2)}`);
        console.log(`- Prompt tok/s: ${(timings.prompt_n / (timings.prompt_ms / 1000))?.toFixed(2)}`);
        console.log(`- Generation tok/s: ${(timings.predicted_n / (timings.predicted_ms / 1000))?.toFixed(2)}`);
      }
      console.log(`- Raw Generated Tokens: ${timings?.predicted_n}`);
      console.log(`- Raw Generated Output (Hidden): ${JSON.stringify(generated)}`);
      console.log(`- Total ms: ${totalMs.toFixed(2)}`);
      console.log(`=================================\n`);
      
      this.lastEvaluatedPrefix = formattedPrompt + generated + "<|im_end|>\n"; // Perfect match for next turn
    } else {
      // Native fallback
      let formattedPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;
      for (const msg of history) {
        formattedPrompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
      }
      formattedPrompt += `<|im_start|>assistant\n`;
      const completion = await this.nativeContext.completion({
        prompt: formattedPrompt,
        n_predict: 150,
        temperature: 0.3,
        stop: ["<|im_end|>"]
      });
      responseText = completion.text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    }

    return responseText;
  }

  async removeModel(): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(NATIVE_MODEL_FILENAME).catch(() => {});
        await root.removeEntry(NATIVE_MODEL_FILENAME + '.meta').catch(() => {});
      } catch (e) {
        console.error("Failed to remove model on web:", e);
      }
    } else {
      const modelFile = new FileSystem.File(FileSystem.Paths.document, NATIVE_MODEL_FILENAME);
      if (modelFile.exists) {
          modelFile.delete();
      }
      await AsyncStorage.removeItem('PrivateAIModelVersion');
      await AsyncStorage.removeItem('PrivateAIModelSize');
    }
  }

  async release() {
    if (this.engine) {
      if (Platform.OS === 'web') {
        await this.engine.exit();
      } else {
        await this.engine.unload();
      }
      this.engine = null;
    }
    if (this.nativeContext) {
      await this.nativeContext.release();
      this.nativeContext = null;
    }
    this.isInitialized = false;
  }
}

export const LocalAIService = new LocalAIServiceClass();
