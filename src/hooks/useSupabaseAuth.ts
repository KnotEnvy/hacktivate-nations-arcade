'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase.types';
import type { SupabaseArcadeService } from '@/services/SupabaseArcadeService';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type EmailSentMode = 'magic' | 'signup' | null;
type SupabaseModule = typeof import('@/lib/supabase');
type BrowserClient = ReturnType<SupabaseModule['getSupabaseBrowserClient']>;
type AuthRuntime = {
  supabase: BrowserClient;
  service: SupabaseArcadeService;
};

interface UseSupabaseAuthState {
  session: Session | null;
  profile: ProfileRow | null;
  loading: boolean;
  error: string | null;
  emailSentMode: EmailSentMode;
  pendingEmail: string | null;
  authDisabled: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string, username?: string) => Promise<void>;
  resendEmail: (mode: Exclude<EmailSentMode, null>) => Promise<void>;
  clearAuthMessages: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export function useSupabaseAuth(): UseSupabaseAuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailSentMode, setEmailSentMode] = useState<EmailSentMode>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [authDisabled, setAuthDisabled] = useState(false);
  const supabaseRef = useRef<BrowserClient | null>(null);
  const arcadeServiceRef = useRef<SupabaseArcadeService | null>(null);
  const authRuntimePromiseRef = useRef<Promise<AuthRuntime> | null>(null);
  const activeUserIdRef = useRef<string | null>(null);

  const ensureAuthRuntime = useCallback(async (): Promise<AuthRuntime> => {
    if (supabaseRef.current && arcadeServiceRef.current) {
      return {
        supabase: supabaseRef.current,
        service: arcadeServiceRef.current,
      };
    }

    if (!authRuntimePromiseRef.current) {
      authRuntimePromiseRef.current = Promise.all([
        import('@/lib/supabase'),
        import('@/services/SupabaseArcadeService'),
      ])
        .then(([supabaseModule, serviceModule]) => {
          const supabase = supabaseModule.getSupabaseBrowserClient();
          const service = new serviceModule.SupabaseArcadeService(supabase);
          supabaseRef.current = supabase;
          arcadeServiceRef.current = service;
          return { supabase, service };
        })
        .catch(error => {
          authRuntimePromiseRef.current = null;
          throw error;
        });
    }

    return authRuntimePromiseRef.current;
  }, []);

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
        const { supabase } = await ensureAuthRuntime();
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
          setPendingEmail(null);
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
  }, [ensureAuthRuntime, loadProfile]);

  const signInWithEmail = useCallback(
    async (email: string) => {
      let supabase = supabaseRef.current;
      if (!supabase) {
        try {
          supabase = (await ensureAuthRuntime()).supabase;
        } catch {
          setError('Supabase not configured');
          return;
        }
      }
      if (!supabase) {
        setError('Supabase not configured');
        return;
      }
      setLoading(true);
      setError(null);
      setEmailSentMode(null);
      setPendingEmail(email);
      const { error: signInError } = await supabase.auth.signInWithOtp({
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
    [ensureAuthRuntime]
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      let supabase = supabaseRef.current;
      if (!supabase) {
        try {
          supabase = (await ensureAuthRuntime()).supabase;
        } catch {
          setError('Supabase not configured');
          return;
        }
      }
      if (!supabase) {
        setError('Supabase not configured');
        return;
      }
      setEmailSentMode(null);
      setPendingEmail(email);
      setLoading(true);
      setError(null);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
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
    [ensureAuthRuntime, loadProfile]
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string, username?: string) => {
      let supabase = supabaseRef.current;
      if (!supabase) {
        try {
          supabase = (await ensureAuthRuntime()).supabase;
        } catch {
          setError('Supabase not configured');
          return;
        }
      }
      if (!supabase) {
        setError('Supabase not configured');
        return;
      }
      setEmailSentMode(null);
      setPendingEmail(email);
      setLoading(true);
      setError(null);
      const { data, error: signUpError } = await supabase.auth.signUp({
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
        } else {
          setPendingEmail(null);
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
    [ensureAuthRuntime, loadProfile]
  );

  const resendEmail = useCallback(
    async (mode: Exclude<EmailSentMode, null>) => {
      let supabase = supabaseRef.current;
      if (!supabase) {
        try {
          supabase = (await ensureAuthRuntime()).supabase;
        } catch {
          setError('Supabase not configured');
          return;
        }
      }
      if (!supabase) {
        setError('Supabase not configured');
        return;
      }
      if (!pendingEmail) {
        setError('Email address is required to resend.');
        return;
      }
      setLoading(true);
      setError(null);
      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
      try {
        if (mode === 'magic') {
          const { error: signInError } = await supabase.auth.signInWithOtp({
            email: pendingEmail,
            options: {
              emailRedirectTo: redirectTo,
            },
          });

          if (signInError) {
            setError(signInError.message);
            return;
          }
        } else {
          const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: pendingEmail,
            options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
          });

          if (resendError) {
            setError(resendError.message);
            return;
          }
        }
        setEmailSentMode(mode);
      } finally {
        setLoading(false);
      }
    },
    [ensureAuthRuntime, pendingEmail]
  );

  const clearAuthMessages = useCallback(() => {
    setEmailSentMode(null);
    setError(null);
    setPendingEmail(null);
  }, []);

  const signOut = useCallback(async () => {
    let supabase = supabaseRef.current;
    if (!supabase) {
      try {
        supabase = (await ensureAuthRuntime()).supabase;
      } catch {
        return;
      }
    }
    setError(null);
    await supabase.auth.signOut();
    activeUserIdRef.current = null;
    setSession(null);
    setProfile(null);
    setEmailSentMode(null);
    setPendingEmail(null);
  }, [ensureAuthRuntime]);

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
    pendingEmail,
    authDisabled,
    signInWithEmail,
    signInWithPassword,
    signUpWithPassword,
    resendEmail,
    clearAuthMessages,
    signOut,
    refreshProfile,
  };
}
