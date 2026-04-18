import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/src/lib/config";
import { BusinessPolicyResponse } from "@/src/types/product";

export default function useBusinessPolicy(open: boolean, businessId?: number | string) {
  const [businessData, setBusinessData] = useState<BusinessPolicyResponse["data"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Remember the last fetched ID so we don't clear data on repeat opens
  const lastFetchedIdRef = useRef<string | number | undefined>(undefined);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    // ── DEFERRED FETCH ──────────────────────────────────────────────────────
    // setTimeout(0) yields to the browser paint loop once, letting the modal
    // render its first frame (price, title, cover image from payload data)
    // before any network work starts. Without this, the two serial fetches
    // (business + follow-stats) block the paint and the tap feels "laggy".
    const timerId = setTimeout(async () => {
      // If we already have data for this exact business, keep showing it
      // (don't flash to empty) and just silently refresh in the background.
      const isSameVendor = lastFetchedIdRef.current === businessId;
      if (!isSameVendor) {
        // New vendor — clear stale data so we don't show wrong policy cards
        setBusinessData(null);
      }

      setLoading(true);
      setError(null);

      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token && !businessId) {
          setError("No auth token found.");
          setLoading(false);
          return;
        }

        const endpoint = businessId
          ? `${API_BASE_URL}/api/business/${businessId}`
          : `${API_BASE_URL}/api/business/me`;
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const bizRes = await fetch(endpoint, {
          method: "GET",
          headers,
          signal: controller.signal,
        });

        if (!bizRes.ok) {
          const text = await bizRes.text();
          throw new Error(`HTTP ${bizRes.status} — ${text}`);
        }

        const bizJson: BusinessPolicyResponse = await bizRes.json();
        if (!bizJson.ok) throw new Error("API returned ok: false");

        const data = bizJson.data as any;

        // Follow-stats fetch (non-blocking — .catch(() => null) on purpose)
        const userId = data.business?.user_id || "me";
        const statsRes = await fetch(`${API_BASE_URL}/api/users/${userId}/follow-stats`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        }).catch(() => null);

        if (statsRes?.ok) {
          const statsJson = await statsRes.json();
          if (statsJson?.data) {
            if (!data.business.stats) data.business.stats = {};
            data.business.stats.followers = Number(statsJson.data.followersCount ?? statsJson.data.followers ?? 0);
            data.business.stats.following = Number(statsJson.data.followingCount ?? statsJson.data.following ?? 0);
            data.business.stats.posts    = Number(statsJson.data.postsCount     ?? statsJson.data.posts     ?? 0);
          }
        }

        lastFetchedIdRef.current = businessId;
        setBusinessData(data);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setError(err.message ?? "Failed to fetch business details");
      } finally {
        setLoading(false);
      }
    }, 0); // ← yields one tick to the paint loop

    return () => {
      clearTimeout(timerId);
      controller.abort();
    };
  }, [open, businessId]);

  return { businessData, loading, error } as const;
}
