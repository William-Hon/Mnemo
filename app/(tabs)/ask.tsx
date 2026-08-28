import { View, Text } from 'react-native';

export default function AskScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-black p-4">
      <Text className="text-xl font-bold dark:text-white">Ask Qora</Text>
      <Text className="text-gray-500 mt-2 text-center">Ask questions about your past entries to find insights.</Text>
    </View>
  );
}
