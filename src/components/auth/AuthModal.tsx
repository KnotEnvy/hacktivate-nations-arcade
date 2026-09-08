'use client';

import { useState } from 'react';
import { AccessibleDialog } from '@/components/ui/AccessibleDialog';
import { Icon } from '@/components/ui/Icon';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onMagicLink: (email: string) => Promise<void>;
  onPasswordSignIn: (email: string, password: string) => Promise<void>;
  onPasswordSignUp: (email: string, password: string, username?: string) => Promise<void>;
  onResendEmail: (mode: 'magic' | 'signup') => Promise<void>;
  onClearMessages: () => void;
  loading: boolean;
  error?: string | null;
  emailSentMode?: 'magic' | 'signup' | null;
  pendingEmail?: string | null;
}

export function AuthModal({
  open,
  onClose,
  onMagicLink,
  onPasswordSignIn,
  onPasswordSignUp,
  onResendEmail,
  onClearMessages,
  loading,
  error,
  emailSentMode,
  pendingEmail,
}: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [mode, setMode] = useState<'magic' | 'signin' | 'signup'>('signin');
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
      await onPasswordSignUp(email, password, username.trim() || undefined);
    } else {
      await onPasswordSignIn(email, password);
    }
  };

  const activeEmail = pendingEmail || email;
  const showEmailScreen = !!emailSentMode;
  const handleModeChange = (nextMode: 'magic' | 'signin' | 'signup') => {
    setMode(nextMode);
    setLocalError(null);
    if (emailSentMode) {
      onClearMessages();
    }
  };
  const handleBackFromEmail = (nextMode: 'magic' | 'signin' | 'signup') => {
    onClearMessages();
    setLocalError(null);
    setMode(nextMode);
  };

  return (
    <AccessibleDialog
      titleId="auth-dialog-title"
      onClose={onClose}
      overlayClassName="backdrop-blur-sm"
      className="animate-rise-in w-full max-w-md space-y-4 overflow-y-auto rounded-panel border border-line bg-surface p-6 shadow-pop max-h-[90vh]"
    >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="auth-dialog-title" className="font-display text-xl font-bold text-ink">
              {showEmailScreen
                ? emailSentMode === 'magic'
                  ? 'Check your email'
                  : 'Confirm your account'
                : mode === 'signup' ? 'Create your arcade account' : 'Sign in to Hacktivate Arcade'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              {showEmailScreen
                ? emailSentMode === 'magic'
                  ? 'We sent a magic link to finish signing you in.'
                  : 'Use the link to confirm your new account, then start playing.'
                : mode === 'signup'
                  ? 'Join the arcade to save coins, achievements, and leaderboard scores.'
                  : 'Use a magic link or email/password to access the arcade and sync your progress.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-lg p-2 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Close sign in"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {showEmailScreen ? (
          <div className="space-y-4">
            <div className="rounded-card border border-line bg-surface-2 px-4 py-3 text-sm text-ink-muted">
              <div className="font-semibold text-ink">Link sent to</div>
              <div className="mt-1 break-all font-mono text-brand-bright">
                {activeEmail || 'your email address'}
              </div>
              <div className="mt-2 text-xs text-ink-faint">
                Check spam or promotions folders if you do not see it within a minute.
              </div>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onResendEmail(emailSentMode as 'magic' | 'signup')}
                disabled={loading}
                className="w-full rounded-control bg-brand py-2 font-semibold text-white transition-colors hover:bg-brand-bright disabled:opacity-45"
              >
                {loading ? 'Sending...' : 'Resend email'}
              </button>
              <button
                type="button"
                onClick={() =>
                  handleBackFromEmail(emailSentMode === 'magic' ? 'magic' : 'signup')
                }
                className="w-full rounded-control border border-line bg-surface-2 py-2 font-semibold text-ink transition-colors hover:bg-surface-3"
              >
                Use a different email
              </button>
              <button
                type="button"
                onClick={() => handleBackFromEmail('signin')}
                className="w-full text-sm font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline"
              >
                Back to sign in
              </button>
            </div>
            {error && (
              <div className="rounded-control border border-bad/30 bg-bad-dim px-3 py-2 text-sm text-bad">
                {error}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1 rounded-control bg-surface-2 p-1 text-sm" role="tablist" aria-label="Account access method">
              <button
                type="button"
                onClick={() => handleModeChange('magic')}
                role="tab"
                aria-selected={mode === 'magic'}
                className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${
                  mode === 'magic'
                    ? 'bg-surface-3 text-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
                >
                  Magic link
                </button>
              <button
                type="button"
                onClick={() => handleModeChange('signin')}
                role="tab"
                aria-selected={mode === 'signin'}
                className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${
                  mode === 'signin'
                    ? 'bg-surface-3 text-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('signup')}
                role="tab"
                aria-selected={mode === 'signup'}
                className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${
                  mode === 'signup'
                    ? 'bg-surface-3 text-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block text-sm font-semibold text-ink">
                Email
                <input
                  type="email"
                  autoFocus
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  className="mt-1.5 h-10 w-full rounded-control border border-line bg-surface-2 px-3 text-ink placeholder:text-ink-faint transition-colors hover:border-line-strong focus:border-brand/60 focus:outline-none"
                  placeholder="you@example.com"
                  required
                />
              </label>
              {mode !== 'magic' && (
                <>
                  {mode === 'signup' && (
                    <label className="block text-sm font-semibold text-ink">
                      Username <span className="font-normal text-ink-faint">(optional)</span>
                      <input
                        type="text"
                        value={username}
                        onChange={event => setUsername(event.target.value)}
                        autoComplete="username"
                        maxLength={32}
                        className="mt-1.5 h-10 w-full rounded-control border border-line bg-surface-2 px-3 text-ink placeholder:text-ink-faint transition-colors hover:border-line-strong focus:border-brand/60 focus:outline-none"
                      />
                    </label>
                  )}
                  <label className="block text-sm font-semibold text-ink">
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      className="mt-1.5 h-10 w-full rounded-control border border-line bg-surface-2 px-3 text-ink placeholder:text-ink-faint transition-colors hover:border-line-strong focus:border-brand/60 focus:outline-none"
                      placeholder="Enter password"
                      required
                    />
                  </label>
                </>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-control bg-brand py-2 font-semibold text-white transition-colors hover:bg-brand-bright disabled:opacity-45"
              >
                {loading
                  ? 'Working...'
                  : mode === 'magic'
                    ? 'Send magic link'
                    : mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </form>

            {(localError || error) && (
              <div role="alert" className="rounded-control border border-bad/30 bg-bad-dim px-3 py-2 text-sm text-bad">
                {localError || error}
              </div>
            )}

            <div className="text-xs leading-relaxed text-ink-faint">
              Tip: Keep this account signed in to sync coins, achievements, and leaderboard entries across devices.
            </div>
          </>
        )}
    </AccessibleDialog>
  );
}

