import { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getUserEntries, Entry } from '../../src/services/entries';
import { useAuth } from '../../src/providers/AuthProvider';

export default function HistoryScreen() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const fetchEntries = async () => {
    try {
      const data = await getUserEntries();
      setEntries(data);
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchEntries();
      }
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchEntries();
  };

  const renderItem = ({ item }: { item: Entry }) => (
    <View className="bg-gray-100 dark:bg-gray-900 p-4 rounded-xl mb-3">
      <Text className="text-gray-500 dark:text-gray-400 text-xs mb-2">
        {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString()}
      </Text>
      <Text className="text-black dark:text-white text-base" numberOfLines={3}>
        {item.content}
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-white dark:bg-black p-4">
      <Text className="text-2xl font-bold dark:text-white mb-6 pt-4">History</Text>
      
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#888" />
        </View>
      ) : entries.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500 dark:text-gray-400">Your past entries will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}
