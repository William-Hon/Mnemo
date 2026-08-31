import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      <Text className="text-4xl font-normal mb-10 tracking-widest text-center text-black dark:text-white">MNEMO</Text>

      {errorMsg ? (
        <View className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-3 rounded-sm mb-4">
          <Text className="text-red-600 dark:text-red-400 text-sm text-center font-medium">{errorMsg}</Text>
        </View>
      ) : null}

      <TextInput
        className="w-full bg-white dark:bg-gray-900 p-4 rounded-sm border border-gray-200 dark:border-gray-800 mb-4 text-black dark:text-white"
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
        className="w-full bg-white dark:bg-gray-900 p-4 rounded-sm border border-gray-200 dark:border-gray-800 mb-8 text-black dark:text-white"
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

      <Pressable
        onPress={handleSignIn}
        disabled={loading}
        className={`w-full py-4 rounded-sm items-center mb-6 shadow-sm ${
          loading ? 'bg-blue-400' : 'bg-blue-500 active:bg-blue-600 shadow-blue-500/20'
        }`}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-white font-bold text-lg tracking-wider">SIGN IN</Text>
        )}
      </Pressable>

      <Link href="/(auth)/sign-up" asChild>
        <Pressable className="items-center p-2 active:opacity-50" disabled={loading}>
          <Text className="text-gray-500 dark:text-gray-400 font-medium">Don't have an account? Sign up</Text>
        </Pressable>
      </Link>
    </View>
  );
}
