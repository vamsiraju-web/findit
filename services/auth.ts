import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

/**
 * Sign in with Google OAuth via Supabase.
 * On native: opens an in-app browser for Google authentication.
 * On web: redirects the page to Google OAuth.
 */
export async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) throw error;
    return;
  }

  // Native flow
  const redirectUrl = Linking.createURL('/(tabs)');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;

  if (data?.url) {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type === 'success') {
      const url = result.url;

      let params: URLSearchParams;
      if (url.includes('#')) {
        params = new URLSearchParams(url.split('#')[1]);
      } else if (url.includes('?')) {
        params = new URLSearchParams(url.split('?')[1]);
      } else {
        console.error('No tokens found in redirect URL:', url);
        return;
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          console.error('Failed to set session:', sessionError);
          throw sessionError;
        }

        console.log('Session set successfully, user:', sessionData.user?.email);
      } else {
        console.error('Missing tokens in redirect.');
      }
    }
  }
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get the current authenticated user session.
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Get the current user profile from the database.
 */
export async function getUserProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: profile } = await supabase.from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  return profile;
}
