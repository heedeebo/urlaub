/** Donut chart: approved, pending and free days out of the total pot. */
export default function Ring({
  segments,
  total,
  size = 172,
  children,
}: {
  segments: { value: number; color: string }[];
  total: number;
  size?: number;
  children?: React.ReactNode;
}) {
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f4" strokeWidth="16" />
        {total > 0 &&
          segments.map((s, i) => {
            const len = Math.max(0, (s.value / total) * c);
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="16"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
