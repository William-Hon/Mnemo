import { View, Text, Pressable } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-black p-4">
      <Text className="text-3xl font-bold mb-12 dark:text-white">Qora</Text>
      
      <Pressable className="bg-black dark:bg-white w-48 h-48 rounded-full items-center justify-center mb-8 shadow-md active:opacity-80">
        <Text className="text-white dark:text-black text-2xl font-semibold">Speak</Text>
      </Pressable>
      
      <Pressable className="p-4 active:opacity-50">
        <Text className="text-gray-500 dark:text-gray-400 text-lg">Type instead</Text>
      </Pressable>
    </View>
  );
}
