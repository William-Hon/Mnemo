import React, { useEffect, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { Tabs, useRouter } from 'expo-router';
import { Platform, View, ActivityIndicator } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { supabase } from '@/src/lib/supabase';
import { getLocalMEK } from '@/src/lib/encryption';
import { useAuth } from '@/src/providers/AuthProvider';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const headerShown = useClientOnlyValue(false, true);
  const { session } = useAuth();
  
  const isAdmin = session?.user?.email === '32whon@gmail.com';

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        router.replace('/(auth)/sign-in');
        return;
      }
      
      const mek = await getLocalMEK();
      if (!mek) {
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
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#888888',
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopColor: '#333333',
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Journals',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: 'About',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAdmin ? '/admin' : null,
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}
