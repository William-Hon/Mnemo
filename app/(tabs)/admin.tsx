import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert, SafeAreaView, ScrollView, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { getFailedEntries, getUnindexedEntries, processTranscription, retryEmbedding, Entry } from '../../src/services/entries';
import WhatsNextModal from '../../components/WhatsNextModal';

type AdminTab = 'failed' | 'unindexed' | 'todos';

interface AdminTodo {
  id: string;
  title: string;
  category: 'Security' | 'Multimodal' | 'Product UX' | 'Proprietary IP' | 'Communication' | 'Engagement';
  priority: 'Critical' | 'High' | 'Medium';
  status: 'In Architecture' | 'Planned' | 'Active Preview';
  icon: { ios: string; android: string; web: string };
  shortDescription: string;
  whyItMatters: string;
  technicalBlueprint: string[];
  actionLabel?: string;
  actionType?: 'preview_whats_next';
}

const ADMIN_TODOS: AdminTodo[] = [
  {
    id: 'encrypt_embeddings',
    title: 'Encrypt Vector Embeddings',
    category: 'Security',
    priority: 'Critical',
    status: 'In Architecture',
    icon: { ios: 'lock.shield.fill', android: 'security', web: 'security' },
    shortDescription: 'Protect high-dimensional vector embeddings from embedding-inversion and semantic probing attacks.',
    whyItMatters: 'While journal text is AES-256 encrypted, storing raw float vectors in Supabase pgvector exposes mathematical semantic fingerprints that could be inverted to infer user topics.',
    technicalBlueprint: [
      'Client-Side Orthogonal Projection: Derive a secret rotation matrix R from user MEK via HKDF.',
      'Distance Preservation: Compute (R · E₁) · (R · E₂) = E₁ · E₂. Cosine similarity and pgvector indexing remain 100% functional.',
      'Zero-Knowledge Database: The database only ever stores scrambled coordinate projections.',
      'Fallback Option: Local on-device vector storage via SQLite-vec where vectors never leave the phone.',
    ],
  },
  {
    id: 'camera_handwriting',
    title: 'Camera Photos & Handwritten Transcriptions',
    category: 'Multimodal',
    priority: 'High',
    status: 'Planned',
    icon: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
    shortDescription: 'Capture physical notebook pages, whiteboards, and sticky notes; transcribe handwriting into encrypted text.',
    whyItMatters: 'Many lifelong journalers prefer physical paper. Bridging analog notebooks with Mnemo digital memory expands daily capture frequency tenfold.',
    technicalBlueprint: [
      'Expo SDK 57 Integration: expo-image-picker and expo-camera for high-resolution document capture.',
      'On-Device OCR: Apple Vision framework (VNRecognizeTextRequest) on iOS and Google ML Kit on Android for zero-cloud handwritten text parsing.',
      'Private Cloud Fallback: Zero-retention multimodal Vision API via Edge Function with ephemeral memory processing.',
      'Storage & Ingestion: Transcribed text is encrypted locally with MEK and piped into entries and entry_chunks.',
    ],
  },
  {
    id: 'explicit_utility',
    title: 'Make Actual Use of App More Explicit',
    category: 'Product UX',
    priority: 'High',
    status: 'In Architecture',
    icon: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
    shortDescription: 'Eliminate the blank canvas problem with contextual reflection prompts, daily habits, and query guidance.',
    whyItMatters: 'A blank screen intimidates users. Clearly guiding users on what to record and what to ask unlocks immediate recurring value.',
    technicalBlueprint: [
      'Daily Reflection Sparks: Morning and evening prompt carousels on the Home screen ("What decision weighed on you today?").',
      'Search Prompt Suggestion Chips: Pre-populated memory queries in History ("When was I most energetic?", "Career thoughts in Q2").',
      'Interactive First-Run Tour: Visual walkthrough demonstrating Spoken Brain Dumps, Handwritten Ingestion, and Fuzzy Recall.',
      'Proactive Memory Flashbacks: Local notifications surfacing reflections from 30 days or 1 year ago.',
    ],
  },
  {
    id: 'proprietary_moat',
    title: 'Make App More Proprietary (Competitive Moat)',
    category: 'Proprietary IP',
    priority: 'High',
    status: 'In Architecture',
    icon: { ios: 'cpu', android: 'memory', web: 'memory' },
    shortDescription: 'Engineer defensible technical moats including a custom hybrid recall engine and branded cognitive vault.',
    whyItMatters: 'Commodity wrappers around third-party AI APIs have zero defensibility. Mnemo must own unique algorithms and cognitive architecture.',
    technicalBlueprint: [
      'Synapse Retrieval Engine: Custom hybrid scoring fusing vector similarity, BM25 keywords, temporal recency decay, and emotional salience.',
      'Zero-Knowledge Cognitive Vault: Proprietary multi-key envelope derivation scheme separating storage keys, transport keys, and query vectors.',
      'Distilled On-Device SLM: Fine-tuned quantized model adapter tailored specifically for non-hallucinatory autobiographical memory synthesis.',
      'Sensory Brand Identity: Custom audio-haptic feedback signatures for voice recording and thought retrieval.',
    ],
  },
  {
    id: 'nontechnical_details',
    title: 'Tell Users More Nontechnical Details',
    category: 'Communication',
    priority: 'Medium',
    status: 'Planned',
    icon: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' },
    shortDescription: 'Translate cryptographic and architectural depth into plain-English mental models and trust-building narratives.',
    whyItMatters: 'Non-technical users do not know what AES-256-GCM or RRF mean. They need intuitive metaphors that prove their memories are safe and genuinely helpful.',
    technicalBlueprint: [
      'Dual-Layer About Screen: A top toggle switching between "Human Story" and "Architect Deep Dive".',
      'Core Mental Models: The Titanium Bank Safe (encryption), Meaning Search vs Keyword Search (vectors), and The Brain on Your Phone (local AI).',
      'Practical User FAQ: "Can your staff read my diary?", "What happens if I lose my phone?", "Why is this better than Apple Notes?".',
      'Trust Verification Badges: Visual indicators confirming local-only processing during journal decryption and search.',
    ],
  },
  {
    id: 'ai_sanitize_exports',
    title: 'AI Export Sanitization & PII Redaction',
    category: 'Security',
    priority: 'High',
    status: 'In Architecture',
    icon: { ios: 'shield.lefthalf.filled', android: 'verified_user', web: 'verified_user' },
    shortDescription: 'Use on-device AI to sanitize, mask, and redact sensitive personal identifiers (names, locations, contact info) prior to exporting Context Briefs.',
    whyItMatters: 'Users frequently export journals for external LLMs (Claude/ChatGPT) or healthcare providers. Automatic client-side AI redaction guarantees third parties never receive identifiable personal data.',
    technicalBlueprint: [
      'Local SLM Prompt Chaining: Pass decrypted export text through local Qwen3 with a structured PII extraction & entity masking prompt.',
      'Deterministic Anonymizer: Replace names with consistent pseudonyms ([Person A], [Company X]) to preserve narrative coherence.',
      'Pre-Export Redaction Preview: Allow user to review masked entities and toggle redactions before generating PDF/Context Brief.',
      'Zero Cloud Leakage: Sanitization executes 100% locally on-device, preserving zero-knowledge guarantees.',
    ],
  },
  {
    id: 'whats_next_popup',
    title: 'Add "What\'s Next" Pop-Up Announcement',
    category: 'Engagement',
    priority: 'Medium',
    status: 'Active Preview',
    icon: { ios: 'bell.badge.fill', android: 'campaign', web: 'campaign' },
    shortDescription: 'In-app announcement modal previewing upcoming features to users, with live admin preview trigger.',
    whyItMatters: 'Keeps early adopters enthusiastic, builds product transparency, and invites targeted user feedback on future milestones.',
    technicalBlueprint: [
      'Modal Component: Built WhatsNextModal with glassmorphic dark theme and categorized feature previews.',
      'Versioned Display: Persists last seen roadmap version in AsyncStorage to display once per major feature release.',
      'User Entrypoint: Added "What\'s Next in Mnemo" row in Settings screen for on-demand access.',
      'Admin Preview Trigger: Test and preview the exact user modal directly from this dashboard.',
    ],
    actionLabel: 'Preview What\'s Next Modal',
    actionType: 'preview_whats_next',
  },
];

