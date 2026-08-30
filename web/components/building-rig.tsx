interface Callout {
  label: string;
  color: string;
  /** Point on the building silhouette this callout points at. */
  mx: number; my: number;
  /** Top-left of the label tag box. */
  tagX: number; tagY: number; tagW: number;
}

const TAG_H = 28;

/**
 * The four things Envo actually emits, per CLAUDE.md's own description of the
 * agent, not a generic feature list: HVAC setpoint, shade tint, outside air
 * damper, demand response. A schematic rather than a photo, so it reads as
 * "what this controls" instead of stock art of an unrelated building.
 */
const CALLOUTS: Callout[] = [
  { label: 'HVAC SETPOINT', color: 'var(--color-heat)', mx: 200, my: 50, tagX: 236, tagY: 14, tagW: 132 },
  { label: 'SHADE TINT', color: 'var(--color-smoke)', mx: 150, my: 140, tagX: 8, tagY: 124, tagW: 118 },
  { label: 'OUTSIDE AIR DAMPER', color: 'var(--color-safe)', mx: 250, my: 230, tagX: 252, tagY: 214, tagW: 168 },
  { label: 'DEMAND RESPONSE', color: 'var(--color-alert)', mx: 150, my: 300, tagX: 8, tagY: 284, tagW: 150 },
];

const FLOOR_LINES = [110, 150, 190, 230, 270, 310];
const BRACKET = 16;

export function BuildingRig() {
  return (
    <svg
      width="380"
      height="300"
      viewBox="0 0 456 360"
      fill="none"
      aria-hidden="true"
      className="block"
    >
      {/* Scan corners — the one nod to a "robotic" targeting HUD, fully static. */}
      {[[0, 0, 1, 1], [456, 0, -1, 1], [0, 356, 1, -1], [456, 356, -1, -1]].map(([x, y, dx, dy], i) => (
        <path
          key={i}
          d={`M${x! + BRACKET * dx!},${y} L${x},${y} L${x},${y! + BRACKET * dy!}`}
          stroke="var(--color-line-2)"
          strokeWidth="1.5"
        />
      ))}

      <ellipse cx="200" cy="332" rx="70" ry="6" fill="var(--color-surface-3)" />

      {/* Rooftop mechanical unit. */}
      <rect x="175" y="40" width="50" height="22" rx="2" stroke="var(--color-line-2)" strokeWidth="1.5" />
      <line x1="200" y1="62" x2="200" y2="70" stroke="var(--color-line-2)" strokeWidth="1.5" />

      {/* Tower. */}
      <rect x="150" y="70" width="100" height="260" rx="2" stroke="var(--color-fg-3)" strokeWidth="1.5" />
      {FLOOR_LINES.map((y) => (
        <line key={y} x1="150" y1={y} x2="250" y2={y} stroke="var(--color-line-2)" strokeWidth="1" />
      ))}
      {/* Facade glazing, sparse and quiet — texture, not the focal point. */}
      {FLOOR_LINES.slice(0, -1).map((y) => (
        <g key={y}>
          <rect x="160" y={y + 8} width="16" height="22" stroke="var(--color-line-2)" strokeWidth="1" />
          <rect x="208" y={y + 8} width="16" height="22" stroke="var(--color-line-2)" strokeWidth="1" />
        </g>
      ))}

      {CALLOUTS.map((c) => (
        <g key={c.label}>
          <line
            x1={c.mx} y1={c.my}
            x2={c.tagX + 12} y2={c.tagY + TAG_H / 2}
            stroke={c.color} strokeWidth="1" strokeDasharray="3 3" opacity="0.6"
          />
          <circle cx={c.mx} cy={c.my} r="3.5" fill="var(--color-surface)" stroke={c.color} strokeWidth="1.5" />
          <rect
            x={c.tagX} y={c.tagY} width={c.tagW} height={TAG_H} rx="6"
            fill="#1B1613" stroke="#3F3630" strokeWidth="1"
          />
          <circle cx={c.tagX + 12} cy={c.tagY + TAG_H / 2} r="3" fill={c.color} />
          <text
            x={c.tagX + 22} y={c.tagY + TAG_H / 2 + 3}
            className="font-mono text-[9px] tracking-wide"
            fill="#F4EFE8"
          >
            {c.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
