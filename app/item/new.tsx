import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Image,
} from 'react-native';
import { router, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { startRecording, stopRecording, uploadVoiceMemo } from '../../services/voice';
import { processVoiceMemo, processTextInput } from '../../services/ai';
import { supabase } from '../../services/supabase';
import { SUPABASE_URL } from '../../constants/config';
import { useItemStore } from '../../stores/itemStore';
import { ExtractionResult } from '../../types/database';
import { colors, spacing, borderRadius, shadows, STATUSBAR_HEIGHT } from '../../constants/theme';

type Step = 'input' | 'processing' | 'confirm';

export default function NewItemScreen() {
  const [step, setStep] = useState<Step>('input');
  const [isRecording, setIsRecording] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [transcript, setTranscript] = useState('');
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [voiceMemoUrl, setVoiceMemoUrl] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const { addItem } = useItemStore();

  // Waveform animation
  const bars = useRef(Array.from({ length: 20 }, () => new Animated.Value(0.3))).current;

  useEffect(() => {
    if (isRecording) {
      bars.forEach((bar, i) => {
        const animate = () => {
          Animated.sequence([
            Animated.timing(bar, { toValue: Math.random(), duration: 200 + i * 30, useNativeDriver: true }),
            Animated.timing(bar, { toValue: 0.3, duration: 200 + i * 30, useNativeDriver: true }),
          ]).start(() => { if (isRecording) animate(); });
        };
        setTimeout(animate, i * 50);
      });
    } else {
      bars.forEach(bar => bar.setValue(0.3));
    }
  }, [isRecording]);

  const handleStartRecording = async () => {
    try {
      await startRecording();
      setIsRecording(true);
    } catch (error) {
      Alert.alert('Error', 'Could not start recording. Check microphone permissions.');
    }
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    setStep('processing');
    try {
      const localUri = await stopRecording();
      if (!localUri) throw new Error('No recording saved');
      const url = await uploadVoiceMemo(localUri);
      setVoiceMemoUrl(url);
      const result = await processVoiceMemo(url!);
      setTranscript(result.transcript);
      setExtraction(result.extraction);
      setStep('confirm');
    } catch (error: any) {
      Alert.alert('Processing Error', error.message);
      setStep('input');
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    setStep('processing');
    try {
      const result = await processTextInput(textInput);
      setTranscript(textInput);
      setExtraction(result.extraction);
      setStep('confirm');
    } catch (error: any) {
      Alert.alert('Processing Error', error.message);
      setStep('input');
    }
  };

  // ─── PHOTO HANDLING ───
  const handleAddPhoto = () => {
    Alert.alert('Add Photo', 'Take a photo of where the item is stored (optional)', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take Photo', onPress: handleTakePhoto },
      { text: 'Choose from Gallery', onPress: handlePickPhoto },
    ]);
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!extraction) return;

    // Upload photo if one was selected
    let photoUrls: string[] = [];
    if (photoUri) {
      try {
        const fileName = `${Date.now()}.jpg`;

        // Use FormData approach — works reliably on React Native / Hermes
        const FileSystem = require('expo-file-system');
        const fileInfo = await FileSystem.getInfoAsync(photoUri);

        const formData = new FormData();
        formData.append('', {
          uri: photoUri,
          name: fileName,
          type: 'image/jpeg',
        } as any);

        const { data: { session } } = await supabase.auth.getSession();
        const uploadResp = await fetch(
          `${SUPABASE_URL}/storage/v1/object/item-photos/${fileName}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
              'x-upsert': 'true',
            },
            body: formData,
          }
        );

        if (uploadResp.ok) {
          const { data: { publicUrl } } = supabase.storage
            .from('item-photos')
            .getPublicUrl(fileName);
          photoUrls = [publicUrl];
          console.log('Photo uploaded:', publicUrl);
        } else {
          const errText = await uploadResp.text();
          console.error('Photo upload failed:', errText);
        }
      } catch (e) {
        console.error('Photo upload failed:', e);
        // Continue saving without photo — it's optional
      }
    }

    const locationPath = extraction.location_hierarchy.map(l => l.name).join(' > ');

    // Validate required fields
    if (!extraction.item_name || extraction.item_name.trim() === '') {
      Alert.alert('Missing Item Name', 'Could not detect an item name. Please try again or edit the name manually.');
      return;
    }

    // Debug: show what we're saving
    console.log('Saving item with photo_urls:', photoUrls);

    const item = await addItem({
      name: extraction.item_name,
      category: extraction.category,
      tags: extraction.tags,
      location_path: locationPath,
      transcript: transcript,
      voice_memo_url: voiceMemoUrl,
      description: extraction.notes,
      photo_urls: photoUrls.length > 0 ? photoUrls : null,
    });
    if (item) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } else {
      Alert.alert('Error', 'Failed to save item');
    }
  };

  // ─── PROCESSING ───
  if (step === 'processing') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.processingText}>Processing your input...</Text>
      </View>
    );
  }

  // ─── CONFIRM ───
  if (step === 'confirm' && extraction) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.confirmContent}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep('input')}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        {/* Transcript Card */}
        <View style={styles.transcriptCard}>
          <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} />
          <Text style={styles.transcriptText}>"{transcript}"</Text>
        </View>

        {/* Extracted Details */}
        <View style={styles.detailCard}>
          <Text style={styles.detailLabel}>ITEM</Text>
          <Text style={styles.detailValue}>{extraction.item_name}</Text>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailLabel}>LOCATION</Text>
          <View style={styles.breadcrumb}>
            {extraction.location_hierarchy.map((loc, i) => (
              <View key={i} style={styles.breadcrumbItem}>
                {i > 0 && <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />}
                <Text style={styles.breadcrumbText}>{loc.name}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailLabel}>CATEGORY</Text>
          <View style={styles.categoryChip}>
            <Text style={styles.categoryChipText}>{extraction.category}</Text>
          </View>
        </View>

        {/* Add Photo */}
        {photoUri ? (
          <View style={styles.photoPreviewContainer}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoActionBtn} onPress={handleAddPhoto}>
                <Ionicons name="swap-horizontal" size={16} color={colors.accent} />
                <Text style={styles.photoActionText}>Change</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoActionBtn} onPress={() => setPhotoUri(null)}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={[styles.photoActionText, { color: colors.danger }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addPhotoButton} onPress={handleAddPhoto}>
            <Ionicons name="camera-outline" size={20} color={colors.accent} />
            <Text style={styles.addPhotoText}>Add Photo (optional)</Text>
          </TouchableOpacity>
        )}

        {/* Confirm & Save */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Confirm & Save</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ─── INPUT (recording) ───
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)');
        }
      }}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.inputContent}>
        {/* Mic Button */}
        <TouchableOpacity
          style={[styles.micButton, isRecording && styles.micButtonActive]}
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          activeOpacity={0.8}
        >
          <Ionicons name={isRecording ? 'stop' : 'mic'} size={36} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.micHint}>
          {isRecording ? 'Listening... Tap to stop' : 'Tap to start speaking'}
        </Text>

        {/* Waveform */}
        <View style={styles.waveform}>
          {bars.map((bar, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveBar,
                { transform: [{ scaleY: bar }], opacity: isRecording ? 1 : 0.3 },
              ]}
            />
          ))}
        </View>

        {/* Text input fallback */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.textInputLabel}>Type what you're storing and where</Text>
        <View style={styles.textInputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Passport in bedroom drawer..."
            placeholderTextColor="#7A9BA8"
            value={textInput}
            onChangeText={setTextInput}
            multiline
          />
          {textInput.trim().length > 0 && (
            <TouchableOpacity style={styles.sendButton} onPress={handleTextSubmit}>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  processingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  backButton: {
    paddingHorizontal: spacing.xl,
    paddingTop: STATUSBAR_HEIGHT + 10,
    paddingBottom: spacing.md,
  },
  inputContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 20,
  },
  micButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  micButtonActive: {
    backgroundColor: colors.danger,
  },
  micHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 24,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    gap: 3,
    marginBottom: 32,
  },
  waveBar: {
    width: 4,
    height: 40,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  textInputRow: {
    width: '100%',
    position: 'relative',
  },
  textInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginLeft: 4,
  },
  textInputWrapper: {
    width: '100%',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#178578',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  textInput: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    paddingRight: 50,
    fontSize: 16,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sendButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ─── CONFIRM SCREEN ───
  confirmContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
  },
  transcriptCard: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    gap: 10,
    marginBottom: spacing.lg,
  },
  transcriptText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  detailCard: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  breadcrumb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breadcrumbText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '500',
  },
  categoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  categoryChipText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    gap: 8,
    marginBottom: spacing.xl,
  },
  addPhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  photoPreviewContainer: {
    marginBottom: spacing.xl,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.md,
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 10,
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  photoActionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.accent,
  },
  saveButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.md,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
