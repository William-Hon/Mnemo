import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignUp = async () => {
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    // If Supabase has email confirmation enabled, data.session will be null
    if (!data.session) {
      Alert.alert(
        'Check Your Email',
        'We sent you a confirmation link. Please check your email to activate your account.'
      );
    }
    // If confirmation is disabled, onAuthStateChange in AuthProvider will auto-route to (tabs)/home
  };

  return (
    <View className="flex-1 justify-center px-6 bg-white dark:bg-black">
      <Text className="text-3xl font-bold mb-8 text-center dark:text-white">Create Account</Text>

      {errorMsg ? (
        <View className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3 rounded-xl mb-4">
          <Text className="text-red-600 dark:text-red-400 text-sm text-center">{errorMsg}</Text>
        </View>
      ) : null}

      <TextInput
        className="w-full bg-gray-100 dark:bg-gray-900 p-4 rounded-xl mb-4 text-black dark:text-white"
        placeholder="Email"
        placeholderTextColor="#6b7280"
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
        className="w-full bg-gray-100 dark:bg-gray-900 p-4 rounded-xl mb-8 text-black dark:text-white"
        placeholder="Password (min. 6 characters)"
        placeholderTextColor="#6b7280"
        secureTextEntry
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (errorMsg) setErrorMsg(null);
        }}
        editable={!loading}
      />

      <Pressable
        onPress={handleSignUp}
        disabled={loading}
        className={`w-full p-4 rounded-xl items-center mb-6 ${
          loading ? 'bg-gray-400 dark:bg-gray-700' : 'bg-black dark:bg-white active:opacity-80'
        }`}
      >
        {loading ? (
          <ActivityIndicator color={process.env.EXPO_PUBLIC_COLOR_SCHEME === 'dark' ? '#000' : '#fff'} />
        ) : (
          <Text className="text-white dark:text-black font-semibold text-lg">Sign Up</Text>
        )}
      </Pressable>

      <Link href="/(auth)/sign-in" asChild>
        <Pressable className="items-center p-2" disabled={loading}>
          <Text className="text-gray-500">Already have an account? Sign in</Text>
        </Pressable>
      </Link>
    </View>
  );
}
