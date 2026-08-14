import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

let authStore: any = null;
let splashModule: any = null;

try {
  authStore = require('../stores/authStore');
} catch (e) {
  console.error('Failed to load authStore:', e);
}

try {
  splashModule = require('expo-splash-screen');
  splashModule.preventAutoHideAsync();
} catch (e) {
  console.error('Failed to load splash-screen:', e);
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  const router = useRouter();
  const segments = useSegments();

  const store = authStore?.useAuthStore?.();

  useEffect(() => {
    async function init() {
      try {
        if (store?.initialize) {
          await store.initialize();
        }
      } catch (e: any) {
        console.error('Auth init error:', e);
      } finally {
        setReady(true);
        if (splashModule?.hideAsync) {
          await splashModule.hideAsync();
        }
      }
    }
    init();
  }, []);

  // Redirect based on auth state
  useEffect(() => {
    if (!ready || !store) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!store.isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (store.isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [store?.isAuthenticated, ready, segments]);

  if (!ready) {
    return null;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="item/new" options={{ headerShown: true, title: 'Log New Item', presentation: 'modal' }} />
      </Stack>
    </>
  );
}
