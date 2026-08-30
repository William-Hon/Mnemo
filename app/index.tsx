import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../src/providers/AuthProvider';

export default function Index() {
  const { isInitialized } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-black">
      {!isInitialized && <ActivityIndicator size="large" />}
    </View>
  );
}
