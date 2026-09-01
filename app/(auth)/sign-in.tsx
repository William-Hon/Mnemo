import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Modal, Platform } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  const handleSignIn = async () => {
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    // Once signed in, onAuthStateChange in AuthProvider triggers
    // and RootLayout automatically redirects to /(tabs)/home
  };

  return (
    <View className="flex-1 justify-center px-6 bg-gray-50 dark:bg-black">
      <Text style={{ textShadowColor: 'rgba(59, 130, 246, 1)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 40 }} className="text-4xl font-normal mb-2 tracking-widest text-center text-blue-400">MNEMO</Text>
      <Pressable onPress={() => setShowAbout(true)} className="mb-10 items-center active:opacity-50">
        <Text className="text-gray-500 dark:text-gray-400 text-[10px] tracking-widest uppercase font-medium underline">"What is MNEMO?"</Text>
      </Pressable>

      <Modal visible={showAbout} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/80 px-6">
          <View className="bg-gray-900 border border-gray-800 p-6 rounded-sm w-full max-w-sm">
            <Text className="text-xl font-bold mb-4 text-white uppercase tracking-widest">About MNEMO</Text>
            <Text className="text-gray-300 mb-4 leading-relaxed font-medium">
              MNEMO is a privacy-first journal archive.
            </Text>
            <Text className="text-gray-300 mb-4 leading-relaxed font-medium">
              Rant freely. Your entries are encrypted, organized, and searchable by meaning (even if they’re messy).
            </Text>
            <Text className="text-gray-300 mb-8 leading-relaxed font-medium">
              Find specific memories later, then choose what to do with them: bring them to therapy, export them to AI for deeper analysis, or keep them completely private.
            </Text>
            <Pressable onPress={() => setShowAbout(false)} className="py-2 items-center active:opacity-50">
              <Text style={{ textShadowColor: 'rgba(59, 130, 246, 0.8)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16 }} className="text-blue-500 font-normal tracking-widest uppercase text-base">CLOSE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {errorMsg ? (
        <View className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-3 rounded-sm mb-4">
          <Text className="text-red-600 dark:text-red-400 text-sm text-center font-medium">{errorMsg}</Text>
        </View>
      ) : null}

      <TextInput
        className="w-full bg-transparent p-4 rounded-sm border border-gray-200 dark:border-gray-800 mb-4 text-black dark:text-white"
        style={Platform.OS === 'web' ? { WebkitBoxShadow: '0 0 0 1000px #000 inset', WebkitTextFillColor: '#fff', outlineStyle: 'none' } as any : undefined}
        placeholder="Email"
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (errorMsg) setErrorMsg(null);
        }}
        editable={!loading}
      />
      <TextInput
        className="w-full bg-transparent p-4 rounded-sm border border-gray-200 dark:border-gray-800 mb-8 text-black dark:text-white"
        style={Platform.OS === 'web' ? { WebkitBoxShadow: '0 0 0 1000px #000 inset', WebkitTextFillColor: '#fff', outlineStyle: 'none' } as any : undefined}
        placeholder="Password"
        placeholderTextColor="#9ca3af"
        secureTextEntry
        value={password}
        onSubmitEditing={handleSignIn}
        onChangeText={(text) => {
          setPassword(text);
          if (errorMsg) setErrorMsg(null);
        }}
        editable={!loading}
      />

      <View className="w-full items-center mb-6">
        <Pressable
          onPress={handleSignIn}
          disabled={loading}
          style={Platform.OS === 'web' ? { boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)' } as any : { shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 }}
          className="border border-blue-500 px-10 py-3 rounded-sm active:opacity-50"
        >
          {loading ? (
            <ActivityIndicator color="#3b82f6" />
          ) : (
            <Text style={{ textShadowColor: 'rgba(59, 130, 246, 0.8)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16 }} className="text-blue-500 font-normal text-lg tracking-widest uppercase">SIGN IN</Text>
          )}
        </Pressable>
      </View>

      <Link href="/(auth)/sign-up" asChild>
        <Pressable className="items-center p-2 active:opacity-50" disabled={loading}>
          <Text className="text-gray-500 dark:text-gray-400 font-medium">Don't have an account? Sign up</Text>
        </Pressable>
      </Link>
    </View>
  );
}
