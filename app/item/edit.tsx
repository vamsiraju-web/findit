import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../services/supabase';
import { useItemStore } from '../../stores/itemStore';
import { Item } from '../../types/database';
import { colors, borderRadius } from '../../constants/theme';
import { SUPABASE_URL } from '../../constants/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 40) : 50;

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { fetchItems } = useItemStore();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [locationPath, setLocationPath] = useState('');
  const [tags, setTags] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchItem();
  }, []);

  const fetchItem = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setItem(data);
      setName(data.name || '');
      setDescription(data.description || '');
      setCategory(data.category || '');
      setLocationPath(data.location_path || '');
      setTags(data.tags ? data.tags.join(', ') : '');
      setPhotoUrls(data.photo_urls || []);
    } catch (error) {
      console.error('Error fetching item:', error);
      Alert.alert('Error', 'Could not load item.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = () => {
    Alert.alert('Add Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: () => pickImage('camera') },
      { text: 'Choose from Gallery', onPress: () => pickImage('gallery') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    };

    let result;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required.');
        return;
      }
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    setUploading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const fileName = `${Date.now()}.jpg`;
      const formData = new FormData();
      formData.append('', {
        uri,
        name: fileName,
        type: 'image/jpeg',
      } as any);

      const uploadResp = await fetch(
        `${SUPABASE_URL}/storage/v1/object/item-photos/${fileName}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-upsert': 'true',
          },
          body: formData,
        }
      );

      if (uploadResp.ok) {
        const { data: { publicUrl } } = supabase.storage
          .from('item-photos')
          .getPublicUrl(fileName);
        setPhotoUrls([...photoUrls, publicUrl]);
      } else {
        const errText = await uploadResp.text();
        console.error('Photo upload failed:', errText);
        Alert.alert('Upload Failed', 'Could not upload photo. Please try again.');
      }
    } catch (e) {
      console.error('Photo upload error:', e);
      Alert.alert('Error', 'Photo upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    Alert.alert('Remove Photo', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const updated = [...photoUrls];
          updated.splice(index, 1);
          setPhotoUrls(updated);
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Item name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const updates = {
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        location_path: locationPath.trim() || null,
        tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : null,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Refresh store
      await fetchItems();

      Alert.alert('Saved', 'Item updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error saving item:', error);
      Alert.alert('Error', 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#178578" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Item</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Name */}
        <View style={styles.field}>
          <Text style={styles.label}>Item Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Item name"
            placeholderTextColor="#7A9BA8"
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional description"
            placeholderTextColor="#7A9BA8"
            multiline
          />
        </View>

        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <TextInput
            style={styles.input}
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. Documents, Tools, Electronics"
            placeholderTextColor="#7A9BA8"
          />
        </View>

        {/* Location */}
        <View style={styles.field}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={locationPath}
            onChangeText={setLocationPath}
            placeholder="e.g. Bedroom > Closet > Top shelf"
            placeholderTextColor="#7A9BA8"
          />
        </View>

        {/* Tags */}
        <View style={styles.field}>
          <Text style={styles.label}>Tags</Text>
          <TextInput
            style={styles.input}
            value={tags}
            onChangeText={setTags}
            placeholder="Comma-separated, e.g. important, backup"
            placeholderTextColor="#7A9BA8"
          />
        </View>

        {/* Photos Section */}
        <View style={styles.field}>
          <Text style={styles.label}>Photos</Text>
          <View style={styles.photoGrid}>
            {photoUrls.map((url, index) => (
              <View key={index} style={styles.photoItem}>
                <Image source={{ uri: url }} style={styles.photoThumb} />
                <TouchableOpacity
                  style={styles.removePhotoBtn}
                  onPress={() => handleRemovePhoto(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#D94545" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Photo Button */}
            <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator size="small" color="#178578" />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={28} color="#178578" />
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A3A4A',
    paddingTop: STATUSBAR_HEIGHT + 10,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: '#178578',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D0D8DD',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    position: 'relative',
  },
  photoThumb: {
    width: (SCREEN_WIDTH - 64) / 3,
    height: (SCREEN_WIDTH - 64) / 3,
    borderRadius: 12,
    backgroundColor: '#ECEFF1',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  addPhotoBtn: {
    width: (SCREEN_WIDTH - 64) / 3,
    height: (SCREEN_WIDTH - 64) / 3,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#178578',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0F2EF',
  },
  addPhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#178578',
    marginTop: 4,
  },
});
