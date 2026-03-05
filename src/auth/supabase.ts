import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  }

  supabaseInstance = createClient(url, key, {
    auth: {
      detectSessionInUrl: true,
      autoRefreshToken: true,
      persistSession: true,
      flowType: 'pkce',
    },
  });

  return supabaseInstance;
}

export { type SupabaseClient };
