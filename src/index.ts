// Auth
export { AuthProvider, useAuth } from './auth/AuthProvider';
export type { AuthContextType, Profile } from './auth/AuthProvider';
export { getSupabase, getAppwriteClient, getAccount } from './auth/supabase';

// Components
export { default as Header } from './components/Header';
export type { HeaderConfig, NavLink, MegaMenuCategory, MegaMenuSection } from './components/Header';
