import type { ReactNode } from 'react';
import { AppNav } from '@/components/app-nav';

/**
 * `/onboarding` sits outside both `/app` and `/dashboard`, so it needs its
 * own copy of the same shell — see app/app/layout.tsx and components/app-sidebar.tsx.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNav />
      {children}
    </>
  );
}
