import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { 
  getLocalMEK, 
  saveLocalMEK, 
  generateMEK, 
  deriveKEK, 
  wrapMEK, 
  unwrapMEK 
} from '../../src/lib/encryption';
import forge from 'node-forge';

export default function RecoveryScreen() {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [salt, setSalt] = useState<string | null>(null);
  const [wrappedMEK, setWrappedMEK] = useState<string | null>(null);
  const [iv, setIv] = useState<string | null>(null);
  
  useEffect(() => {
    checkEncryptionStatus();
  }, []);

  const checkEncryptionStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/(auth)/sign-in');
        return;
      }

      // Check if user already has a wrapped key in Supabase
      const { data, error } = await supabase
        .from('user_encryption_keys')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        // New user or missing keys
        setIsNewUser(true);
      } else {
        // Returning user on a new device
        setIsNewUser(false);
        setSalt(data.kdf_salt);
        setWrappedMEK(data.wrapped_mek);
        setIv(data.wrapped_mek_iv);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to check encryption status");
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    if (passphrase.length < 8) {
      Alert.alert("Passphrase too short", "Please use at least 8 characters.");
      return;
    }
    
    setLoading(true);
    
    // We use setTimeout to allow the UI to show the loading spinner before synchronous PBKDF2 runs
    setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not logged in");

        const mek = generateMEK();
        const newSalt = forge.util.bytesToHex(forge.random.getBytesSync(16));
        
        const kek = deriveKEK(passphrase, newSalt);
        const wrapped = wrapMEK(mek, kek);

        const { error } = await supabase
          .from('user_encryption_keys')
          .insert([{
            user_id: user.id,
            wrapped_mek: wrapped.wrappedMEK,
            wrapped_mek_iv: wrapped.iv,
            kdf_salt: newSalt,
            kdf_algorithm: 'pbkdf2-hmac-sha256',
            kdf_params: { iterations: 100000, keylen: 32 },
            encryption_algorithm: 'aes-256-gcm'
          }]);

        if (error) throw error;

        await saveLocalMEK(mek);
        router.replace('/(tabs)/home');
      } catch (e) {
        console.error(e);
        Alert.alert("Setup Failed", e.message);
        setLoading(false);
      }
    }, 100);
  };

  const handleRecover = async () => {
    if (!passphrase || !salt || !wrappedMEK || !iv) return;
    
    setLoading(true);
    
    setTimeout(async () => {
      try {
        const kek = deriveKEK(passphrase, salt);
        const mek = unwrapMEK(wrappedMEK, iv, kek);
        
        await saveLocalMEK(mek);
        router.replace('/(tabs)/home');
      } catch (e) {
        console.error(e);
        Alert.alert("Recovery Failed", "Incorrect passphrase or corrupted key.");
        setLoading(false);
      }
    }, 100);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {isNewUser ? "Secure Your Journal" : "Recover Your Journal"}
      </Text>
      
      <Text style={styles.subtitle}>
        {isNewUser 
          ? "Create a recovery passphrase to encrypt your journal. If you lose this, your data cannot be recovered."
          : "Enter your recovery passphrase to decrypt your journal on this device."
        }
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Recovery Passphrase"
        value={passphrase}
        onChangeText={setPassphrase}
        secureTextEntry
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.button} onPress={isNewUser ? handleSetup : handleRecover}>
        <Text style={styles.buttonText}>
          {isNewUser ? "Create Passphrase" : "Unlock Journal"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
