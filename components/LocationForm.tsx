import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Location } from '../types/database';
import { useLocationStore } from '../stores/locationStore';

type LocationType = Location['type'];

interface LocationFormProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (location: Location) => void;
  parentId: string | null;
  /** If provided, the form is in "edit" mode */
  editLocation?: Location | null;
}

const LOCATION_TYPES: { value: LocationType; label: string; icon: string }[] = [
  { value: 'building', label: 'Building', icon: 'business-outline' },
  { value: 'room', label: 'Room', icon: 'grid-outline' },
  { value: 'furniture', label: 'Furniture', icon: 'file-tray-stacked-outline' },
  { value: 'container', label: 'Container', icon: 'cube-outline' },
  { value: 'spot', label: 'Spot', icon: 'pin-outline' },
];

export function LocationForm({ visible, onClose, onSuccess, parentId, editLocation }: LocationFormProps) {
  const { createLocation, updateLocation } = useLocationStore();

  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('room');
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!editLocation;

  // Reset form when opening
  useEffect(() => {
    if (visible) {
      if (editLocation) {
        setName(editLocation.name);
        setType(editLocation.type);
      } else {
        setName('');
        // Auto-suggest type based on parent depth
        setType(getSuggestedType());
      }
    }
  }, [visible, editLocation]);

  /**
   * Suggest a location type based on the navigation depth.
   * Root level = building, nested = room, deeper = furniture/container/spot
   */
  const getSuggestedType = (): LocationType => {
    if (!parentId) return 'building';
    // Default to 'room' when creating inside another location
    return 'room';
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter a name for this location.');
      return;
    }

    setIsSaving(true);

    try {
      if (isEditing && editLocation) {
        await updateLocation(editLocation.id, { name: trimmedName, type });
        onClose();
      } else {
        const newLocation = await createLocation(trimmedName, type, parentId);
        if (newLocation) {
          onSuccess?.(newLocation);
          onClose();
        } else {
          Alert.alert('Error', 'Failed to create location. Please try again.');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit Location' : 'New Location'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.headerButton, styles.saveButton]}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[styles.saveText, !name.trim() && styles.saveTextDisabled]}>
                {isEditing ? 'Save' : 'Create'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
          {/* Name field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Living Room, Top Drawer, Garage Shelf"
              placeholderTextColor="#95A5A6"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>

          {/* Type selector */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeGrid}>
              {LOCATION_TYPES.map(({ value, label, icon }) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.typeOption,
                    type === value && styles.typeOptionSelected,
                  ]}
                  onPress={() => setType(value)}
                >
                  <Ionicons
                    name={icon as any}
                    size={22}
                    color={type === value ? '#FFFFFF' : '#2C3E50'}
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      type === value && styles.typeLabelSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Context info */}
          {parentId && !isEditing && (
            <View style={styles.contextInfo}>
              <Ionicons name="information-circle-outline" size={16} color="#7F8C8D" />
              <Text style={styles.contextText}>
                This will be created inside the current location.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 70,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2C3E50',
  },
  cancelText: {
    fontSize: 16,
    color: '#7F8C8D',
  },
  saveButton: {
    backgroundColor: '#1B4F72',
    borderRadius: 8,
  },
  saveText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  saveTextDisabled: {
    opacity: 0.5,
  },
  form: {
    flex: 1,
    padding: 20,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E6ED',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2C3E50',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0E6ED',
    backgroundColor: '#FFFFFF',
  },
  typeOptionSelected: {
    backgroundColor: '#1B4F72',
    borderColor: '#1B4F72',
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
  },
  typeLabelSelected: {
    color: '#FFFFFF',
  },
  contextInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EBF5FB',
    padding: 12,
    borderRadius: 8,
  },
  contextText: {
    fontSize: 13,
    color: '#5D6D7E',
    flex: 1,
  },
});
