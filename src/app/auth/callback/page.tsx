'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Signing you in...');
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const code = searchParams.get('code');
        const hash = typeof window !== 'undefined' ? window.location.hash : '';

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (hash.startsWith('#')) {
          const params = new URLSearchParams(hash.slice(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) throw error;
          }
        } else {
          // Nothing to exchange; redirect home to let onAuthStateChange hydrate.
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            throw new Error('No auth session found in callback.');
          }
        }

        setMessage('Signed in! Redirecting...');
        setStatus('success');
        setTimeout(() => router.push('/'), 800);
      } catch (err) {
        const text = err instanceof Error ? err.message : 'Unable to complete sign in.';
        setMessage(text);
        setStatus('error');
      }
    };

    void run();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="bg-gray-900/80 border border-purple-700 rounded-xl px-6 py-8 shadow-xl">
        <h1 className="text-xl font-bold mb-2">Authenticating...</h1>
        <p className="text-sm text-gray-200">{message}</p>
        {status === 'error' && (
          <button
            onClick={() => router.push('/')}
            className="mt-4 w-full rounded-lg bg-white text-gray-900 font-semibold py-2 hover:bg-gray-100 transition-colors"
          >
            Return to Arcade
          </button>
        )}
      </div>
    </div>
  );
}
