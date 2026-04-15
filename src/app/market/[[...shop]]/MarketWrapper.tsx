"use client";

import dynamic from "next/dynamic";
import React from "react";
import ShimmerGrid from "@/src/components/shimmer";

// Disable SSR so the server doesn't execute the local storage code, fully satisfying hydration constraints
const MarketClient = dynamic(() => import("./MarketClient"), { 
    ssr: false, 
    loading: () => <ShimmerGrid count={15} /> 
});

export default function MarketWrapper(props: any) {
    return <MarketClient {...props} />;
}
