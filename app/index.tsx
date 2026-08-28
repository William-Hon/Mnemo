import { Redirect } from 'expo-router';

export default function Index() {
  // TODO: Add auth state check here
  const isAuthenticated = false; // Mock

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
