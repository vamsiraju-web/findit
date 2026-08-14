import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  ScrollView,
  Switch,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { STATUSBAR_HEIGHT } from '../../constants/theme';

const ACCENT = '#178578';
const PRIMARY = '#1A3A4A';
const BG = '#E4EAEF';
const CARD = '#FFFFFF';
const TEXT = '#1A1D2E';
const TEXT_SEC = '#4A5568';
const TEXT_MUTED = '#7A8A9A';
const DANGER = '#D94545';
const BORDER = '#E8EDF2';

type Page = 'main' | 'notifications' | 'privacy' | 'help' | 'about';

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuthStore();
  const [page, setPage] = useState<Page>('main');

  // Reset to main page whenever this tab gains focus
  useFocusEffect(
    useCallback(() => { setPage('main'); }, [])
  );

  // Notification settings
  const [loanReminders, setLoanReminders] = useState(true);
  const [itemAdded, setItemAdded] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  // Privacy settings
  const [biometric, setBiometric] = useState(false);
  const [analytics, setAnalytics] = useState(true);

  const displayName = profile?.display_name || user?.user_metadata?.full_name || 'User';
  const email = user?.email || '';
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  // ─── NOTIFICATIONS PAGE ───
  if (page === 'notifications') {
    return (
      <SafeAreaView style={styles.container}>
        <PageHeader title="Notifications" onBack={() => setPage('main')} />
        <ScrollView style={styles.pageContent}>
          <Text style={styles.sectionTitle}>Push Notifications</Text>
          <View style={styles.settingsCard}>
            <SettingRow
              icon="alarm-outline"
              label="Loan Reminders"
              subtitle="Get reminded when items are due back"
              value={loanReminders}
              onToggle={setLoanReminders}
            />
            <SettingRow
              icon="checkmark-circle-outline"
              label="Item Added"
              subtitle="Confirmation when items are saved"
              value={itemAdded}
              onToggle={setItemAdded}
            />
            <SettingRow
              icon="calendar-outline"
              label="Weekly Digest"
              subtitle="Summary of your stored items"
              value={weeklyDigest}
              onToggle={setWeeklyDigest}
              isLast
            />
          </View>

          <Text style={styles.sectionTitle}>Email Notifications</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Receiving emails at</Text>
                <Text style={styles.settingSubtitle}>{email}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── PRIVACY & SECURITY PAGE ───
  if (page === 'privacy') {
    return (
      <SafeAreaView style={styles.container}>
        <PageHeader title="Privacy & Security" onBack={() => setPage('main')} />
        <ScrollView style={styles.pageContent}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.settingsCard}>
            <SettingRow
              icon="finger-print-outline"
              label="Biometric Lock"
              subtitle="Require fingerprint or face to open app"
              value={biometric}
              onToggle={setBiometric}
            />
            <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
              <Ionicons name="key-outline" size={20} color={ACCENT} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Change Password</Text>
                <Text style={styles.settingSubtitle}>Managed via Google account</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Data</Text>
          <View style={styles.settingsCard}>
            <SettingRow
              icon="analytics-outline"
              label="Usage Analytics"
              subtitle="Help improve FindIt with anonymous data"
              value={analytics}
              onToggle={setAnalytics}
              isLast={false}
            />
            <TouchableOpacity style={[styles.settingRow, { borderBottomWidth: 0 }]}>
              <Ionicons name="download-outline" size={20} color={ACCENT} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Export My Data</Text>
                <Text style={styles.settingSubtitle}>Download all your items as CSV</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.dangerButton}>
            <Ionicons name="trash-outline" size={18} color={DANGER} />
            <Text style={styles.dangerButtonText}>Delete Account & All Data</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── HELP & SUPPORT PAGE ───
  if (page === 'help') {
    return (
      <SafeAreaView style={styles.container}>
        <PageHeader title="Help & Support" onBack={() => setPage('main')} />
        <ScrollView style={styles.pageContent}>
          <View style={styles.settingsCard}>
            <MenuItem
              icon="book-outline"
              label="How to Use FindIt"
              subtitle="Quick guide to get started"
              onPress={() => {}}
            />
            <MenuItem
              icon="mic-outline"
              label="Voice Commands Guide"
              subtitle="Tips for better voice logging"
              onPress={() => {}}
            />
            <MenuItem
              icon="search-outline"
              label="Search Tips"
              subtitle="Get better results with natural language"
              onPress={() => {}}
            />
            <MenuItem
              icon="chatbubble-ellipses-outline"
              label="Contact Support"
              subtitle="support@findit-app.com"
              onPress={() => Linking.openURL('mailto:support@findit-app.com')}
              isLast
            />
          </View>

          <Text style={styles.sectionTitle}>FAQ</Text>
          <View style={styles.settingsCard}>
            <FAQItem question="How does voice search work?" answer="Just tap the mic button and describe what you're looking for in natural language. Our AI uses semantic understanding to find matching items even if you don't remember the exact name." />
            <FAQItem question="Is my data stored securely?" answer="Yes! All data is encrypted in transit and at rest. Your voice recordings are processed and deleted — only the extracted text is stored." />
            <FAQItem question="Can I use FindIt offline?" answer="You can record items offline. They'll sync automatically when you're back online." isLast />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── ABOUT PAGE ───
  if (page === 'about') {
    return (
      <SafeAreaView style={styles.container}>
        <PageHeader title="About FindIt" onBack={() => setPage('main')} />
        <ScrollView style={styles.pageContent} contentContainerStyle={{ alignItems: 'center' }}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.aboutLogo}
            resizeMode="contain"
          />
          <Text style={styles.aboutTitle}>
            <Text style={{ color: PRIMARY }}>Find</Text>
            <Text style={{ color: ACCENT }}>It</Text>
          </Text>
          <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          <Text style={styles.aboutTagline}>Speak it. Store it. Find it.</Text>

          <View style={styles.aboutWriteup}>
            <Text style={styles.aboutWriteupText}>
              Ever wasted 20 minutes searching for your passport before a trip? Or forgotten which drawer holds the spare keys?
            </Text>
            <Text style={styles.aboutWriteupText}>
              <Text style={{ fontWeight: '700' }}>FindIt</Text> is your memory for physical things. Just speak where you put something — our AI instantly understands the item, location, and category. When you need it back, search naturally like you'd ask a friend: "where did I put the warranty papers?"
            </Text>
            <Text style={styles.aboutWriteupText}>
              No typing, no organizing, no tagging. Just talk and find. Track loaned items, attach photos for proof, and never lose track of what matters.
            </Text>
            <Text style={styles.aboutWriteupHighlight}>
              Your belongings. Your voice. Instantly findable.
            </Text>
          </View>

          <View style={[styles.settingsCard, { width: '100%', marginTop: 20 }]}>
            <MenuItem
              icon="logo-github"
              label="Source Code"
              subtitle="Open source on GitHub"
              onPress={() => {}}
            />
            <MenuItem
              icon="document-text-outline"
              label="Terms of Service"
              onPress={() => {}}
            />
            <MenuItem
              icon="shield-checkmark-outline"
              label="Privacy Policy"
              onPress={() => {}}
            />
            <MenuItem
              icon="heart-outline"
              label="Rate FindIt"
              subtitle="Love it? Let us know!"
              onPress={() => {}}
              isLast
            />
          </View>

          <Text style={styles.aboutFooter}>
            © 2026 FindIt. All rights reserved.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── MAIN SETTINGS PAGE ───
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={28} color={ACCENT} />
            </View>
          )}
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menu}>
          <MenuItem
            icon="notifications-outline"
            label="Notifications"
            onPress={() => setPage('notifications')}
          />
          <MenuItem
            icon="shield-outline"
            label="Privacy & Security"
            onPress={() => setPage('privacy')}
          />
          <MenuItem
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => setPage('help')}
          />
          <MenuItem
            icon="information-circle-outline"
            label="About FindIt"
            subtitle="Version 1.0.0"
            onPress={() => setPage('about')}
            isLast
          />
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={DANGER} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── REUSABLE COMPONENTS ───

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.pageHeader}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={TEXT} />
      </TouchableOpacity>
      <Text style={styles.pageHeaderTitle}>{title}</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

