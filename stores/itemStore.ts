import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { Item, ItemWithLocation, SearchResult } from '../types/database';

interface ItemState {
  items: Item[];
  recentItems: Item[];
  searchResults: SearchResult[];
  isLoading: boolean;
  isSearching: boolean;

  // Actions
  fetchItems: () => Promise<void>;
  fetchRecentItems: (limit?: number) => Promise<void>;
  searchItems: (query: string) => Promise<void>;
  addItem: (item: Partial<Item>) => Promise<Item | null>;
  updateItem: (id: string, updates: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  markAsLoaned: (id: string, loaned: boolean) => Promise<void>;
}

export const useItemStore = create<ItemState>((set, get) => ({
  items: [],
  recentItems: [],
  searchResults: [],
  isLoading: false,
  isSearching: false,

  fetchItems: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      set({ items: data || [] });
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchRecentItems: async (limit = 10) => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      set({ recentItems: data || [] });
    } catch (error) {
      console.error('Error fetching recent items:', error);
    }
  },

  searchItems: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }

    set({ isSearching: true });
    try {
      // Call the hybrid search RPC function
      const { data, error } = await supabase.rpc('search_items_hybrid', {
        query_text: query,
        match_count: 20,
      });

      if (error) throw error;
      set({ searchResults: data || [] });
    } catch (error) {
      console.error('Error searching items:', error);
      // Fallback to basic text search
      const { data } = await supabase
        .from('items')
        .select('id, name, location_path, photo_urls, voice_memo_url')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%,transcript.ilike.%${query}%`)
        .limit(20);
      set({ searchResults: (data || []).map(d => ({ ...d, score: 1 })) });
    } finally {
      set({ isSearching: false });
    }
  },

  addItem: async (item: Partial<Item>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('items')
        .insert({ ...item, user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      set(state => ({
        items: [data, ...state.items],
        recentItems: [data, ...state.recentItems.slice(0, 9)],
      }));

      return data;
    } catch (error) {
      console.error('Error adding item:', error);
      return null;
    }
  },

  updateItem: async (id: string, updates: Partial<Item>) => {
    try {
      const { error } = await supabase
        .from('items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        items: state.items.map(i => i.id === id ? { ...i, ...updates } : i),
        recentItems: state.recentItems.map(i => i.id === id ? { ...i, ...updates } : i),
      }));
    } catch (error) {
      console.error('Error updating item:', error);
    }
  },

  deleteItem: async (id: string) => {
    try {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) throw error;

      set(state => ({
        items: state.items.filter(i => i.id !== id),
        recentItems: state.recentItems.filter(i => i.id !== id),
      }));
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  },

  markAsLoaned: async (id: string, loaned: boolean) => {
    await get().updateItem(id, { is_loaned: loaned });
  },
}));
