import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';

interface WhatsNextModalProps {
  visible: boolean;
  onClose: () => void;
}

interface RoadmapItem {
  id: string;
  icon: { ios: string; android: string; web: string };
  title: string;
  tag: string;
  tagColor: string;
  description: string;
}

const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    id: 'embeddings',
    icon: { ios: 'lock.shield.fill', android: 'security', web: 'security' },
    title: 'Zero-Knowledge Encrypted Embeddings',
    tag: 'Privacy Core',
    tagColor: 'text-purple-400 bg-purple-950/40 border-purple-800/40',
    description:
      'Mathematical transformation of AI vector coordinates ensuring cloud memories remain unreadable noise even to server administrators, without losing semantic search speed.',
  },
  {
    id: 'camera_handwriting',
    icon: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
    title: 'Camera & Handwritten OCR Ingestion',
    tag: 'Capture Anywhere',
    tagColor: 'text-blue-400 bg-blue-950/40 border-blue-800/40',
    description:
      'Snap photos of physical journal pages, notebook spreads, or sticky notes. On-device vision transcribes your handwriting into private, encrypted searchable text.',
  },
  {
    id: 'explicit_utility',
    icon: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
    title: 'Guided Prompts & Daily Sparks',
    tag: 'Everyday Utility',
    tagColor: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40',
    description:
      'Never face a blank page. Contextual morning and evening reflection prompts spark meaningful thoughts and resurrect forgotten insights from your own past writings.',
  },
  {
    id: 'proprietary_engine',
    icon: { ios: 'cpu', android: 'memory', web: 'memory' },
    title: 'Proprietary Synapse Recall Engine',
    tag: 'AI Retrieval Moat',
    tagColor: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/40',
    description:
      'A multi-stage retrieval algorithm that fuses semantic similarity, exact keywords, recency decay, and emotional resonance to surface deeply relevant memories.',
  },
  {
    id: 'ai_sanitize_exports',
    icon: { ios: 'shield.lefthalf.filled', android: 'verified_user', web: 'verified_user' },
    title: 'AI Export Sanitization & PII Redaction',
    tag: 'Safe Sharing',
    tagColor: 'text-rose-400 bg-rose-950/40 border-rose-800/40',
    description:
      'Export and share only what you want to. On-device AI automatically detects and redacts real names, contacts, and sensitive identifiers before sharing with therapists or external tools.',
  },
  {
    id: 'nontechnical_narrative',
    icon: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' },
    title: 'Human-Centered Architecture Guides',
    tag: 'Clarity & Trust',
    tagColor: 'text-amber-400 bg-amber-950/40 border-amber-800/40',
    description:
      'Intuitive mental models and transparent guides explaining exactly how your encrypted second brain operates without confusing cryptographic jargon.',
  },
];

export default function WhatsNextModal({ visible, onClose }: WhatsNextModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View className="flex-1 bg-black/80 items-center justify-center p-4">
        <View 
          className="w-full max-w-xl rounded-[26px] border p-6 overflow-hidden max-h-[85%]"
          style={[
            {
              backgroundColor: '#0a0e18',
              borderColor: 'rgba(255, 255, 255, 0.08)',
              shadowColor: '#3b82f6',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.5,
              shadowRadius: 36,
              elevation: 10,
            },
            Platform.OS === 'web' ? ({
              boxShadow: '0 28px 64px -8px rgba(0, 0, 0, 0.95), inset 0 1px 0 0 rgba(255, 255, 255, 0.1), 0 0 35px -2px rgba(59, 130, 246, 0.15)',
            } as any) : undefined
          ]}
        >
          {/* Header */}
          <View className="items-center mb-5">
            <View className="flex-row items-center gap-2.5 mb-2">
              <View style={Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 10px rgba(59, 130, 246, 0.8))' } as any : {}}>
                <SymbolView
                  name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' } as any}
                  tintColor="#3b82f6"
                  size={26}
                />
              </View>
              <Text className="text-xl font-bold text-white tracking-wider uppercase">WHAT'S NEXT IN MNEMO</Text>
            </View>
            <Text className="text-slate-400 text-xs text-center font-medium leading-relaxed px-4">
              A preview of upcoming capabilities being engineered for your encrypted personal memory system.
            </Text>
          </View>

          {/* Roadmap List */}
          <ScrollView className="flex-1" showsVerticalScrollIndicator={true}>
            <View className="flex-col gap-3 py-1">
              {ROADMAP_ITEMS.map((item) => (
                <View
                  key={item.id}
                  style={[
                    {
                      backgroundColor: '#070b12',
                      borderColor: 'rgba(255, 255, 255, 0.05)',
                    },
                    Platform.OS === 'web' ? ({
                      boxShadow: 'inset 0 2px 6px 0 rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.02)',
                    } as any) : undefined
                  ]}
                  className="rounded-2xl p-4 border"
                >
                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                      <SymbolView
                        name={item.icon as any}
                        tintColor="#60a5fa"
                        size={17}
                      />
                      <Text className="text-sm font-bold text-slate-100 flex-1 flex-wrap">
                        {item.title}
                      </Text>
                    </View>
                    <View className={`px-2.5 py-0.5 rounded-full border ${item.tagColor}`}>
                      <Text className="text-[10px] font-bold uppercase tracking-wider">{item.tag}</Text>
                    </View>
                  </View>
                  <Text className="text-slate-400 text-xs leading-relaxed pl-7">
                    {item.description}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Footer CTA */}
          <View className="border-t border-white/[0.06] pt-4 mt-4 flex-row justify-between items-center">
            <Text className="text-slate-500 text-[11px] font-medium tracking-wide">
              MNEMO Continuous Evolution
            </Text>
            <Pressable
              onPress={onClose}
              style={[
                Platform.OS === 'web' ? ({
                  boxShadow: '0 4px 16px rgba(59, 130, 246, 0.35)',
                } as any) : undefined
              ]}
              className="bg-blue-600 active:bg-blue-500 px-6 py-2.5 rounded-xl flex-row items-center justify-center shadow-lg shadow-blue-500/30"
            >
              <Text className="text-white font-bold text-xs uppercase tracking-wider">
                Sounds Great
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
