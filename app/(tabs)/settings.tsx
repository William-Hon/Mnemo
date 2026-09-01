import React, { useState } from 'react';
import { View, Text, Pressable, SafeAreaView, ScrollView, Modal, Platform, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../../src/providers/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { deleteLocalMEK } from '../../src/lib/encryption';
import { LocalAIService } from '../../src/services/LocalAIService';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import WhatsNextModal from '../../components/WhatsNextModal';

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
  const [showLimitInfo, setShowLimitInfo] = useState(false);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [showWhatsNextModal, setShowWhatsNextModal] = useState(false);
  React.useEffect(() => {
    checkModelStatus();
  }, []);

  const checkModelStatus = async () => {
    const isInstalled = await LocalAIService.isModelDownloaded();
    setModelInstalled(isInstalled);
    const limitInfo = await LocalAIService.getDownloadLimitInfo();
    setDownloadLimit(limitInfo);
  };

  const isOutOfDownloads = downloadLimit ? (downloadLimit.total - downloadLimit.used <= 0) : false;

  const handleDownloadModel = async () => {
    if (isOutOfDownloads) return;
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
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 p-6 mt-8">
        <View className="bg-gray-900 rounded-sm p-4 shadow-sm border border-gray-800 mb-6">
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Private AI</Text>
          <View className="flex-row items-center mb-1">
            <Text className="text-gray-100 text-base">
              Model: Qwen3 0.6B Q4_K_M
            </Text>
            <Pressable onPress={() => setShowModelInfo(true)} className="p-1 active:opacity-50 ml-1">
              <SymbolView name={{ ios: 'info.circle', android: 'info', web: 'info' } as any} tintColor="#9ca3af" size={16} />
            </Pressable>
          </View>

          <Modal visible={showModelInfo} animationType="fade" transparent={true}>
            <View className="flex-1 bg-black/60 items-center justify-center p-4">
              <View className="w-full max-w-sm bg-gray-900 rounded-sm shadow-2xl border border-gray-800 p-6 overflow-hidden">
                <View className="items-center mb-8">
                  <View style={[Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 12px rgba(59, 130, 246, 0.8))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }]} className="mb-6">
                    <SymbolView name={{ ios: 'cpu', android: 'memory', web: 'memory' } as any} tintColor="#3b82f6" size={48} />
                  </View>
                  <Text style={{ textShadowColor: 'rgba(59, 130, 246, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }} className="text-xl font-black text-blue-500 tracking-widest text-center mb-4 uppercase">Qwen3 0.6B Q4_K_M</Text>
                  <Text className="text-gray-400 text-left self-start leading-relaxed font-medium mb-4">
                    This AI model strikes the perfect balance for private, local journaling on everyday devices.
                  </Text>
                  
                  <Text className="text-gray-300 font-bold self-start mb-2">Pros:</Text>
                  <View className="self-start ml-2 mb-4">
                    <Text className="text-gray-400 font-medium mb-1">• Runs completely locally (100% private)</Text>
                    <Text className="text-gray-400 font-medium mb-1">• Tiny file size (~484 MB download)</Text>
                    <Text className="text-gray-400 font-medium mb-1">• Fast enough to run directly in your browser or phone</Text>
                  </View>

                  <Text className="text-gray-300 font-bold self-start mb-2">Cons:</Text>
                  <View className="self-start ml-2">
                    <Text className="text-gray-400 font-medium mb-1">• Not as knowledgeable as large cloud models like ChatGPT</Text>
                    <Text className="text-gray-400 font-medium mb-1">• Best suited for short text (like a ~500-word journal entry)</Text>
                  </View>
                </View>
                
                <View className="flex-row justify-end border-t border-gray-800 pt-5">
                  <Pressable 
                    onPress={() => setShowModelInfo(false)}
                    className="bg-gray-800 py-3 px-6 rounded-sm active:bg-gray-700 w-full items-center"
                  >
                    <Text className="text-white font-bold tracking-widest uppercase text-xs">Got it</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
          <Text className="text-gray-500 text-sm mb-1">
            Version: v1
          </Text>
          <Text className="text-gray-500 text-sm mb-1">
            Status: {modelInstalled ? 'Installed (~484 MB)' : 'Not installed'}
          </Text>
          {downloadLimit && (
            <View className="flex-row items-center mb-4">
              <Text className="text-gray-500 text-sm mr-2">
                {Math.max(0, downloadLimit.total - downloadLimit.used)}/{downloadLimit.total} manual downloads remaining this month.
              </Text>
              <Pressable onPress={() => setShowLimitInfo(true)} className="p-1 active:opacity-50">
                <SymbolView name={{ ios: 'info.circle', android: 'info', web: 'info' } as any} tintColor="#9ca3af" size={16} />
              </Pressable>
            </View>
          )}

          <Modal visible={showLimitInfo} animationType="fade" transparent={true}>
            <View className="flex-1 bg-black/60 items-center justify-center p-4">
              <View className="w-full max-w-sm bg-gray-900 rounded-sm shadow-2xl border border-gray-800 p-6 overflow-hidden">
                <View className="items-center mb-8">
                  <View style={[Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 12px rgba(59, 130, 246, 0.8))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }]} className="mb-6">
                    <SymbolView name={{ ios: 'info.circle.fill', android: 'info', web: 'info' } as any} tintColor="#3b82f6" size={48} />
                  </View>
                  <Text style={{ textShadowColor: 'rgba(59, 130, 246, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }} className="text-2xl font-black text-blue-500 tracking-widest mb-4">DOWNLOAD LIMIT</Text>
                  <Text className="text-gray-400 text-center leading-relaxed font-medium mb-4">
                    The AI model is a large file hosted on a secure server. We limit manual downloads to help manage our bandwidth costs.
                  </Text>
                  <Text className="text-gray-400 text-left self-start leading-relaxed font-medium">
                    Once downloaded, it runs locally for free forever and stays on your device unless you:
                  </Text>
                  <View className="self-start mt-2 ml-2">
                    <Text className="text-gray-400 font-medium">• Sign out of the app</Text>
                    <Text className="text-gray-400 font-medium">• Clear browser/site data</Text>
                    <Text className="text-gray-400 font-medium">• Manually remove it</Text>
                  </View>
                </View>
                
                <View className="flex-row justify-end border-t border-gray-800 pt-5">
                  <Pressable 
                    onPress={() => setShowLimitInfo(false)} 
                    style={[Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 8px rgba(59, 130, 246, 0.5))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }]} 
                    className="flex-row items-center justify-center py-2 px-6 active:opacity-50"
                  >
                    <Text style={{ color: '#3b82f6' }} className="font-bold uppercase tracking-wider text-sm">Got it</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
          
          {modelActionLoading && (
            <View className="mb-4 flex-row items-center gap-3 bg-blue-900/20 p-3 rounded-sm">
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text className="text-blue-400 font-bold text-xs flex-1">{modelProgress || 'Loading...'}</Text>
            </View>
          )}

          {!modelInstalled ? (
            <Pressable 
              onPress={handleDownloadModel}
              disabled={modelActionLoading || isOutOfDownloads}
              className={`py-3 rounded-sm items-center active:opacity-50 ${modelActionLoading || isOutOfDownloads ? 'bg-gray-800' : 'bg-blue-500'}`}
            >
              <Text className={`${modelActionLoading || isOutOfDownloads ? 'text-gray-500' : 'text-white'} font-bold tracking-widest uppercase text-xs`}>Download Model</Text>
            </Pressable>
          ) : (
            <Pressable 
              onPress={handleRemoveModel}
              disabled={modelActionLoading}
              className="bg-red-900/20 py-3 rounded-sm items-center active:opacity-50"
            >
              <Text className="text-red-500 font-bold tracking-widest uppercase text-xs">Remove Model</Text>
            </Pressable>
          )}
        </View>

        {/* Roadmap & What's Next */}
        <View className="bg-gray-900 rounded-sm p-4 shadow-sm border border-gray-800 mb-6">
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Roadmap & Future</Text>
          <Text className="text-gray-100 text-base mb-1">
            What's Next in Mnemo
          </Text>
          <Text className="text-gray-500 text-xs mb-4 leading-relaxed">
            Discover upcoming capabilities: encrypted vector vaults, handwritten OCR, and daily reflection sparks.
          </Text>

          <Pressable 
            onPress={() => setShowWhatsNextModal(true)}
            className="bg-blue-950/60 border border-blue-800/80 py-3 rounded-sm items-center active:opacity-60 flex-row justify-center gap-2"
          >
            <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' } as any} tintColor="#60a5fa" size={18} />
            <Text className="text-blue-400 font-bold tracking-wider uppercase text-xs">View What's Next</Text>
          </Pressable>
        </View>

        <View className="bg-gray-900 rounded-sm p-4 shadow-sm border border-gray-800 mb-6">
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Account</Text>
          <Text className="text-gray-100 text-base mb-1">
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
            className="bg-red-900/20 active:bg-red-900/30 border border-red-900/50 py-3.5 rounded-sm items-center"
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
            <View className="w-full max-w-sm bg-gray-900 rounded-sm shadow-2xl border border-gray-800 p-6 overflow-hidden">
              <View className="items-center mb-10">
                <View style={[Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 12px rgba(59, 130, 246, 0.8))' } as any : { shadowColor: '#3b82f6', shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }]} className="mb-6">
                  <SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' } as any} tintColor="#3b82f6" size={48} />
                </View>
                <Text style={{ textShadowColor: 'rgba(59, 130, 246, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }} className="text-2xl font-black text-blue-500 tracking-widest mb-4">SIGN OUT</Text>
                <Text className="text-gray-400 text-center leading-relaxed font-medium">
                  Are you sure you want to sign out of your account?
                </Text>
              </View>
              
              <View className="flex-row justify-between border-t border-gray-800 pt-5">
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
            <View className="w-full max-w-sm bg-gray-900 rounded-sm shadow-2xl border border-gray-800 p-6 overflow-hidden">
              <View className="items-center mb-10">
                <View style={[Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 12px rgba(239, 68, 68, 0.8))' } as any : { shadowColor: '#ef4444', shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }]} className="mb-6">
                  <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' } as any} tintColor="#ef4444" size={48} />
                </View>
                <Text style={{ textShadowColor: 'rgba(239, 68, 68, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }} className="text-2xl font-black text-red-500 tracking-widest mb-4">DELETE ACCOUNT</Text>
                <Text className="text-gray-400 text-center leading-relaxed font-medium">
                  This action is <Text className="font-bold text-red-500">permanent</Text> and will destroy all of your encrypted journals and keys. Are you absolutely sure?
                </Text>
              </View>
              
              <View className="flex-row justify-between border-t border-gray-800 pt-5">
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

      <WhatsNextModal
        visible={showWhatsNextModal}
        onClose={() => setShowWhatsNextModal(false)}
      />
    </SafeAreaView>
  );
}
