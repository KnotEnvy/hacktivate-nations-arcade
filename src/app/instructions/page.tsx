import Link from 'next/link';

export const metadata = {
  title: 'How to Play - HacktivateNations Arcade'
};

export default function InstructionsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 text-gray-200">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-center text-white">How to Play</h1>

        <section className="space-y-2">
          <h2 className="text-xl font-bold text-purple-300">Getting Started</h2>
          <p>
            Play games to earn <span className="text-yellow-400 font-bold">coins</span>. Use coins to
            unlock additional game tiers and customize your profile.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold text-purple-300">Game Tiers</h2>
          <p>New games unlock as you progress through tiers:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Tier 0 – Runner game is available for free.</li>
            <li>Tier 1 – Unlocks one extra game for 2,000 coins.</li>
            <li>Tier 2 – Unlocks two more games for 5,000 coins.</li>
            <li>Tier 3 – Unlocks two more games for 10,000 coins.</li>
            <li>Tier 4 – Unlocks two more games for 20,000 coins.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold text-purple-300">Game Types</h2>
          <p>The arcade features a variety of retro‑inspired games like Endless Runner and Block Puzzle. More games will be added over time.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold text-purple-300">Daily Challenges</h2>
          <p>Every day you receive three random challenges. Complete them for bonus coins. Finishing all challenges applies a 1.5× coin multiplier.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold text-purple-300">Achievements</h2>
          <p>Unlock one‑time achievements to earn extra coins and show off your skills.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold text-purple-300">Player Profile</h2>
          <p>Your profile tracks level, play time, coins earned and more. Customize your avatar and view detailed stats in the Profile tab.</p>
        </section>

        <div className="text-center pt-4">
          <Link href="/" className="arcade-button inline-block">Back to Arcade</Link>
        </div>
      </div>
    </main>
  );
}
