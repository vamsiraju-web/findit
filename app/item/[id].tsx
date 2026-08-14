import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { playVoiceMemo } from '../../services/voice';
import { useItemStore } from '../../stores/itemStore';
import { Item, Loan } from '../../types/database';
import { Audio } from 'expo-av';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 40) : 50;

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { updateItem, deleteItem } = useItemStore();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [photoViewerIndex, setPhotoViewerIndex] = useState<number | null>(null);

  // Loan form state
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerContact, setBorrowerContact] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [loanNotes, setLoanNotes] = useState('');
  const [savingLoan, setSavingLoan] = useState(false);

  useEffect(() => {
    fetchItem();
    return () => {
      // Cleanup sound on unmount
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [id]);

  const fetchItem = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setItem(data);
    } catch (error) {
      console.error('Error fetching item:', error);
      Alert.alert('Error', 'Could not load item details.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  // ---- VOICE PLAYBACK ----
  const handlePlayVoiceMemo = async () => {
    if (!item?.voice_memo_url) return;

    try {
      if (isPlaying && sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
        return;
      }

      setIsPlaying(true);
      const newSound = await playVoiceMemo(item.voice_memo_url);
      setSound(newSound);

      // Listen for playback finish
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          newSound.unloadAsync();
          setSound(null);
        }
      });
    } catch (error) {
      console.error('Playback error:', error);
      setIsPlaying(false);
      Alert.alert('Playback Error', 'Could not play voice memo.');
    }
  };

  // ---- LOAN ----
  const handleCreateLoan = async () => {
    if (!borrowerName.trim()) {
      Alert.alert('Required', 'Please enter the borrower\'s name.');
      return;
    }

    setSavingLoan(true);
    try {
      const { error } = await supabase.from('loans').insert({
        item_id: id,
        user_id: item!.user_id,
        borrower_name: borrowerName.trim(),
        borrower_contact: borrowerContact.trim() || null,
        expected_return: expectedReturn.trim() || null,
        notes: loanNotes.trim() || null,
      });

      if (error) throw error;

      // Mark item as loaned
      await updateItem(id!, { is_loaned: true });
      setItem(prev => prev ? { ...prev, is_loaned: true } : null);

      setShowLoanModal(false);
      resetLoanForm();
      Alert.alert('Success', `Loaned to ${borrowerName}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not create loan.');
    } finally {
      setSavingLoan(false);
    }
  };

  const resetLoanForm = () => {
    setBorrowerName('');
    setBorrowerContact('');
    setExpectedReturn('');
    setLoanNotes('');
  };

  // ---- DELETE ----
  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item?.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteItem(id!);
            router.back();
          },
        },
      ]
    );
  };

  // ---- EDIT ----
  const handleEdit = () => {
    // Navigate to edit screen (or could inline edit)
    router.push({ pathname: '/item/edit', params: { id } });
  };

  // ---- FORMAT DATE ----
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ---- PARSE LOCATION PATH ----
  const getLocationBreadcrumbs = (locationPath: string | null): string[] => {
    if (!locationPath) return [];
    return locationPath.split(' > ').filter(Boolean);
  };

  // ---- LOADING STATE ----
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#178578" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#95A5A6" />
        <Text style={styles.errorText}>Item not found</Text>
      </View>
    );
  }

  const breadcrumbs = getLocationBreadcrumbs(item.location_path);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header with actions */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#2C3E50" />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleEdit}>
              <Ionicons name="pencil" size={20} color="#178578" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color="#E74C3C" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Photo Gallery */}
        {item.photo_urls && item.photo_urls.length > 0 && (
          <View style={styles.photoSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoGallery}
            >
              {item.photo_urls.map((url, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setPhotoViewerIndex(index)}
                  activeOpacity={0.9}
                >
                  <Image source={{ uri: url }} style={styles.galleryPhoto} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Main Content Card */}
        <View style={styles.contentCard}>
          {/* Item Name */}
          <Text style={styles.itemName}>{item.name}</Text>

          {/* Loaned Badge */}
          {item.is_loaned && (
            <View style={styles.loanedBadge}>
              <Ionicons name="hand-left" size={14} color="#E67E22" />
              <Text style={styles.loanedText}>Currently loaned out</Text>
            </View>
          )}

          {/* Category Badge */}
          {item.category && (
            <View style={styles.categoryRow}>
              <View style={styles.categoryChip}>
                <Ionicons name="pricetag" size={14} color="#1E8449" />
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
            </View>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {item.tags.map((tag, i) => (
                <View key={i} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Location Breadcrumb */}
          {breadcrumbs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Location</Text>
              <View style={styles.breadcrumbRow}>
                {breadcrumbs.map((crumb, i) => (
                  <View key={i} style={styles.breadcrumbStep}>
                    {i > 0 && (
                      <Ionicons name="chevron-forward" size={12} color="#BDC3C7" />
                    )}
                    <View style={[
                      styles.breadcrumbBadge,
                      i === breadcrumbs.length - 1 && styles.breadcrumbBadgeLast,
                    ]}>
                      <Text style={[
                        styles.breadcrumbText,
                        i === breadcrumbs.length - 1 && styles.breadcrumbTextLast,
                      ]}>
                        {crumb}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          {item.description && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <Text style={styles.descriptionText}>{item.description}</Text>
            </View>
          )}

          {/* Voice Memo Playback */}
          {item.voice_memo_url && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Voice Memo</Text>
              <TouchableOpacity
                style={[styles.playButton, isPlaying && styles.playButtonActive]}
                onPress={handlePlayVoiceMemo}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isPlaying ? 'stop' : 'play'}
                  size={20}
                  color={isPlaying ? '#FFFFFF' : '#178578'}
                />
                <Text style={[styles.playButtonText, isPlaying && styles.playButtonTextActive]}>
                  {isPlaying ? 'Stop Playback' : 'Play Voice Memo'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Transcript */}
          {item.transcript && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Original Transcript</Text>
              <View style={styles.transcriptContainer}>
                <Ionicons name="chatbubble-outline" size={14} color="#7F8C8D" />
                <Text style={styles.transcriptText}>"{item.transcript}"</Text>
              </View>
            </View>
          )}
        </View>

        {/* Loan Button */}
        {!item.is_loaned && (
          <TouchableOpacity
            style={styles.loanButton}
            onPress={() => setShowLoanModal(true)}
          >
            <Ionicons name="hand-left-outline" size={20} color="#FFFFFF" />
            <Text style={styles.loanButtonText}>Loan this item</Text>
          </TouchableOpacity>
        )}

        {/* Timestamps */}
        <View style={styles.timestamps}>
          <View style={styles.timestampRow}>
            <Ionicons name="time-outline" size={14} color="#BDC3C7" />
            <Text style={styles.timestampText}>
              Created {formatDate(item.created_at)}
            </Text>
          </View>
          {item.updated_at !== item.created_at && (
            <View style={styles.timestampRow}>
              <Ionicons name="refresh-outline" size={14} color="#BDC3C7" />
              <Text style={styles.timestampText}>
                Updated {formatDate(item.updated_at)}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Photo Viewer Modal */}
      {photoViewerIndex !== null && item.photo_urls && (
        <Modal visible animationType="fade" transparent>
          <View style={styles.photoViewerOverlay}>
            <TouchableOpacity
              style={styles.photoViewerClose}
              onPress={() => setPhotoViewerIndex(null)}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Image
              source={{ uri: item.photo_urls[photoViewerIndex] }}
              style={styles.photoViewerImage}
              resizeMode="contain"
            />
            {/* Navigation arrows */}
            {item.photo_urls.length > 1 && (
              <View style={styles.photoViewerNav}>
                <TouchableOpacity
                  style={styles.photoNavBtn}
                  onPress={() => setPhotoViewerIndex(
                    (photoViewerIndex - 1 + item.photo_urls!.length) % item.photo_urls!.length
                  )}
                >
                  <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.photoCounter}>
                  {photoViewerIndex + 1} / {item.photo_urls.length}
                </Text>
                <TouchableOpacity
                  style={styles.photoNavBtn}
                  onPress={() => setPhotoViewerIndex(
                    (photoViewerIndex + 1) % item.photo_urls!.length
                  )}
                >
                  <Ionicons name="chevron-forward" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>
      )}

      {/* Loan Modal */}
      <Modal visible={showLoanModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Loan Item</Text>
              <TouchableOpacity onPress={() => setShowLoanModal(false)}>
                <Ionicons name="close" size={24} color="#7F8C8D" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Lending "{item.name}" to someone
            </Text>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Borrower Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Who are you lending to?"
                placeholderTextColor="#BDC3C7"
                value={borrowerName}
                onChangeText={setBorrowerName}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Contact (optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Phone or email"
                placeholderTextColor="#BDC3C7"
                value={borrowerContact}
                onChangeText={setBorrowerContact}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Expected Return (optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Next Friday, 2 weeks"
                placeholderTextColor="#BDC3C7"
                value={expectedReturn}
                onChangeText={setExpectedReturn}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                placeholder="Any notes about this loan"
                placeholderTextColor="#BDC3C7"
                value={loanNotes}
                onChangeText={setLoanNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={styles.loanSubmitButton}
              onPress={handleCreateLoan}
              disabled={savingLoan}
            >
              {savingLoan ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  <Text style={styles.loanSubmitText}>Confirm Loan</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#95A5A6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: STATUSBAR_HEIGHT + 10,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },

  // Photo Gallery
  photoSection: {
    marginTop: 8,
  },
  photoGallery: {
    paddingHorizontal: 16,
    gap: 10,
  },
  galleryPhoto: {
    width: SCREEN_WIDTH * 0.7,
    height: 200,
    borderRadius: 14,
    backgroundColor: '#ECEFF1',
  },

  // Content Card
  contentCard: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  itemName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2C3E50',
    letterSpacing: -0.3,
  },
  loanedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEF5E7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  loanedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E67E22',
  },
  categoryRow: {
    flexDirection: 'row',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E8449',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    backgroundColor: '#F4F6F7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 13,
    color: '#5D6D7E',
  },

  // Sections
  section: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F4F6F7',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#95A5A6',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Breadcrumb
  breadcrumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  breadcrumbStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breadcrumbBadge: {
    backgroundColor: '#EBF5FB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  breadcrumbBadgeLast: {
    backgroundColor: '#178578',
  },
  breadcrumbText: {
    fontSize: 13,
    color: '#178578',
    fontWeight: '500',
  },
  breadcrumbTextLast: {
    color: '#FFFFFF',
  },

  // Description
  descriptionText: {
    fontSize: 15,
    color: '#5D6D7E',
    lineHeight: 22,
  },

  // Voice Memo
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EBF5FB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  playButtonActive: {
    backgroundColor: '#178578',
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#178578',
  },
  playButtonTextActive: {
    color: '#FFFFFF',
  },

  // Transcript
  transcriptContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#FAFBFC',
    padding: 12,
    borderRadius: 10,
  },
  transcriptText: {
    flex: 1,
    fontSize: 14,
    color: '#5D6D7E',
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // Loan button
  loanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E67E22',
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  loanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Timestamps
  timestamps: {
    marginTop: 24,
    marginHorizontal: 16,
    gap: 6,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timestampText: {
    fontSize: 12,
    color: '#BDC3C7',
  },

  // Photo Viewer Modal
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerImage: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
  },
  photoViewerNav: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  photoNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCounter: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },

  // Loan Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C3E50',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: -8,
  },
  formField: {
    gap: 6,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5D6D7E',
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#ECEFF1',
  },
  formTextArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  loanSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E67E22',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  loanSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
