"use client";

import React from "react";

interface StoqleLoaderProps {
  /** Override the outer size. Defaults to 44px */
  size?: number;
  className?: string;
}

export default function StoqleLoader({ size = 30, className = "" }: StoqleLoaderProps) {
  const strokeWidth = size * 0.09;
  const r = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  // Each arc is ~140° out of 360°, leaving a ~40° gap
  const arcLength = circumference * (140 / 360);
  const gapLength = circumference - arcLength;

  return (
    <>
      <style>{`
        @keyframes stoqle-chase {
          /* fast spin for 2 s (0% → 80%), then soft rest for 0.5 s (80% → 100%) */
          0%   { transform: rotate(0deg); }
          80%  { transform: rotate(1440deg); animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1); }
          100% { transform: rotate(1480deg); }
        }
        @keyframes stoqle-chase-b {
          0%   { transform: rotate(180deg); }
          80%  { transform: rotate(1620deg); animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1); }
          100% { transform: rotate(1660deg); }
        }
        .stoqle-arc-a {
          animation: stoqle-chase   2.5s cubic-bezier(0.2, 0, 0.3, 1) infinite;
          transform-origin: center;
        }
        .stoqle-arc-b {
          animation: stoqle-chase-b 2.5s cubic-bezier(0.2, 0, 0.3, 1) infinite;
          transform-origin: center;
        }
      `}</style>
      <div
        className={`relative flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        aria-label="Loading…"
        role="status"
      >
        {/* Arc A */}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute stoqle-arc-a"
          style={{ overflow: "visible" }}
        >
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="#f43f5e"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${gapLength}`}
            strokeDashoffset={0}
          />
        </svg>

        {/* Arc B — starts 180° offset, chasing A */}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute stoqle-arc-b"
          style={{ overflow: "visible" }}
        >
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="#f43f5e"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${gapLength}`}
            strokeDashoffset={0}
          />
        </svg>
      </div>
    </>
  );
}
