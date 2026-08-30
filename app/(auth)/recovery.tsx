import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { generateMEK, deriveKEK, wrapMEK, unwrapMEK, saveLocalMEK, generateSaltHex } from '@/src/lib/encryption';

export default function RecoveryScreen() {
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSetupOrUnlock = async () => {
    if (!passphrase || passphrase.length < 8) {
      Alert.alert('Invalid', 'Passphrase must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if user already has an encryption key in DB
      const { data: existingKeys, error: fetchError } = await supabase
        .from('user_encryption_keys')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingKeys) {
        // UNLOCK EXISTING MEK
        const kek = await deriveKEK(passphrase, existingKeys.kdf_salt);
        let mek;
        try {
          mek = await unwrapMEK(existingKeys.wrapped_mek, existingKeys.wrapped_mek_iv, kek);
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
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black items-center justify-center p-4">
      <View className="w-full max-w-sm">
        <Text className="text-3xl font-bold dark:text-white mb-2 text-center">Unlock Journal</Text>
        <Text className="text-gray-500 dark:text-gray-400 mb-8 text-center leading-relaxed">
          Your journal is end-to-end encrypted. Enter your recovery passphrase to unlock your device. If you are new, this will create your permanent passphrase.
        </Text>

        <TextInput
          className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-base mb-6 dark:text-white"
          placeholder="Recovery Passphrase"
          placeholderTextColor="#888"
          secureTextEntry
          value={passphrase}
          onChangeText={setPassphrase}
          editable={!loading}
        />

        <Pressable 
          className={`bg-blue-500 rounded-xl p-4 items-center ${loading ? 'opacity-50' : 'active:bg-blue-600'}`}
          onPress={handleSetupOrUnlock}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-lg">Unlock / Setup</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
