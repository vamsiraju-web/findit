import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { Profile } from '../types/database';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,

  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session?.user,
      isLoading: false,
    });

    // Fetch profile when session is set
    if (session?.user) {
      supabase.from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile) set({ profile });
        });
    }
  },

  setProfile: (profile) => {
    set({ profile });
  },

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Verify the session is still valid by refreshing it
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        get().setSession(refreshedSession);
      } else {
        set({ isLoading: false, isAuthenticated: false });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      session: null,
      user: null,
      profile: null,
      isAuthenticated: false,
    });
  },
}));

// Listen for auth state changes (fires on sign-in, sign-out, token refresh)
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session?.user?.email);
  useAuthStore.getState().setSession(session);
});
