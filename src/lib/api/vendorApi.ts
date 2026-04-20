// src/lib/api/vendorApi.ts
import { safeFetch } from "./handler";

export interface VendorBadge {
    business_id: number;
    verified_badge: boolean;
    badge_label: string | null;
    updated_at?: string;
}

/**
 * Fetch the verification badge for a single vendor.
 * Use this on dedicated pages (store page, product page, vendor profile).
 */
export async function fetchVendorBadge(businessId: number): Promise<VendorBadge> {
    try {
        const json = await safeFetch<any>(`/api/vendors/${businessId}/verification-badge`, {
            next: { revalidate: 3600 }, // 1-hour ISR for RSC usage
        } as RequestInit);
        
        if (!json?.data) {
            return { business_id: businessId, verified_badge: false, badge_label: null };
        }
        return json.data as VendorBadge;
    } catch {
        return { business_id: businessId, verified_badge: false, badge_label: null };
    }
}

/**
 * Batch-fetch verification badges for multiple vendors in ONE round-trip.
 * Use this on list pages (market feed, search results, cart, checkout, chat).
 * Returns a lookup map: { [business_id]: VendorBadge }
 */
export async function fetchVendorBadgesBatch(
    businessIds: number[]
): Promise<Record<number, VendorBadge>> {
    if (!businessIds.length) return {};

    const unique = [...new Set(businessIds)];

    try {
        const json = await safeFetch<any>("/api/vendors/verification-badges", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ businessIds: unique }),
        });

        if (!json?.data?.badges) return {};

        // Normalize to a lookup map keyed by business_id
        return (json.data.badges as VendorBadge[]).reduce(
            (map, b) => {
                map[b.business_id] = b;
                return map;
            },
            {} as Record<number, VendorBadge>
        );
    } catch {
        return {};
    }
}
