import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  FlatList,
  Dimensions,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useItemStore } from '../../stores/itemStore';
import { STATUSBAR_HEIGHT } from '../../constants/theme';

const { width } = Dimensions.get('window');
const TILE_GAP = 12;
const TILE_SIZE = (width - 56 - TILE_GAP) / 2;

const CATEGORIES = [
  { key: 'all', label: 'All Items', icon: 'cube', color: '#1A3A4A' },
  { key: 'Tools', label: 'Tools', icon: 'construct', color: '#0F6B5E' },
  { key: 'loaned', label: 'Loaned\nItems', icon: 'briefcase', color: '#178578' },
  { key: 'Documents', label: 'Important\nDocs', icon: 'document-text', color: '#4AADA5' },
];

export default function HomeScreen() {
  const { items, recentItems, fetchItems, fetchRecentItems } = useItemStore();

  useEffect(() => {
    fetchItems();
    fetchRecentItems();
  }, []);

  // Get last location from most recent item
  const lastLocation = recentItems.length > 0 && recentItems[0].location_path
    ? recentItems[0].location_path.replace(/ > /g, ' / ')
    : 'No items logged yet';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header icons row */}
        <View style={styles.header}>
          <View style={{ width: 36 }} />
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIconBtn}>
              <Ionicons name="notifications-outline" size={20} color="#1A3A4A" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Ionicons name="settings-outline" size={20} color="#1A3A4A" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Logo */}
        <View style={styles.heroSection}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.heroLogo}
            resizeMode="contain"
          />
          <Text style={styles.heroTitle}>
            <Text style={{ color: '#1A4A5A' }}>Find</Text>
            <Text style={{ color: '#178578' }}>It</Text>
          </Text>
          <Text style={styles.heroTagline}>Speak it. Store it. Find it.</Text>
        </View>

        {/* Category Grid */}
        <View style={styles.grid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.tile, { backgroundColor: cat.color }]}
              activeOpacity={0.85}
              onPress={() => {
                if (cat.key === 'loaned') {
                  router.push('/(tabs)/loans');
                } else if (cat.key === 'all') {
                  router.push('/(tabs)/search');
                } else {
                  router.push({ pathname: '/(tabs)/search', params: { category: cat.key } });
                }
              }}
            >
              <View style={styles.tileIconCircle}>
                <Ionicons name={cat.icon as any} size={28} color={cat.color} />
              </View>
              <Text style={styles.tileLabel}>{cat.label}</Text>
              {cat.key === 'all' && items.length > 0 && (
                <View style={styles.tileBadge}>
                  <Text style={styles.tileBadgeText}>{items.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Last Location Card */}
        <TouchableOpacity style={styles.lastLocation} activeOpacity={0.7}>
          <View style={styles.lastLocationIcon}>
            <Ionicons name="location" size={18} color="#178578" />
          </View>
          <View style={styles.lastLocationText}>
            <Text style={styles.lastLocationLabel}>Last Location:</Text>
            <Text style={styles.lastLocationValue}>{lastLocation}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#CCC" />
        </TouchableOpacity>

        {/* Recently Added */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recently Added</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/search')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {recentItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={32} color="#B0BEC5" />
              <Text style={styles.emptyText}>Items you log will appear here</Text>
            </View>
          ) : (
            <FlatList
              data={recentItems.slice(0, 8)}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.recentCard}
                  onPress={() => router.push(`/item/${item.id}`)}
                  activeOpacity={0.8}
                >
                  <View style={styles.recentIconBox}>
                    <Ionicons name="cube" size={18} color="#178578" />
                  </View>
                  <Text style={styles.recentName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.recentLocation} numberOfLines={1}>
                    {item.location_path?.split(' > ').pop() || ''}
                  </Text>
                  <Text style={styles.recentTime}>
                    {getTimeAgo(item.created_at)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E4EAEF',
  },
  // ─── HEADER ───
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: STATUSBAR_HEIGHT,
    paddingBottom: 0,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  // ─── HERO ───
  heroSection: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 12,
  },
  heroLogo: {
    width: 100,
    height: 100,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
  },
  heroTagline: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },
  // ─── GRID ───
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: TILE_GAP,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE * 0.75,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  tileIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 16,
  },
  tileBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tileBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // ─── LAST LOCATION ───
  lastLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  lastLocationIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lastLocationText: {
    flex: 1,
  },
  lastLocationLabel: {
    fontSize: 11,
    color: '#7A8A9A',
    fontWeight: '500',
  },
  lastLocationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1D2E',
    marginTop: 2,
  },
  // ─── RECENT ───
  recentSection: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1D2E',
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: '#178578',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  emptyText: {
    fontSize: 13,
    color: '#7A8A9A',
    fontWeight: '500',
  },
  recentCard: {
    width: 120,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginRight: 10,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  recentIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1D2E',
    textAlign: 'center',
  },
  recentLocation: {
    fontSize: 10,
    color: '#7A8A9A',
    textAlign: 'center',
  },
  recentTime: {
    fontSize: 9,
    color: '#B0BEC5',
    textAlign: 'center',
  },
});
