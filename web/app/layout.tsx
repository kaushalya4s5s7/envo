import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Envo — the outdoor brain for building automation',
  description:
    'Envo reads heat, smoke, and sun for every block at 60 to 100 m, twelve hours ahead, and turns it into the setpoint, shade, and damper commands your automation system already accepts.',
  openGraph: {
    title: 'Envo',
    description: 'Your building knows the weather. Not your block.',
    type: 'website',
  },
  icons: {
    icon: `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#131209"/>${
        ['#272727', '#E8843C', '#9A8FA6', '#9A8FA6', '#57C99A', '#272727', '#272727', '#272727', '#E8843C']
          .map((f, i) => `<rect x="${6 + (i % 3) * 7}" y="${6 + Math.floor(i / 3) * 7}" width="6" height="6" fill="${f}"/>`)
          .join('')
      }</svg>`,
    )}`,
  },
};

export const viewport: Viewport = { themeColor: '#000000' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <head>
        {/* Aspekta — not on Google Fonts, so this can't go through next/font/google.
            Fontshare serves it as its official free source; next/font/local would
            need the .woff2 files committed here instead. Geist stays as the
            fallback in --font-sans (globals.css) if this stylesheet is slow or
            blocked for a visitor. */}
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=aspekta@400,500,600,700&display=swap"
        />
      </head>
      <body>
        <a
          href="#main"
          className="ease-fluid absolute left-4 top-[-64px] z-100 rounded-lg border border-line-2 bg-surface-3 px-3 py-2 text-sm font-semibold transition-all duration-300 focus:top-4"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
