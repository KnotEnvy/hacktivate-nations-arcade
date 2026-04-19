// ===== src/app/layout.tsx =====
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Orbitron } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  title: 'HacktivateNations Arcade',
  description: 'A retro-inspired arcade hub with modular mini-games',
  keywords: ['arcade', 'games', 'retro', 'web games'],
  authors: [{ name: 'KnotNVS' }],
  icons: {
    icon: '/favicon.ico',
  },
};

// Separate viewport export is correct
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#8B5CF6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fontVariables = [inter.variable, orbitron.variable, jetbrainsMono.variable].join(' ');

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} ${fontVariables} antialiased bg-gray-900 text-white custom-scrollbar`}>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
