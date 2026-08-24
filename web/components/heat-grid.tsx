'use client';

import { useEffect, useRef } from 'react';
import { tiles } from '@/lib/data';

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

export function HeatGrid({ data = tiles }: { data?: HeatGridData }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shell = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cv = canvas.current, host = shell.current;
    if (!cv || !host) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const cell = Math.max(6, Math.floor((host.clientWidth - 32) / data.cols));
      const w = cell * data.cols, h = cell * data.rows;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const gap = cell > 10 ? 2 : 1, s = cell - gap;
      const span = data.maxC - data.minC || 1;
      for (let r = 0; r < data.rows; r++) {
        for (let c = 0; c < data.cols; c++) {
          // A tile the API did not return is left blank. Substituting the floor
          // would paint a fabricated cold spot at the edge of the grid.
          const v = data.grid[r]?.[c];
          if (v === null || v === undefined) continue;
          const t = (v - data.minC) / span;
          // Cool #1F1F1F through to hot #E8843C.
          const mix = (a: number, b: number) => Math.round(a + (b - a) * Math.pow(t, 0.85));
          ctx.fillStyle = `rgb(${mix(31, 232)},${mix(31, 132)},${mix(31, 60)})`;
          ctx.fillRect(c * cell, r * cell, s, s);
        }
      }

      const bx = data.buildingCol * cell, by = data.buildingRow * cell;
      ctx.strokeStyle = 'rgba(87,201,154,.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, by + cell / 2); ctx.lineTo(w, by + cell / 2);
      ctx.moveTo(bx + cell / 2, 0); ctx.lineTo(bx + cell / 2, h);
      ctx.stroke();
      ctx.strokeStyle = '#57C99A';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx - 1.5, by - 1.5, s + 3, s + 3);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(host);
    return () => observer.disconnect();
  }, [data]);

  return (
    <div ref={shell} className="relative p-4">
      <canvas ref={canvas} className="block [image-rendering:pixelated]" />
      <span className="pointer-events-none absolute top-6 left-8 flex items-center gap-1 font-mono text-xs tracking-wide text-fg-2">
        <i className="block size-[7px] flex-none border-[1.5px] border-safe" />
        THIS BUILDING
      </span>
      <span className="pointer-events-none absolute right-8 bottom-6 font-mono text-xs tracking-wide text-fg-3 max-md:hidden">
        {data.sourceTiles} REAL TILES · {data.granularityM} m
      </span>
    </div>
  );
}
