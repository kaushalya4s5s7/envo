import type { ReactNode } from 'react';
import { AppNav } from '@/components/app-nav';

/**
 * Shared chrome for every /app/* page — the sidebar renders once here
 * instead of once per page. See components/app-sidebar.tsx.
 */
export default function AppSectionLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNav />
      {children}
    </>
  );
}
