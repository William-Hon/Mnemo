import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let webMediaRecorder: MediaRecorder | null = null;
let webAudioChunks: Blob[] = [];
let webAudioCtx: AudioContext | null = null;
let webAnimationFrameId: number | null = null;

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
export async function startRecording(onMetering?: (db: number) => void): Promise<any> {
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
      
      if (onMetering) {
        webAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = webAudioCtx.createAnalyser();
        analyser.fftSize = 256;
        const source = webAudioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateMetering = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          // map 0-255 roughly to -60dB to 0dB range for consistency
          const db = -60 + (average / 255) * 60;
          onMetering(db);
          webAnimationFrameId = requestAnimationFrame(updateMetering);
        };
        updateMetering();
      }
      
      webMediaRecorder.start();
      return 'web-recording'; // Truthy value so UI knows it started
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
      onMetering ? (status) => {
        if (status.metering !== undefined) {
           onMetering(status.metering);
        }
      } : undefined,
      100
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
    if (Platform.OS === 'web') {
      if (webAnimationFrameId !== null) {
        cancelAnimationFrame(webAnimationFrameId);
        webAnimationFrameId = null;
      }
      if (webAudioCtx) {
        webAudioCtx.close();
        webAudioCtx = null;
      }
    }
    
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
