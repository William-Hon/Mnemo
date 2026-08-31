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
    <View className="flex-1 justify-center px-6 bg-gray-50 dark:bg-black">
      <Text className="text-4xl font-normal mb-10 tracking-widest text-center text-black dark:text-white">MNEMO</Text>
      <Text className="text-xl font-bold mb-4 text-center text-gray-800 dark:text-gray-200 uppercase tracking-widest">Encryption Key for this Device</Text>
      <Text className="text-gray-500 dark:text-gray-400 mb-8 text-center leading-relaxed font-medium">
        Your journal is end-to-end encrypted. Enter your recovery passphrase to unlock your device. If you are new, this will create your permanent passphrase.
      </Text>

      <TextInput
        className="w-full bg-white dark:bg-gray-900 p-4 rounded-sm border border-gray-200 dark:border-gray-800 mb-6 text-black dark:text-white"
        placeholder="Recovery Passphrase"
        placeholderTextColor="#9ca3af"
        secureTextEntry
        value={passphrase}
        onSubmitEditing={handleSetupOrUnlock}
        onChangeText={setPassphrase}
        editable={!loading}
      />

      <Pressable 
        className={`w-full py-4 rounded-sm items-center mb-6 shadow-sm ${loading ? 'bg-blue-400' : 'bg-blue-500 active:bg-blue-600 shadow-blue-500/20'}`}
        onPress={handleSetupOrUnlock}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-white font-bold text-lg tracking-wider">UNLOCK / SETUP</Text>
        )}
      </Pressable>
    </View>
  );
}
