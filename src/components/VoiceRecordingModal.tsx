import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { router } from 'expo-router';
import { useAuth } from '../providers/AuthProvider';
import { createVoiceEntry } from '../services/entries';
import { requestMicrophonePermissions, startRecording, stopRecording, mockTranscribeAudio } from '../services/audio';

type VoiceRecordingModalProps = {
  visible: boolean;
  onClose: () => void;
};

type State = 'idle' | 'recording' | 'transcribing' | 'reviewing';

export function VoiceRecordingModal({ visible, onClose }: VoiceRecordingModalProps) {
  const [state, setState] = useState<State>('idle');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcribedText, setTranscribedText] = useState('');
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
    if (!recording) return;

    setState('transcribing');
    const uri = await stopRecording(recording);
    setRecording(null);

    if (uri) {
      // Mock transcription for Phase 3
      const text = await mockTranscribeAudio(uri);
      setTranscribedText(text);
      setState('reviewing');
    } else {
      Alert.alert('Error', 'Failed to save recording.');
      resetState();
    }
  };

  const handleSave = async () => {
    if (!session?.user.id) return;
    
    try {
      await createVoiceEntry(transcribedText, session.user.id);
      resetState();
      router.push('/(tabs)/history');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save entry.');
    }
  };

  const resetState = () => {
    setState('idle');
    setRecording(null);
    setRecordingDuration(0);
    setTranscribedText('');
    onClose();
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetState}>
      <SafeAreaView className="flex-1 bg-white dark:bg-black">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 p-6">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-8">
              <Text className="text-xl font-bold dark:text-white">Voice Entry</Text>
              <Pressable onPress={resetState} className="p-2">
                <Text className="text-blue-500 text-lg">Cancel</Text>
              </Pressable>
            </View>

            {/* Main Content Area */}
            <View className="flex-1 justify-center items-center">
              {state === 'idle' && (
                <View className="items-center">
                  <Text className="text-gray-500 dark:text-gray-400 mb-8 text-center px-4 text-lg">
                    Tap to start speaking your thoughts.
                  </Text>
                  <Pressable 
                    onPress={handleStartRecording}
                    className="bg-black dark:bg-white w-32 h-32 rounded-full items-center justify-center shadow-lg active:opacity-70"
                  >
                    <Text className="text-white dark:text-black font-semibold text-lg">Start</Text>
                  </Pressable>
                </View>
              )}

              {state === 'recording' && (
                <View className="items-center">
                  <Text className="text-red-500 font-bold text-3xl mb-12">
                    {formatDuration(recordingDuration)}
                  </Text>
                  <Pressable 
                    onPress={handleStopRecording}
                    className="bg-red-500 w-32 h-32 rounded-full items-center justify-center shadow-lg active:opacity-70"
                  >
                    <View className="bg-white w-10 h-10 rounded-sm" />
                  </Pressable>
                </View>
              )}

              {state === 'transcribing' && (
                <View className="items-center space-y-6">
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text className="text-gray-600 dark:text-gray-300 text-lg">Transcribing audio...</Text>
                </View>
              )}

              {state === 'reviewing' && (
                <View className="w-full flex-1">
                  <Text className="text-gray-500 dark:text-gray-400 mb-2 font-medium">Review Transcription</Text>
                  <TextInput
                    className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-xl p-4 text-lg text-black dark:text-white"
                    multiline
                    textAlignVertical="top"
                    value={transcribedText}
                    onChangeText={setTranscribedText}
                  />
                  <Pressable 
                    onPress={handleSave}
                    className="bg-blue-500 p-4 rounded-xl items-center mt-6 shadow-sm active:opacity-80"
                  >
                    <Text className="text-white font-bold text-lg">Save Entry</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
