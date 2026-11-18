"use client";

import { useMemo } from "react";

type Props = {
  bars?: number;
  className?: string;
  barClassName?: string;
};

// Decorative animated voice waveform. Bar heights are deterministic so
// the render is stable, and delays are staggered so the wave feels alive.
export default function Waveform({
  bars = 28,
  className = "",
  barClassName = "bg-brass",
}: Props) {
  const heights = useMemo(
    () =>
      Array.from(
        { length: bars },
        (_, i) => 25 + Math.round(60 * Math.abs(Math.sin(i * 0.9))),
      ),
    [bars],
  );

  return (
    <div
      className={`flex h-10 items-center gap-[3px] ${className}`}
      aria-hidden="true"
    >
      {heights.map((height, i) => (
        <span
          key={i}
          className={`wave-bar w-[3px] rounded-full ${barClassName}`}
          style={{
            height: `${height}%`,
            animationDelay: `${(i % 7) * 120}ms`,
            animationDuration: `${900 + (i % 5) * 140}ms`,
          }}
        />
      ))}
    </div>
  );
}
