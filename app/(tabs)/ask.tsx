import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, SafeAreaView, Keyboard } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { searchEntries } from '../../src/services/entries';

type SearchResult = {
  id: string;
  content: string;
  created_at: string;
  similarity: number;
};

export default function AskScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    Keyboard.dismiss();
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const data = await searchEntries(query.trim());
      setResults(data || []);
    } catch (error) {
      console.error(error);
      alert('Search failed. Please make sure you have run the 05_match_entries.sql migration.');
    } finally {
      setIsSearching(false);
    }
  };

  const renderItem = ({ item }: { item: SearchResult }) => (
    <View className="bg-white dark:bg-gray-900 p-4 rounded-2xl mb-4 shadow-sm border border-gray-100 dark:border-gray-800">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-gray-500 dark:text-gray-400 font-medium">
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
        <Text className="text-blue-500 text-xs font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
          {Math.round(item.similarity * 100)}% Match
        </Text>
      </View>
      <Text className="text-gray-800 dark:text-gray-200 text-base leading-relaxed">
        {item.content}
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black">
      <View className="p-4">
        <Text className="text-3xl font-bold mb-2 dark:text-white">Ask Qora</Text>
        <Text className="text-gray-500 mb-6">Search your journal using natural language. Try searching for concepts, not just exact words!</Text>
        
        {/* Search Bar */}
        <View className="flex-row items-center bg-white dark:bg-gray-900 p-2 rounded-2xl border border-gray-200 dark:border-gray-800 mb-6 shadow-sm">
          <TextInput
            className="flex-1 px-4 py-2 text-base dark:text-white"
            placeholder="What did I learn about..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <Pressable 
            onPress={handleSearch}
            disabled={isSearching || !query.trim()}
            className={`p-3 rounded-xl ${isSearching || !query.trim() ? 'bg-gray-300 dark:bg-gray-800' : 'bg-blue-500 active:bg-blue-600'}`}
          >
            {isSearching ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <SymbolView name="magnifyingglass" tintColor="white" size={20} />
            )}
          </Pressable>
        </View>

        {/* Results */}
        {isSearching ? (
          <View className="flex-1 items-center justify-center pt-20">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="text-gray-500 mt-4 font-medium">Thinking...</Text>
          </View>
        ) : hasSearched && results.length === 0 ? (
          <View className="flex-1 items-center justify-center pt-20">
            <Text className="text-gray-500 text-lg">No related entries found.</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
