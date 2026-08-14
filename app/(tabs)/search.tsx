import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Animated,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useItemStore } from '../../stores/itemStore';
import { semanticSearch } from '../../services/ai';
import { colors, spacing, borderRadius, shadows, STATUSBAR_HEIGHT } from '../../constants/theme';
import { supabase } from '../../services/supabase';
import { startRecording, stopRecording, uploadVoiceMemo, playVoiceMemo } from '../../services/voice';
import { SearchResult } from '../../types/database';

type SearchMode = 'idle' | 'text' | 'voice';
type VoiceState = 'idle' | 'recording' | 'processing';

export default function SearchScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('idle');
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [semanticResults, setSemanticResults] = useState<SearchResult[]>([]);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);
  const [playingMemoId, setPlayingMemoId] = useState<string | null>(null);

  const { items, searchResults, isSearching, searchItems, fetchItems } = useItemStore();
  const soundRef = useRef<Audio.Sound | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Cleanup sound on unmount
  useEffect(() => {
    fetchItems();
    return () => {};
  }, []);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Pulse animation for recording indicator
  useEffect(() => {
    if (voiceState === 'recording') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [voiceState]);

  // ─── Debounced Text Search (hybrid RPC via store) ────────────────────

  const handleTextSearch = useCallback((text: string) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      if (text.trim().length > 0) {
        searchItems(text);
      }
    }, 400);
  }, [searchItems]);

  const onChangeText = (text: string) => {
    setQuery(text);
    setSearchMode(text.length > 0 ? 'text' : 'idle');
    setVoiceTranscript('');
    setSemanticResults([]);
    if (text.trim().length === 0) {
      searchItems('');
    } else {
      handleTextSearch(text);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setSearchMode('idle');
    setVoiceTranscript('');
    setSemanticResults([]);
    searchItems('');
  };

  // ─── Voice Search Flow ───────────────────────────────────────────────
  // 1. Record audio with expo-av
  // 2. Upload to Supabase Storage
  // 3. Call edge function with voice_memo_url → gets Whisper transcript
  // 4. Call edge function with search_query → semantic search with embedding
  // This gives the best results because it uses Whisper for accurate STT
  // and then generates an embedding for the transcript for semantic matching.

  const handleVoiceSearchStart = async () => {
    try {
      setVoiceState('recording');
      setSearchMode('voice');
      setVoiceTranscript('');
      setSemanticResults([]);
      await startRecording();
    } catch (error: any) {
      console.error('Voice search start failed:', error);
      setVoiceState('idle');
      setSearchMode('idle');
      Alert.alert(
        'Microphone Access',
        'Please grant microphone permission to use voice search.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleVoiceSearchStop = async () => {
    try {
      setVoiceState('processing');

      // Step 1: Stop recording and get local file URI
      const uri = await stopRecording();
      if (!uri) {
        throw new Error('No recording captured');
      }

      // Step 2: Upload audio to Supabase Storage
      const voiceMemoUrl = await uploadVoiceMemo(uri);
      if (!voiceMemoUrl) {
        throw new Error('Failed to upload voice recording');
      }

      // Step 3: Transcribe with Whisper via the edge function
      const { data: transcribeData, error: transcribeError } = await supabase
        .functions.invoke('process-item', {
          body: { voice_memo_url: voiceMemoUrl, transcribe_only: true },
        });

      if (transcribeError) throw transcribeError;

      const transcript = transcribeData?.transcript || '';
      if (!transcript.trim()) {
        throw new Error('Could not understand the audio. Please try again.');
      }

      setVoiceTranscript(transcript);
      setQuery(transcript);

      // Step 4: Semantic search with the transcribed text
      const results = await semanticSearch(transcript);
      setSemanticResults(results || []);
      setVoiceState('idle');
    } catch (error: any) {
      console.error('Voice search failed:', error);
      setVoiceState('idle');
      Alert.alert(
        'Voice Search',
        error.message || 'Could not process your voice search. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleVoiceButtonPress = () => {
    if (voiceState === 'recording') {
      handleVoiceSearchStop();
    } else if (voiceState === 'idle') {
      handleVoiceSearchStart();
    }
    // If 'processing', ignore taps
  };

  // ─── Voice Memo Playback (for search results) ────────────────────────

  const handlePlayMemo = async (memoUrl: string, itemId: string) => {
    try {
      // Stop any currently playing sound
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      if (playingMemoId === itemId) {
        // Toggle off — already playing this one
        setPlayingMemoId(null);
        return;
      }

      setPlayingMemoId(itemId);
      const sound = await playVoiceMemo(memoUrl);
      soundRef.current = sound;

      // Listen for playback completion
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingMemoId(null);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (error) {
      console.error('Playback error:', error);
      setPlayingMemoId(null);
    }
  };

  // ─── Determine which results to display ──────────────────────────────

  const hasQuery = query.trim().length > 0;
  const displayResults = hasQuery
    ? (searchMode === 'voice' ? semanticResults : searchResults)
    : items
        .filter(i => {
          if (!category || category === 'all') return true;
          return i.category?.toLowerCase() === category.toLowerCase();
        })
        .map(i => ({ id: i.id, name: i.name, location_path: i.location_path, photo_urls: i.photo_urls, voice_memo_url: i.voice_memo_url, score: 1 }));
  const isCurrentlySearching = searchMode === 'voice' ? isSemanticSearching : isSearching;

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#7F8C8D" />
        <TextInput
          style={styles.searchInput}
          placeholder='Try "spare house keys" or "thing to fix a leak"'
          placeholderTextColor="#95A5A6"
          value={query}
          onChangeText={onChangeText}
          autoFocus
          returnKeyType="search"
          editable={voiceState === 'idle'}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clearSearch}>
            <Ionicons name="close-circle" size={20} color="#BDC3C7" />
          </TouchableOpacity>
        )}
      </View>

      {/* Voice Search Button */}
      <TouchableOpacity
        style={[
          styles.voiceButton,
          voiceState === 'recording' && styles.voiceButtonRecording,
          voiceState === 'processing' && styles.voiceButtonProcessing,
        ]}
        onPress={handleVoiceButtonPress}
        disabled={voiceState === 'processing'}
        activeOpacity={0.7}
      >
        {voiceState === 'recording' ? (
          <>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Ionicons name="mic" size={22} color="#FFFFFF" />
            </Animated.View>
            <Text style={styles.voiceButtonTextActive}>Listening... tap to search</Text>
          </>
        ) : voiceState === 'processing' ? (
          <>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.voiceButtonText}>Processing voice...</Text>
          </>
        ) : (
          <>
            <Ionicons name="mic-outline" size={20} color="#FFFFFF" />
            <Text style={styles.voiceButtonText}>Search by voice</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Voice Transcript Banner */}
      {voiceTranscript.length > 0 && searchMode === 'voice' && (
        <View style={styles.transcriptBanner}>
          <Ionicons name="chatbubble-outline" size={14} color="#178578" />
          <Text style={styles.transcriptText} numberOfLines={2}>
            &quot;{voiceTranscript}&quot;
          </Text>
        </View>
      )}

      {/* Results Area */}
      {isCurrentlySearching || voiceState === 'processing' ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1A3A4A" />
          <Text style={styles.loadingText}>
            {voiceState === 'processing' ? 'Transcribing & searching...' : 'Searching...'}
          </Text>
        </View>
      ) : hasQuery && displayResults.length === 0 && voiceState === 'idle' ? (
        <View style={styles.emptyContainer}>
          <Image
            source={require('../../assets/images/search-empty.png')}
            style={{ width: 160, height: 160, marginBottom: 16 }}
            resizeMode="contain"
          />
          <Text style={styles.emptyTitle}>No items found</Text>
          <Text style={styles.emptySubtitle}>
            {searchMode === 'voice'
              ? "Try describing what you're looking for differently"
              : 'Try different keywords or use voice search'}
          </Text>
        </View>
      ) : !hasQuery && voiceState === 'idle' && displayResults.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No items yet</Text>
          <Text style={styles.emptySubtitle}>
            Log items from the Home screen to see them here
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SearchResultCard
              result={item}
              isPlaying={playingMemoId === item.id}
              onPlayMemo={handlePlayMemo}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.resultsList}
          ListHeaderComponent={
            displayResults.length > 0 ? (
              <Text style={styles.resultsCount}>
                {displayResults.length} result{displayResults.length !== 1 ? 's' : ''}
                {searchMode === 'voice' ? ' (semantic match)' : ''}
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ─── Search Result Card Component ────────────────────────────────────────────

interface SearchResultCardProps {
  result: SearchResult;
  isPlaying: boolean;
  onPlayMemo: (url: string, id: string) => void;
}

function SearchResultCard({ result, isPlaying, onPlayMemo }: SearchResultCardProps) {
  const thumbnailUrl = result.photo_urls?.[0] || null;

  return (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => router.push(`/item/${result.id}`)}
      activeOpacity={0.7}
    >
      {/* Photo Thumbnail */}
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
      ) : (
        <View style={styles.thumbnailPlaceholder}>
          <Ionicons name="cube-outline" size={24} color="#BDC3C7" />
        </View>
      )}

      {/* Item Info */}
      <View style={styles.resultContent}>
        <Text style={styles.resultName} numberOfLines={1}>
          {result.name}
        </Text>
        {result.location_path && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color="#1A3A4A" />
            <Text style={styles.locationText} numberOfLines={1}>
              {result.location_path}
            </Text>
          </View>
        )}
        {result.score != null && result.score < 1 && (
          <View style={styles.scoreRow}>
            <View style={styles.scoreBar}>
              <View
                style={[
                  styles.scoreBarFill,
                  { width: `${Math.min(result.score * 100, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.scoreText}>
              {Math.round(result.score * 100)}% match
            </Text>
          </View>
        )}
      </View>

      {/* Voice Memo Playback Button */}
      {result.voice_memo_url && (
        <TouchableOpacity
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={() => onPlayMemo(result.voice_memo_url!, result.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={16}
            color={isPlaying ? '#FFFFFF' : '#178578'}
          />
        </TouchableOpacity>
      )}

      <Ionicons name="chevron-forward" size={18} color="#BDC3C7" />
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E4EAEF',
    paddingTop: STATUSBAR_HEIGHT,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 20,
    marginTop: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1D2E',
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#178578',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
    marginHorizontal: 20,
    gap: 8,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  voiceButtonRecording: {
    backgroundColor: '#FFE5E5',
    borderColor: '#EF4444',
  },
  voiceButtonProcessing: {
    backgroundColor: '#E0F2EF',
    borderColor: '#178578',
  },
  voiceButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  voiceButtonTextActive: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  transcriptBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
    marginHorizontal: 20,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#178578',
  },
  transcriptText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1D2E',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  hintContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 60,
  },
  hintIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  hintTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1D2E',
  },
  hintSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 12,
  },
  hintExamples: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  hintChip: {
    backgroundColor: '#E0F2EF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#178578',
  },
  hintChipText: {
    fontSize: 12,
    color: '#178578',
  },
  resultsCount: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultsList: {
    paddingTop: 12,
    paddingBottom: 100,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    marginHorizontal: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  thumbnailPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#E0F2EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultContent: {
    flex: 1,
    gap: 3,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1D2E',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#178578',
    flex: 1,
    fontWeight: '500',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  scoreBar: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: 4,
    backgroundColor: '#178578',
    borderRadius: 2,
  },
  scoreText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E0F2EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonActive: {
    backgroundColor: '#178578',
  },
});
