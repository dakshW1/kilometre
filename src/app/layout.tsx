import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Serif, Manrope } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({ variable: '--font-bricolage', subsets: ['latin'], weight: ['500', '600', '700', '800'] });
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });
const instrument = Instrument_Serif({ variable: '--font-instrument', subsets: ['latin'], weight: '400', style: ['normal', 'italic'] });

export const metadata: Metadata = {
  title: 'Kilometre · Make every kilometre pay',
  description: 'Real hourly wage, restaurant wait times, where to ride next, and AI-written appeals for Bengaluru gig workers.',
};

export const viewport: Viewport = { themeColor: '#090C12' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${manrope.variable} ${instrument.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
