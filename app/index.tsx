import { Redirect } from 'expo-router';
import { useAuth } from '../src/providers/AuthProvider';
import { View } from 'react-native';

export default function Index() {
  const { isInitialized, session } = useAuth();

  // Don't render anything until auth state is known — prevents flash
  if (!isInitialized) {
    return <View className="flex-1 bg-black" />;
  }

  // Route based on auth state
  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