export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState<AdminTab>('failed');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Roadmap Tab State
  const [expandedTodoId, setExpandedTodoId] = useState<string | null>('encrypt_embeddings');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showWhatsNextModal, setShowWhatsNextModal] = useState(false);

  const fetchData = async () => {
    if (activeTab === 'todos') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (activeTab === 'failed') {
        const data = await getFailedEntries();
        setEntries(data);
      } else if (activeTab === 'unindexed') {
        const data = await getUnindexedEntries();
        setEntries(data);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to fetch data.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [activeTab])
  );

  const handleRetryTranscription = async (entry: Entry) => {
    if (!entry.audio_path) {
      Alert.alert('Error', 'Missing audio path.');
      return;
    }
    
    setRetryingId(entry.id);
    try {
      await processTranscription(entry.id, entry.audio_path);
      await retryEmbedding(entry.id);
      
      Alert.alert('Success', 'Transcription and Indexing completed successfully!');
      fetchData();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Retry Failed', error.message || 'Something went wrong.');
      fetchData();
    } finally {
      setRetryingId(null);
    }
  };

  const handleForceIndex = async (entry: Entry) => {
    setRetryingId(entry.id);
    try {
      await retryEmbedding(entry.id);
      Alert.alert('Success', 'Vector Indexing completed successfully!');
      fetchData();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Retry Failed', error.message || 'Something went wrong.');
      fetchData();
    } finally {
      setRetryingId(null);
    }
  };

  const toggleTodoExpand = (id: string) => {
    setExpandedTodoId((prev) => (prev === id ? null : id));
  };

  const categories = ['All', 'Security', 'Multimodal', 'Product UX', 'Proprietary IP', 'Communication', 'Engagement'];

  const filteredTodos = selectedCategory === 'All'
    ? ADMIN_TODOS
    : ADMIN_TODOS.filter((t) => t.category === selectedCategory);

  const renderTodoItem = (todo: AdminTodo) => {
    const isExpanded = expandedTodoId === todo.id;

    const priorityBadge = {
      Critical: 'bg-red-950/80 text-red-400 border-red-800',
      High: 'bg-amber-950/80 text-amber-400 border-amber-800',
      Medium: 'bg-blue-950/80 text-blue-400 border-blue-800',
    }[todo.priority];

    const statusBadge = {
      'In Architecture': 'bg-purple-950/80 text-purple-300 border-purple-800',
      Planned: 'bg-gray-800 text-gray-300 border-gray-700',
      'Active Preview': 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
    }[todo.status];

    return (
      <View
        key={todo.id}
        className="bg-gray-900/90 rounded-xl mb-4 border border-gray-800 overflow-hidden shadow-sm"
      >
        <Pressable
          onPress={() => toggleTodoExpand(todo.id)}
          className="p-4 active:bg-gray-800/50"
        >
          {/* Top Metadata Row */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2 flex-wrap">
              <View className={`px-2 py-0.5 rounded-full border ${priorityBadge}`}>
                <Text className="text-[10px] font-bold uppercase">{todo.priority}</Text>
              </View>
              <View className={`px-2 py-0.5 rounded-full border ${statusBadge}`}>
                <Text className="text-[10px] font-bold uppercase">{todo.status}</Text>
              </View>
              <Text className="text-gray-500 text-xs font-semibold">{todo.category}</Text>
            </View>
            <SymbolView
              name={{
                ios: isExpanded ? 'chevron.up' : 'chevron.down',
                android: isExpanded ? 'expand_less' : 'expand_more',
                web: isExpanded ? 'expand_less' : 'expand_more',
              } as any}
              tintColor="#9ca3af"
              size={18}
            />
          </View>

          {/* Title and Icon */}
          <View className="flex-row items-center gap-3 mb-2">
            <View className="w-8 h-8 rounded-lg bg-blue-950/50 border border-blue-800/60 items-center justify-center">
              <SymbolView name={todo.icon as any} tintColor="#60a5fa" size={18} />
            </View>
            <Text className="text-base font-bold text-white flex-1">{todo.title}</Text>
          </View>

          <Text className="text-gray-400 text-xs leading-relaxed">
            {todo.shortDescription}
          </Text>
        </Pressable>

        {/* Expanded Blueprint Details */}
        {isExpanded && (
          <View className="px-4 pb-4 pt-2 border-t border-gray-800/80 bg-black/40">
            <View className="mb-3">
              <Text className="text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-1">
                Why It Matters
              </Text>
              <Text className="text-gray-300 text-xs leading-relaxed">{todo.whyItMatters}</Text>
            </View>

            <View className="mb-4">
              <Text className="text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-1.5">
                Technical Blueprint & Architecture
              </Text>
              <View className="flex-col gap-1.5">
                {todo.technicalBlueprint.map((point, index) => (
                  <View key={index} className="flex-row items-start">
                    <Text className="text-blue-500 text-xs mr-2 font-bold">•</Text>
                    <Text className="text-gray-300 text-xs leading-relaxed flex-1">
                      {point}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Action Item if available */}
            {todo.actionType === 'preview_whats_next' && (
              <Pressable
                onPress={() => setShowWhatsNextModal(true)}
                className="bg-blue-600 active:bg-blue-500 p-3 rounded-xl flex-row items-center justify-center gap-2 shadow-md shadow-blue-500/20"
              >
                <SymbolView
                  name={{ ios: 'eye.fill', android: 'visibility', web: 'visibility' } as any}
                  tintColor="#ffffff"
                  size={16}
                />
                <Text className="text-white font-bold text-xs uppercase tracking-wider">
                  {todo.actionLabel}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderItem = ({ item }: { item: Entry }) => {
    if (activeTab === 'unindexed') {
      return (
        <View className="bg-gray-900 p-4 rounded-xl mb-4 shadow-sm border border-gray-800">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-400 font-medium text-xs">
              {new Date(item.created_at).toLocaleString()}
            </Text>
            <Text className="bg-yellow-900/40 text-yellow-400 px-2 py-1 rounded text-xs font-bold uppercase">
              No Vector
            </Text>
          </View>

          <Text className="text-gray-200 mb-4 text-xs" numberOfLines={3}>
            {item.content || "Empty content"}
          </Text>

          <Pressable 
            onPress={() => handleForceIndex(item)}
            disabled={retryingId === item.id}
            className={`p-3 rounded-xl items-center ${retryingId === item.id ? 'bg-gray-700' : 'bg-purple-600 active:opacity-80'}`}
          >
            {retryingId === item.id ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-xs">Force Index Vector</Text>
            )}
          </Pressable>
        </View>
      );
    }

    // Failed Tab Item
    const isTranscriptionFailure = item.entry_type === 'voice' && !item.content;

    return (
      <View className="bg-gray-900 p-4 rounded-xl mb-4 border border-red-900 shadow-sm">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-gray-400 font-medium text-xs">
            {new Date(item.created_at).toLocaleString()}
          </Text>
          <Text className="bg-red-900/40 text-red-400 px-2 py-1 rounded text-xs font-bold uppercase">
            Failed
          </Text>
        </View>

        <Text className="text-red-400 font-mono text-xs mb-4 bg-red-950 p-2 rounded">
          {item.last_error || "Unknown Error"}
        </Text>

        <View className="flex-row gap-3">
          {isTranscriptionFailure ? (
            <Pressable 
              onPress={() => handleRetryTranscription(item)}
              disabled={retryingId === item.id}
              className={`flex-1 p-3 rounded-xl items-center ${retryingId === item.id ? 'bg-gray-700' : 'bg-blue-500 active:opacity-80'}`}
            >
              {retryingId === item.id ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-xs">Retry Transcription</Text>
              )}
            </Pressable>
          ) : (
            <Pressable 
              onPress={() => handleForceIndex(item)}
              disabled={retryingId === item.id}
              className={`flex-1 p-3 rounded-xl items-center ${retryingId === item.id ? 'bg-gray-700' : 'bg-green-600 active:opacity-80'}`}
            >
              {retryingId === item.id ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-xs">Retry Indexing</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView 
      className="flex-1 bg-black"
      style={Platform.OS === 'web' ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as any : {}}
    >
      <View className="flex-1 p-4 pt-10">
        {/* Header Title */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-xl font-black text-white tracking-wide">ADMIN CONSOLE</Text>
            <Text className="text-gray-500 text-xs font-medium">Task Management & Roadmap Dashboard</Text>
          </View>
          <View className="px-2.5 py-1 rounded bg-blue-950/60 border border-blue-800">
            <Text className="text-blue-400 font-bold text-[10px] tracking-wider uppercase">Privileged</Text>
          </View>
        </View>

        {/* 3-Segment Control */}
        <View className="flex-row bg-gray-900 rounded-xl p-1 mb-4 border border-gray-800">
          <Pressable 
            onPress={() => setActiveTab('failed')}
            className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'failed' ? 'bg-gray-800 shadow' : ''}`}
          >
            <Text className={`font-bold text-xs ${activeTab === 'failed' ? 'text-white' : 'text-gray-400'}`}>
              Failed Tasks
            </Text>
          </Pressable>
          <Pressable 
            onPress={() => setActiveTab('unindexed')}
            className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'unindexed' ? 'bg-gray-800 shadow' : ''}`}
          >
            <Text className={`font-bold text-xs ${activeTab === 'unindexed' ? 'text-white' : 'text-gray-400'}`}>
              Unindexed
            </Text>
          </Pressable>
          <Pressable 
            onPress={() => setActiveTab('todos')}
            className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'todos' ? 'bg-blue-600 shadow' : ''}`}
          >
            <Text className={`font-bold text-xs ${activeTab === 'todos' ? 'text-white' : 'text-gray-400'}`}>
              To-Dos ({ADMIN_TODOS.length})
            </Text>
          </Pressable>
        </View>

        {activeTab === 'todos' ? (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {/* Summary Progress Card */}
            <View className="bg-gray-900/90 rounded-2xl p-4 mb-4 border border-blue-900/40">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-xs font-black text-blue-400 uppercase tracking-widest">
                  Roadmap Execution
                </Text>
                <Text className="text-xs font-bold text-gray-400">
                  {ADMIN_TODOS.length} Strategic Initiatives
                </Text>
              </View>

              <View className="flex-row gap-2 mb-3">
                <View className="flex-1 bg-black/50 p-2.5 rounded-xl border border-gray-800 items-center">
                  <Text className="text-emerald-400 font-black text-base">
                    {ADMIN_TODOS.filter((t) => t.status === 'Active Preview').length}
                  </Text>
                  <Text className="text-gray-400 text-[10px] uppercase font-bold">Active Preview</Text>
                </View>
                <View className="flex-1 bg-black/50 p-2.5 rounded-xl border border-gray-800 items-center">
                  <Text className="text-purple-400 font-black text-base">
                    {ADMIN_TODOS.filter((t) => t.status === 'In Architecture').length}
                  </Text>
                  <Text className="text-gray-400 text-[10px] uppercase font-bold">Architecture</Text>
                </View>
                <View className="flex-1 bg-black/50 p-2.5 rounded-xl border border-gray-800 items-center">
                  <Text className="text-blue-400 font-black text-base">
                    {ADMIN_TODOS.filter((t) => t.status === 'Planned').length}
                  </Text>
                  <Text className="text-gray-400 text-[10px] uppercase font-bold">Planned</Text>
                </View>
              </View>

              <Text className="text-gray-400 text-xs leading-relaxed">
                Tap any item below to inspect architectural blueprints, privacy implications, and interactive test actions.
              </Text>
            </View>

            {/* Category Filter Pills */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              className="mb-4"
              contentContainerStyle={{ gap: 8 }}
            >
              {categories.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full border ${
                    selectedCategory === cat
                      ? 'bg-blue-600 border-blue-500'
                      : 'bg-gray-900 border-gray-800'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      selectedCategory === cat ? 'text-white' : 'text-gray-400'
                    }`}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* List of To-Dos */}
            <View className="flex-col">
              {filteredTodos.map(renderTodoItem)}
            </View>

            <View className="h-10" />
          </ScrollView>
        ) : loading ? (
          <ActivityIndicator size="large" color="#3b82f6" className="mt-10" />
        ) : entries.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-400 text-base">
              {activeTab === 'failed' ? "No failed tasks! 🎉" : "All entries are indexed! 🧠"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Interactive What's Next Modal Preview */}
      <WhatsNextModal
        visible={showWhatsNextModal}
        onClose={() => setShowWhatsNextModal(false)}
      />
    </SafeAreaView>
  );
}
