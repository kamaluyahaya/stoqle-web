"use client";

import React, { useEffect, useState } from "react";

type ShimmerGridProps = { count?: number };

export function ShimmerCard({ heightClass = "min-h-[200px] sm:min-h-[250px] max-h-[300px] sm:max-h-[350px]" }: { heightClass?: string }) {
  return (
    <article
      className="group flex flex-col rounded-[1.05rem] bg-white cursor-default select-none border border-slate-100 overflow-hidden"
      aria-hidden="true"
    >
      <div className="relative overflow-hidden bg-slate-100">
        <div className={`w-full ${heightClass} shimmer-bg`} />
      </div>

      <div className="p-3">
        <div className="h-4 rounded-md w-3/4 mb-3 shimmer-bg opacity-70" />

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-5 w-5 rounded-full shimmer-bg opacity-60" />
            <div className="h-2.5 rounded-sm w-20 shimmer-bg opacity-50" />
          </div>

          <div className="h-5 w-8 rounded-md shimmer-bg opacity-40" />
        </div>
      </div>
    </article>
  );
}

export default function ShimmerGrid({ count = 10 }: ShimmerGridProps) {
  const [columns, setColumns] = useState(5);

  useEffect(() => {
    const updateColumns = () => {
      const w = window.innerWidth;
      if (w < 700) setColumns(2);
      else if (w < 1210) setColumns(3);
      else if (w < 1430) setColumns(4);
      else setColumns(5);
    };
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const columnData = Array.from({ length: columns }, () => [] as any[]);
  // Use mixed heights to simulate masonry
  const heights = [
    "aspect-[4/5]",
    "aspect-[3/4]",
    "aspect-[1/1]",
    "aspect-[2/3]",
    "h-[250px] sm:h-[320px]",
    "h-[200px] sm:h-[280px]"
  ];

  for (let i = 0; i < count; i++) {
    columnData[i % columns].push(heights[i % heights.length]);
  }

  return (
    <div className="flex gap-2 sm:gap-6 items-start w-full max-w-full overflow-hidden">
      {columnData.map((colItems, colIdx) => {
        // Build responsive visibility classes to prevent hydration flash
        let visibilityClass = "flex-1 flex flex-col gap-2 sm:gap-6 min-w-0";
        if (colIdx === 2) visibilityClass += " hidden [@media(min-width:700px)]:flex";
        if (colIdx === 3) visibilityClass += " hidden [@media(min-width:1210px)]:flex";
        if (colIdx === 4) visibilityClass += " hidden [@media(min-width:1430px)]:flex";

        return (
          <div key={colIdx} className={visibilityClass}>
            {colItems.map((height: string, itemIdx: number) => (
              <ShimmerCard key={itemIdx} heightClass={height} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
