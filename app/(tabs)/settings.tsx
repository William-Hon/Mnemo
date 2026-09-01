import React, { useState } from 'react';
import { View, Text, Pressable, SafeAreaView, ScrollView, Modal, Platform, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../../src/providers/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { deleteLocalMEK } from '../../src/lib/encryption';
import { LocalAIService } from '../../src/services/LocalAIService';
import { SymbolView } from 'expo-symbols';

import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [modelInstalled, setModelInstalled] = useState(false);
  const [modelActionLoading, setModelActionLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState('');
  const [downloadLimit, setDownloadLimit] = useState<{used: number, total: number} | null>(null);

  React.useEffect(() => {
    checkModelStatus();
  }, []);

  const checkModelStatus = async () => {
    const isInstalled = await LocalAIService.isModelDownloaded();
    setModelInstalled(isInstalled);
    const limitInfo = await LocalAIService.getDownloadLimitInfo();
    setDownloadLimit(limitInfo);
  };

  const handleDownloadModel = async () => {
    try {
      setModelActionLoading(true);
      await LocalAIService.initAndDownload((progress) => {
        setModelProgress(progress);
      });
      await checkModelStatus();
    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert(e.message);
      } else {
        Alert.alert('Download Error', e.message);
      }
    } finally {
      setModelActionLoading(false);
      setModelProgress('');
    }
  };

  const handleRemoveModel = async () => {
    try {
      setModelActionLoading(true);
      await LocalAIService.removeModel();
      await checkModelStatus();
    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert('Failed to remove model');
      } else {
        Alert.alert('Error', 'Failed to remove model');
      }
    } finally {
      setModelActionLoading(false);
    }
  };

  const performSignOut = async () => {
    try {
      setLoggingOut(true);
      await deleteLocalMEK();
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

  const performDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete account');
      }

      await deleteLocalMEK();
      await supabase.auth.signOut();

    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert(e.message);
      } else {
        Alert.alert('Error', e.message);
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleSignOut = () => {
    setShowSignOutConfirm(true);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black">
      <View className="flex-1 p-6 mt-8">
        <View className="bg-white dark:bg-gray-900 rounded-sm p-4 shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Private AI</Text>
          <Text className="text-gray-900 dark:text-gray-100 text-base mb-1">
            Model: Qwen3 0.6B Q4_K_M
          </Text>
          <Text className="text-gray-500 text-sm mb-1">
            Version: v1
          </Text>
          <Text className="text-gray-500 text-sm mb-1">
            Status: {modelInstalled ? 'Installed (~484 MB)' : 'Not installed'}
          </Text>
          {downloadLimit && (
            <Text className="text-gray-500 text-sm mb-4">
              Successful downloads this month: {downloadLimit.used} / {downloadLimit.total}
            </Text>
          )}
          
          {modelActionLoading && (
            <View className="mb-4 flex-row items-center gap-3 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-sm">
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text className="text-blue-600 dark:text-blue-400 font-bold text-xs flex-1">{modelProgress || 'Loading...'}</Text>
            </View>
          )}

          {!modelInstalled ? (
            <Pressable 
              onPress={handleDownloadModel}
              disabled={modelActionLoading}
              className="bg-blue-500 py-3 rounded-sm items-center active:opacity-50"
            >
              <Text className="text-white font-bold tracking-widest uppercase text-xs">Download Model</Text>
            </Pressable>
          ) : (
            <View className="flex-row gap-3">
              <Pressable 
                onPress={handleDownloadModel}
                disabled={modelActionLoading}
                className="flex-1 bg-gray-100 dark:bg-gray-800 py-3 rounded-sm items-center active:opacity-50"
              >
                <Text className="text-gray-700 dark:text-gray-300 font-bold tracking-widest uppercase text-xs">Redownload</Text>
              </Pressable>
              <Pressable 
                onPress={handleRemoveModel}
                disabled={modelActionLoading}
                className="flex-1 bg-red-500/10 dark:bg-red-900/20 py-3 rounded-sm items-center active:opacity-50"
              >
                <Text className="text-red-500 font-bold tracking-widest uppercase text-xs">Remove</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View className="bg-white dark:bg-gray-900 rounded-sm p-4 shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Account</Text>
          <Text className="text-gray-900 dark:text-gray-100 text-base mb-1">
            Logged in as
          </Text>
          <Text className="text-gray-500 text-sm mb-6">
            {user?.email || 'No email attached'}
          </Text>

          <Pressable 
            onPress={handleSignOut}
            disabled={loggingOut || deletingAccount}
            style={Platform.OS === 'web' ? { boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)' } as any : { shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 }}
            className="border border-blue-500 py-3.5 rounded-sm items-center mb-4 active:opacity-50"
          >
            <Text style={{ textShadowColor: 'rgba(59, 130, 246, 0.8)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16 }} className="text-blue-500 font-normal tracking-widest uppercase">{loggingOut ? 'SIGNING OUT...' : 'SIGN OUT'}</Text>
          </Pressable>

          <Pressable 
            onPress={handleDelete}
            disabled={loggingOut || deletingAccount}
            className="bg-red-500/10 dark:bg-red-900/20 active:bg-red-500/20 border border-red-200 dark:border-red-900/50 py-3.5 rounded-sm items-center"
          >
            {deletingAccount ? (
              <ActivityIndicator color="#ef4444" />
            ) : (
              <Text className="text-red-500 font-bold tracking-widest uppercase">Delete Account</Text>
            )}
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

        {/* Custom Delete Account Modal */}
        <Modal visible={showDeleteConfirm} animationType="fade" transparent={true}>
          <View className="flex-1 bg-black/60 items-center justify-center p-4">
            <View className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-sm shadow-2xl border border-gray-200 dark:border-gray-800 p-6 overflow-hidden">
              <View className="items-center mb-10">
                <View style={[Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 12px rgba(239, 68, 68, 0.8))' } as any : { shadowColor: '#ef4444', shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }]} className="mb-6">
                  <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' } as any} tintColor="#ef4444" size={48} />
                </View>
                <Text style={{ textShadowColor: 'rgba(239, 68, 68, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }} className="text-2xl font-black text-red-500 tracking-widest mb-4">DELETE ACCOUNT</Text>
                <Text className="text-gray-500 dark:text-gray-400 text-center leading-relaxed font-medium">
                  This action is <Text className="font-bold text-red-500">permanent</Text> and will destroy all of your encrypted journals and keys. Are you absolutely sure?
                </Text>
              </View>
              
              <View className="flex-row justify-between border-t border-gray-100 dark:border-gray-800 pt-5">
                <Pressable 
                  onPress={() => setShowDeleteConfirm(false)} 
                  className="flex-row items-center justify-center py-2 px-4 active:opacity-50"
                >
                  <Text className="font-bold text-gray-500 uppercase tracking-wider text-sm">Cancel</Text>
                </Pressable>
                
                <Pressable 
                  onPress={() => {
                    setShowDeleteConfirm(false);
                    performDeleteAccount();
                  }} 
                  style={[Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(239, 68, 68, 0.5))' } as any : { shadowColor: '#ef4444', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }]} 
                  className="flex-row items-center justify-center py-2 px-4 active:opacity-50"
                >
                  <Text style={{ color: '#ef4444' }} className="font-bold uppercase tracking-wider text-sm">Delete Forever</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}
