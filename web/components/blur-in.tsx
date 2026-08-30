'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/cn';

function useReveal<T extends HTMLElement>(delay: number) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timeout: number | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        timeout = window.setTimeout(() => setShown(true), delay);
        io.disconnect();
      },
      { threshold: 0.05 },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [delay]);

  return { ref: ref as RefObject<T>, shown };
}

function blurClass(shown: boolean) {
  return cn(
    'transition-[opacity,filter,transform] duration-[1400ms] ease-fluid will-change-[opacity,filter,transform]',
    shown ? 'translate-y-0 opacity-100 blur-none' : 'translate-y-6 opacity-0 blur-[18px]',
  );
}

export function BlurIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, shown } = useReveal<HTMLDivElement>(delay);

  return (
    <div ref={ref} className={cn(blurClass(shown), className)}>
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
  const { ref, shown } = useReveal<HTMLHeadingElement>(delay);

  return (
    <h1 ref={ref} className={className}>
      {lines.map((line, index) => (
        <span
          key={line}
          className={cn('block', blurClass(shown))}
          style={{ transitionDelay: shown ? `${index * 160}ms` : '0ms' }}
        >
          {line}
        </span>
      ))}
    </h1>
  );
}
