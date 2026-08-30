import type { Metadata } from 'next';
import { Newsreader } from 'next/font/google';
import { LandingPreview } from '@/components/landing-preview';

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-preview-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Landing page direction — Envo',
  description: 'A proposed visual direction for the Envo landing page.',
  robots: { index: false, follow: false },
};

export default function PreviewPage() {
  return (
    <div className={newsreader.variable}>
      <LandingPreview />
    </div>
  );
}
