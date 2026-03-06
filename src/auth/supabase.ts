/**
 * Shared Appwrite client — replaces shared/auth/supabase.ts
 * Exports getSupabase() for backward compatibility (returns supabase-like wrapper)
 */
import { Client, Account, Databases, Storage, Query, ID } from 'appwrite';

let clientInstance: Client | null = null;
let accountInstance: Account | null = null;

export function getAppwriteClient(): Client {
  if (clientInstance) return clientInstance;
  
  const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
  const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
  
  if (!endpoint || !projectId) {
    throw new Error('Missing VITE_APPWRITE_ENDPOINT or VITE_APPWRITE_PROJECT_ID');
  }
  
  clientInstance = new Client().setEndpoint(endpoint).setProject(projectId);
  return clientInstance;
}

export function getAccount(): Account {
  if (accountInstance) return accountInstance;
  accountInstance = new Account(getAppwriteClient());
  return accountInstance;
}

// Backward-compatible export (shared AuthProvider imports getSupabase)
// Returns the supabase-like wrapper from the school's lib/supabase.ts
// In practice, the shared AuthProvider should be updated to use Appwrite directly
export function getSupabase() {
  // This is a minimal shim — the AuthProvider is rewritten to use Appwrite directly
  return {
    client: getAppwriteClient(),
    account: getAccount(),
  };
}

export { type Client, type Account };
