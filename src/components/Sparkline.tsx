"use client";

import { useState } from "react";

interface SparklinePoint {
  date: string;
  value: number;
  league?: string | null;
  format?: string | null;
  result?: string | null;
  goals?: number;
  assists?: number;
  positions?: string[] | null;
}

interface SparklineProps {
  data: SparklinePoint[];
}

export default function Sparkline({ data }: SparklineProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (data.length < 2) return null;

  const width = 300;
  const height = 60;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const padding = 6;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const coords = data.map((d, i) => ({
    x: padding + (i / (data.length - 1)) * chartWidth,
    y: padding + chartHeight - ((d.value - min) / range) * chartHeight,
  }));

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const active = activeIndex !== null ? data[activeIndex] : null;
  const activeCoord = activeIndex !== null ? coords[activeIndex] : null;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    });

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <polyline
          points={polyline}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={activeIndex === i ? "5" : "3"}
            fill={activeIndex === i ? "#16a34a" : "#22c55e"}
            className="cursor-pointer"
            onClick={() => setActiveIndex(activeIndex === i ? null : i)}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
          />
        ))}
        {/* Larger invisible hit targets for mobile */}
        {coords.map((c, i) => (
          <circle
            key={`hit-${i}`}
            cx={c.x}
            cy={c.y}
            r="12"
            fill="transparent"
            className="cursor-pointer"
            onClick={() => setActiveIndex(activeIndex === i ? null : i)}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
          />
        ))}
      </svg>

      {/* Tooltip below chart */}
      {active && (
        <div className="mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">{active.value}/10</span>
            <span className="text-gray-500">{formatDate(active.date)}</span>
            {active.league && (
              <span className="text-gray-600 dark:text-gray-400">
                {active.league}{active.format && ` · ${active.format}`}
              </span>
            )}
            {active.result && (
              <span className="text-gray-600 dark:text-gray-400">{active.result}</span>
            )}
            <span className="text-gray-500">
              {active.goals ?? 0}G / {active.assists ?? 0}A
              {active.positions?.length ? ` · ${active.positions.join("/")}` : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
