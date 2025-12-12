'use client';

interface OnboardingOverlayProps {
  onClose: () => void;
}

export function OnboardingOverlay({ onClose }: OnboardingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4" data-testid="onboarding-overlay">
      <div className="bg-gray-900 p-6 rounded-lg max-w-sm text-center space-y-4 overflow-y-auto max-h-[80vh]">
        <h2 className="text-xl font-bold text-white">Welcome to Hacktivate Nations Retro Arcade!</h2>
        <p className="text-gray-300 text-sm">
          Earn <span className="text-yellow-400 font-bold">coins</span> by playing games. Use them to unlock new tiers,
          then unlock games within each tier. Track your progress in the{' '}
          <span className="font-bold">Profile</span> tab.
        </p>
        <ul className="text-gray-300 text-sm text-left list-disc list-inside space-y-1">
          <li>Tier 0 is open by default, and Runner is free.</li>
          <li>Unlock Tier 1 (2,000 coins), Tier 2 (5,000), Tier 3 (10,000), and Tier 4 (20,000) to open more tiers.</li>
          <li>After a tier is open, unlock its games one by one; each unlock raises the next cost in that tier (Tier 0 +100, Tier 1 +1000, Tier 2 +5000...).</li>
          <li>Complete <span className="font-semibold">Daily Challenges</span> for bonus coins.</li>
          <li>Earn <span className="font-semibold">Achievements</span> for one-time rewards.</li>
          <li>Your <span className="font-semibold">Player Profile</span> tracks stats and levels.</li>
        </ul>
        <a href="/instructions" className="text-purple-300 underline text-sm hover:text-purple-200 block">View full instructions</a>
        <button onClick={onClose} className="arcade-button w-full text-sm" data-testid="onboarding-finish">Got it!</button>
      </div>
    </div>
  );
}
