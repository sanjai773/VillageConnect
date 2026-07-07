import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isPlaceholder = (val) => {
  return (
    !val || 
    val.includes('your-project-id') || 
    val.includes('your-supabase-anon-key') || 
    val.trim() === ''
  );
};

export const isSupabaseConfigured = !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseAnonKey);

let supabaseInstance = null;

if (isSupabaseConfigured) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
  }
} else {
  console.warn(
    'Supabase is not configured or uses placeholders. Running in local/localStorage fallback mode. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file to connect a real backend.'
  );
}

export const supabase = supabaseInstance;
