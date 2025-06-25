'use client';

interface OnboardingOverlayProps {
  onClose: () => void;
}

export function OnboardingOverlay({ onClose }: OnboardingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-gray-900 p-6 rounded-lg max-w-sm text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Welcome to HacktivateNations Arcade!</h2>
        <p className="text-gray-300 text-sm">
          Earn <span className="text-yellow-400 font-bold">coins</span> by playing games. Use them to unlock new tiers
          and track your progress in the <span className="font-bold">Profile</span> tab.
        </p>
        <button onClick={onClose} className="arcade-button w-full text-sm">Got it!</button>
      </div>
    </div>
  );
}
