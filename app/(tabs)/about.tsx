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
    <View className="flex-1 h-full bg-gray-50 dark:bg-black">
      <ScrollView 
        className="flex-1 h-full"
        contentContainerStyle={{ paddingTop: 40, paddingHorizontal: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={true}
      >
        <Text className="text-center text-gray-500 dark:text-gray-400 text-base font-medium leading-relaxed mb-8 px-4">
          MNEMO uses Zero-Knowledge cryptography and Edge AI to guarantee your memories belong exclusively to you.
        </Text>
        
        {/* 1. E2EE */}
        <Pressable 
          onPress={() => toggleSection('e2ee')}
          className="mb-4 bg-white dark:bg-gray-900 rounded-sm p-5 shadow-sm border border-gray-100 dark:border-gray-800"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-4">
              <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' } as any} tintColor="#3b82f6" size={24} style={iconGlowStyle} />
              <Text className="text-lg font-bold dark:text-white">Encrypted at Rest</Text>
            </View>
            <SymbolView name={{ ios: expandedSection === 'e2ee' ? 'chevron.up' : 'chevron.down', android: expandedSection === 'e2ee' ? 'expand_less' : 'expand_more', web: expandedSection === 'e2ee' ? 'expand_less' : 'expand_more' } as any} tintColor="#9ca3af" size={24} />
          </View>
          
          {expandedSection === 'e2ee' && (
            <View className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800">
              <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base mb-4">
                Your journal entries are encrypted on your device before being stored in MNEMO's database.
              </Text>
              <View className="flex-col gap-3 pl-1">
                <View className="flex-row">
                  <Text className="text-gray-400 dark:text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold dark:text-gray-300">AES-GCM Encryption:</Text> Journal entries are encrypted before database storage.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-400 dark:text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold dark:text-gray-300">Local Key Generation:</Text> Your Master Encryption Key is randomly generated on your device. Your passphrase is used with PBKDF2 to derive a separate Key Encryption Key that protects the master key.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-400 dark:text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold dark:text-gray-300">Temporary AI Processing:</Text> Some AI features temporarily send your encryption key to isolated backend infrastructure, where entries may be decrypted in memory for processing. The key is not intentionally stored permanently.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-400 dark:text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold dark:text-gray-300">Secure Database Storage:</Text> The primary database stores encrypted journal text, so a database-only compromise would not directly reveal the contents of your entries.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-400 dark:text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold dark:text-gray-300">Search Privacy:</Text> Search embeddings and plaintext search queries may be visible to backend infrastructure and can reveal some semantic information about your entries.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Pressable>

        {/* 2. Voice & Storage */}
        <Pressable 
          onPress={() => toggleSection('voice')}
          className="mb-4 bg-white dark:bg-gray-900 rounded-sm p-5 shadow-sm border border-gray-100 dark:border-gray-800"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-4">
              <SymbolView name={{ ios: 'waveform', android: 'graphic_eq', web: 'graphic_eq' } as any} tintColor="#3b82f6" size={24} style={iconGlowStyle} />
              <Text className="text-lg font-bold dark:text-white">Voice Storage</Text>
            </View>
            <SymbolView name={{ ios: expandedSection === 'voice' ? 'chevron.up' : 'chevron.down', android: expandedSection === 'voice' ? 'expand_less' : 'expand_more', web: expandedSection === 'voice' ? 'expand_less' : 'expand_more' } as any} tintColor="#9ca3af" size={24} />
          </View>
          
          {expandedSection === 'voice' && (
            <View className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800">
              <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base mb-4">
                Voice recordings are securely processed to generate transcriptions. Here is the lifecycle of your audio:
              </Text>
              <View className="flex-col gap-3 pl-1">
                <View className="flex-row">
                  <Text className="text-gray-400 dark:text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold dark:text-gray-300">Private Bucket:</Text> Raw audio is uploaded directly to a private, authenticated cloud storage bucket.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-400 dark:text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold dark:text-gray-300">Groq Whisper API:</Text> The audio is sent via an encrypted connection to Groq for high-speed transcription.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-400 dark:text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold dark:text-gray-300">Encrypted Transcripts:</Text> The resulting text is encrypted using your ephemerally transmitted key before database storage.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-400 dark:text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold dark:text-gray-300">Data Deletion:</Text> The raw audio remains securely stored for playback, but is permanently wiped when you delete the entry.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Pressable>

        {/* 3. Search */}
        <Pressable 
          onPress={() => toggleSection('rag')}
          className="mb-12 bg-white dark:bg-gray-900 rounded-sm p-5 shadow-sm border border-gray-100 dark:border-gray-800"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-4">
              <SymbolView name={{ ios: 'brain.head.profile', android: 'psychology', web: 'psychology' } as any} tintColor="#3b82f6" size={24} style={iconGlowStyle} />
              <Text className="text-lg font-bold dark:text-white">Hybrid RAG Pipeline</Text>
            </View>
            <SymbolView name={{ ios: expandedSection === 'rag' ? 'chevron.up' : 'chevron.down', android: expandedSection === 'rag' ? 'expand_less' : 'expand_more', web: expandedSection === 'rag' ? 'expand_less' : 'expand_more' } as any} tintColor="#9ca3af" size={24} />
          </View>
          
          {expandedSection === 'rag' && (
            <View className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800">
              <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base mb-4">
                MNEMO uses a powerful Hybrid RAG (Retrieval-Augmented Generation) architecture combining cloud AI with local processing:
              </Text>
              <View className="flex-col gap-3 pl-1">
                <View className="flex-row">
                  <Text className="text-gray-400 dark:text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold dark:text-gray-300">In-Use Decryption:</Text> To power AI, your entries are briefly decrypted in isolated Edge infrastructure using your ephemerally transmitted key.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-400 dark:text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold dark:text-gray-300">Vector Generation:</Text> An embedding vector (representing abstract meaning) is generated and securely stored in a vector database before the memory is purged.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-400 dark:text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold dark:text-gray-300">Semantic Recall:</Text> When you search, the Edge finds the top conceptual matches and securely beams them back to your device for local decryption.
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="text-gray-400 dark:text-gray-500 mr-3 text-lg leading-6">•</Text>
                  <Text className="text-gray-600 dark:text-gray-400 leading-relaxed text-base flex-1">
                    <Text className="font-bold dark:text-gray-300">Hybrid Fusion (RRF):</Text> Your device runs a local keyword pass on the decrypted text and uses Reciprocal Rank Fusion (RRF) to merge the semantic and keyword results.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Pressable>

        <View className="h-10" />
      </ScrollView>
    </View>
  );
}
