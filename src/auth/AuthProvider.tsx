import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Client, Account, Databases, Query, ID } from 'appwrite';

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://appwrite.vibecoding.by/v1';
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || '69aa2114000211b48e63';
const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || 'vibecoding';
const API_URL = import.meta.env.VITE_API_URL || 'https://vibecoding.by/functions/v1';

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
const account = new Account(client);
const databases = new Databases(client);

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

interface AppwriteUser {
  id: string;
  email: string;
  user_metadata: { full_name: string };
}

export interface AuthContextType {
  user: AppwriteUser | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  sendVerificationEmail: (email: string, fullName: string) => Promise<{ error: Error | null }>;
  verifyEmailAndCreateUser: (token: string, email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  sendPasswordResetEmail: (email: string) => Promise<{ error: Error | null }>;
  verifyResetToken: (token: string, email: string) => Promise<{ valid: boolean; error: string | null; message: string | null }>;
  resetPassword: (token: string, email: string, newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppwriteUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const acc = await account.get();
        if (mounted) {
          const u = { id: acc.$id, email: acc.email, user_metadata: { full_name: acc.name } };
          setUser(u);
          await loadProfile(acc.$id);
        }
      } catch {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    initAuth();
    return () => { mounted = false; };
  }, []);

  const loadProfile = async (userId: string, retries = 5) => {
    for (let i = 0; i < retries; i++) {
      try {
        const doc = await databases.getDocument(DATABASE_ID, 'profiles', userId);
        setProfile({
          id: doc.$id,
          email: doc.email,
          full_name: doc.full_name,
          avatar_url: doc.avatar_url,
          role: doc.role,
          created_at: doc.created_at,
          updated_at: doc.updated_at,
        });
        setLoading(false);
        return;
      } catch {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    setProfile(null);
    setLoading(false);
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      await account.create(ID.unique(), email, password, fullName);
      await account.createEmailPasswordSession(email, password);
      const acc = await account.get();
      setUser({ id: acc.$id, email: acc.email, user_metadata: { full_name: acc.name } });
      await loadProfile(acc.$id);
      return { error: null };
    } catch (e: any) {
      return { error: { message: e.message } };
    }
  };

  const sendVerificationEmail = async (email: string, fullName: string) => {
    try {
      const res = await fetch(`${API_URL}/send-verification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName, siteUrl: window.location.origin }),
      });
      const data = await res.json();
      if (!res.ok) return { error: new Error(data.error || 'Failed') };
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const verifyEmailAndCreateUser = async (token: string, email: string, password: string, fullName: string) => {
    try {
      const res = await fetch(`${API_URL}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password, fullName }),
      });
      const data = await res.json();
      if (!res.ok) return { error: new Error(data.error || 'Verification failed') };
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const sendPasswordResetEmail = async (email: string) => {
    try {
      const res = await fetch(`${API_URL}/send-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, siteUrl: window.location.origin }),
      });
      const data = await res.json();
      if (!res.ok) return { error: new Error(data.error || 'Failed') };
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const verifyResetToken = async (token: string, email: string) => {
    try {
      const res = await fetch(`${API_URL}/verify-reset-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email }),
      });
      const data = await res.json();
      if (!data.valid) return { valid: false, error: data.error, message: data.message };
      return { valid: true, error: null, message: null };
    } catch {
      return { valid: false, error: 'network_error', message: 'Network error' };
    }
  };

  const resetPassword = async (token: string, email: string, newPassword: string) => {
    try {
      const res = await fetch(`${API_URL}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) return { error: new Error(data.error || 'Reset failed') };
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await account.createEmailPasswordSession(email, password);
      const acc = await account.get();
      const u = { id: acc.$id, email: acc.email, user_metadata: { full_name: acc.name } };
      setUser(u);
      await loadProfile(acc.$id);
      return { error: null };
    } catch (e: any) {
      return { error: { message: e.message } };
    }
  };

  const signInWithGoogle = async () => {
    try {
      account.createOAuth2Session(
        'google' as any,
        `${window.location.origin}/auth/callback`,
        `${window.location.origin}/login`
      );
      return { error: null };
    } catch (e: any) {
      return { error: { message: e.message } };
    }
  };

  const signOut = async () => {
    try {
      await account.deleteSession('current');
    } catch {}
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user') };
    try {
      const clean: any = {};
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined && k !== 'id') clean[k] = v;
      }
      await databases.updateDocument(DATABASE_ID, 'profiles', user.id, clean);
      await loadProfile(user.id);
      return { error: null };
    } catch (e: any) {
      return { error: new Error(e.message) };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user, profile, loading,
        signUp, sendVerificationEmail, verifyEmailAndCreateUser,
        signIn, signInWithGoogle, signOut, updateProfile,
        sendPasswordResetEmail, verifyResetToken, resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
