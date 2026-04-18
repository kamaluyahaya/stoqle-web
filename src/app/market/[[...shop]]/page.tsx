import React from "react";
import MarketWrapper from "./MarketWrapper";
import Loading from "./loading";
import { fetchBusinessCategories } from "@/src/lib/api/productApi";

export const revalidate = 300; // 5 minutes cache invalidation for the server shell

export default async function MarketPage(props: { params: Promise<{ shop?: string[] }> }) {
    // Resolve categories on the SERVER before passing to the client.
    //
    // A Promise object is NOT serializable across the RSC → Client boundary:
    // Next.js drops it silently, so the Client Component receives `undefined`
    // and the downstream `.then().catch()` chain crashes at runtime.
    //
    // By awaiting here we ship plain data (array | null) which serializes fine.
    const initialCategories = await fetchBusinessCategories()
        .then(res => {
            if (res?.status === "success" || res?.success || res?.ok) {
                return res.data || res;
            }
            return null;
        })
        .catch(() => null);

    return (
        <React.Suspense fallback={<Loading />}>
            <MarketWrapper params={props.params} initialCategories={initialCategories} />
        </React.Suspense>
    );
}
