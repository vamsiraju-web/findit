/**
 * Supabase Configuration
 * 
 * Replace these with your actual Supabase project credentials.
 * You can find them at: https://supabase.com/dashboard/project/<project-id>/settings/api
 */
export const SUPABASE_URL = 'https://necltotchgqxqoyiuewe.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lY2x0b3RjaGdxeHFveWl1ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0OTM5OTEsImV4cCI6MjEwMjA2OTk5MX0.5RS2fnn7hRAaelxZF6Ds46mQlIZ_1D2iYaEioFXgllE';

/**
 * OpenAI Configuration (used by Edge Functions, not directly in app)
 * Store this in Supabase Edge Function secrets, NOT in the app.
 */
// export const OPENAI_API_KEY = 'sk-...'; // DO NOT put this in the app

/**
 * App Constants
 */
export const APP_NAME = 'FindIt';
export const APP_VERSION = '1.0.0';

/**
 * Categories for item classification
 */
export const ITEM_CATEGORIES = [
  'Documents',
  'Tools',
  'Electronics',
  'Clothing',
  'Kitchen',
  'Personal',
  'Medical',
  'Financial',
  'Seasonal',
  'Sports',
  'Other',
] as const;

export type ItemCategory = typeof ITEM_CATEGORIES[number];

/**
 * Location types for the hierarchy
 */
export const LOCATION_TYPES = [
  'building',
  'room',
  'furniture',
  'container',
  'spot',
] as const;

export type LocationType = typeof LOCATION_TYPES[number];
