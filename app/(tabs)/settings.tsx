import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../../src/providers/AuthProvider';
import { supabase } from '../../src/lib/supabase';

export default function SettingsScreen() {
  const { user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          const { error } = await supabase.auth.signOut();
          setLoggingOut(false);

          if (error) {
            Alert.alert('Error', error.message);
          }
          // AuthProvider listener will auto-route to /(auth)/sign-in
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-white dark:bg-black p-6 justify-between">
      <View className="pt-10">
        <Text className="text-3xl font-bold dark:text-white mb-6">Settings</Text>

        <View className="bg-gray-100 dark:bg-gray-900 p-4 rounded-2xl mb-6">
          <Text className="text-xs uppercase font-semibold text-gray-400 mb-1">Account</Text>
          <Text className="text-lg font-medium dark:text-white">{user?.email || 'No email attached'}</Text>
        </View>
      </View>

      <Pressable
        onPress={handleSignOut}
        disabled={loggingOut}
        className="w-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-4 rounded-xl items-center mb-8 active:opacity-80"
      >
        {loggingOut ? (
          <ActivityIndicator color="#ef4444" />
        ) : (
          <Text className="text-red-600 dark:text-red-400 font-semibold text-lg">Sign Out</Text>
        )}
      </Pressable>
    </View>
  );
}
