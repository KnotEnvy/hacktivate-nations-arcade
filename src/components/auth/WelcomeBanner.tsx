'use client';

interface WelcomeBannerProps {
  name: string;
  authenticated: boolean;
  onSignIn: () => void;
  onSignOut?: () => void;
}

export function WelcomeBanner({ name, authenticated, onSignIn, onSignOut }: WelcomeBannerProps) {
  return (
    <div className="w-full bg-white/5 border border-white/10 backdrop-blur rounded-2xl p-5 text-white shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-sm text-purple-200 uppercase tracking-wide">Welcome</p>
          <h3 className="text-xl font-bold">{name}</h3>
          <p className="text-sm text-gray-200 mt-1">
            {authenticated
              ? 'Your coins and achievements are ready to sync across devices.'
              : 'Sign in to sync coins, achievements, and leaderboard entries across devices.'}
          </p>
        </div>
        <div className="flex gap-2">
          {!authenticated ? (
            <button
              onClick={onSignIn}
              className="px-4 py-2 bg-white text-gray-900 font-semibold rounded-lg hover:shadow-md transition-shadow"
            >
              Sign in
            </button>
          ) : (
            <button
              onClick={onSignOut}
              className="px-4 py-2 bg-white/10 border border-white/10 font-semibold rounded-lg hover:bg-white/15 transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
