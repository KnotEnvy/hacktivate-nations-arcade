'use client';

import { useState } from 'react';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onMagicLink: (email: string) => Promise<void>;
  onPasswordSignIn: (email: string, password: string) => Promise<void>;
  onPasswordSignUp: (email: string, password: string, username?: string) => Promise<void>;
  loading: boolean;
  error?: string | null;
  emailSent?: boolean;
}

export function AuthModal({
  open,
  onClose,
  onMagicLink,
  onPasswordSignIn,
  onPasswordSignUp,
  loading,
  error,
  emailSent,
}: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [mode, setMode] = useState<'magic' | 'signin' | 'signup'>('magic');
  const [localError, setLocalError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || loading) return;
    setLocalError(null);

    if (mode === 'magic') {
      await onMagicLink(email);
      return;
    }

    if (!password) {
      setLocalError('Password is required.');
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
      await onPasswordSignUp(email, password, username.trim() || undefined);
      return;
    }

    await onPasswordSignIn(email, password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-gray-900 border border-purple-700 rounded-xl shadow-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Sign in to Hacktivate Arcade</h2>
            <p className="text-sm text-gray-300 mt-1">
              Use a magic link or email/password to sync your arcade progress.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white rounded-full p-2 transition-colors"
            aria-label="Close sign in"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-2 text-sm text-white">
          <button
            type="button"
            onClick={() => setMode('magic')}
            className={`flex-1 rounded-lg px-3 py-2 border ${
              mode === 'magic'
                ? 'border-purple-500 bg-purple-900/60'
                : 'border-gray-700 bg-gray-800'
            }`}
          >
            Magic link
          </button>
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 rounded-lg px-3 py-2 border ${
              mode === 'signin'
                ? 'border-purple-500 bg-purple-900/60'
                : 'border-gray-700 bg-gray-800'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 rounded-lg px-3 py-2 border ${
              mode === 'signup'
                ? 'border-purple-500 bg-purple-900/60'
                : 'border-gray-700 bg-gray-800'
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm text-gray-200 font-medium">
            Email
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="you@example.com"
              required
            />
          </label>
          {mode !== 'magic' && (
            <>
              <label className="block text-sm text-gray-200 font-medium">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="••••••••"
                  required
                />
              </label>
              {mode === 'signup' && (
                <>
                  <label className="block text-sm text-gray-200 font-medium">
                    Confirm Password
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={event => setConfirmPassword(event.target.value)}
                      className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="••••••••"
                      required
                    />
                  </label>
                  <label className="block text-sm text-gray-200 font-medium">
                    Username (optional)
                    <input
                      type="text"
                      value={username}
                      onChange={event => setUsername(event.target.value)}
                      className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="ArcadeHero"
                    />
                  </label>
                </>
              )}
            </>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            {loading
              ? 'Working...'
              : mode === 'magic'
                ? 'Send magic link'
                : mode === 'signin'
                  ? 'Sign in'
                  : 'Create account'}
          </button>
        </form>

        {emailSent && (
          <div className="rounded-lg bg-green-900/60 border border-green-700 px-3 py-2 text-green-200 text-sm">
            Magic link sent! Check your email to complete sign in.
          </div>
        )}
        {(localError || error) && (
          <div className="rounded-lg bg-red-900/60 border border-red-700 px-3 py-2 text-red-200 text-sm">
            {localError || error}
          </div>
        )}

        <div className="text-xs text-gray-400">
          Tip: Stay signed in to sync coins, achievements, and leaderboard entries across devices.
        </div>
      </div>
    </div>
  );
}
