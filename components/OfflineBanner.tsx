import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineStore } from '../utils/offlineQueue';
import { useEffect, useRef } from 'react';

/**
 * OfflineBanner — A subtle banner displayed at the top of the screen
 * when the device is offline or syncing queued items.
 *
 * States:
 * 1. Hidden (online, no queue) — renders nothing
 * 2. "You're offline" — orange banner when disconnected
 * 3. "Syncing X items..." — blue banner when processing queue
 */
export function OfflineBanner() {
  const { isOnline, isSyncing, queueLength } = useOfflineStore();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const shouldShow = !isOnline || isSyncing || queueLength > 0;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [shouldShow]);

  if (!shouldShow) return null;

  const getBannerContent = () => {
    if (!isOnline) {
      return {
        icon: 'cloud-offline-outline' as const,
        text: "You're offline — items will sync when connected",
        style: styles.offlineBanner,
        textStyle: styles.offlineText,
      };
    }

    if (isSyncing) {
      return {
        icon: 'sync-outline' as const,
        text: `Syncing ${queueLength} item${queueLength !== 1 ? 's' : ''}...`,
        style: styles.syncingBanner,
        textStyle: styles.syncingText,
      };
    }

    // Online but has queued items (waiting to process)
    return {
      icon: 'time-outline' as const,
      text: `${queueLength} item${queueLength !== 1 ? 's' : ''} pending sync`,
      style: styles.pendingBanner,
      textStyle: styles.pendingText,
    };
  };

  const { icon, text, style, textStyle } = getBannerContent();

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity: slideAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-40, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Ionicons name={icon} size={16} color={textStyle.color as string} />
      <Text style={[styles.text, textStyle]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
  },
  offlineBanner: {
    backgroundColor: '#FEF3E2',
    borderBottomWidth: 1,
    borderBottomColor: '#F39C12',
  },
  offlineText: {
    color: '#D35400',
  },
  syncingBanner: {
    backgroundColor: '#EBF5FB',
    borderBottomWidth: 1,
    borderBottomColor: '#2E86C1',
  },
  syncingText: {
    color: '#1B4F72',
  },
  pendingBanner: {
    backgroundColor: '#FEF9E7',
    borderBottomWidth: 1,
    borderBottomColor: '#F4D03F',
  },
  pendingText: {
    color: '#7D6608',
  },
});
