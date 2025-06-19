// ===== src/app/page.tsx =====
// This is the main entry point for the HacktivateNations Arcade application.
// It renders the ArcadeHub component which serves as the main interface for the arcade.
// The ArcadeHub component manages the display of available games, user currency, and game interactions.

import { ArcadeHub } from '@/components/arcade/ArcadeHub';

export default function HomePage() {
  return (
    <main>
      <ArcadeHub />
    </main>
  );
}
