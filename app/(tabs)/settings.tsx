import React, { useState } from 'react';
import { View, Text, Pressable, SafeAreaView, ScrollView, Modal, Platform, Alert } from 'react-native';
import { useAuth } from '../../src/providers/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { SymbolView } from 'expo-symbols';

import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const performSignOut = async () => {
    try {
      setLoggingOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        if (Platform.OS === 'web') {
          window.alert(error.message);
        } else {
          Alert.alert('Error', error.message);
        }
      }
    } catch (e: any) {
      console.error('Sign out error:', e);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSignOut = () => {
    setShowSignOutConfirm(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black">
      <View className="flex-1 p-6 mt-8">
        <View className="bg-white dark:bg-gray-900 rounded-sm p-4 shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Account</Text>
          <Text className="text-gray-900 dark:text-gray-100 text-base mb-1">
            Logged in as
          </Text>
          <Text className="text-gray-500 text-sm mb-4">
            {user?.email || 'No email attached'}
          </Text>

          <Pressable 
            onPress={handleSignOut}
            disabled={loggingOut}
            className="bg-red-500 active:bg-red-600 py-3.5 rounded-sm items-center shadow-sm shadow-red-500/20"
          >
            <Text className="text-white font-bold">{loggingOut ? 'Signing out...' : 'Sign Out'}</Text>
          </Pressable>
        </View>

        {/* Custom Sign Out Modal */}
        <Modal visible={showSignOutConfirm} animationType="fade" transparent={true}>
          <View className="flex-1 bg-black/60 items-center justify-center p-4">
            <View className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-sm shadow-2xl border border-gray-200 dark:border-gray-800 p-6 overflow-hidden">
              <View className="items-center mb-10">
                <View style={[Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 12px rgba(59, 130, 246, 0.8))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }]} className="mb-6">
                  <SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' } as any} tintColor="#3b82f6" size={48} />
                </View>
                <Text style={{ textShadowColor: 'rgba(59, 130, 246, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }} className="text-2xl font-black text-blue-500 tracking-widest mb-4">SIGN OUT</Text>
                <Text className="text-gray-500 dark:text-gray-400 text-center leading-relaxed font-medium">
                  Are you sure you want to sign out of your account?
                </Text>
              </View>
              
              <View className="flex-row justify-between border-t border-gray-100 dark:border-gray-800 pt-5">
                <Pressable 
                  onPress={() => setShowSignOutConfirm(false)} 
                  className="flex-row items-center justify-center py-2 px-4 active:opacity-50"
                >
                  <Text className="font-bold text-gray-500 uppercase tracking-wider text-sm">Cancel</Text>
                </Pressable>
                
                <Pressable 
                  onPress={() => {
                    setShowSignOutConfirm(false);
                    performSignOut();
                  }} 
                  style={[Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(59, 130, 246, 0.5))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }]} 
                  className="flex-row items-center justify-center py-2 px-4 active:opacity-50"
                >
                  <Text style={{ color: '#3b82f6' }} className="font-bold uppercase tracking-wider text-sm">Sign Out</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}
