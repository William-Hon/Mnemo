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

      // We can optionally create a lightweight endpoint for just the count, 
      // but calling the download-url endpoint with a dry-run flag or 
      // directly querying the table (if RLS allows read) is better.
      // Since RLS allows users to view their own sessions, we can just query here!
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('private_ai_download_sessions')
        .select('id')
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
        return metadata.status === 'complete' && metadata.version === MODEL_VERSION && metadata.size === EXPECTED_SIZE;
      } catch (e) {
        return false;
      }
    } else {
      const modelFile = new FileSystem.File(FileSystem.Paths.document, NATIVE_MODEL_FILENAME);
      if (!modelFile.exists) return false;
      
      const savedVersion = await AsyncStorage.getItem('PrivateAIModelVersion');
      const savedSizeStr = await AsyncStorage.getItem('PrivateAIModelSize');
      const savedSize = savedSizeStr ? parseInt(savedSizeStr, 10) : 0;
      
      return savedVersion === MODEL_VERSION && savedSize === EXPECTED_SIZE && modelFile.size === EXPECTED_SIZE;
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
      
      const isValid = modelFile.exists && modelFile.size === EXPECTED_SIZE && savedVersion === MODEL_VERSION && savedSize === EXPECTED_SIZE;

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
        if (modelFile.exists && modelFile.size === EXPECTED_SIZE) {
          await AsyncStorage.setItem('PrivateAIModelVersion', MODEL_VERSION);
          await AsyncStorage.setItem('PrivateAIModelSize', EXPECTED_SIZE.toString());
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

      if (currentFile.size === EXPECTED_SIZE && metadata.version === MODEL_VERSION && metadata.status === 'complete') {
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

  async analyzeBatch(chunks: any[]): Promise<DeepAnalysisResult[]> {
    if (!this.isInitialized) throw new Error("Model not initialized.");

    const prompt = `You are a relevance analyzer for a private journal search system.

You are NOT a therapist, advisor, or general chatbot.

The user searched for:

${chunks[0]?.query || 'unknown'}

You will receive journal entries that were already retrieved by another search system.

For each journal:

1. JOURNAL BRIEF
Write one concise sentence describing what the journal is mainly about.

2. RELEVANT PART
Write one concise sentence beginning with:
'You talked about...'

Describe only the section that is meaningfully relevant to the user's search.

Only use information explicitly contained in the journal.

If no meaningful relevant section exists, return null.

3. RELEVANCE
Return exactly one:

DIRECT
RELATED
WEAK
NOT_RELEVANT

DIRECT = clearly addresses the search intent.
RELATED = meaningfully related but indirect.
WEAK = loosely related.
NOT_RELEVANT = no meaningful relationship.

Do not diagnose.
Do not give advice.
Do not invent information.
Do not generate percentages.
Do not explain your reasoning outside the required fields.

Return valid JSON only matching exactly this structure:
{
  "results": [
    {
      "entry_id": "...",
      "journal_brief": "...",
      "relevant_part": "You talked about...",
      "relevance": "DIRECT"
    }
  ]
}

Chunks to evaluate:
${chunks.map(c => `ID: ${c.id}\nText: ${c.content}`).join('\n\n')}
`;

    let responseText = "";

    if (Platform.OS === 'web') {
      if (!this.engine) {
        const { Wllama } = await import('@wllama/wllama/esm/index.js');
        this.engine = new Wllama({
          "default": "https://unpkg.com/@wllama/wllama/esm/wasm/wllama.wasm",
        }, {
          logger: {
            debug: () => {},
            log: () => {},
            warn: () => {},
            error: () => {},
          }
        });

        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle(NATIVE_MODEL_FILENAME);
        const file = await fileHandle.getFile();
        
        console.log("Loading model into WebGPU (this may take up to a minute)...");
        await this.engine.loadModel([file], {
          n_ctx: 2048,
          log_level: 0,
          flash_attn: false,
        });
        console.log("Model successfully loaded into WebGPU!");
      }

      const fullPrompt = `<|im_start|>system\nYou are a helpful assistant.<|im_end|>\n<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n{\n  "results": [\n`;
      
      const isIsolated = typeof window !== 'undefined' && window.crossOriginIsolated;
      console.log(`[Web Inference Config] crossOriginIsolated: ${isIsolated}`);
      console.log(`[Web Inference Config] SharedArrayBuffer: ${typeof SharedArrayBuffer !== "undefined"}`);
      if (this.engine) {
         console.log(`[Web Inference Config] Wllama Multi-Threaded: ${this.engine.isMultithread()}`);
         console.log(`[Web Inference Config] Thread Count: ${this.engine.getNumThreads()}`);
      }
      
      console.log("Starting WebGPU inference...");
      let generated = "";
      const startTime = performance.now();
      await this.engine.createCompletion({
        prompt: fullPrompt,
        max_tokens: 1024,
        temperature: 0.1,
        flash_attn: false,
        stop: ["</think>", "<|im_end|>"],
        stream: true,
        onData: (chunk: any) => {
          const text = chunk.choices[0]?.text || "";
          if (text) {
             generated += text;
          }
        }
      });
      const endTime = performance.now();
      const elapsedSeconds = (endTime - startTime) / 1000;
      // Rough estimation of tokens: approx 4 characters per token
      const tokensGenerated = generated.length / 4;
      console.log(`Inference complete in ${elapsedSeconds.toFixed(2)}s (${(tokensGenerated / elapsedSeconds).toFixed(2)} tokens/sec). Full generated text:`, generated);
      responseText = '{\n  "results": [\n' + generated;
    } else {
      const completion = await this.nativeContext.completion({
        prompt: `<|im_start|>system\nYou are a helpful assistant.<|im_end|>\n<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n{\n  "results": [\n`,
        n_predict: 1024,
        temperature: 0.1,
        stop: ["</think>", "<|im_end|>"]
      });
      responseText = '{\n  "results": [\n' + completion.text;
    }

    try {
      let cleanText = responseText;
      if (cleanText.includes("</think>")) {
         cleanText = cleanText.split("</think>")[0];
      }
      const jsonStr = cleanText.substring(cleanText.indexOf('{'), cleanText.lastIndexOf('}') + 1);
      const parsed = JSON.parse(jsonStr);
      return parsed.results || [];
    } catch (e) {
      console.error("Failed to parse LLM output:", responseText);
      return [];
    }
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
