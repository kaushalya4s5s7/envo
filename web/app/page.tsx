import { Newsreader } from 'next/font/google';
import { LandingPreview } from '@/components/landing-preview';

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-preview-serif',
  display: 'swap',
});

export default function Page() {
  return (
    <div className={newsreader.variable}>
      <LandingPreview />
    </div>
  );
}
