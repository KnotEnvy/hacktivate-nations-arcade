// ===== src/app/layout.tsx =====
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'HacktivateNations Arcade',
  description: 'A retro-inspired arcade hub with modular mini-games',
  keywords: ['arcade', 'games', 'retro', 'web games'],
  authors: [{ name: 'HacktivateNations Team' }],
};

// Separate viewport export (Next.js 15 requirement)
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
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.className} antialiased bg-gray-900 text-white`}>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}