function MenuItem({ icon, label, subtitle, onPress, isLast }: {
  icon: string; label: string; subtitle?: string; onPress?: () => void; isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, isLast && { borderBottomWidth: 0 }]}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={20} color={ACCENT} />
      <View style={styles.menuItemContent}>
        <Text style={styles.menuItemLabel}>{label}</Text>
        {subtitle && <Text style={styles.menuItemSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
    </TouchableOpacity>
  );
}

function SettingRow({ icon, label, subtitle, value, onToggle, isLast }: {
  icon: string; label: string; subtitle?: string; value: boolean; onToggle: (v: boolean) => void; isLast?: boolean;
}) {
  return (
    <View style={[styles.settingRow, isLast && { borderBottomWidth: 0 }]}>
      <Ionicons name={icon as any} size={20} color={ACCENT} />
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#D1D9E0', true: ACCENT }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function FAQItem({ question, answer, isLast }: { question: string; answer: string; isLast?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity
      style={[styles.faqItem, isLast && { borderBottomWidth: 0 }]}
      onPress={() => setExpanded(!expanded)}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{question}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={TEXT_MUTED} />
      </View>
      {expanded && <Text style={styles.faqAnswer}>{answer}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: STATUSBAR_HEIGHT + 10,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT,
  },
  // ─── PROFILE CARD ───
  profileCard: {
    alignItems: 'center',
    backgroundColor: CARD,
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#E0F2EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: TEXT_SEC,
  },
  // ─── MENU ───
  menu: {
    backgroundColor: CARD,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 15,
    color: TEXT,
    fontWeight: '500',
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 40,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: CARD,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: DANGER,
  },
  // ─── SUB-PAGES ───
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: STATUSBAR_HEIGHT + 10,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CARD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
  },
  pageContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_MUTED,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    color: TEXT,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: CARD,
    gap: 8,
    borderWidth: 1,
    borderColor: DANGER,
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: DANGER,
  },
  // ─── FAQ ───
  faqItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
    flex: 1,
    paddingRight: 8,
  },
  faqAnswer: {
    fontSize: 13,
    color: TEXT_SEC,
    marginTop: 8,
    lineHeight: 20,
  },
  // ─── ABOUT ───
  aboutLogo: {
    width: 100,
    height: 100,
    marginTop: 20,
  },
  aboutTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  aboutVersion: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  aboutTagline: {
    fontSize: 14,
    color: TEXT_SEC,
    marginTop: 4,
    fontWeight: '500',
  },
  aboutFooter: {
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 30,
    marginBottom: 40,
    lineHeight: 20,
  },
  aboutWriteup: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
  },
  aboutWriteupText: {
    fontSize: 14,
    color: '#4A5568',
    lineHeight: 22,
    marginBottom: 12,
  },
  aboutWriteupHighlight: {
    fontSize: 15,
    fontWeight: '700',
    color: ACCENT,
    textAlign: 'center',
    marginTop: 4,
  },
});
