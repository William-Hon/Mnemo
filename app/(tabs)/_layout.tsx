import React, { useEffect, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { Tabs, useRouter } from 'expo-router';
import { Platform, View, ActivityIndicator } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { getLocalMEK } from '@/src/lib/encryption';
import { supabase } from '@/src/lib/supabase';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    checkAuthAndEncryption();
  }, []);

  const checkAuthAndEncryption = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/(auth)/sign-in');
        return;
      }
      
      const mek = await getLocalMEK();
      if (!mek) {
        // MEK missing, force recovery
        router.replace('/(auth)/recovery');
        return;
      }
      
      setIsReady(true);
    } catch (e) {
      console.error(e);
    }
  };

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={28} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'clock.fill', android: 'history', web: 'history' }} tintColor={color} size={28} />
          ),
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: 'Ask Qora',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={color} size={28} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} tintColor={color} size={28} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} tintColor={color} size={28} />
          ),
        }}
      />
    </Tabs>
  );
}
