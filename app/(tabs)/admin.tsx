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
        <View className="bg-white dark:bg-gray-900 p-4 rounded-xl mb-4 shadow-sm border border-gray-100 dark:border-gray-800">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-500 dark:text-gray-400 font-medium">
              {new Date(item.created_at).toLocaleString()}
            </Text>
            <Text className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold uppercase">
              No Vector
            </Text>
          </View>

          <Text className="text-gray-800 dark:text-gray-200 mb-4" numberOfLines={3}>
            {item.content || "Empty content"}
          </Text>

          <Pressable 
            onPress={() => handleForceIndex(item)}
            disabled={retryingId === item.id}
            className={`p-3 rounded-xl items-center ${retryingId === item.id ? 'bg-gray-400' : 'bg-purple-500 active:opacity-80'}`}
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
      <View className="bg-white dark:bg-gray-900 p-4 rounded-xl mb-4 border border-red-200 dark:border-red-900 shadow-sm">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-gray-500 dark:text-gray-400 font-medium">
            {new Date(item.created_at).toLocaleString()}
          </Text>
          <Text className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold uppercase">
            Failed
          </Text>
        </View>

        <Text className="text-red-500 font-mono text-sm mb-4 bg-red-50 dark:bg-red-950 p-2 rounded">
          {item.last_error || "Unknown Error"}
        </Text>

        <View className="flex-row gap-3">
          {isTranscriptionFailure ? (
            <Pressable 
              onPress={() => handleRetryTranscription(item)}
              disabled={retryingId === item.id}
              className={`flex-1 p-3 rounded-xl items-center ${retryingId === item.id ? 'bg-gray-400' : 'bg-blue-500 active:opacity-80'}`}
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
              className={`flex-1 p-3 rounded-xl items-center ${retryingId === item.id ? 'bg-gray-400' : 'bg-green-500 active:opacity-80'}`}
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
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black p-4">
      <Text className="text-3xl font-bold mb-2 dark:text-white">Admin</Text>
      
      {/* Segmented Control */}
      <View className="flex-row bg-gray-200 dark:bg-gray-800 rounded-lg p-1 mb-6">
        <Pressable 
          onPress={() => setActiveTab('failed')}
          className={`flex-1 p-2 rounded-md items-center ${activeTab === 'failed' ? 'bg-white shadow dark:bg-gray-600' : ''}`}
        >
          <Text className={`font-semibold ${activeTab === 'failed' ? 'text-black dark:text-white' : 'text-gray-500'}`}>
            Failed Tasks
          </Text>
        </Pressable>
        <Pressable 
          onPress={() => setActiveTab('unindexed')}
          className={`flex-1 p-2 rounded-md items-center ${activeTab === 'unindexed' ? 'bg-white shadow dark:bg-gray-600' : ''}`}
        >
          <Text className={`font-semibold ${activeTab === 'unindexed' ? 'text-black dark:text-white' : 'text-gray-500'}`}>
            Unindexed
          </Text>
        </Pressable>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" className="mt-10" />
      ) : entries.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500 text-lg">
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
