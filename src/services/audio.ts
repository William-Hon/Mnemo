import { Audio } from 'expo-av';

// Helper to request permissions
export async function requestMicrophonePermissions() {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

// Starts a new recording using high quality presets
export async function startRecording(): Promise<Audio.Recording | null> {
  try {
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

// Stops recording and returns the local file URI
export async function stopRecording(recording: Audio.Recording): Promise<string | null> {
  try {
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
    return recording.getURI();
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
