// ===== src/app/layout.tsx =====
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ShaderBackground } from '@/components/visuals/ShaderBackground';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'HacktivateNations Arcade',
  description: 'A retro-inspired arcade hub with modular mini-games',
  keywords: ['arcade', 'games', 'retro', 'web games'],
  authors: [{ name: 'KnotNVS' }],
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },

  manifest: '/manifest.json', 
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
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased bg-gray-900 text-white custom-scrollbar`}>
        <ShaderBackground />
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
