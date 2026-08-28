import { View, Text, TextInput, Pressable } from 'react-native';
import { Link } from 'expo-router';

export default function SignInScreen() {
  return (
    <View className="flex-1 justify-center px-6 bg-white dark:bg-black">
      <Text className="text-3xl font-bold mb-8 text-center dark:text-white">Welcome Back</Text>
      
      <TextInput 
        className="w-full bg-gray-100 dark:bg-gray-900 p-4 rounded-xl mb-4 text-black dark:text-white"
        placeholder="Email"
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
      />
      <TextInput 
        className="w-full bg-gray-100 dark:bg-gray-900 p-4 rounded-xl mb-8 text-black dark:text-white"
        placeholder="Password"
        placeholderTextColor="#6b7280"
        secureTextEntry
      />
      
      <Pressable className="w-full bg-black dark:bg-white p-4 rounded-xl items-center mb-6">
        <Text className="text-white dark:text-black font-semibold text-lg">Sign In</Text>
      </Pressable>
      
      <Link href="/(auth)/sign-up" asChild>
        <Pressable className="items-center p-2">
          <Text className="text-gray-500">Don't have an account? Sign up</Text>
        </Pressable>
      </Link>
    </View>
  );
}
