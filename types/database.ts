/**
 * TypeScript types matching the Supabase database schema.
 * These are used throughout the app for type safety.
 */

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  type: 'building' | 'room' | 'furniture' | 'container' | 'spot';
  photo_url: string | null;
  depth: number;
  path: string | null;
  created_at: string;
}

export interface Item {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  location_id: string | null;
  location_path: string | null;
  photo_urls: string[] | null;
  voice_memo_url: string | null;
  transcript: string | null;
  is_loaned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Loan {
  id: string;
  item_id: string;
  user_id: string;
  borrower_name: string;
  borrower_contact: string | null;
  loaned_at: string;
  expected_return: string | null;
  returned_at: string | null;
  reminder_sent_count: number;
  next_reminder_at: string | null;
  notes: string | null;
}

// Joined types for UI display
export interface ItemWithLocation extends Item {
  location?: Location;
}

export interface LoanWithItem extends Loan {
  item?: Item;
}

// Search result type
export interface SearchResult {
  id: string;
  name: string;
  location_path: string | null;
  photo_urls: string[] | null;
  voice_memo_url: string | null;
  score: number;
}

// AI extraction result
export interface ExtractionResult {
  item_name: string;
  category: string;
  location_hierarchy: {
    name: string;
    type: 'building' | 'room' | 'furniture' | 'container' | 'spot';
  }[];
  tags: string[];
  notes: string | null;
}
