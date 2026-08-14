import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { Loan, LoanWithItem } from '../types/database';
import { scheduleLoanReminder, cancelNotification } from '../services/notifications';
import { useItemStore } from './itemStore';

interface LoanState {
  activeLoans: LoanWithItem[];
  loanHistory: LoanWithItem[];
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;

  // Actions
  fetchActiveLoans: () => Promise<void>;
  fetchLoanHistory: () => Promise<void>;
  createLoan: (
    itemId: string,
    borrowerName: string,
    borrowerContact: string | null,
    expectedReturn: Date | null,
    notes: string | null
  ) => Promise<Loan | null>;
  markReturned: (loanId: string) => Promise<void>;
  sendReminder: (loan: LoanWithItem) => Promise<void>;
  clearError: () => void;
}

export const useLoanStore = create<LoanState>((set, get) => ({
  activeLoans: [],
  loanHistory: [],
  isLoading: false,
  isCreating: false,
  error: null,

  fetchActiveLoans: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('loans')
        .select('*, item:items(*)')
        .is('returned_at', null)
        .order('loaned_at', { ascending: false });

      if (error) throw error;
      set({ activeLoans: data || [] });
    } catch (error: any) {
      console.error('Error fetching active loans:', error);
      set({ error: error.message || 'Failed to fetch active loans' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchLoanHistory: async () => {
    try {
      const { data, error } = await supabase
        .from('loans')
        .select('*, item:items(*)')
        .not('returned_at', 'is', null)
        .order('returned_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      set({ loanHistory: data || [] });
    } catch (error: any) {
      console.error('Error fetching loan history:', error);
    }
  },

  createLoan: async (itemId, borrowerName, borrowerContact, expectedReturn, notes) => {
    set({ isCreating: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create the loan record
      const loanPayload: Record<string, any> = {
        item_id: itemId,
        user_id: user.id,
        borrower_name: borrowerName,
        borrower_contact: borrowerContact,
        loaned_at: new Date().toISOString(),
        expected_return: expectedReturn ? expectedReturn.toISOString() : null,
        notes,
      };

      const { data: loan, error: loanError } = await supabase
        .from('loans')
        .insert(loanPayload)
        .select('*, item:items(*)')
        .single();

      if (loanError) throw loanError;

      // Mark the item as loaned
      const { error: itemError } = await supabase
        .from('items')
        .update({ is_loaned: true, updated_at: new Date().toISOString() })
        .eq('id', itemId);

      if (itemError) {
        console.error('Error updating item loaned status:', itemError);
      }

      // Update itemStore's local state
      useItemStore.getState().markAsLoaned(itemId, true);

      // Schedule a push notification reminder if return date is set
      if (expectedReturn && loan) {
        try {
          const itemName = loan.item?.name || 'your item';
          const notificationId = await scheduleLoanReminder(
            loan.id,
            itemName,
            borrowerName,
            expectedReturn
          );
          // Store the notification ID on the loan for later cancellation
          await supabase
            .from('loans')
            .update({ notification_id: notificationId })
            .eq('id', loan.id);
        } catch (notifError) {
          // Notification scheduling is non-critical
          console.warn('Failed to schedule loan reminder notification:', notifError);
        }
      }

      // Update local state
      set(state => ({
        activeLoans: [loan, ...state.activeLoans],
      }));

      return loan;
    } catch (error: any) {
      console.error('Error creating loan:', error);
      set({ error: error.message || 'Failed to create loan' });
      return null;
    } finally {
      set({ isCreating: false });
    }
  },

  markReturned: async (loanId: string) => {
    try {
      const loan = get().activeLoans.find(l => l.id === loanId);
      if (!loan) return;

      // Update loan record
      const { error } = await supabase
        .from('loans')
        .update({ returned_at: new Date().toISOString() })
        .eq('id', loanId);

      if (error) throw error;

      // Mark item as no longer loaned
      if (loan.item_id) {
        await supabase
          .from('items')
          .update({ is_loaned: false, updated_at: new Date().toISOString() })
          .eq('id', loan.item_id);

        useItemStore.getState().markAsLoaned(loan.item_id, false);
      }

      // Cancel any scheduled notification
      if ((loan as any).notification_id) {
        try {
          await cancelNotification((loan as any).notification_id);
        } catch (e) {
          console.warn('Failed to cancel notification:', e);
        }
      }

      // Move from active to history in local state
      const returnedLoan: LoanWithItem = {
        ...loan,
        returned_at: new Date().toISOString(),
      };

      set(state => ({
        activeLoans: state.activeLoans.filter(l => l.id !== loanId),
        loanHistory: [returnedLoan, ...state.loanHistory],
      }));
    } catch (error: any) {
      console.error('Error marking loan returned:', error);
      set({ error: error.message || 'Failed to mark returned' });
    }
  },

  sendReminder: async (loan: LoanWithItem) => {
    try {
      const itemName = loan.item?.name || 'an item';
      const returnDate = loan.expected_return
        ? new Date(loan.expected_return)
        : new Date(Date.now() + 24 * 60 * 60 * 1000); // Default: tomorrow

      const notificationId = await scheduleLoanReminder(
        loan.id,
        itemName,
        loan.borrower_name,
        returnDate
      );

      // Update reminder count
      await supabase
        .from('loans')
        .update({
          reminder_sent_count: (loan.reminder_sent_count || 0) + 1,
          next_reminder_at: returnDate.toISOString(),
          notification_id: notificationId,
        })
        .eq('id', loan.id);

      // Update local state
      set(state => ({
        activeLoans: state.activeLoans.map(l =>
          l.id === loan.id
            ? { ...l, reminder_sent_count: (l.reminder_sent_count || 0) + 1 }
            : l
        ),
      }));
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      set({ error: error.message || 'Failed to send reminder' });
    }
  },

  clearError: () => set({ error: null }),
}));
