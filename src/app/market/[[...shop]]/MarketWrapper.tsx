"use client";

import dynamic from "next/dynamic";
import React from "react";
import StoqleLoader from "@/src/components/common/StoqleLoader";

// Disable SSR so the server doesn't execute the local storage code, fully satisfying hydration constraints


const MarketSkeleton = dynamic(() => import("./MarketClient"), {
    ssr: true,
    loading: () => (
        <div className="px-1 animate-in fade-in duration-500">
            {/* Subcategory Strip Skeleton */}
            <div className="flex flex-wrap gap-y-4 gap-x-2 sm:gap-x-4 px-1 py-3 mb-4">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-[calc((100%-32px)/5)] sm:w-[calc((100%-48px)/7)] lg:w-[calc((100%-80px)/10)]">
                        <div className="w-12 h-12 rounded bg-slate-200/60 animate-pulse" />
                        <div className="w-10 h-2.5 rounded bg-slate-200/60 animate-pulse" />
                    </div>
                ))}
            </div>

            {/* Product Grid Skeleton (Masonry mimic) */}
            <div className="flex gap-2 sm:gap-6 items-start w-full max-w-full overflow-hidden">
                {[1, 2, 3, 4, 5].map((colIdx) => {
                    let visibilityClass = "flex-1 flex flex-col gap-2 sm:gap-6 min-w-0";
                    if (colIdx === 3) visibilityClass += " hidden [@media(min-width:700px)]:flex";
                    if (colIdx === 4) visibilityClass += " hidden [@media(min-width:1210px)]:flex";
                    if (colIdx === 5) visibilityClass += " hidden [@media(min-width:1430px)]:flex";

                    return (
                        <div key={colIdx} className={visibilityClass}>
                            {Array.from({ length: 3 }).map((_, i) => {
                                // Randomize height for masonry feel
                                const heights = ["h-48", "h-64", "h-72", "h-56"];
                                const h = heights[(i + colIdx) % heights.length];
                                return (
                                    <div key={i} className={`w-full ${h} rounded-2xl bg-slate-200/50 animate-pulse flex flex-col justify-end p-4 gap-2`}>
                                        <div className="w-3/4 h-3 rounded-full bg-slate-200" />
                                        <div className="w-1/2 h-3 rounded-full bg-slate-200" />
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    )
});
export default function MarketWrapper(props: any) {
    return <MarketSkeleton {...props} />;
}
