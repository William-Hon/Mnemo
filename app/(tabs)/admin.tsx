import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getFailedEntries, getUnindexedEntries, processTranscription, retryEmbedding, Entry } from '../../src/services/entries';

export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState<'failed' | 'unindexed'>('failed');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'failed') {
        const data = await getFailedEntries();
        setEntries(data);
      } else {
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
      // If transcription succeeds, it also needs an embedding!
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

  const renderItem = ({ item }: { item: Entry }) => {
    if (activeTab === 'unindexed') {
      return (
        <View className="bg-gray-900 p-4 rounded-xl mb-4 shadow-sm border border-gray-800">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-400 font-medium">
              {new Date(item.created_at).toLocaleString()}
            </Text>
            <Text className="bg-yellow-900/40 text-yellow-400 px-2 py-1 rounded text-xs font-bold uppercase">
              No Vector
            </Text>
          </View>

          <Text className="text-gray-200 mb-4" numberOfLines={3}>
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
              <Text className="text-white font-bold">Force Index Vector</Text>
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
          <Text className="text-gray-400 font-medium">
            {new Date(item.created_at).toLocaleString()}
          </Text>
          <Text className="bg-red-900/40 text-red-400 px-2 py-1 rounded text-xs font-bold uppercase">
            Failed
          </Text>
        </View>

        <Text className="text-red-400 font-mono text-sm mb-4 bg-red-950 p-2 rounded">
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
                <Text className="text-white font-bold">Retry Transcription</Text>
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
                <Text className="text-white font-bold">Retry Indexing</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-black p-4 mt-8">
      {/* Segmented Control */}
      <View className="flex-row bg-gray-800 rounded-lg p-1 mb-6">
        <Pressable 
          onPress={() => setActiveTab('failed')}
          className={`flex-1 p-2 rounded-md items-center ${activeTab === 'failed' ? 'bg-gray-700 shadow' : ''}`}
        >
          <Text className={`font-semibold ${activeTab === 'failed' ? 'text-white' : 'text-gray-400'}`}>
            Failed Tasks
          </Text>
        </Pressable>
        <Pressable 
          onPress={() => setActiveTab('unindexed')}
          className={`flex-1 p-2 rounded-md items-center ${activeTab === 'unindexed' ? 'bg-gray-700 shadow' : ''}`}
        >
          <Text className={`font-semibold ${activeTab === 'unindexed' ? 'text-white' : 'text-gray-400'}`}>
            Unindexed
          </Text>
        </Pressable>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" className="mt-10" />
      ) : entries.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 text-lg">
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
    </SafeAreaView>
  );
}
