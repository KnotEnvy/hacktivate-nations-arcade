'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase.types';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { SupabaseArcadeService } from '@/services/SupabaseArcadeService';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

interface UseSupabaseAuthState {
  session: Session | null;
  profile: ProfileRow | null;
  loading: boolean;
  error: string | null;
  emailSent: boolean;
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
  const [emailSent, setEmailSent] = useState(false);
  const [authDisabled, setAuthDisabled] = useState(false);
  const supabaseRef = useRef<ReturnType<typeof getSupabaseBrowserClient> | null>(null);
  const arcadeServiceRef = useRef<SupabaseArcadeService | null>(null);
  const [arcadeService, setArcadeService] = useState<SupabaseArcadeService | null>(null);

  const loadProfile = useCallback(
    async (userId: string, fallbackName?: string) => {
      const service = arcadeServiceRef.current;
      if (!supabaseRef.current || !service) return;
      setError(null);

      const { data, error: fetchError } = await supabaseRef.current
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

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
        });
        setProfile(created);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create profile');
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    const initClient = async () => {
      if (typeof window === 'undefined') return;
      try {
        const supabase = getSupabaseBrowserClient();
        supabaseRef.current = supabase;
        const service = new SupabaseArcadeService(supabase);
        arcadeServiceRef.current = service;
        setArcadeService(service);
        setAuthDisabled(false);

        const syncProfile = (user: Session['user']) => {
          const fallback =
            user.user_metadata?.preferred_username ||
            user.email?.split('@')[0] ||
            'Player';
          void loadProfile(user.id, fallback);
        };

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!mounted) return;
        if (sessionError) setError(sessionError.message);
        setSession(data.session);
        setLoading(false);
        if (data.session?.user) {
          syncProfile(data.session.user);
        }

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (!mounted) return;
          setSession(nextSession);
          setEmailSent(false);
          if (nextSession?.user) {
            syncProfile(nextSession.user);
          } else {
            setProfile(null);
          }
        });

        return () => subscription.unsubscribe();
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
      setEmailSent(false);
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
      setEmailSent(true);
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
          const fallback =
            data.session.user.user_metadata?.preferred_username ||
            data.session.user.email?.split('@')[0];
          await loadProfile(data.session.user.id, fallback);
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
        setEmailSent(true);
        if (data.session?.user) {
          const fallback =
            data.session.user.user_metadata?.preferred_username ||
            data.session.user.email?.split('@')[0];
          await loadProfile(data.session.user.id, fallback);
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
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await loadProfile(session.user.id);
    }
  }, [loadProfile, session?.user]);

  return {
    session,
    profile,
    loading,
    error,
    emailSent,
    authDisabled,
    signInWithEmail,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    refreshProfile,
  };
}
