import type { Metadata } from 'next';
import { DM_Sans, Newsreader } from 'next/font/google';
import './globals.css';
import { Nav } from '@/components/Nav';
import { CoachProvider, Gate } from '@/lib/coach';

// Beide zijn variable fonts (geen weight nodig); de CSS-vars worden in globals.css
// aan --font-sans / --font-serif gekoppeld.
const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  display: 'swap',
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lau in Balans — coach',
  description: 'Coach-dashboard van Lau in Balans.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className={`${newsreader.variable} ${dmSans.variable} h-full`}>
      <body className="min-h-full bg-cream font-sans text-body antialiased">
        <CoachProvider>
          <Gate>
            {/* Nav rendert zichzelf alleen mét coach — op /login blijft hij dus weg. */}
            <Nav />
            {children}
          </Gate>
        </CoachProvider>
      </body>
    </html>
  );
}
