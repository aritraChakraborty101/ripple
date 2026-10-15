interface Props {
  readonly values: readonly number[];
  /** Drawn as a faint dashed line: the normal level. */
  readonly base: number;
  readonly tone: string;
  readonly width?: number;
  readonly height?: number;
}

/** A small trend line with the normal level marked. */
export function Sparkline({ values, base, tone, width = 200, height = 36 }: Props) {
  const lo = Math.min(base, ...values);
  const hi = Math.max(base, ...values);
  const span = hi - lo || 1;
  const pad = 2;
  const x = (i: number) => (values.length <= 1 ? width : (i / (values.length - 1)) * width);
  const y = (v: number) => height - pad - ((v - lo) / span) * (height - pad * 2);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line
        x1="0"
        x2={width}
        y1={y(base)}
        y2={y(base)}
        stroke="var(--line)"
        strokeDasharray="3 4"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={points}
        fill="none"
        stroke={tone}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
