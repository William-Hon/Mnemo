import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable, Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';

export default function AboutScreen() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const iconGlowStyle = Platform.select({
    web: {
      filter: 'drop-shadow(0px 0px 12px rgba(59, 130, 246, 1))',
    },
    default: {
      shadowColor: '#3b82f6',
      shadowOpacity: 1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
    },
  }) as any;

  return (
    <View 
      className="flex-1 bg-black"
      style={Platform.OS === 'web' ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as any : {}}
    >
      <ScrollView 
        className="flex-1 h-full"
        contentContainerStyle={{ paddingTop: 40, paddingHorizontal: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={true}
      >
        <Text className="text-center text-gray-400 text-base font-medium leading-relaxed mb-8 px-4">
          MNEMO is a privacy-first personal memory system built to capture, search, and reason over years of thoughts without requiring users to hand their entire journal history to a third-party AI provider.
        </Text>
        
        {/* 1. Privacy-First Architecture */}
        <Pressable 
          onPress={() => toggleSection('privacy')}
          style={Platform.OS === 'web' ? { boxShadow: '0 0 25px rgba(59, 130, 246, 0.6)' } as any : { shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20, elevation: 8 }}
          className="mb-4 bg-transparent rounded-sm p-5 border border-blue-500"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-4 flex-1 pr-2">
              <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' } as any} tintColor="#3b82f6" size={24} style={iconGlowStyle} />
              <Text className="text-lg font-bold text-white flex-1 flex-wrap">Privacy-First Architecture</Text>
            </View>
            <SymbolView name={{ ios: expandedSection === 'privacy' ? 'chevron.up' : 'chevron.down', android: expandedSection === 'privacy' ? 'expand_less' : 'expand_more', web: expandedSection === 'privacy' ? 'expand_less' : 'expand_more' } as any} tintColor="#9ca3af" size={24} />
          </View>
          
          {expandedSection === 'privacy' && (
            <View className="mt-5 pt-5 border-t border-gray-800">
              <Text className="text-gray-400 leading-relaxed text-base mb-4">
                MNEMO encrypts journal entries before they are permanently stored.
              </Text>
              <View className="flex-col gap-3 pl-1">
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold text-gray-300">AES-256-GCM Encryption:</Text> Journal text is encrypted before database storage.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold text-gray-300">Device-Generated Keys:</Text> Each user receives a randomly generated Master Encryption Key (MEK).
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold text-gray-300">Protected Keys:</Text> A user passphrase derives a separate Key Encryption Key (KEK) using PBKDF2, which protects the MEK.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold text-gray-300">Encrypted Storage:</Text> Supabase/PostgreSQL stores encrypted journal text rather than readable entries.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold text-gray-300">Temporary Processing:</Text> Cloud features can briefly decrypt only the required data in memory for operations such as embedding generation, without permanently storing the plaintext.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold text-gray-300">Private AI:</Text> LLM inference can run locally, keeping retrieved journal context on the user's device.
                  </Text>
                </View>
              </View>
              <Text className="text-gray-500 leading-relaxed text-sm mt-4 italic">
                The architecture is designed around minimizing when and where readable personal data exists.
              </Text>
            </View>
          )}
        </Pressable>

        {/* 2. Memory Storage & Hybrid RAG Retrieval */}
        <Pressable 
          onPress={() => toggleSection('rag')}
          style={Platform.OS === 'web' ? { boxShadow: '0 0 25px rgba(59, 130, 246, 0.6)' } as any : { shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20, elevation: 8 }}
          className="mb-4 bg-transparent rounded-sm p-5 border border-blue-500"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-4 flex-1 pr-2">
              <SymbolView name={{ ios: 'brain.head.profile', android: 'psychology', web: 'psychology' } as any} tintColor="#3b82f6" size={24} style={iconGlowStyle} />
              <Text className="text-lg font-bold text-white flex-1 flex-wrap">Memory Storage & Hybrid RAG</Text>
            </View>
            <SymbolView name={{ ios: expandedSection === 'rag' ? 'chevron.up' : 'chevron.down', android: expandedSection === 'rag' ? 'expand_less' : 'expand_more', web: expandedSection === 'rag' ? 'expand_less' : 'expand_more' } as any} tintColor="#9ca3af" size={24} />
          </View>
          
          {expandedSection === 'rag' && (
            <View className="mt-5 pt-5 border-t border-gray-800">
              <Text className="text-gray-400 leading-relaxed text-base mb-4">
                MNEMO turns years of unstructured entries into a searchable personal knowledge base using a custom Retrieval-Augmented Generation (RAG) pipeline.
              </Text>
              <View className="flex-col gap-3 pl-1">
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    Entries are stored as full memories and searchable chunks.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    An <Text className="font-bold text-gray-300">embedding model</Text> converts their meaning into vectors stored with <Text className="font-bold text-gray-300">PostgreSQL + pgvector</Text>.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    Semantic vector search retrieves memories based on meaning rather than exact wording.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    The device performs an additional local keyword search over decrypted results.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold text-gray-300">Reciprocal Rank Fusion (RRF)</Text> combines semantic and keyword rankings for stronger retrieval.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    Relevant memories are dynamically provided to the LLM instead of repeatedly loading the user's entire journal.
                  </Text>
                </View>
              </View>
              <Text className="text-gray-500 leading-relaxed text-sm mt-4 italic">
                This lets a user search something like "times I felt unsure about a major decision" and recover related memories even if those exact words were never written.
              </Text>
            </View>
          )}
        </Pressable>

        {/* 3. Private Local LLM */}
        <Pressable 
          onPress={() => toggleSection('llm')}
          style={Platform.OS === 'web' ? { boxShadow: '0 0 25px rgba(59, 130, 246, 0.6)' } as any : { shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20, elevation: 8 }}
          className="mb-4 bg-transparent rounded-sm p-5 border border-blue-500"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-4 flex-1 pr-2">
              <SymbolView name={{ ios: 'cpu', android: 'memory', web: 'memory' } as any} tintColor="#3b82f6" size={24} style={iconGlowStyle} />
              <Text className="text-lg font-bold text-white flex-1 flex-wrap">Private Local LLM</Text>
            </View>
            <SymbolView name={{ ios: expandedSection === 'llm' ? 'chevron.up' : 'chevron.down', android: expandedSection === 'llm' ? 'expand_less' : 'expand_more', web: expandedSection === 'llm' ? 'expand_less' : 'expand_more' } as any} tintColor="#9ca3af" size={24} />
          </View>
          
          {expandedSection === 'llm' && (
            <View className="mt-5 pt-5 border-t border-gray-800">
              <Text className="text-gray-400 leading-relaxed text-base mb-4">
                MNEMO integrates a quantized Qwen3 0.6B Large Language Model directly on the user's device.
              </Text>
              <View className="flex-col gap-3 pl-1">
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold text-gray-300">Local Inference:</Text> Retrieved memories can be analyzed without sending them to ChatGPT, Claude, or another cloud LLM.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold text-gray-300">WebGPU Acceleration:</Text> Supported devices use local GPU hardware to accelerate inference.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold text-gray-300">Model Delivery APIs:</Text> Dedicated APIs handle downloading and managing model artifacts from cloud/CDN infrastructure.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold text-gray-300">Persistent Model Caching:</Text> The model is downloaded once and reused between sessions.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold text-gray-300">Model Preloading:</Text> Initialization begins before the user starts a conversation to reduce first-response latency.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold text-gray-300">KV-Cache Reuse:</Text> Previously processed context remains cached so the LLM does not repeatedly recompute the same journal information.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold text-gray-300">Prompt Engineering:</Text> Structured prompts combine retrieved memories with user questions while keeping the model grounded in actual journal data.
                  </Text>
                </View>
              </View>
              <Text className="text-gray-500 leading-relaxed text-sm mt-4 italic">
                The result combines LLMs, RAG, local inference, caching, and cloud model delivery while keeping the most sensitive AI processing on the user's hardware.
              </Text>
            </View>
          )}
        </Pressable>

        {/* 4. Voice-to-Memory Pipeline */}
        <Pressable 
          onPress={() => toggleSection('voice')}
          style={Platform.OS === 'web' ? { boxShadow: '0 0 25px rgba(59, 130, 246, 0.6)' } as any : { shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20, elevation: 8 }}
          className="mb-12 bg-transparent rounded-sm p-5 border border-blue-500"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-4 flex-1 pr-2">
              <SymbolView name={{ ios: 'waveform', android: 'graphic_eq', web: 'graphic_eq' } as any} tintColor="#3b82f6" size={24} style={iconGlowStyle} />
              <Text className="text-lg font-bold text-white flex-1 flex-wrap">Voice-to-Memory Pipeline</Text>
            </View>
            <SymbolView name={{ ios: expandedSection === 'voice' ? 'chevron.up' : 'chevron.down', android: expandedSection === 'voice' ? 'expand_less' : 'expand_more', web: expandedSection === 'voice' ? 'expand_less' : 'expand_more' } as any} tintColor="#9ca3af" size={24} />
          </View>
          
          {expandedSection === 'voice' && (
            <View className="mt-5 pt-5 border-t border-gray-800">
              <Text className="text-gray-400 leading-relaxed text-base mb-4">
                Voice entries automatically become part of the same encrypted and searchable memory system.
              </Text>
              <View className="flex-col gap-3 pl-1">
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    Audio is uploaded through authenticated <Text className="font-bold text-gray-300">APIs</Text> to private storage.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold text-gray-300">Groq Whisper</Text> performs speech-to-text transcription.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    The transcript is encrypted before permanent database storage.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    Transcribed entries automatically enter the same embedding and <Text className="font-bold text-gray-300">RAG retrieval pipeline</Text> as typed entries.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-400 leading-relaxed text-base flex-1">
                    Original audio remains available for playback and is removed when its associated entry is deleted.
                  </Text>
                </View>
              </View>
              <Text className="text-gray-500 leading-relaxed text-sm mt-4 italic">
                Whether a thought is typed or spoken, MNEMO turns it into one private, searchable memory bank.
              </Text>
            </View>
          )}
        </Pressable>

        <View className="h-10" />
      </ScrollView>
    </View>
  );
}
