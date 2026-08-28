import { View, Text } from 'react-native';

export default function SettingsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-black p-4">
      <Text className="text-xl font-bold dark:text-white">Settings</Text>
      <Text className="text-gray-500 mt-2">Account and preferences.</Text>
    </View>
  );
}
