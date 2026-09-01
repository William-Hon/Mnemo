import { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { createTextEntry } from '../../src/services/entries';

export default function NewEntryScreen() {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const handleSave = async () => {
    if (!content.trim() || !user) return;
    
    try {
      setIsSubmitting(true);
      await createTextEntry(content.trim(), user.id);
      router.back();
    } catch (error) {
      console.error('Failed to save entry:', error);
      // In a real app, show a toast or alert here
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-black"
    >
      <View className="flex-row items-center justify-between p-4 border-b border-gray-800">
        <Pressable onPress={() => router.back()} className="p-2">
          <Text className="text-gray-400 text-lg">Cancel</Text>
        </Pressable>
        
        <Pressable 
          onPress={handleSave} 
          disabled={isSubmitting || !content.trim()}
          className={`px-4 py-2 rounded-full ${content.trim() ? 'bg-blue-500' : 'bg-gray-800'}`}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text className={`font-semibold ${content.trim() ? 'text-white' : 'text-gray-500'}`}>Save</Text>
          )}
        </Pressable>
      </View>

      <TextInput
        className="flex-1 p-6 text-lg text-white bg-black"
        placeholder="What's on your mind?"
        placeholderTextColor="#9ca3af"
        multiline
        autoFocus
        textAlignVertical="top"
        value={content}
        onChangeText={setContent}
      />
    </KeyboardAvoidingView>
  );
}
