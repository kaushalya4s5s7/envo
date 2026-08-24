import { IslandNav } from '@/components/island-nav';
import { Hero } from '@/components/hero';
import { HowItWorks } from '@/components/how-it-works';

export default function Page() {
  return (
    <>
      <IslandNav />
      <main id="main">
        <Hero />
        <HowItWorks />
      </main>
    </>
  );
}
