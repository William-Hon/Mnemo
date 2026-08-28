import { View, Text } from 'react-native';

export default function HistoryScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-black p-4">
      <Text className="text-xl font-bold dark:text-white">History</Text>
      <Text className="text-gray-500 mt-2">Your past entries will appear here.</Text>
    </View>
  );
}
