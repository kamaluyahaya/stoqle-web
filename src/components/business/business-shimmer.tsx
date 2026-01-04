// src/components/ui/Shimmer.tsx
"use client";

export default function Shimmer({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-slate-200 ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer-business_1.4s_infinite] bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200" />
    </div>
  );
}
