import React from "react";
import MarketWrapper from "./MarketWrapper";
import Loading from "./loading";
import { fetchBusinessCategories } from "@/src/lib/api/productApi";

export const revalidate = 300; // 5 minutes cache invalidation for the server shell

export default async function MarketPage(props: { params: Promise<{ shop?: string[] }> }) {
    // Fetch critical public data on the server side to stream immediately
    // We catch errors to ensure the UI doesn't crash on failed category fetches
    const categoriesPromise = fetchBusinessCategories().then(res => {
        if (res?.status === "success" || res?.success || res?.ok) {
            return res.data || res;
        }
        return null;
    }).catch(() => null);

    return (
        <React.Suspense fallback={<Loading />}>
            <MarketWrapper params={props.params} initialCategoriesPromise={categoriesPromise} />
        </React.Suspense>
    );
}
