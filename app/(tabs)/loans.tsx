import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { LoanWithItem } from '../../types/database';
import { colors, spacing, borderRadius, shadows, STATUSBAR_HEIGHT } from '../../constants/theme';

type Tab = 'borrowed' | 'lending';

export default function LoansScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('borrowed');
  const [lendingLoans, setLendingLoans] = useState<LoanWithItem[]>([]);
  const [borrowedLoans, setBorrowedLoans] = useState<LoanWithItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    setIsLoading(true);

    // Lending: items I own that are loaned to someone
    const { data: lending, error: lendError } = await supabase
      .from('loans')
      .select('*, item:items(*)')
      .is('returned_at', null)
      .not('borrower_name', 'is', null)
      .order('loaned_at', { ascending: false });

    if (!lendError) {
      setLendingLoans(lending || []);
    }

    // Borrowed: items borrowed from others (borrower_name would be "me" or user)
    // For now, we separate by a convention: if the loan has notes starting with "borrowed:"
    // In future, add a 'direction' column. For now, borrowed tab shows empty or items marked as borrowed.
    const { data: borrowed, error: borrowError } = await supabase
      .from('loans')
      .select('*, item:items(*)')
      .is('returned_at', null)
      .order('loaned_at', { ascending: false });

    // Filter: lending = all current loans (you loaned to someone)
    // For MVP, borrowed tab shows items where item.is_loaned is false (placeholder)
    setBorrowedLoans([]);

    setIsLoading(false);
  };

  const markReturned = async (loanId: string) => {
    const { error } = await supabase
      .from('loans')
      .update({ returned_at: new Date().toISOString() })
      .eq('id', loanId);

    if (!error) {
      setLendingLoans(lendingLoans.filter(l => l.id !== loanId));
    }
  };

  const getDaysAgo = (date: string) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Loans</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'borrowed' && styles.tabActive]}
          onPress={() => setActiveTab('borrowed')}
        >
          <Text style={[styles.tabText, activeTab === 'borrowed' && styles.tabTextActive]}>
            Borrowed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'lending' && styles.tabActive]}
          onPress={() => setActiveTab('lending')}
        >
          <Text style={[styles.tabText, activeTab === 'lending' && styles.tabTextActive]}>
            Lending
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.sectionLabel}>
          {activeTab === 'borrowed' ? 'Borrowing:' : 'Lending:'}
        </Text>

        {(activeTab === 'lending' ? lendingLoans : borrowedLoans).length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="swap-horizontal-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {activeTab === 'borrowed' ? 'Nothing borrowed' : 'Nothing lent out'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'borrowed'
                ? 'Items you borrow from others will appear here'
                : 'Items you lend to others will appear here'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={activeTab === 'lending' ? lendingLoans : borrowedLoans}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: loan }) => (
              <View style={styles.loanCard}>
                {/* Photo placeholder */}
                <View style={styles.loanPhoto}>
                  <Ionicons name="cube" size={24} color={colors.accent} />
                </View>

                {/* Info */}
                <View style={styles.loanInfo}>
                  <Text style={styles.loanItemName}>
                    {loan.item?.name || 'Unknown item'} to {loan.borrower_name}
                  </Text>
                  <Text style={styles.loanReturnDate}>
                    Return by {loan.expected_return
                      ? new Date(loan.expected_return).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'No date set'}
                  </Text>
                </View>

                {/* Remind button */}
                <TouchableOpacity style={styles.remindButton}>
                  <Text style={styles.remindText}>Remind</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: STATUSBAR_HEIGHT + 10,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    marginHorizontal: spacing.xl,
    marginTop: 0,
    borderRadius: borderRadius.md,
    padding: 4,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textWhite,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  loanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: 12,
    ...shadows.sm,
  },
  loanPhoto: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loanInfo: {
    flex: 1,
  },
  loanItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  loanReturnDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  remindButton: {
    backgroundColor: colors.danger,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  remindText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
