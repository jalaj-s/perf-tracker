interface SparklineProps {
  data: { date: string; value: number }[];
  height?: number;
  width?: number;
}

export default function Sparkline({ data, height = 60, width = 300 }: SparklineProps) {
  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((d.value - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const polyline = points.join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxWidth: width }}>
      <polyline
        points={polyline}
        fill="none"
        stroke="#22c55e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((d.value - min) / range) * chartHeight;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="3"
            fill="#22c55e"
          />
        );
      })}
    </svg>
  );
}
