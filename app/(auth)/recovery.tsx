import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, SafeAreaView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { generateMEK, deriveKEK, wrapMEK, unwrapMEK, saveLocalMEK, generateSaltHex } from '@/src/lib/encryption';
import { SymbolView } from 'expo-symbols';

export default function RecoveryScreen() {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showConfirmPassphrase, setShowConfirmPassphrase] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasExistingKey, setHasExistingKey] = useState<boolean | null>(null);
  const [keyData, setKeyData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    checkExistingKey();
  }, []);

  const checkExistingKey = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/(auth)/sign-in');
        return;
      }

      const { data: existingKeys, error: fetchError } = await supabase
        .from('user_encryption_keys')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingKeys) {
        setHasExistingKey(true);
        setKeyData(existingKeys);
      } else {
        setHasExistingKey(false);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSetupOrUnlock = async () => {
    setErrorMsg('');
    
    if (!hasExistingKey) {
      if (!passphrase || passphrase.length < 8) {
        setErrorMsg('Passphrase must be at least 8 characters.');
        return;
      }
      if (passphrase !== confirmPassphrase) {
        setErrorMsg('Passphrases do not match.');
        return;
      }
      if (!hasAcknowledged) {
        setErrorMsg('Please acknowledge that you have saved your passphrase.');
        return;
      }
    } else {
      if (!passphrase || passphrase.length < 8) {
        setErrorMsg('Passphrase must be at least 8 characters.');
        return;
      }
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (hasExistingKey && keyData) {
        // UNLOCK EXISTING MEK
        const kek = await deriveKEK(passphrase, keyData.kdf_salt);
        let mek;
        try {
          mek = await unwrapMEK(keyData.wrapped_mek, keyData.wrapped_mek_iv, kek);
        } catch (e) {
          throw new Error('Incorrect passphrase or corrupted key data.');
        }
        await saveLocalMEK(mek);
      } else {
        // SETUP NEW MEK
        const salt = generateSaltHex();
        const kek = await deriveKEK(passphrase, salt);
        const mek = await generateMEK();
        
        const { wrappedMek, iv } = await wrapMEK(mek, kek);

        const { error: insertError } = await supabase
          .from('user_encryption_keys')
          .insert({
            user_id: user.id,
            wrapped_mek: wrappedMek,
            wrapped_mek_iv: iv,
            kdf_salt: salt,
            kdf_algorithm: 'PBKDF2',
            kdf_params: { iterations: 100000, length: 32 },
            encryption_algorithm: 'AES-GCM'
          });

        if (insertError) throw insertError;
        
        await saveLocalMEK(mek);
      }

      router.replace('/(tabs)/home');

    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.replace('/(auth)/sign-in');
  };

  if (initialLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-black">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center px-6 bg-black relative">
      <Pressable onPress={handleBack} className="absolute top-12 left-6 active:opacity-50 p-2 z-10">
        <Text className="text-gray-400 text-xs font-bold tracking-widest uppercase">← Back</Text>
      </Pressable>
      
      {hasExistingKey ? (
        <>
          <Text className="text-[38px] font-bold mb-4 mt-8 text-center text-gray-100 uppercase tracking-wider">Unlock your journal</Text>
          <Text className="text-gray-400 mb-8 text-center leading-relaxed font-medium">
            Enter your encryption passphrase to unlock your journals on this device.
          </Text>

          <View className="w-full mb-8 relative justify-center">
            <TextInput
              className="w-full bg-gray-900 p-4 pr-12 rounded-sm border border-gray-800 text-white"
              style={Platform.OS === 'web' ? { outlineColor: '#3b82f6' } as any : undefined}
              placeholder="Encryption Passphrase"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassphrase}
              value={passphrase}
              onSubmitEditing={() => {
                if (!hasExistingKey && !hasAcknowledged) {
                  setErrorMsg('Please acknowledge that you have saved your passphrase.');
                  return;
                }
                handleSetupOrUnlock();
              }}
              onChangeText={setPassphrase}
              editable={!loading}
            />
            <Pressable 
              onPress={() => setShowPassphrase(!showPassphrase)} 
              className="absolute right-4 p-1 active:opacity-50"
            >
              <SymbolView 
                name={{ ios: showPassphrase ? 'eye' : 'eye.slash', android: showPassphrase ? 'visibility' : 'visibility_off', web: showPassphrase ? 'visibility' : 'visibility_off' } as any} 
                tintColor="#6b7280" 
                size={20} 
              />
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text className="text-[38px] font-bold mb-4 mt-8 text-center text-gray-100 uppercase tracking-wider">Set Up Encryption</Text>
          <View style={{ width: '70%', alignSelf: 'center', maxWidth: 640 }} className="mb-8 px-2">
            <Text 
              style={{ textShadowColor: 'rgba(239, 68, 68, 0.3)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }} 
              className="text-red-500 text-sm leading-relaxed font-normal text-center"
            >
              <Text className="font-bold">Critical Warning:</Text> This passphrase protects the encryption key used to decrypt your journals. Only you can unlock your entries. Mnemo <Text className="underline font-bold">CANNOT</Text> access or recover your passphrase. If you lose your passphrase, your journals cannot be recovered.
            </Text>
          </View>

          <View className="w-full mb-4 relative justify-center">
            <TextInput
              className="w-full bg-gray-900 p-4 pr-12 rounded-sm border border-gray-800 text-white"
              style={Platform.OS === 'web' ? { outlineColor: '#3b82f6' } as any : undefined}
              placeholder="Passphrase"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassphrase}
              value={passphrase}
              onChangeText={setPassphrase}
              editable={!loading}
            />
            <Pressable 
              onPress={() => setShowPassphrase(!showPassphrase)} 
              className="absolute right-4 p-1 active:opacity-50"
            >
              <SymbolView 
                name={{ ios: showPassphrase ? 'eye' : 'eye.slash', android: showPassphrase ? 'visibility' : 'visibility_off', web: showPassphrase ? 'visibility' : 'visibility_off' } as any} 
                tintColor="#6b7280" 
                size={20} 
              />
            </Pressable>
          </View>

          <View className="w-full mb-4 relative justify-center">
            <TextInput
              className="w-full bg-gray-900 p-4 pr-12 rounded-sm border border-gray-800 text-white"
              style={Platform.OS === 'web' ? { outlineColor: '#3b82f6' } as any : undefined}
              placeholder="Confirm passphrase"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showConfirmPassphrase}
              value={confirmPassphrase}
              onChangeText={setConfirmPassphrase}
              editable={!loading}
            />
            <Pressable 
              onPress={() => setShowConfirmPassphrase(!showConfirmPassphrase)} 
              className="absolute right-4 p-1 active:opacity-50"
            >
              <SymbolView 
                name={{ ios: showConfirmPassphrase ? 'eye' : 'eye.slash', android: showConfirmPassphrase ? 'visibility' : 'visibility_off', web: showConfirmPassphrase ? 'visibility' : 'visibility_off' } as any} 
                tintColor="#6b7280" 
                size={20} 
              />
            </Pressable>
          </View>

          <Pressable 
            className="flex-row items-center mb-6 active:opacity-50"
            onPress={() => setHasAcknowledged(!hasAcknowledged)}
            disabled={loading}
          >
            <View className={`w-5 h-5 rounded-sm border mr-3 items-center justify-center ${hasAcknowledged ? 'bg-gray-200 border-gray-200' : 'border-gray-700 bg-transparent'}`}>
               {hasAcknowledged && <Text className="text-black text-xs font-bold">✓</Text>}
            </View>
            <Text className="text-gray-300 text-sm font-medium">I’ve saved my passphrase somewhere secure.</Text>
          </Pressable>
        </>
      )}

      {errorMsg ? (
        <Text style={{ textShadowColor: 'rgba(239, 68, 68, 0.3)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }} className="text-red-500 font-bold mb-4 text-center tracking-wider text-sm">{errorMsg}</Text>
      ) : null}

      <Pressable 
        className={`w-full py-4 items-center ${(!hasExistingKey && !hasAcknowledged) ? 'opacity-40' : 'active:opacity-50'}`}
        onPress={() => {
          if (!hasExistingKey && !hasAcknowledged) {
            setErrorMsg('Please acknowledge that you have saved your passphrase.');
            return;
          }
          handleSetupOrUnlock();
        }}
        disabled={loading || (!hasExistingKey && !hasAcknowledged)}
      >
        {loading ? (
          <ActivityIndicator color="#3b82f6" />
        ) : (
          <Text 
            style={(!hasExistingKey && !hasAcknowledged) ? undefined : { textShadowColor: 'rgba(59, 130, 246, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }} 
            className={`font-normal text-lg tracking-widest uppercase ${(!hasExistingKey && !hasAcknowledged) ? 'text-gray-500' : 'text-blue-500'}`}
          >
            {hasExistingKey ? 'UNLOCK' : 'CREATE PASSPHRASE'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
