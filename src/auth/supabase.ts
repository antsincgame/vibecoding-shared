import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cross-subdomain cookie storage for shared auth
class CookieStorage {
  private domain: string;

  constructor() {
    // Use root domain for cookie sharing across subdomains
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const parts = host.split('.');
    this.domain = parts.length >= 2 ? `.${parts.slice(-2).join('.')}` : host;
  }

  getItem(key: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(^| )${encodeURIComponent(key)}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
  }

  setItem(key: string, value: string): void {
    if (typeof document === 'undefined') return;
    const maxAge = 365 * 24 * 60 * 60; // 1 year
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; domain=${this.domain}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
  }

  removeItem(key: string): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${encodeURIComponent(key)}=; domain=${this.domain}; path=/; max-age=0`;
  }
}

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
      storage: new CookieStorage(),
      flowType: 'pkce',
    },
  });

  return supabaseInstance;
}

export { type SupabaseClient };
