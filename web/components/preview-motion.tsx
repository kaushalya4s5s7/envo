'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Preview-only motion. Scroll is sampled through requestAnimationFrame,
 * never attached as an unthrottled listener, per design-skills B7.
 */
export function Parallax({
  strength = 0.18,
  className,
  children,
}: {
  strength?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2 - window.innerHeight / 2;
      el.style.transform = `translate3d(0, ${mid * strength * -1}px, 0)`;
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [strength]);

  return (
    <div ref={ref} className={cn('will-change-transform', className)}>
      {children}
    </div>
  );
}
