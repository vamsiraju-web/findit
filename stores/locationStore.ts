import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { Location } from '../types/database';

interface LocationState {
  locations: Location[];
  isLoading: boolean;
  itemCounts: Record<string, number>; // locationId -> count of items

  // Actions
  fetchLocations: (parentId: string | null) => Promise<void>;
  createLocation: (name: string, type: Location['type'], parentId: string | null) => Promise<Location | null>;
  updateLocation: (id: string, updates: Partial<Pick<Location, 'name' | 'type'>>) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
  getLocationPath: (locationId: string) => Promise<Location[]>;
  getItemCount: (locationId: string) => Promise<number>;
  fetchItemCounts: (locationIds: string[]) => Promise<void>;
}

/**
 * Builds the materialized path string for a location.
 * e.g., "Home > Living Room > Bookshelf"
 */
async function buildMaterializedPath(parentId: string | null, name: string): Promise<string> {
  if (!parentId) {
    return name;
  }

  // Fetch the parent's path
  const { data: parent } = await supabase
    .from('locations')
    .select('path, name')
    .eq('id', parentId)
    .single();

  if (parent?.path) {
    return `${parent.path} > ${name}`;
  }
  if (parent?.name) {
    return `${parent.name} > ${name}`;
  }
  return name;
}

/**
 * Calculates the depth based on parent.
 */
async function calculateDepth(parentId: string | null): Promise<number> {
  if (!parentId) return 0;

  const { data: parent } = await supabase
    .from('locations')
    .select('depth')
    .eq('id', parentId)
    .single();

  return (parent?.depth ?? 0) + 1;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  locations: [],
  isLoading: false,
  itemCounts: {},

  fetchLocations: async (parentId: string | null) => {
    set({ isLoading: true });
    try {
      const query = supabase
        .from('locations')
        .select('*')
        .order('name');

      if (parentId) {
        query.eq('parent_id', parentId);
      } else {
        query.is('parent_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      const locations = data || [];
      set({ locations });

      // Fetch item counts for all fetched locations
      if (locations.length > 0) {
        get().fetchItemCounts(locations.map(l => l.id));
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  createLocation: async (name: string, type: Location['type'], parentId: string | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const path = await buildMaterializedPath(parentId, name);
      const depth = await calculateDepth(parentId);

      const { data, error } = await supabase
        .from('locations')
        .insert({
          user_id: user.id,
          name,
          type,
          parent_id: parentId,
          path,
          depth,
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      set(state => ({
        locations: [...state.locations, data].sort((a, b) => a.name.localeCompare(b.name)),
      }));

      return data;
    } catch (error) {
      console.error('Error creating location:', error);
      return null;
    }
  },

  updateLocation: async (id: string, updates: Partial<Pick<Location, 'name' | 'type'>>) => {
    try {
      // If name is being updated, recalculate the path
      let pathUpdate: { path?: string } = {};
      if (updates.name) {
        const { data: existing } = await supabase
          .from('locations')
          .select('parent_id')
          .eq('id', id)
          .single();

        if (existing) {
          pathUpdate.path = await buildMaterializedPath(existing.parent_id, updates.name);
        }
      }

      const { error } = await supabase
        .from('locations')
        .update({ ...updates, ...pathUpdate })
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        locations: state.locations
          .map(l => l.id === id ? { ...l, ...updates, ...pathUpdate } : l)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }));
    } catch (error) {
      console.error('Error updating location:', error);
    }
  },

  deleteLocation: async (id: string) => {
    try {
      // Check if location has children
      const { data: children } = await supabase
        .from('locations')
        .select('id')
        .eq('parent_id', id)
        .limit(1);

      if (children && children.length > 0) {
        throw new Error('Cannot delete a location that contains sub-locations. Remove children first.');
      }

      // Check if location has items
      const { count } = await supabase
        .from('items')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', id);

      if (count && count > 0) {
        throw new Error('Cannot delete a location that contains items. Move or remove items first.');
      }

      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        locations: state.locations.filter(l => l.id !== id),
        itemCounts: Object.fromEntries(
          Object.entries(state.itemCounts).filter(([key]) => key !== id)
        ),
      }));
    } catch (error) {
      console.error('Error deleting location:', error);
      throw error; // Re-throw so the UI can show the message
    }
  },

  getLocationPath: async (locationId: string) => {
    const path: Location[] = [];
    let currentId: string | null = locationId;

    while (currentId) {
      const { data } = await supabase
        .from('locations')
        .select('*')
        .eq('id', currentId)
        .single();

      if (!data) break;
      path.unshift(data);
      currentId = data.parent_id;
    }

    return path;
  },

  getItemCount: async (locationId: string) => {
    const { count, error } = await supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId);

    if (error) {
      console.error('Error getting item count:', error);
      return 0;
    }

    const itemCount = count || 0;

    // Update local cache
    set(state => ({
      itemCounts: { ...state.itemCounts, [locationId]: itemCount },
    }));

    return itemCount;
  },

  fetchItemCounts: async (locationIds: string[]) => {
    if (locationIds.length === 0) return;

    try {
      // Batch query: get count of items per location
      const { data, error } = await supabase
        .from('items')
        .select('location_id')
        .in('location_id', locationIds);

      if (error) throw error;

      // Count items per location
      const counts: Record<string, number> = {};
      locationIds.forEach(id => { counts[id] = 0; });

      (data || []).forEach(item => {
        if (item.location_id) {
          counts[item.location_id] = (counts[item.location_id] || 0) + 1;
        }
      });

      set(state => ({
        itemCounts: { ...state.itemCounts, ...counts },
      }));
    } catch (error) {
      console.error('Error fetching item counts:', error);
    }
  },
}));
