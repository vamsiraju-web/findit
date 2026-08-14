import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and save the token.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get push token
  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Save token to database for server-side notifications
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('push_tokens').upsert({
      user_id: user.id,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    });
  }

  // Android notification channel
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('loan-reminders', {
      name: 'Loan Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return token;
}

/**
 * Schedule a local notification for a loan return reminder.
 */
export async function scheduleLoanReminder(
  loanId: string,
  itemName: string,
  borrowerName: string,
  returnDate: Date
): Promise<string> {
  // Schedule reminder 1 day before return date
  const reminderDate = new Date(returnDate);
  reminderDate.setDate(reminderDate.getDate() - 1);

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: '📦 Loan Reminder',
      body: `${borrowerName} should return "${itemName}" tomorrow`,
      data: { loanId, type: 'loan_reminder' },
    },
    trigger: {
      date: reminderDate,
    },
  });

  return identifier;
}

/**
 * Cancel a scheduled notification.
 */
export async function cancelNotification(identifier: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}
