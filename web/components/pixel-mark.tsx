/** Brand mark: nine segments in the data palette. The product's unit is a pixel. */
export function PixelMark({ size = 18 }: { size?: number }) {
  const fills = [
    '#272727', '#E8843C', '#9A8FA6',
    '#9A8FA6', '#57C99A', '#272727',
    '#272727', '#272727', '#E8843C',
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="block">
      <rect width="32" height="32" rx="9" fill="#1F1F1F" />
      {fills.map((fill, i) => (
        <rect key={i} x={7 + (i % 3) * 6} y={7 + Math.floor(i / 3) * 6} width="5" height="5" fill={fill} />
      ))}
    </svg>
  );
}
