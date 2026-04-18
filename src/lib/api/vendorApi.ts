// src/lib/api/vendorApi.ts
import { API_BASE_URL } from "@/src/lib/config";

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
    const res = await fetch(`${API_BASE_URL}/api/vendors/${businessId}/verification-badge`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 }, // 1-hour ISR for RSC usage
    } as RequestInit);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.data) {
        return { business_id: businessId, verified_badge: false, badge_label: null };
    }
    return json.data as VendorBadge;
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
        const res = await fetch(`${API_BASE_URL}/api/vendors/verification-badges`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({ businessIds: unique }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.data?.badges) return {};

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
