/**
 * Elevation of the four commands Envo emits. One drawing, so the labels
 * stay locked to the rooftop plant, sunlit glass, intake, and peak hold.
 */
const ZONES = [
  {
    title: 'HVAC setpoint',
    note: 'Rooftop plant',
    color: '#FF8B3E',
    tag: { x: 384, y: 28 },
    from: { x: 330, y: 48 },
    to: { x: 384, y: 48 },
  },
  {
    title: 'Shade tint',
    note: 'Sunlit face',
    color: '#8A8078',
    tag: { x: 16, y: 118 },
    from: { x: 230, y: 138 },
    to: { x: 180, y: 138 },
  },
  {
    title: 'Outside air',
    note: 'Intake damper',
    color: '#C4843A',
    tag: { x: 384, y: 208 },
    from: { x: 330, y: 228 },
    to: { x: 384, y: 228 },
  },
  {
    title: 'Demand response',
    note: 'Peak hold',
    color: '#FF8B3E',
    tag: { x: 16, y: 278 },
    from: { x: 230, y: 298 },
    to: { x: 180, y: 298 },
  },
] as const;

const TAG_W = 160;
const TAG_H = 40;

const WINDOWS = [
  { x: 244, tinted: true },
  { x: 268, tinted: false },
  { x: 292, tinted: false },
] as const;

const FLOORS = [88, 128, 168, 208, 248, 288];

export function BuildingRig() {
  return (
    <svg
      viewBox="0 0 560 360"
      fill="none"
      role="img"
      aria-label="Four commands Envo can emit on one building: HVAC setpoint at the rooftop plant, shade tint on the sunlit face, outside air at the intake damper, and demand response as a peak hold."
      className="mx-auto block w-full max-w-[520px]"
    >
      <circle cx="198" cy="138" r="7" className="fill-[#FF8B3E]/80" />
      <circle cx="198" cy="138" r="13" className="fill-none stroke-[#FF8B3E]/35" strokeWidth="1" />

      <rect x="246" y="36" width="68" height="22" rx="2" className="stroke-[#3F3630]" strokeWidth="1.5" />
      <rect x="268" y="28" width="24" height="8" rx="1" className="stroke-[#3F3630]" strokeWidth="1.25" />
      <line x1="280" y1="58" x2="280" y2="68" className="stroke-[#3F3630]" strokeWidth="1.5" />

      <rect x="230" y="68" width="100" height="248" rx="2" className="stroke-[#1B1613]" strokeWidth="1.5" />

      {FLOORS.map((y) => (
        <g key={y}>
          {WINDOWS.map((pane) => (
            <rect
              key={`${y}-${pane.x}`}
              x={pane.x}
              y={y}
              width="16"
              height="26"
              className={pane.tinted ? 'fill-[#E8C4A0] stroke-[#3F3630]' : 'fill-[#FFF6E5] stroke-[#B1ACA6]'}
              strokeWidth="1"
            />
          ))}
        </g>
      ))}

      <rect x="286" y="214" width="28" height="22" className="fill-[#FFF6E5] stroke-[#3F3630]" strokeWidth="1" />
      <line x1="290" y1="220" x2="310" y2="220" className="stroke-[#3F3630]" strokeWidth="1" />
      <line x1="290" y1="225" x2="310" y2="225" className="stroke-[#3F3630]" strokeWidth="1" />
      <line x1="290" y1="230" x2="310" y2="230" className="stroke-[#3F3630]" strokeWidth="1" />

      <rect x="218" y="316" width="124" height="10" rx="1" className="stroke-[#1B1613]" strokeWidth="1.5" />
      <rect x="256" y="320" width="48" height="4" className="fill-[#FF8B3E]" />

      {ZONES.map((zone) => (
        <g key={zone.title}>
          <path d={`M${zone.from.x} ${zone.from.y} H${zone.to.x}`} stroke={zone.color} strokeWidth="1" />
          <circle cx={zone.from.x} cy={zone.from.y} r="2.5" fill={zone.color} />
          <rect
            x={zone.tag.x}
            y={zone.tag.y}
            width={TAG_W}
            height={TAG_H}
            className="fill-[#1B1613] stroke-[#3F3630]"
            strokeWidth="1"
          />
          <circle cx={zone.tag.x + 12} cy={zone.tag.y + 14} r="2.5" fill={zone.color} />
          <text
            x={zone.tag.x + 22}
            y={zone.tag.y + 17}
            className="fill-[#F4EFE8]"
            style={{ fontSize: 12, letterSpacing: '0.02em' }}
          >
            {zone.title}
          </text>
          <text
            x={zone.tag.x + 22}
            y={zone.tag.y + 31}
            className="fill-[#B1ACA6]"
            style={{ fontSize: 10 }}
          >
            {zone.note}
          </text>
        </g>
      ))}
    </svg>
  );
}
