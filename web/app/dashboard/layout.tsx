import type { ReactNode } from 'react';
import { AppNav } from '@/components/app-nav';

/**
 * `/dashboard` sits outside the `/app` route segment, so it needs its own
 * copy of the same shell — see app/app/layout.tsx and components/app-sidebar.tsx.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNav />
      {children}
    </>
  );
}
