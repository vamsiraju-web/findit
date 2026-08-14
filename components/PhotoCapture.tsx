import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

interface PhotoCaptureProps {
  /** Already-uploaded photo URLs (for display) */
  existingPhotos?: string[];
  /** Called when a new photo is successfully uploaded */
  onPhotoUploaded: (url: string) => void;
  /** Called when a photo is removed */
  onPhotoRemoved?: (url: string) => void;
  /** Max number of photos allowed */
  maxPhotos?: number;
}

/**
 * Reusable photo capture component.
 * Opens camera or photo library, uploads to Supabase Storage 'item-photos' bucket,
 * and returns the public URL via callback.
 */
export default function PhotoCapture({
  existingPhotos = [],
  onPhotoUploaded,
  onPhotoRemoved,
  maxPhotos = 5,
}: PhotoCaptureProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [photos, setPhotos] = useState<string[]>(existingPhotos);

  const canAddMore = photos.length < maxPhotos;

  const showPickerOptions = () => {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: handleCamera },
      { text: 'Photo Library', onPress: handleLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const handleLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library permission is needed.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (localUri: string) => {
    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      const userId = session.user.id;
      const fileExt = localUri.split('.').pop() || 'jpg';
      const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to Uint8Array
      const binaryData = base64ToBytes(base64);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('item-photos')
        .upload(fileName, binaryData, {
          contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('item-photos')
        .getPublicUrl(data.path);

      const publicUrl = urlData.publicUrl;
      setPhotos(prev => [...prev, publicUrl]);
      onPhotoUploaded(publicUrl);
    } catch (error: any) {
      console.error('Photo upload failed:', error);
      Alert.alert('Upload Failed', error.message || 'Could not upload photo. Try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = (url: string) => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setPhotos(prev => prev.filter(p => p !== url));
          onPhotoRemoved?.(url);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Photos</Text>

      <View style={styles.photosGrid}>
        {/* Existing photos */}
        {photos.map((url, index) => (
          <View key={index} style={styles.photoWrapper}>
            <Image source={{ uri: url }} style={styles.photo} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemovePhoto(url)}
            >
              <Ionicons name="close-circle" size={22} color="#E74C3C" />
            </TouchableOpacity>
          </View>
        ))}

        {/* Add photo button */}
        {canAddMore && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={showPickerOptions}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#1B4F72" />
            ) : (
              <>
                <Ionicons name="camera" size={28} color="#1B4F72" />
                <Text style={styles.addText}>Add Photo</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {photos.length > 0 && (
        <Text style={styles.countText}>
          {photos.length}/{maxPhotos} photos
        </Text>
      )}
    </View>
  );
}

/**
 * Convert base64 string to Uint8Array.
 * Works on Hermes engine (React Native).
 */
function base64ToBytes(base64: string): Uint8Array {
  const lookup = new Uint8Array(256);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

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

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#95A5A6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoWrapper: {
    position: 'relative',
    width: 88,
    height: 88,
    borderRadius: 10,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  removeButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
  },
  addButton: {
    width: 88,
    height: 88,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D6EAF8',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FBFE',
    gap: 4,
  },
  addText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1B4F72',
  },
  countText: {
    fontSize: 12,
    color: '#95A5A6',
    marginTop: 4,
  },
});
