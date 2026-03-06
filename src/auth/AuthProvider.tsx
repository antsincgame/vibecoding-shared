import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSupabase, getAccount, restoreCrossDomainSession } from './supabase';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any | null }>;
  sendVerificationEmail: (email: string, fullName: string) => Promise<{ error: Error | null }>;
  verifyEmailAndCreateUser: (token: string, email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: any | null }>;
  signInWithGoogle: () => Promise<{ error: any | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  sendPasswordResetEmail: (email: string) => Promise<{ error: Error | null }>;
  verifyResetToken: (token: string, email: string) => Promise<{ valid: boolean; error: string | null; message: string | null }>;
  resetPassword: (token: string, email: string, newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      try {
        await restoreCrossDomainSession();
        const { data } = await supabase.auth.getSession();
        if (mounted) {
          if (data.session?.user) {
            setUser(data.session.user);
            await loadProfile();
          } else {
            setUser(null);
            setLoading(false);
          }
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };
    initAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (!mounted) return;
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile();
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const loadProfile = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
      try {
        const acc = getAccount();
        const awUser = await acc.get();
        const { data } = await supabase.from('profiles').select('*').eq('email', awUser.email).maybeSingle();
        if (data) { setProfile(data); setLoading(false); return; }
        await new Promise(r => setTimeout(r, 500 + i * 200));
      } catch { await new Promise(r => setTimeout(r, 500)); }
    }
    // Auto-create profile if none exists
    try {
      const acc = getAccount();
      const awUser = await acc.get();
      const { data } = await supabase.from('profiles').insert({
        email: awUser.email,
        full_name: awUser.name || awUser.email.split('@')[0],
        role: 'student',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (data) { setProfile(data); setLoading(false); return; }
    } catch { /* fall through */ }
    setProfile(null);
    setLoading(false);
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    return { error };
  };

  const sendVerificationEmail = async (_email: string, _fullName: string) => {
    try {
      const acc = getAccount();
      await acc.createVerification(window.location.origin + '/student/confirm');
      return { error: null };
    } catch (error) { return { error: error as Error }; }
  };

  const verifyEmailAndCreateUser = async (token: string, _email: string, _password: string, _fullName: string) => {
    try {
      const acc = getAccount();
      const urlParams = new URLSearchParams(window.location.search);
      const userId = urlParams.get('userId') || '';
      const secret = urlParams.get('secret') || token;
      await acc.updateVerification(userId, secret);
      return { error: null };
    } catch (error) { return { error: error as Error }; }
  };

  const sendPasswordResetEmail = async (email: string) => {
    try {
      const acc = getAccount();
      await acc.createRecovery(email, window.location.origin + '/student/reset-password');
      return { error: null };
    } catch (error) { return { error: error as Error }; }
  };

  const verifyResetToken = async () => ({ valid: true, error: null, message: null });

  const resetPassword = async (_token: string, _email: string, newPassword: string) => {
    try {
      const acc = getAccount();
      const urlParams = new URLSearchParams(window.location.search);
      const userId = urlParams.get('userId') || '';
      const secret = urlParams.get('secret') || _token;
      await acc.updateRecovery(userId, secret, newPassword);
      return { error: null };
    } catch (error) { return { error: error as Error }; }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user') };
    try {
      const acc = getAccount();
      const awUser = await acc.get();
      const { data: existing } = await supabase.from('profiles').select('*').eq('email', awUser.email).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('profiles').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', existing.id);
        if (error) throw error;
        await loadProfile();
      }
      return { error: null };
    } catch (error) { return { error: error as Error }; }
  };

  return (
    <AuthContext.Provider value={{
      user, profile, loading, signUp, sendVerificationEmail, verifyEmailAndCreateUser,
      signIn, signInWithGoogle, signOut, updateProfile, sendPasswordResetEmail, verifyResetToken, resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    const noop = async () => ({ error: null }) as any;
    return {
      user: null, profile: null, loading: false,
      signUp: noop, sendVerificationEmail: noop, verifyEmailAndCreateUser: noop,
      signIn: noop, signInWithGoogle: noop, signOut: async () => {},
      updateProfile: noop, sendPasswordResetEmail: noop,
      verifyResetToken: async () => ({ valid: false, error: null, message: null }),
      resetPassword: noop,
    };
  }
  return context;
}
