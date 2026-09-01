import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, title: 'MNEMO' }}>
      <Stack.Screen name="sign-in" options={{ title: 'MNEMO' }} />
      <Stack.Screen name="sign-up" options={{ title: 'MNEMO' }} />
    </Stack>
  );
}
