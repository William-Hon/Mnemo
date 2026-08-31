import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, cancelAnimation, Easing } from 'react-native-reanimated';
import { useAuth } from '../../src/providers/AuthProvider';
import { createPendingVoiceEntry, processTranscription, updateEntry, deleteEntries } from '../../src/services/entries';
import { uploadMedia } from '../../src/services/media';
import { requestMicrophonePermissions, startRecording, stopRecording } from '../../src/services/audio';

type State = 'idle' | 'recording' | 'transcribing' | 'reviewing' | 'typing';

export default function HomeScreen() {
  const [state, setState] = useState<State>('idle');
  const [recording, setRecording] = useState<any>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcribedText, setTranscribedText] = useState('');
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const { session } = useAuth();
  
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === 'recording') {
      interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseOpacity.value = withTiming(1, { duration: 300 });
    } else if (state === 'idle') {
      setRecordingDuration(0);
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      setRecordingDuration(0);
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = withTiming(1, { duration: 300 });
      pulseOpacity.value = withTiming(1, { duration: 300 });
    }
    return () => clearInterval(interval);
  }, [state]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseScale.value }],
      opacity: pulseOpacity.value,
    };
  });

  const handleStartRecording = async () => {
    const hasPermission = await requestMicrophonePermissions();
    if (!hasPermission) {
      Alert.alert('Permission needed', 'Please allow microphone access to record voice notes.');
      return;
    }

    const newRecording = await startRecording((db) => {
      let normalizedDb = Math.max(-60, Math.min(0, db));
      let scale = 1 + ((normalizedDb + 60) / 60) * 0.3;
      pulseScale.value = withTiming(scale, { duration: 100, easing: Easing.out(Easing.ease) });
    });
    
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
        const audioPath = await uploadMedia(session.user.id, uri, 'audio');
        const entry = await createPendingVoiceEntry(session.user.id, audioPath);
        setCurrentEntryId(entry.id);
        const text = await processTranscription(entry.id, audioPath);
        
        setTranscribedText(text);
        setState('reviewing');
      } catch (error) {
        console.error("Transcription error:", error);
        Alert.alert('Transcription Failed', 'The audio was saved, but transcription failed.');
        resetState();
      }
    } else {
      Alert.alert('Error', 'Failed to save recording.');
      handleCancel();
    }
  };

  const handleSaveTextEntry = async () => {
    if (!transcribedText.trim() || !session?.user.id) return;
    try {
      const { createTextEntry } = await import('../../src/services/entries');
      await createTextEntry(transcribedText);
      resetState();
      router.push('/(tabs)/history');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save text entry.');
    }
  };

  const handleSave = async () => {
    if (state === 'typing') {
      return handleSaveTextEntry();
    }
    
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
    
    if (currentEntryId) {
      try {
        await deleteEntries([{ id: currentEntryId } as any]);
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

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingTop: (state === 'typing' || state === 'reviewing') ? 48 : 24 }}>
          {(state === 'idle' || state === 'recording') && (
            <View style={{ marginBottom: 48, alignItems: 'center', width: '100%' }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: isDark ? '#fff' : '#000', letterSpacing: 1, marginBottom: 8, textAlign: 'center' }}>
                MNEMO
              </Text>
              <Text style={{ fontSize: 18, color: isDark ? '#d1d5db' : '#4b5563', fontStyle: 'italic', marginBottom: 12, textAlign: 'center' }}>
                /E^niE?.moES/
              </Text>
              <Text style={{ fontSize: 16, color: isDark ? '#fff' : '#000', lineHeight: 24, textAlign: 'center' }}>
                <Text style={{ fontStyle: 'italic' }}>n.</Text> memory; remembrance; a record of what should not be forgotten.
              </Text>
            </View>
          )}
          
          {/* Timer (Only visible when recording) */}
          {state === 'recording' && (
            <Text style={{ fontSize: 24, fontWeight: '300', color: isDark ? '#fff' : '#000', marginBottom: 32, fontFamily: 'monospace' }}>
              {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
            </Text>
          )}

          {/* Main Interaction Button */}
          {state !== 'typing' && (
            state === 'idle' || state === 'reviewing' ? (
              <Pressable 
                onPress={state === 'idle' ? handleStartRecording : handleCancel}
                style={{ marginBottom: state === 'reviewing' ? 16 : 32 }}
                className="active:opacity-80"
              >
                <Animated.View style={[
                  state === 'idle' ? animatedStyle : undefined, 
                  { 
                    width: state === 'reviewing' ? 128 : 192, 
                    height: state === 'reviewing' ? 128 : 192, 
                    borderRadius: state === 'reviewing' ? 64 : 96, 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    backgroundColor: 'transparent', 
                    borderWidth: state === 'idle' ? 4 : 2, 
                    borderColor: state === 'idle' ? '#3b82f6' : (isDark ? '#fff' : '#000'),
                    shadowColor: state === 'idle' ? '#3b82f6' : 'transparent',
                    shadowOpacity: state === 'idle' ? 0.6 : 0,
                    shadowRadius: 15,
                    shadowOffset: { width: 0, height: 0 },
                    ...(Platform.OS === 'web' && state === 'idle' ? { filter: 'drop-shadow(0px 0px 10px rgba(59, 130, 246, 0.8))' } as any : {})
                  }
                ]}>
                  <Text style={{ color: state === 'idle' ? '#3b82f6' : (isDark ? '#fff' : '#000'), fontSize: state === 'reviewing' ? 14 : 18, letterSpacing: 2, fontFamily: 'monospace', textTransform: 'uppercase', fontWeight: state === 'idle' ? 'bold' : 'normal' }}>
                    {state === 'idle' ? 'Speak' : 'Reset'}
                  </Text>
                </Animated.View>
              </Pressable>
            ) : state === 'recording' ? (
              <Pressable 
                onPress={handleStopRecording}
                style={{ marginBottom: 32 }}
                className="active:opacity-80"
              >
                <Animated.View style={[animatedStyle, { 
                  width: 192, height: 192, borderRadius: 96, alignItems: 'center', justifyContent: 'center', 
                  backgroundColor: 'transparent', borderWidth: 4, borderColor: '#3b82f6', 
                  shadowColor: '#3b82f6', shadowOpacity: 0.8, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
                  ...(Platform.OS === 'web' ? { filter: 'drop-shadow(0px 0px 12px rgba(59, 130, 246, 1))' } as any : {})
                }]}>
                  <Text style={{ color: '#3b82f6', fontSize: 18, letterSpacing: 2, fontFamily: 'monospace', textTransform: 'uppercase', fontWeight: 'bold' }}>Stop</Text>
                </Animated.View>
              </Pressable>
            ) : (
              <View style={{ width: 192, height: 192, borderRadius: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 32, borderWidth: 2, borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', backgroundColor: 'transparent' }}>
                <ActivityIndicator size="large" color={isDark ? "#ffffff" : "#000000"} />
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginTop: 16, fontFamily: 'monospace', letterSpacing: 2, fontSize: 12, textTransform: 'uppercase' }}>Transcribing</Text>
              </View>
            )
          )}

          {/* Text Box / Save Button (Visible in Reviewing OR Typing state) */}
          {(state === 'reviewing' || state === 'typing') && (
            <View style={{ width: '100%', flex: 1, marginTop: 16, paddingBottom: 32 }}>
               <Text style={{ color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 12, fontFamily: 'monospace', textAlign: 'center', letterSpacing: 2, fontSize: 12, textTransform: 'uppercase' }}>
                 {state === 'typing' ? 'Write Entry' : 'Review Transcription'}
               </Text>
               <TextInput
                  style={{ width: '100%', flex: 1, minHeight: 160, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', borderRadius: 4, padding: 16, fontSize: 18, color: isDark ? '#fff' : '#000', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }}
                  multiline
                  textAlignVertical="top"
                  value={transcribedText}
                  onChangeText={setTranscribedText}
                  placeholder={state === 'typing' ? "Type your thoughts..." : ""}
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                  autoFocus={state === 'typing'}
               />
               <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                 <Pressable onPress={handleCancel} style={{ flex: 1, backgroundColor: '#ef4444', padding: 16, borderRadius: 4, alignItems: 'center' }} className="active:opacity-80">
                   <Text style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>Cancel</Text>
                 </Pressable>
                 <Pressable onPress={handleSave} style={{ flex: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderWidth: 1, borderColor: isDark ? '#fff' : '#000', padding: 16, borderRadius: 4, alignItems: 'center' }} className="active:opacity-80">
                   <Text style={{ color: isDark ? '#fff' : '#000', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>Save Entry</Text>
                 </Pressable>
               </View>
            </View>
          )}
          
          {/* Type Instead Link (Only visible when idle) */}
          {state === 'idle' && (
            <Pressable style={{ padding: 16 }} className="active:opacity-50" onPress={() => setState('typing')}>
              <Text style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontSize: 12, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 2 }}>Type instead</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
