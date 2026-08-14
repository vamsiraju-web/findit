import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

let recording: Audio.Recording | null = null;

/**
 * Start recording audio from the microphone.
 */
export async function startRecording(): Promise<void> {
  try {
    // Request permissions
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error('Microphone permission required');

    // Set audio mode for recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // Create and start recording
    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recording = newRecording;
  } catch (error) {
    console.error('Failed to start recording:', error);
    throw error;
  }
}

/**
 * Stop recording and return the local file URI.
 */
export async function stopRecording(): Promise<string | null> {
  if (!recording) return null;

  try {
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    const uri = recording.getURI();
    recording = null;
    return uri;
  } catch (error) {
    console.error('Failed to stop recording:', error);
    recording = null;
    return null;
  }
}

/**
 * Upload a voice memo to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadVoiceMemo(localUri: string): Promise<string | null> {
  try {
    // Use getSession (local) instead of getUser (network call)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not authenticated');

    const user = session.user;
    const fileName = `${user.id}/${Date.now()}.m4a`;

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to ArrayBuffer (atob doesn't work on Hermes/RN)
    const binaryStr = base64ToBytes(base64);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('voice-memos')
      .upload(fileName, binaryStr, {
        contentType: 'audio/m4a',
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('voice-memos')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Failed to upload voice memo:', error);
    throw error; // Re-throw so the caller can show the error
  }
}

/**
 * Play back a voice memo from a URL.
 */
export async function playVoiceMemo(url: string): Promise<Audio.Sound> {
  const { sound } = await Audio.Sound.createAsync({ uri: url });
  await sound.playAsync();
  return sound;
}

/**
 * Convert base64 string to Uint8Array.
 * Works on Hermes engine (React Native) where atob is not available.
 */
function base64ToBytes(base64: string): Uint8Array {
  const lookup = new Uint8Array(256);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  // Remove padding
  let bufferLength = Math.floor(base64.length * 0.75);
  if (base64[base64.length - 1] === '=') bufferLength--;
  if (base64[base64.length - 2] === '=') bufferLength--;

  const bytes = new Uint8Array(bufferLength);
  let p = 0;

  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  return bytes;
}
