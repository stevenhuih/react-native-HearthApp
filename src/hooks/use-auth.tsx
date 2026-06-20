import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { exchangeCodeFromUrl } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/db';

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  /** True until the initial session + profile load resolves (gate shows splash). */
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PROFILE_COLUMNS =
  'id, display_name, archetype_id, dietary_profile, household_id, subscription_tier, locale, onboarding_complete, notification_prefs, last_scan_at';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (current: Session | null) => {
    if (!current?.user) {
      setProfile(null);
      return;
    }
    // Ensure the public.users row exists for this auth user, then read it.
    // TODO(db): a `handle_new_user` trigger on auth.users INSERT is the more
    // robust production pattern; this client-side upsert keeps the migrations
    // untouched for now. RLS (users_insert_own / users_select_own) permits it.
    await supabase
      .from('users')
      .upsert({ id: current.user.id }, { onConflict: 'id', ignoreDuplicates: true });

    const { data } = await supabase
      .from('users')
      .select(PROFILE_COLUMNS)
      .eq('id', current.user.id)
      .maybeSingle();

    setProfile((data as UserProfile | null) ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!mounted) return;
      setSession(next);
      await loadProfile(next);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Handle the magic-link / OAuth deep link landing on native.
  useEffect(() => {
    const handle = (url: string | null) => {
      if (url) exchangeCodeFromUrl(url).catch(() => {});
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  const refreshProfile = useCallback(() => loadProfile(session), [loadProfile, session]);

  const value = useMemo<AuthContextValue>(
    () => ({ session, profile, isLoading, refreshProfile }),
    [session, profile, isLoading, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider.');
  return ctx;
}
