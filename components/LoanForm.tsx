import { useState } from 'react';
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
import { useLoanStore } from '../stores/loanStore';

interface LoanFormProps {
  visible: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  onSuccess?: () => void;
}

export default function LoanForm({ visible, onClose, itemId, itemName, onSuccess }: LoanFormProps) {
  const { createLoan, isCreating } = useLoanStore();

  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerContact, setBorrowerContact] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedReturn, setExpectedReturn] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Quick-pick date options
  const dateOptions = [
    { label: 'Tomorrow', days: 1 },
    { label: '3 days', days: 3 },
    { label: '1 week', days: 7 },
    { label: '2 weeks', days: 14 },
    { label: '1 month', days: 30 },
  ];

  const [selectedDateOption, setSelectedDateOption] = useState<number | null>(null);

  // Manual date input state
  const [manualDate, setManualDate] = useState('');

  const resetForm = () => {
    setBorrowerName('');
    setBorrowerContact('');
    setNotes('');
    setExpectedReturn(null);
    setSelectedDateOption(null);
    setManualDate('');
    setShowDatePicker(false);
  };

  const handleSelectDateOption = (days: number, index: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(9, 0, 0, 0); // Set to 9:00 AM for notification
    setExpectedReturn(date);
    setSelectedDateOption(index);
    setManualDate('');
    setShowDatePicker(false);
  };

  const handleManualDateSubmit = () => {
    if (!manualDate.trim()) return;

    // Parse date in format MM/DD/YYYY or YYYY-MM-DD
    const parsed = new Date(manualDate);
    if (isNaN(parsed.getTime())) {
      Alert.alert('Invalid Date', 'Please enter a valid date (MM/DD/YYYY)');
      return;
    }
    if (parsed <= new Date()) {
      Alert.alert('Invalid Date', 'Return date must be in the future');
      return;
    }
    parsed.setHours(9, 0, 0, 0);
    setExpectedReturn(parsed);
    setSelectedDateOption(null);
    setShowDatePicker(false);
  };

  const handleSubmit = async () => {
    // Validate
    if (!borrowerName.trim()) {
      Alert.alert('Required', 'Please enter who you are lending to');
      return;
    }

    const loan = await createLoan(
      itemId,
      borrowerName.trim(),
      borrowerContact.trim() || null,
      expectedReturn,
      notes.trim() || null
    );

    if (loan) {
      resetForm();
      onClose();
      onSuccess?.();
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#7F8C8D" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loan Item</Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView
          style={styles.form}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Item info */}
          <View style={styles.itemBanner}>
            <Ionicons name="cube-outline" size={20} color="#1B4F72" />
            <Text style={styles.itemBannerText}>{itemName}</Text>
          </View>

          {/* Borrower Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Lending to *</Text>
            <TextInput
              style={styles.input}
              placeholder="Person's name"
              placeholderTextColor="#BDC3C7"
              value={borrowerName}
              onChangeText={setBorrowerName}
              autoFocus
              returnKeyType="next"
            />
          </View>

          {/* Borrower Contact */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Contact (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Phone number or email"
              placeholderTextColor="#BDC3C7"
              value={borrowerContact}
              onChangeText={setBorrowerContact}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
            />
            <Text style={styles.fieldHint}>
              Helps you remember how to reach them for reminders
            </Text>
          </View>

          {/* Expected Return Date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Expected return</Text>

            {/* Quick-pick chips */}
            <View style={styles.dateChips}>
              {dateOptions.map((option, index) => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.dateChip,
                    selectedDateOption === index && styles.dateChipSelected,
                  ]}
                  onPress={() => handleSelectDateOption(option.days, index)}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      selectedDateOption === index && styles.dateChipTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom date toggle */}
            <TouchableOpacity
              style={styles.customDateToggle}
              onPress={() => setShowDatePicker(!showDatePicker)}
            >
              <Ionicons name="calendar-outline" size={16} color="#3498DB" />
              <Text style={styles.customDateToggleText}>
                {showDatePicker ? 'Hide custom date' : 'Enter specific date'}
              </Text>
            </TouchableOpacity>

            {/* Manual date input */}
            {showDatePicker && (
              <View style={styles.manualDateRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor="#BDC3C7"
                  value={manualDate}
                  onChangeText={setManualDate}
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="done"
                  onSubmitEditing={handleManualDateSubmit}
                />
                <TouchableOpacity
                  style={styles.setDateButton}
                  onPress={handleManualDateSubmit}
                >
                  <Text style={styles.setDateButtonText}>Set</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Show selected date */}
            {expectedReturn && (
              <View style={styles.selectedDateDisplay}>
                <Ionicons name="checkmark-circle" size={16} color="#27AE60" />
                <Text style={styles.selectedDateText}>
                  Return by {formatDate(expectedReturn)}
                </Text>
                <TouchableOpacity onPress={() => { setExpectedReturn(null); setSelectedDateOption(null); }}>
                  <Ionicons name="close-circle" size={16} color="#95A5A6" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Notes */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Condition, context, special instructions..."
              placeholderTextColor="#BDC3C7"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Notification info */}
          {expectedReturn && (
            <View style={styles.notificationInfo}>
              <Ionicons name="notifications-outline" size={16} color="#8E44AD" />
              <Text style={styles.notificationInfoText}>
                You'll get a reminder 1 day before the return date
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, isCreating && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="hand-left-outline" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Loan It Out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
    backgroundColor: '#FFFFFF',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2C3E50',
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: 20,
    gap: 20,
  },
  itemBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EBF5FB',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D4E6F1',
  },
  itemBannerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B4F72',
    flex: 1,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE1E5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2C3E50',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  fieldHint: {
    fontSize: 12,
    color: '#95A5A6',
    marginTop: 2,
  },
  dateChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE1E5',
  },
  dateChipSelected: {
    backgroundColor: '#1B4F72',
    borderColor: '#1B4F72',
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2C3E50',
  },
  dateChipTextSelected: {
    color: '#FFFFFF',
  },
  customDateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  customDateToggleText: {
    fontSize: 13,
    color: '#3498DB',
    fontWeight: '500',
  },
  manualDateRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  setDateButton: {
    backgroundColor: '#1B4F72',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  setDateButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  selectedDateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EAFAF1',
    padding: 10,
    borderRadius: 8,
  },
  selectedDateText: {
    fontSize: 13,
    color: '#27AE60',
    fontWeight: '500',
    flex: 1,
  },
  notificationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F4ECF7',
    padding: 12,
    borderRadius: 8,
  },
  notificationInfoText: {
    fontSize: 12,
    color: '#8E44AD',
    flex: 1,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1B4F72',
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
