// ===== src/app/layout.tsx =====
import type { Metadata, Viewport } from 'next';
import {
  Inter,
  Orbitron,
  Exo,
  Source_Code_Pro,
  Space_Mono,
  Tomorrow,
  Fira_Code,
  VT323,
  Courier_Prime,
  Anonymous_Pro,
  Rajdhani,
  Audiowide,
  Share_Tech_Mono,
  Playfair_Display,
  Crimson_Text,
  Inconsolata,
  JetBrains_Mono
} from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

// Game theme fonts
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron' });
const exo = Exo({ subsets: ['latin'], variable: '--font-exo' });
const sourceCodePro = Source_Code_Pro({ subsets: ['latin'], variable: '--font-source-code-pro' });
const spaceMono = Space_Mono({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-space-mono' });
const tomorrow = Tomorrow({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-tomorrow' });
const firaCode = Fira_Code({ subsets: ['latin'], variable: '--font-fira-code' });
const vt323 = VT323({ weight: '400', subsets: ['latin'], variable: '--font-vt323' });
const courierPrime = Courier_Prime({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-courier-prime' });
const anonymousPro = Anonymous_Pro({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-anonymous-pro' });
const rajdhani = Rajdhani({ weight: ['300', '400', '500', '600', '700'], subsets: ['latin'], variable: '--font-rajdhani' });
const audiowide = Audiowide({ weight: '400', subsets: ['latin'], variable: '--font-audiowide' });
const shareTechMono = Share_Tech_Mono({ weight: '400', subsets: ['latin'], variable: '--font-share-tech-mono' });
const playfairDisplay = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair-display' });
const crimsonText = Crimson_Text({ weight: ['400', '600'], subsets: ['latin'], variable: '--font-crimson-text' });
const inconsolata = Inconsolata({ subsets: ['latin'], variable: '--font-inconsolata' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

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
  const fontVariables = [
    orbitron.variable,
    exo.variable,
    sourceCodePro.variable,
    spaceMono.variable,
    tomorrow.variable,
    firaCode.variable,
    vt323.variable,
    courierPrime.variable,
    anonymousPro.variable,
    rajdhani.variable,
    audiowide.variable,
    shareTechMono.variable,
    playfairDisplay.variable,
    crimsonText.variable,
    inconsolata.variable,
    jetbrainsMono.variable,
  ].join(' ');

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} ${fontVariables} antialiased bg-gray-900 text-white custom-scrollbar`}>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}