import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase.types';

type TypedClient = SupabaseClient<Database>;

const missingEnvMessage =
  'Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.';

const getPublicConfig = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(missingEnvMessage);
  }

  return { supabaseUrl, supabaseAnonKey };
};

let browserClient: TypedClient | null = null;

export const getSupabaseBrowserClient = (): TypedClient => {
  if (typeof window === 'undefined') {
    throw new Error('Browser Supabase client should only be created in the browser.');
  }

  if (browserClient) return browserClient;

  const { supabaseUrl, supabaseAnonKey } = getPublicConfig();
  browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
};

export const createSupabaseServerClient = (options?: {
  accessToken?: string;
  useServiceRole?: boolean;
}): TypedClient => {
  if (typeof window !== 'undefined') {
    throw new Error('Server Supabase client cannot be created in the browser.');
  }

  const { supabaseUrl, supabaseAnonKey } = getPublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseKey = options?.useServiceRole ? serviceRoleKey : supabaseAnonKey;

  if (!supabaseKey) {
    throw new Error(
      options?.useServiceRole
        ? 'SUPABASE_SERVICE_ROLE_KEY is required for privileged server calls.'
        : missingEnvMessage
    );
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch,
      headers: options?.accessToken
        ? { Authorization: `Bearer ${options.accessToken}` }
        : undefined,
    },
  });
};

export const createSupabaseAccessTokenClient = (accessToken: string): TypedClient => {
  const { supabaseUrl, supabaseAnonKey } = getPublicConfig();
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => accessToken,
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};

export const assertSupabaseEnv = (): void => {
  getPublicConfig();
};
