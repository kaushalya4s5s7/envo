'use client';

import { useEffect, useRef } from 'react';
import { tiles } from '@/lib/data';
import { cn } from '@/lib/cn';

/**
 * Real FortyGuard `tcm` tiles, rendered as pixels because a 100 m segment is
 * literally what a pixel here represents. Temperature is the one signal that is
 * genuinely per block: air quality is metro scale.
 * See docs/decisions/product/what-we-can-claim.md.
 *
 * Takes a grid rather than reading the fixture, so a live capture and the
 * committed replay render through the identical path.
 */

export interface HeatGridData {
  cols: number;
  rows: number;
  /** `null` where the area of interest returned no tile. */
  grid: (number | null)[][];
  buildingCol: number;
  buildingRow: number;
  minC: number;
  maxC: number;
  sourceTiles: number;
  granularityM: number;
}

export function HeatGrid({
  data = tiles,
  contain = false,
}: {
  data?: HeatGridData;
  contain?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cv = canvas.current, host = shell.current, box = frame.current;
    if (!cv || !host || !box) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const pad = contain ? 0 : 32;
      const availW = Math.max(1, host.clientWidth - pad);
      const availH = contain ? Math.max(1, host.clientHeight) : Number.POSITIVE_INFINITY;
      const cellByW = Math.max(6, Math.floor(availW / data.cols));
      const cellByH = contain ? Math.max(6, Math.floor(availH / data.rows)) : cellByW;
      const cell = Math.max(6, Math.min(cellByW, cellByH));
      const w = cell * data.cols, h = cell * data.rows;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      box.style.width = `${w}px`;
      box.style.height = `${h}px`;
      cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const gap = cell > 10 ? 2 : 1, s = cell - gap;
      const span = data.maxC - data.minC || 1;
      const styles = getComputedStyle(host);
      const hot = styles.getPropertyValue('--color-heat').trim() || '#E8843C';
      const mark = styles.getPropertyValue('--color-safe').trim() || '#57C99A';
      const coolR = 31, coolG = 31, coolB = 31;
      const [hotR, hotG, hotB] = hexToRgb(hot) ?? [232, 132, 60];
      for (let r = 0; r < data.rows; r++) {
        for (let c = 0; c < data.cols; c++) {
          // A tile the API did not return is left blank. Substituting the floor
          // would paint a fabricated cold spot at the edge of the grid.
          const v = data.grid[r]?.[c];
          if (v === null || v === undefined) continue;
          const t = (v - data.minC) / span;
          const mix = (a: number, b: number) => Math.round(a + (b - a) * Math.pow(t, 0.85));
          ctx.fillStyle = `rgb(${mix(coolR, hotR)},${mix(coolG, hotG)},${mix(coolB, hotB)})`;
          ctx.fillRect(c * cell, r * cell, s, s);
        }
      }

      const bx = data.buildingCol * cell, by = data.buildingRow * cell;
      ctx.strokeStyle = withAlpha(mark, 0.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, by + cell / 2); ctx.lineTo(w, by + cell / 2);
      ctx.moveTo(bx + cell / 2, 0); ctx.lineTo(bx + cell / 2, h);
      ctx.stroke();
      ctx.strokeStyle = mark;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx - 1.5, by - 1.5, s + 3, s + 3);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(host);
    return () => observer.disconnect();
  }, [data, contain]);

  const markLeft = `${((data.buildingCol + 0.5) / data.cols) * 100}%`;
  const markTop = `${((data.buildingRow + 0.5) / data.rows) * 100}%`;

  return (
    <div
      ref={shell}
      className={cn(
        'relative',
        contain ? 'flex h-full w-full items-center justify-center' : 'p-4',
      )}
    >
      <div ref={frame} className="relative">
        <canvas ref={canvas} className="block [image-rendering:pixelated]" />
        <span
          className={cn(
            'pointer-events-none absolute flex items-center gap-1 font-mono text-xs tracking-wide text-fg-2',
            contain ? '-translate-x-1/2 -translate-y-6' : 'top-2 left-2',
          )}
          style={contain ? { left: markLeft, top: markTop } : undefined}
        >
          <i className="block size-[7px] flex-none border-[1.5px] border-safe" />
          THIS BUILDING
        </span>
        <span className="pointer-events-none absolute right-2 bottom-2 font-mono text-xs tracking-wide text-fg-3 max-md:hidden">
          {data.sourceTiles} REAL TILES · {data.granularityM} m
        </span>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): [number, number, number] | null {
  const raw = hex.replace('#', '').trim();
  if (raw.length !== 3 && raw.length !== 6) return null;
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function withAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}
