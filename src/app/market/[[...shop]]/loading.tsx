import React from "react";
import ShimmerGrid from "@/src/components/shimmer";

export default function Loading() {
    return (
        <section className="min-h-screen pb-10 bg-slate-50">
            {/* Nav tabs skeleton */}
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100">
                <div className="flex px-4 py-2.5 gap-2 overflow-hidden">
                    <div className="w-20 h-8 bg-slate-200 animate-pulse rounded-full" />
                    <div className="w-24 h-8 bg-slate-200 animate-pulse rounded-full" />
                    <div className="w-20 h-8 bg-slate-200 animate-pulse rounded-full" />
                    <div className="w-28 h-8 bg-slate-200 animate-pulse rounded-full" />
                    <div className="w-24 h-8 bg-slate-200 animate-pulse rounded-full" />
                </div>
            </div>

            {/* Grid skeleton */}
            <div className="p-2 sm:p-4 mt-2">
                <ShimmerGrid count={15} />
            </div>
        </section>
    );
}
