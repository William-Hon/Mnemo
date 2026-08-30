import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let webMediaRecorder: MediaRecorder | null = null;
let webAudioChunks: Blob[] = [];

// Helper to request permissions
export async function requestMicrophonePermissions() {
  if (Platform.OS === 'web') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop tracks immediately just for the permission check so we don't leak the indicator
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

// Starts a new recording using high quality presets
export async function startRecording(): Promise<any> {
  try {
    if (Platform.OS === 'web') {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      webMediaRecorder = new MediaRecorder(stream);
      webAudioChunks = [];
      
      webMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          webAudioChunks.push(event.data);
        }
      };
      
      webMediaRecorder.start();
      return 'web-recording'; // Truthy value so UI knows it started
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    return recording;
  } catch (err) {
    console.error('Failed to start recording', err);
    return null;
  }
}

// Stops recording and returns the local file URI (or Blob URL on web)
export async function stopRecording(recording: any): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && webMediaRecorder) {
      return await new Promise<string | null>((resolve, reject) => {
        webMediaRecorder!.onstop = () => {
          const audioBlob = new Blob(webAudioChunks, { type: 'audio/webm' });
          const url = URL.createObjectURL(audioBlob);
          
          // Stop all microphone tracks to release the hardware indicator
          webMediaRecorder!.stream.getTracks().forEach(track => track.stop());
          
          resolve(url);
        };
        
        try {
          webMediaRecorder!.stop();
        } catch (err) {
          // If stopped before fully initialized or already inactive
          webMediaRecorder!.stream.getTracks().forEach(track => track.stop());
          resolve(null);
        }
      });
    }

    if (recording && typeof recording !== 'string') {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      return recording.getURI();
    }
    
    return null;
  } catch (err) {
    console.error('Failed to stop recording', err);
    return null;
  }
}

// MOCK: Simulate transcription delay (To be replaced in Phase 4)
export async function mockTranscribeAudio(uri: string): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("This is a mocked transcription of your voice note. You can edit this text before saving.");
    }, 2000);
  });
}
