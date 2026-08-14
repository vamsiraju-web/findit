import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';

// --- Types ---

export type QueuedAction =
  | { type: 'CREATE_ITEM'; payload: Record<string, any>; createdAt: string }
  | { type: 'UPDATE_ITEM'; payload: { id: string; updates: Record<string, any> }; createdAt: string }
  | { type: 'CREATE_LOCATION'; payload: { name: string; type: string; parentId: string | null }; createdAt: string }
  | { type: 'VOICE_MEMO'; payload: { fileUri: string; itemData: Record<string, any> }; createdAt: string };

interface OfflineQueueState {
  isOnline: boolean;
  isSyncing: boolean;
  queueLength: number;
  lastSyncedAt: string | null;

  // Actions
  initialize: () => () => void; // returns unsubscribe
  enqueue: (action: Omit<QueuedAction, 'createdAt'>) => Promise<void>;
  processQueue: () => Promise<void>;
  getQueueLength: () => Promise<number>;
  clearQueue: () => Promise<void>;
}

// --- Constants ---
const QUEUE_STORAGE_KEY = '@findit_offline_queue';
const LAST_SYNC_KEY = '@findit_last_sync';

// --- Queue persistence ---

async function loadQueue(): Promise<QueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('[OfflineQueue] Failed to load queue:', error);
    return [];
  }
}

async function saveQueue(queue: QueuedAction[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[OfflineQueue] Failed to save queue:', error);
  }
}

// --- Action processors ---

async function processAction(action: QueuedAction): Promise<boolean> {
  // Dynamic import to avoid circular dependencies
  const { supabase } = require('@services/supabase');

  try {
    switch (action.type) {
      case 'CREATE_ITEM': {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase
          .from('items')
          .insert({ ...action.payload, user_id: user.id });

        if (error) throw error;
        return true;
      }

      case 'UPDATE_ITEM': {
        const { id, updates } = action.payload;
        const { error } = await supabase
          .from('items')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) throw error;
        return true;
      }

      case 'CREATE_LOCATION': {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { name, type, parentId } = action.payload;
        const { error } = await supabase
          .from('locations')
          .insert({
            user_id: user.id,
            name,
            type,
            parent_id: parentId,
          });

        if (error) throw error;
        return true;
      }

      case 'VOICE_MEMO': {
        // For voice memos, we need to upload the file first, then create the item
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { fileUri, itemData } = action.payload;

        // Upload voice memo to storage
        const fileName = `voice_memos/${user.id}/${Date.now()}.m4a`;
        const response = await fetch(fileUri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, blob, { contentType: 'audio/m4a' });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(fileName);

        // Create the item with the voice memo URL
        const { error } = await supabase
          .from('items')
          .insert({
            ...itemData,
            user_id: user.id,
            voice_memo_url: publicUrl,
          });

        if (error) throw error;
        return true;
      }

      default:
        console.warn('[OfflineQueue] Unknown action type:', (action as any).type);
        return true; // Remove unknown actions from queue
    }
  } catch (error) {
    console.error('[OfflineQueue] Failed to process action:', action.type, error);
    return false;
  }
}

// --- Zustand Store ---

export const useOfflineStore = create<OfflineQueueState>((set, get) => ({
  isOnline: true,
  isSyncing: false,
  queueLength: 0,
  lastSyncedAt: null,

  initialize: () => {
    // Load initial state
    loadQueue().then(queue => {
      set({ queueLength: queue.length });
    });

    AsyncStorage.getItem(LAST_SYNC_KEY).then(val => {
      if (val) set({ lastSyncedAt: val });
    });

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !get().isOnline;
      const isNowOnline = !!(state.isConnected && state.isInternetReachable !== false);

      set({ isOnline: isNowOnline });

      // If we just came back online, process the queue
      if (wasOffline && isNowOnline) {
        console.log('[OfflineQueue] Back online — processing queue...');
        get().processQueue();
      }
    });

    // Also check initial state
    NetInfo.fetch().then((state: NetInfoState) => {
      set({ isOnline: !!(state.isConnected && state.isInternetReachable !== false) });
    });

    return unsubscribe;
  },

  enqueue: async (action) => {
    const queuedAction: QueuedAction = {
      ...action,
      createdAt: new Date().toISOString(),
    } as QueuedAction;

    const queue = await loadQueue();
    queue.push(queuedAction);
    await saveQueue(queue);

    set({ queueLength: queue.length });
    console.log('[OfflineQueue] Enqueued action:', action.type, '| Queue size:', queue.length);

    // If online, try to process immediately
    if (get().isOnline) {
      get().processQueue();
    }
  },

  processQueue: async () => {
    if (get().isSyncing) return; // Already processing
    if (!get().isOnline) return; // Still offline

    const queue = await loadQueue();
    if (queue.length === 0) return;

    set({ isSyncing: true });
    console.log('[OfflineQueue] Processing queue:', queue.length, 'items');

    let processed = 0;
    const remainingQueue: QueuedAction[] = [];

    for (const action of queue) {
      // Check connectivity before each action
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        // Lost connection mid-sync, keep remaining items
        remainingQueue.push(action);
        continue;
      }

      const success = await processAction(action);
      if (success) {
        processed++;
      } else {
        // Keep failed actions for retry (could add retry limit here)
        remainingQueue.push(action);
      }
    }

    await saveQueue(remainingQueue);

    const now = new Date().toISOString();
    if (processed > 0) {
      await AsyncStorage.setItem(LAST_SYNC_KEY, now);
    }

    set({
      isSyncing: false,
      queueLength: remainingQueue.length,
      lastSyncedAt: processed > 0 ? now : get().lastSyncedAt,
    });

    console.log(`[OfflineQueue] Done. Processed: ${processed}, Remaining: ${remainingQueue.length}`);
  },

  getQueueLength: async () => {
    const queue = await loadQueue();
    set({ queueLength: queue.length });
    return queue.length;
  },

  clearQueue: async () => {
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
    set({ queueLength: 0 });
    console.log('[OfflineQueue] Queue cleared');
  },
}));
