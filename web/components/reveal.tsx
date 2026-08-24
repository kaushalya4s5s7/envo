'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** B7 scroll interpolation. IntersectionObserver only, never a scroll listener. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          const t = window.setTimeout(() => setShown(true), delay);
          io.disconnect();
          return () => window.clearTimeout(t);
        }
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-1000 ease-fluid',
        shown ? 'translate-y-0 opacity-100 blur-none' : 'translate-y-16 opacity-0 blur-md',
        className,
      )}
    >
      {children}
    </div>
  );
}
