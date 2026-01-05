'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase.types';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { SupabaseArcadeService } from '@/services/SupabaseArcadeService';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type EmailSentMode = 'magic' | 'signup' | null;

interface UseSupabaseAuthState {
  session: Session | null;
  profile: ProfileRow | null;
  loading: boolean;
  error: string | null;
  emailSentMode: EmailSentMode;
  authDisabled: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string, username?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export function useSupabaseAuth(): UseSupabaseAuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailSentMode, setEmailSentMode] = useState<EmailSentMode>(null);
  const [authDisabled, setAuthDisabled] = useState(false);
  const supabaseRef = useRef<ReturnType<typeof getSupabaseBrowserClient> | null>(null);
  const arcadeServiceRef = useRef<SupabaseArcadeService | null>(null);
  const activeUserIdRef = useRef<string | null>(null);

  const loadProfile = useCallback(
    async (userId: string, fallbackName?: string, accessToken?: string) => {
      const service = arcadeServiceRef.current;
      if (!supabaseRef.current || !service) return;
      const isActiveUser = () => activeUserIdRef.current === userId;
      setError(null);

      const { data, error: fetchError } = await supabaseRef.current
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!isActiveUser()) return;

      // If not found, create a profile with basic defaults
      if (fetchError && fetchError.code !== 'PGRST116') {
        setError(fetchError.message);
        return;
      }

      if (data) {
        setProfile(data);
        return;
      }

      const username = fallbackName || 'Player';

      try {
        const created = await service.upsertProfile({
          id: userId,
          username,
        }, accessToken ? { accessToken } : undefined);
        if (!isActiveUser()) return;
        setProfile(created);
      } catch (err) {
        if (!isActiveUser()) return;
        setError(err instanceof Error ? err.message : 'Failed to create profile');
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;
    const initClient = async () => {
      if (typeof window === 'undefined') return;
      try {
        const supabase = getSupabaseBrowserClient();
        supabaseRef.current = supabase;
        const service = new SupabaseArcadeService(supabase);
        arcadeServiceRef.current = service;
        setAuthDisabled(false);

        const syncProfile = (nextSession: Session) => {
          const user = nextSession.user;
          activeUserIdRef.current = user.id;
          const fallback =
            user.user_metadata?.preferred_username ||
            user.email?.split('@')[0] ||
            'Player';
          void loadProfile(user.id, fallback, nextSession.access_token);
        };

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!mounted) return;
        if (sessionError) setError(sessionError.message);
        setSession(data.session);
        activeUserIdRef.current = data.session?.user?.id ?? null;
        setLoading(false);
        if (data.session?.user) {
          syncProfile(data.session);
        }

        const {
          data: authState,
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (!mounted) return;
          setSession(nextSession);
          setEmailSentMode(null);
          if (nextSession) {
            syncProfile(nextSession);
          } else {
            activeUserIdRef.current = null;
            setProfile(null);
          }
        });
        subscription = authState.subscription;
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Supabase unavailable';
        setError(message);
        setAuthDisabled(true);
        setLoading(false);
      }
    };

    void initClient();
    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
        subscription = null;
      }
    };
  }, [loadProfile]);

  const signInWithEmail = useCallback(
    async (email: string) => {
      if (!supabaseRef.current) {
        setError('Supabase not configured');
        return;
      }
      setLoading(true);
      setError(null);
      setEmailSentMode(null);
      const { error: signInError } = await supabaseRef.current.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo:
            typeof window !== 'undefined'
              ? `${window.location.origin}/auth/callback`
              : undefined,
        },
      });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      setEmailSentMode('magic');
      setLoading(false);
    },
    []
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      if (!supabaseRef.current) {
        setError('Supabase not configured');
        return;
      }
      setEmailSentMode(null);
      setLoading(true);
      setError(null);
      const { data, error: signInError } = await supabaseRef.current.auth.signInWithPassword({
        email,
        password,
      });
        if (signInError) {
          setError(signInError.message);
        } else {
          setSession(data.session);
          if (data.session?.user) {
            activeUserIdRef.current = data.session.user.id;
            const fallback =
              data.session.user.user_metadata?.preferred_username ||
              data.session.user.email?.split('@')[0];
            await loadProfile(data.session.user.id, fallback, data.session.access_token);
          }
        }
      setLoading(false);
    },
    [loadProfile]
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string, username?: string) => {
      if (!supabaseRef.current) {
        setError('Supabase not configured');
        return;
      }
      setEmailSentMode(null);
      setLoading(true);
      setError(null);
      const { data, error: signUpError } = await supabaseRef.current.auth.signUp({
        email,
        password,
        options: {
          data: username ? { preferred_username: username } : undefined,
          emailRedirectTo:
            typeof window !== 'undefined'
              ? `${window.location.origin}/auth/callback`
              : undefined,
        },
      });
        if (signUpError) {
          setError(signUpError.message);
        } else {
          if (!data.session) {
            setEmailSentMode('signup');
          }
          if (data.session?.user) {
            activeUserIdRef.current = data.session.user.id;
            const fallback =
              data.session.user.user_metadata?.preferred_username ||
              data.session.user.email?.split('@')[0];
            await loadProfile(data.session.user.id, fallback, data.session.access_token);
          }
        }
      setLoading(false);
    },
    [loadProfile]
  );

  const signOut = useCallback(async () => {
    if (!supabaseRef.current) return;
    setError(null);
    await supabaseRef.current.auth.signOut();
    activeUserIdRef.current = null;
    setSession(null);
    setProfile(null);
    setEmailSentMode(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await loadProfile(session.user.id, undefined, session.access_token);
    }
  }, [loadProfile, session?.access_token, session?.user]);

  return {
    session,
    profile,
    loading,
    error,
    emailSentMode,
    authDisabled,
    signInWithEmail,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    refreshProfile,
  };
}
