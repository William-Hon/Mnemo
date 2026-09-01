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
    tag: 'Privacy Defense',
    tagColor: 'text-purple-400 bg-purple-950/60 border-purple-800',
    description:
      'Mathematical rotation of AI vector coordinates so your cloud memories remain unreadable noise even to server administrators, without losing search speed.',
  },
  {
    id: 'camera_handwriting',
    icon: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
    title: 'Camera & Handwritten OCR Ingestion',
    tag: 'Capture Anywhere',
    tagColor: 'text-blue-400 bg-blue-950/60 border-blue-800',
    description:
      'Snap photos of physical journal pages, sticky notes, or whiteboard sketches. Mnemo transcribes your handwriting into private searchable text.',
  },
  {
    id: 'explicit_utility',
    icon: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
    title: 'Guided Prompts & Daily Sparks',
    tag: 'Everyday Utility',
    tagColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800',
    description:
      'Never face a blank page. Contextual morning and evening reflection prompts spark meaningful thoughts and suggest search queries based on your past reflections.',
  },
  {
    id: 'proprietary_engine',
    icon: { ios: 'cpu', android: 'memory', web: 'memory' },
    title: 'Proprietary Synapse Recall Engine',
    tag: 'Custom AI Moat',
    tagColor: 'text-cyan-400 bg-cyan-950/60 border-cyan-800',
    description:
      'A multi-stage retrieval algorithm that weights semantic similarity, keyword precision, recency decay, and emotional salience to retrieve past wisdom.',
  },
  {
    id: 'nontechnical_narrative',
    icon: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' },
    title: 'Human-Centered Explanations',
    tag: 'Clarity & Trust',
    tagColor: 'text-amber-400 bg-amber-950/60 border-amber-800',
    description:
      'Plain-English mental models and transparent guides explaining exactly how your private second brain keeps you safe without confusing cryptographic jargon.',
  },
];

export default function WhatsNextModal({ visible, onClose }: WhatsNextModalProps) {
  const iconGlowStyle = Platform.select({
    web: {
      filter: 'drop-shadow(0px 0px 10px rgba(59, 130, 246, 0.7))',
    },
    default: {
      shadowColor: '#3b82f6',
      shadowOpacity: 0.8,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 },
    },
  }) as any;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View className="flex-1 bg-black/80 items-center justify-center p-4">
        <View 
          className="w-full max-w-lg bg-gray-950 rounded-2xl shadow-2xl border border-gray-800 p-6 overflow-hidden max-h-[85%]"
          style={Platform.OS === 'web' ? { boxShadow: '0 0 40px rgba(59, 130, 246, 0.25)' } as any : {}}
        >
          {/* Header */}
          <View className="items-center mb-5">
            <View className="flex-row items-center gap-2 mb-2">
              <View style={iconGlowStyle}>
                <SymbolView
                  name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' } as any}
                  tintColor="#3b82f6"
                  size={26}
                />
              </View>
              <Text className="text-xl font-black text-white tracking-wide">WHAT'S NEXT</Text>
            </View>
            <Text className="text-gray-400 text-xs text-center font-medium px-4">
              A glimpse into upcoming capabilities being crafted for your private second brain.
            </Text>
          </View>

          {/* Roadmap List */}
          <ScrollView className="flex-1" showsVerticalScrollIndicator={true}>
            <View className="flex-col gap-3 py-1">
              {ROADMAP_ITEMS.map((item) => (
                <View
                  key={item.id}
                  className="bg-gray-900/80 rounded-xl p-3.5 border border-gray-800/80"
                >
                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                      <SymbolView
                        name={item.icon as any}
                        tintColor="#60a5fa"
                        size={18}
                      />
                      <Text className="text-sm font-bold text-gray-100 flex-1 flex-wrap">
                        {item.title}
                      </Text>
                    </View>
                    <View className={`px-2 py-0.5 rounded-full border ${item.tagColor}`}>
                      <Text className="text-[10px] font-bold uppercase">{item.tag}</Text>
                    </View>
                  </View>
                  <Text className="text-gray-400 text-xs leading-relaxed pl-7">
                    {item.description}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Footer CTA */}
          <View className="border-t border-gray-800 pt-4 mt-4 flex-row justify-between items-center">
            <Text className="text-gray-500 text-[11px] italic">
              Mnemo Continuous Evolution
            </Text>
            <Pressable
              onPress={onClose}
              className="bg-blue-600 active:bg-blue-500 px-5 py-2.5 rounded-xl flex-row items-center justify-center shadow-lg shadow-blue-500/30"
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
