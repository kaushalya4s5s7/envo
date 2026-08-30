'use client';

import { useEffect, useRef, useState } from 'react';
import type { CaptureGeometry } from '@/lib/capture-store';

/**
 * The captured tiles, drawn over the actual streets.
 *
 * A bare grid of coloured squares is honest but unreadable: an operator cannot
 * tell which square is their building, or which way the hot side faces. On a
 * street map they can, and the hyperlocal claim becomes checkable rather than
 * asserted — you can see the park that is cooler and the rail cut that is not.
 *
 * OpenStreetMap raster tiles, inverted to sit in a dark UI. Attribution is
 * required by the tile usage policy and is rendered, not optional.
 */

const TILE = 256;
const OSM = 'https://tile.openstreetmap.org';

/** Web Mercator, in pixels at a given zoom. */
const project = (lon: number, lat: number, z: number) => {
  const n = TILE * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * n,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n,
  };
};

/**
 * Zoom and origin for the viewport, plus the projection into it. Shared by
 * drawing and hit testing: computing it twice invites the two to disagree and
 * the readout to name the wrong tile.
 *
 * The area of interest is roughly 1.7 km by 2.7 km — portrait, and far taller
 * than a page-width frame. Fitting all of it into 1088 x 420 shrinks the tiles
 * to a 238 px sliver where no street name is readable, which defeats the point
 * of drawing a map at all.
 *
 * So the frame **covers** the viewport and centres on the building: the
 * captured block and its neighbours at street zoom, with the far north and
 * south of the box outside the frame. The legend spans every captured tile, not
 * only the visible ones, so the stated range stays true to the whole capture.
 */
function frame(geometry: CaptureGeometry, w: number, h: number, lat: number, lon: number) {
  const lons = geometry.cells.flatMap((c) => c.r.map((p) => p[0]));
  const lats = geometry.cells.flatMap((c) => c.r.map((p) => p[1]));
  const west = Math.min(...lons), east = Math.max(...lons);
  const north = Math.max(...lats), south = Math.min(...lats);

  // Smallest zoom that still fills the frame, so no empty gutter shows.
  let z = 12;
  while (z < 17) {
    const a = project(west, north, z), b = project(east, south, z);
    if (b.x - a.x >= w && b.y - a.y >= h) break;
    z++;
  }
  const centre = project(lon, lat, z);
  const originX = centre.x - w / 2, originY = centre.y - h / 2;
  const toPx = (ln: number, lt: number) => {
    const p = project(ln, lt, z);
    return { x: p.x - originX, y: p.y - originY };
  };
  return { z, originX, originY, toPx };
}

export function BlockMap({
  geometry, lat, lon, buildingC, height = 420,
}: {
  geometry: CaptureGeometry;
  lat: number;
  lon: number;
  buildingC: number;
  height?: number;
}) {
  const shell = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [tiles, setTiles] = useState<{ z: number; url: string; left: number; top: number }[]>([]);
  const [hover, setHover] = useState<{ x: number; y: number; c: number } | null>(null);

  useEffect(() => {
    const host = shell.current, cv = canvas.current;
    if (!host || !cv) return;

    const draw = () => {
      const w = host.clientWidth, h = height;
      if (w === 0) return;

      const { z, originX, originY, toPx } = frame(geometry, w, h, lat, lon);

      // Raster tiles behind, as images so no canvas tainting is involved.
      const next: typeof tiles = [];
      const n = 2 ** z;
      for (let tx = Math.floor(originX / TILE); tx <= Math.floor((originX + w) / TILE); tx++) {
        for (let ty = Math.floor(originY / TILE); ty <= Math.floor((originY + h) / TILE); ty++) {
          if (ty < 0 || ty >= n) continue;
          const wrapped = ((tx % n) + n) % n;
          next.push({
            z, url: `${OSM}/${z}/${wrapped}/${ty}.png`,
            left: tx * TILE - originX, top: ty * TILE - originY,
          });
        }
      }
      setTiles(next);

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      cv.width = w * dpr; cv.height = h * dpr;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const span = geometry.maxC - geometry.minC || 1;
      ctx.globalAlpha = 0.62;
      for (const cell of geometry.cells) {
        const t = (cell.t - geometry.minC) / span;
        const mix = (a: number, b: number) => Math.round(a + (b - a) * Math.pow(t, 0.85));
        // Cool #2E6BE8 through to hot #E8843C, so the spread reads at a glance.
        ctx.fillStyle = `rgb(${mix(46, 232)},${mix(107, 132)},${mix(232, 60)})`;
        ctx.beginPath();
        cell.r.forEach((p, i) => {
          const q = toPx(p[0], p[1]);
          if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
        });
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // The building, drawn last so nothing sits on top of it.
      const b = toPx(lon, lat);
      ctx.strokeStyle = '#57C99A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#57C99A';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(host);
    return () => observer.disconnect();
  }, [geometry, lat, lon, height]);

  /** Read out the tile under the pointer, so a claim can be checked per block. */
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const host = shell.current;
    if (!host) return;
    const box = host.getBoundingClientRect();
    const px = e.clientX - box.left, py = e.clientY - box.top;
    const { toPx } = frame(geometry, host.clientWidth, height, lat, lon);

    for (const cell of geometry.cells) {
      const pts = cell.r.map((p) => {
        const q = toPx(p[0], p[1]);
        return [q.x, q.y] as const;
      });
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) { setHover({ x: px, y: py, c: cell.t }); return; }
    }
    setHover(null);
  };

  return (
    <div
      ref={shell}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      className="relative overflow-hidden bg-surface-2"
      style={{ height }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        /* OSM ships light tiles; inverting keeps the map inside the dark palette. */
        style={{ filter: 'invert(1) hue-rotate(180deg) saturate(0.45) brightness(0.78) contrast(1.05)' }}
      >
        {tiles.map((t) => (
          <img
            key={`${t.z}/${t.left}/${t.top}`} src={t.url} alt="" width={TILE} height={TILE}
            loading="lazy" className="absolute max-w-none"
            style={{ left: t.left, top: t.top }}
          />
        ))}
      </div>

      <canvas ref={canvas} className="pointer-events-none absolute inset-0" />

      <span className="pointer-events-none absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-ink/80 px-2 py-1 font-mono text-xs tracking-wide text-fg-2">
        <i className="block size-2 flex-none rounded-full border-[1.5px] border-safe" />
        THIS BUILDING · {(buildingC * 9 / 5 + 32).toFixed(1)} °F
      </span>

      <span className="pointer-events-none absolute top-3 right-3 flex items-center gap-2 rounded-full bg-ink/80 px-2 py-1 font-mono text-xs text-fg-3">
        {(geometry.minC * 9 / 5 + 32).toFixed(1)}
        <i className="block h-2 w-16 rounded-full" style={{ background: 'linear-gradient(90deg,#2E6BE8,#E8843C)' }} />
        {(geometry.maxC * 9 / 5 + 32).toFixed(1)} °F
        <span className="text-fg-3/70">· all {geometry.cells.length} tiles</span>
      </span>

      {hover ? (
        <span
          className="tabular pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[150%] rounded-md bg-ink px-2 py-1 font-mono text-xs text-fg"
          style={{ left: hover.x, top: hover.y }}
        >
          {(hover.c * 9 / 5 + 32).toFixed(1)} °F
        </span>
      ) : null}

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="pointer-events-auto absolute right-3 bottom-3 rounded bg-ink/80 px-1.5 py-0.5 font-mono text-[10px] text-fg-3 underline decoration-fg-3/50 underline-offset-2"
      >
        © OpenStreetMap contributors
      </a>
    </div>
  );
}
