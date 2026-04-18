/**
 * useSocialShare.ts
 *
 * Generates a short share link for social posts (reels/posts) via the backend.
 */
'use client';

import { useState, useCallback, useRef } from 'react';
import { API_BASE_URL } from '@/src/lib/config';

interface UseSocialShareReturn {
  /** Call to generate & cache the share URL for a social post. Idempotent per social_post_id. */
  share: (socialPostId: number | string, title?: string) => Promise<string | null>;
  shareUrl: string | null;
  isSharing: boolean;
  reset: () => void;
}

export function useSocialShare(token?: string | null): UseSocialShareReturn {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Use refs for mutable values accessed inside useCallback — avoids stale closures
  const isLoadingRef = useRef(false);
  const lastPostIdRef = useRef<string | null>(null);
  const lastUrlRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null | undefined>(token);
  tokenRef.current = token; // always up-to-date

  const share = useCallback(async (
    socialPostId: number | string,
    _title?: string,
  ): Promise<string | null> => {
    if (!socialPostId) return null;

    const spid = String(socialPostId);

    // Return cached URL only if the same post is requested
    if (lastUrlRef.current && lastPostIdRef.current === spid) {
      return lastUrlRef.current;
    }

    // Prevent concurrent requests
    if (isLoadingRef.current) return null;
    isLoadingRef.current = true;
    setIsSharing(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tokenRef.current) headers['Authorization'] = `Bearer ${tokenRef.current}`;

      const res = await fetch(`${API_BASE_URL}/api/social/share`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ post_id: spid }),
      });

      const json = await res.json();
      if (!json.ok || !json.data?.url) throw new Error(json.message || 'Failed to generate link');

      const url: string = json.data.url;

      // Update refs and state
      lastPostIdRef.current = spid;
      lastUrlRef.current = url;
      setShareUrl(url);
      return url;
    } catch (err: any) {
      console.error('[useSocialShare]', err);
      return null;
    } finally {
      isLoadingRef.current = false;
      setIsSharing(false);
    }
  }, []); // stable — all mutable values via refs

  const reset = useCallback(() => {
    setShareUrl(null);
    lastPostIdRef.current = null;
    lastUrlRef.current = null;
    isLoadingRef.current = false;
  }, []);

  return { share, shareUrl, isSharing, reset };
}
