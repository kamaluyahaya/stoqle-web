/**
 * useShareProduct.ts
 *
 * Generates a short share link via the backend and exposes it as state.
 * The modal (SmartShareButton) decides what to do with the URL.
 */
'use client';

import { useState, useCallback, useRef } from 'react';
import { API_BASE_URL } from '@/src/lib/config';

interface UseShareProductReturn {
  /** Call to generate & cache the share URL. Idempotent per product_id. */
  share: (productId: number | string, title?: string) => Promise<string | null>;
  shareUrl: string | null;
  isSharing: boolean;
  reset: () => void;
}

export function useShareProduct(token?: string | null): UseShareProductReturn {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Use refs for mutable values accessed inside useCallback — avoids stale closures
  const isLoadingRef = useRef(false);
  const lastProductIdRef = useRef<string | null>(null);
  const lastUrlRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null | undefined>(token);
  tokenRef.current = token; // always up-to-date

  const share = useCallback(async (
    productId: number | string,
    _title?: string,
  ): Promise<string | null> => {
    if (!productId) return null;

    const pid = String(productId);

    // Return cached URL only if the same product is requested
    if (lastUrlRef.current && lastProductIdRef.current === pid) {
      return lastUrlRef.current;
    }

    // Prevent concurrent requests
    if (isLoadingRef.current) return null;
    isLoadingRef.current = true;
    setIsSharing(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tokenRef.current) headers['Authorization'] = `Bearer ${tokenRef.current}`;

      const res = await fetch(`${API_BASE_URL}/api/share`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ product_id: pid }),
      });

      const json = await res.json();
      if (!json.ok || !json.data?.url) throw new Error(json.message || 'Failed to generate link');

      const url: string = json.data.url;

      // Update refs and state
      lastProductIdRef.current = pid;
      lastUrlRef.current = url;
      setShareUrl(url);
      return url;
    } catch (err: any) {
      console.error('[useShareProduct]', err);
      return null;
    } finally {
      isLoadingRef.current = false;
      setIsSharing(false);
    }
  }, []); // stable — all mutable values via refs

  const reset = useCallback(() => {
    setShareUrl(null);
    lastProductIdRef.current = null;
    lastUrlRef.current = null;
    isLoadingRef.current = false;
  }, []);

  return { share, shareUrl, isSharing, reset };
}
