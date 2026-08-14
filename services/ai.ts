import { supabase } from './supabase';
import { ExtractionResult } from '../types/database';

/**
 * Process a voice memo through the AI pipeline.
 * Calls the Supabase Edge Function that handles:
 * 1. Whisper transcription
 * 2. LLM entity extraction
 * 3. Embedding generation
 * 
 * @param voiceMemoUrl - URL of the uploaded voice memo
 * @returns Extracted structured data
 */
export async function processVoiceMemo(voiceMemoUrl: string): Promise<{
  transcript: string;
  extraction: ExtractionResult;
}> {
  const { data, error } = await supabase.functions.invoke('process-item', {
    body: { voice_memo_url: voiceMemoUrl },
  });

  if (error) throw error;
  return data;
}

/**
 * Process a text input through the AI extraction pipeline.
 * Used when the user types instead of speaking.
 * 
 * @param text - User's text description
 * @returns Extracted structured data
 */
export async function processTextInput(text: string): Promise<{
  transcript: string;
  extraction: ExtractionResult;
}> {
  const { data, error } = await supabase.functions.invoke('process-item', {
    body: { text_input: text },
  });

  if (error) throw error;
  return data;
}

/**
 * Generate a search embedding for a query.
 * Used for semantic search — the Edge Function generates the embedding
 * and performs the hybrid search.
 * 
 * @param query - Search query text
 * @returns Search results from the hybrid search function
 */
export async function semanticSearch(query: string) {
  const { data, error } = await supabase.functions.invoke('process-item', {
    body: { search_query: query },
  });

  if (error) throw error;
  return data.results;
}
