import { act, renderHook, waitFor } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

jest.mock('@/lib/supabase', () => ({
  getSupabaseBrowserClient: jest.fn(),
}));

const mockedGetSupabaseBrowserClient = jest.mocked(getSupabaseBrowserClient);

const createSession = (userId = 'user-1'): Session =>
  ({
    access_token: 'token-123',
    user: {
      id: userId,
      email: 'player@example.com',
      user_metadata: {},
    },
  }) as Session;

describe('useSupabaseAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads the authenticated server profile and clears it on sign out', async () => {
    const session = createSession();
    let authStateCallback: ((event: string, nextSession: Session | null) => void) | null = null;

    const profileRow = {
      id: session.user.id,
      username: 'ServerPlayer',
      avatar: '🎮',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-04-15T00:00:00.000Z',
    };

    const profileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: profileRow, error: null }),
    };

    const supabase = {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session }, error: null }),
        onAuthStateChange: jest.fn(callback => {
          authStateCallback = callback;
          return {
            data: {
              subscription: {
                unsubscribe: jest.fn(),
              },
            },
          };
        }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
        signInWithOtp: jest.fn(),
        signInWithPassword: jest.fn(),
        signUp: jest.fn(),
      },
      from: jest.fn(() => profileQuery),
    };

    mockedGetSupabaseBrowserClient.mockReturnValue(supabase as never);

    const { result } = renderHook(() => useSupabaseAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    await waitFor(() => {
      expect(result.current.session?.user.id).toBe(session.user.id);
      expect(result.current.profile?.username).toBe('ServerPlayer');
    });

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(profileQuery.single).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.signOut();
    });

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();

    act(() => {
      authStateCallback?.('SIGNED_OUT', null);
    });

    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
  });
});
