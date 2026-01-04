// Shimmer.tsx
import React from "react";

type ShimmerGridProps = { count?: number };

export function ShimmerCard() {
  return (
    <article
      className="group flex flex-col rounded-3xl bg-white cursor-default select-none"
      aria-hidden="true"
    >
      <div className="relative overflow-hidden rounded-2xl bg-slate-200">
        <div className="w-full lg:min-h-[320px] min-h-[250px] max-h-[320px] rounded-2xl shimmer-bg" />
      </div>

      <div className="flex flex-col p-4">
        <div className="h-4 rounded-md w-3/4 mb-3 shimmer-bg" />

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-5 w-5 rounded-full shimmer-bg" />
            <div className="h-3 rounded-sm w-32 shimmer-bg" />
          </div>

          <div className="h-6 w-10 rounded-md shimmer-bg" />
        </div>
      </div>
    </article>
  );
}

export default function ShimmerGrid({ count = 10 }: ShimmerGridProps) {
  return (
    <div
      className="post-grid "
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerCard key={i} />
      ))}
    </div>
  );
}
