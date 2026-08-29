import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { createPendingVoiceEntry, processTranscription, updateEntry, deleteEntry } from '../../src/services/entries';
import { uploadMedia } from '../../src/services/media';
import { requestMicrophonePermissions, startRecording, stopRecording } from '../../src/services/audio';

type State = 'idle' | 'recording' | 'transcribing' | 'reviewing';

export default function HomeScreen() {
  const [state, setState] = useState<State>('idle');
  const [recording, setRecording] = useState<any>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcribedText, setTranscribedText] = useState('');
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const { session } = useAuth();
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === 'recording') {
      interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => clearInterval(interval);
  }, [state]);

  const handleStartRecording = async () => {
    const hasPermission = await requestMicrophonePermissions();
    if (!hasPermission) {
      Alert.alert('Permission needed', 'Please allow microphone access to record voice notes.');
      return;
    }

    const newRecording = await startRecording();
    if (newRecording) {
      setRecording(newRecording);
      setState('recording');
    }
  };

  const handleStopRecording = async () => {
    if (!recording || !session?.user.id) return;

    setState('transcribing');
    const uri = await stopRecording(recording);
    setRecording(null);

    if (uri) {
      try {
        // 1. Upload audio to Supabase Storage
        const audioPath = await uploadMedia(session.user.id, uri, 'audio');
        
        // 2. Create pending entry in database
        const entry = await createPendingVoiceEntry(session.user.id, audioPath);
        setCurrentEntryId(entry.id);

        // 3. Trigger Edge Function for real AI transcription
        const text = await processTranscription(entry.id, audioPath);
        
        setTranscribedText(text);
        setState('reviewing');
      } catch (error) {
        console.error("Transcription error:", error);
        Alert.alert('Transcription Failed', 'The audio was saved, but transcription failed. You can retry it in the Admin tab.');
        resetState(); // Reset UI but keep the entry in the DB
      }
    } else {
      Alert.alert('Error', 'Failed to save recording.');
      handleCancel();
    }
  };

  const handleSave = async () => {
    if (!currentEntryId) return;
    
    try {
      await updateEntry(currentEntryId, transcribedText);
      resetState();
      router.push('/(tabs)/history');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save entry edits.');
    }
  };

  const handleCancel = async () => {
    if (state === 'recording' && recording) {
      await stopRecording(recording);
    }
    
    // If we cancel after an entry was created in the DB, delete it to keep things clean
    if (currentEntryId) {
      try {
        await deleteEntry(currentEntryId);
      } catch (e) {
        console.error("Failed to delete cancelled entry", e);
      }
    }
    
    resetState();
  };

  const resetState = () => {
    setState('idle');
    setRecording(null);
    setRecordingDuration(0);
    setTranscribedText('');
    setCurrentEntryId(null);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        className="flex-1"
      >
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-3xl font-bold mb-12 dark:text-white">Qora</Text>
          
          {/* Timer (Only visible when recording) */}
          {state === 'recording' && (
            <Text className="text-red-500 font-bold text-3xl mb-6">
              {formatDuration(recordingDuration)}
            </Text>
          )}

          {/* Main Interaction Button */}
          {state === 'idle' || state === 'reviewing' ? (
            <Pressable 
              onPress={state === 'idle' ? handleStartRecording : handleCancel}
              className="bg-black dark:bg-white w-48 h-48 rounded-full items-center justify-center mb-8 shadow-md active:opacity-80"
            >
              <Text className="text-white dark:text-black text-2xl font-semibold">
                {state === 'idle' ? 'Speak' : 'Reset'}
              </Text>
            </Pressable>
          ) : state === 'recording' ? (
            <Pressable 
              onPress={handleStopRecording}
              className="bg-red-500 w-48 h-48 rounded-full items-center justify-center mb-8 shadow-md active:opacity-80"
              style={{ backgroundColor: '#ef4444' }}
            >
              <Text className="text-white font-semibold text-2xl">Stop</Text>
            </Pressable>
          ) : (
            <View className="w-48 h-48 rounded-full items-center justify-center mb-8 bg-gray-100 dark:bg-gray-900">
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text className="text-gray-500 mt-4">Transcribing...</Text>
            </View>
          )}

          {/* Text Box / Save Button (Only visible in Reviewing state) */}
          {state === 'reviewing' && (
            <View className="w-full mt-6">
               <Text className="text-gray-500 dark:text-gray-400 mb-2 font-medium text-center">Review Transcription</Text>
               <TextInput
                  className="w-full h-40 bg-gray-100 dark:bg-gray-900 rounded-xl p-4 text-lg text-black dark:text-white border border-gray-200 dark:border-gray-800"
                  multiline
                  textAlignVertical="top"
                  value={transcribedText}
                  onChangeText={setTranscribedText}
               />
               <Pressable onPress={handleSave} className="bg-blue-500 p-4 rounded-xl items-center mt-4 shadow-sm active:opacity-80">
                 <Text className="text-white font-bold text-lg">Save Entry</Text>
               </Pressable>
            </View>
          )}
          
          {/* Type Instead Link (Only visible when idle) */}
          {state === 'idle' && (
            <Pressable className="p-4 active:opacity-50" onPress={() => router.push('/entry/new')}>
              <Text className="text-gray-500 dark:text-gray-400 text-lg">Type instead</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
