'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function BlurIn({
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
        'transition-all duration-[1200ms] ease-fluid',
        shown ? 'translate-y-0 opacity-100 blur-none' : 'translate-y-8 opacity-0 blur-xl',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BlurLines({
  lines,
  delay = 0,
  className,
}: {
  lines: string[];
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
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
    <h1 ref={ref} className={className}>
      {lines.map((line, index) => (
        <span
          key={line}
          className={cn(
            'block transition-all duration-[1200ms] ease-fluid',
            shown ? 'translate-y-0 opacity-100 blur-none' : 'translate-y-8 opacity-0 blur-xl',
          )}
          style={{ transitionDelay: shown ? `${index * 140}ms` : '0ms' }}
        >
          {line}
        </span>
      ))}
    </h1>
  );
}
