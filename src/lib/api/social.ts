/**
 * Social API service
 * - centralizes fetch logic and mapping from API payload -> Post
 * - exports: fetchSocialPosts, fetchSocialPostById, prefetchMediaConservative
 */

import { API_BASE_URL } from "@/src/lib/config";
import { safeFetch, isOffline } from "./handler";
import type { Post } from "@/src/lib/types";

const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;
const NO_IMAGE_PLACEHOLDER = "https://via.placeholder.com/800x600?text=No+Image";

const isVideoUrl = (u?: string) => !!u && VIDEO_EXT_RE.test(u);

const formatLocalUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;

  const base = (API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
};

/**
 * Map an API response post to our frontend Post shape.
 * Keep this deterministic and side-effect free.
 */
export const mapApiPost = (p: any): Post => {
  // Guard: Backend may occasionally return a null item in a list or on a failed fetch
  if (!p) {
    return {
      id: Math.floor(Math.random() * 1e6),
      apiId: 0,
      src: NO_IMAGE_PLACEHOLDER,
      caption: "Unavailable",
      user: { id: 0, name: "Unknown", avatar: "" },
      liked: false,
      likeCount: 0,
      allMedia: []
    } as any;
  }
  const apiId = p.social_post_id ?? p.id ?? Math.floor(Math.random() * 1e6);
  let src: string | undefined;
  let thumbnail: string | undefined;
  const images = Array.isArray(p.images) ? p.images : [];

  if (p.cover_type === "video") {
    const videoFile = images.find((i: any) => isVideoUrl(i.image_url));
    const coverFile = images.find((i: any) => !!i.is_cover);

    src = formatLocalUrl(videoFile?.image_url);
    thumbnail = formatLocalUrl(coverFile?.image_url);

    // Fallback if no video file found but cover exists
    if (!src) src = coverFile?.image_url;
  } else if (images.length > 0) {
    const cover = images.find((i: any) => !!i.is_cover) ?? images[0];
    src = formatLocalUrl(cover?.image_url);
  }

  const allMedia = images.length > 0
    ? images.map((i: any) => ({ url: formatLocalUrl(i.image_url), id: i.social_post_image_id || i.post_image_id || i.id }))
    : src ? [{ url: formatLocalUrl(src), id: p.cover_id || null }] : [];

  if (!src && p.cover_type !== "note") {
    src = NO_IMAGE_PLACEHOLDER;
  }
  const isVideo = p.cover_type === "video" || isVideoUrl(src);
  const caption = p.text || "";
  const subtitle = p.subtitle || "";
  const note_caption = p.subtitle || p.text || "";
  return {
    id: apiId,
    apiId,
    src,
    isVideo,
    caption,
    subtitle,
    note_caption,
    user: {
      id: p.user_id ?? p.user?.user_id ?? p.user?.id ?? 0,
      name: p.author_name ?? "Unknown",
      username: p.author_handle ?? p.user?.username ?? "",
      avatar: formatLocalUrl(p.logo || p.business_logo || p.vendor_logo || p.shop_logo || p.author_pic || p.profile_pic || p.avatar || p.user?.logo || p.user?.profile_pic) || `https://i.pravatar.cc/100?u=${p.user_id ?? apiId}`,
      is_trusted: Number(
        p.author_is_trusted ??
        p.user?.is_trusted ??
        p.user?.is_verified_partner ??
        p.user?.is_partner ??
        p.user?.policy?.market_affiliation?.trusted_partner ??
        p.is_verified_partner ??
        p.is_partner ??
        0
      ) === 1 ||
        !!p.author_is_verified ||
        !!p.user?.is_verified_partner ||
        !!p.user?.is_partner ||
        !!p.is_verified_partner ||
        !!p.is_partner ||
        !!p.author_is_trusted,
      is_partner: !!p.author_is_partner || !!p.is_partner || !!p.author_is_verified || !!p.is_verified_partner,
      verified_badge: !!p.verified_badge || !!p.author_is_trusted,
    },
    author_is_partner: p.author_is_partner,
    verified_badge: p.verified_badge,
    author_handle: p.author_handle,
    author_name: p.author_name,
    author_pic: p.author_pic,
    liked: Boolean(p.liked_by_me),
    likeCount: p.likes_count ?? 0,
    coverType: p.cover_type,
    noteConfig: p.config,
    rawCreatedAt: p.created_at,
    allMedia,
    location: p.location,
    category: p.category,
    thumbnail: thumbnail,
    status: p.status,
    is_product_linked: Boolean(p.is_product_linked),
    linked_product: p.linked_product,

    // Engagement Metadata - Master Keys
    likes_count: p.likes_count ?? p.likeCount ?? 0,
    comment_count: p.comment_count ?? p.comments_count ?? p.commentCount ?? 0,
    liked_by_user: Boolean(p.liked_by_me ?? p.liked ?? false),
    is_following: Boolean(p.is_following ?? false),
    original_audio_url: formatLocalUrl(p.original_audio_url),
    original_video_url: formatLocalUrl(p.original_video_url),
  };
};

type FetchPostsOptions = {
  baseUrl?: string;
  signal?: AbortSignal;
  limit?: number;
  offset?: number;
  cursor?: string | null;
  category?: string;
  token?: string | null;
  targetUserId?: string | number | null;
  buffer_ids?: (string | number)[];
  is_product_linked?: boolean;
  softCategory?: boolean;
};

/**
 * Fetch list of posts from backend and map them to Post[]
 */
export async function fetchSocialPosts(opts: FetchPostsOptions = {}) {
  const url = new URL(`${(opts.baseUrl || API_BASE_URL).replace(/\/$/, "")}/api/social/`);
  if (opts.limit !== undefined) url.searchParams.set("limit", String(opts.limit));
  if (opts.offset !== undefined) url.searchParams.set("offset", String(opts.offset));
  if (opts.category !== undefined) url.searchParams.set("category", String(opts.category));

  const headers: any = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const json = await safeFetch<any>(url.toString(), {
    signal: opts.signal,
    headers
  });
  const apiPosts: any[] = json?.data?.posts && Array.isArray(json.data.posts) ? json.data.posts : [];
  return apiPosts.map(mapApiPost);
}

/**
 * Fetch social posts with linked products
 */
export async function fetchLinkedProductPosts(opts: FetchPostsOptions = {}) {
  const url = new URL(`${(opts.baseUrl || API_BASE_URL).replace(/\/$/, "")}/api/social/`);
  url.searchParams.set("is_product_linked", "true");
  if (opts.limit !== undefined) url.searchParams.set("limit", String(opts.limit));
  if (opts.offset !== undefined) url.searchParams.set("offset", String(opts.offset));

  const headers: any = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const json = await safeFetch<any>(url.toString(), {
    signal: opts.signal,
    headers,
  });
  const apiPosts: any[] = json?.data?.posts && Array.isArray(json.data.posts) ? json.data.posts : [];
  return apiPosts.filter(Boolean).map(mapApiPost);
}

/**
 * Fetch a single post by ID
 */
export async function fetchSocialPostById(postId: number, opts: FetchPostsOptions = {}) {
  const json = await safeFetch<any>(`/api/social/${postId}`, {
    signal: opts.signal,
  });
  return mapApiPost(json?.data ?? json);
}

// Persistent cache for deep-link tokens
interface CachedTokenStore {
  urlData: any;
  expiresAt: number;
}

const getCache = (): Map<string, CachedTokenStore> => {
  if (typeof window === "undefined") return new Map();
  try {
    const stored = sessionStorage.getItem("xsec_tokens");
    if (stored) return new Map(JSON.parse(stored));
  } catch (e) { }
  return new Map();
};

const saveCache = (cache: Map<string, CachedTokenStore>) => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem("xsec_tokens", JSON.stringify(Array.from(cache.entries())));
  } catch (e) { }
};

/**
 * Fetch a securely signed deep-link URL from the backend (with caching)
 */
export async function fetchSecurePostUrl(postId: number | string, source: string, token?: string | null) {
  const cacheKey = `${postId}-${source}`;
  const now = Date.now();
  const cache = getCache();
  const cached = cache.get(cacheKey);

  // Return cached token if valid, maintaining a 1-minute buffer before backend expiration
  if (cached && cached.expiresAt > now + 60000) {
    return cached.urlData;
  }

  const base = API_BASE_URL;

  const url = new URL(`${base.replace(/\/$/, "")}/api/social/${postId}/secure-link`);
  url.searchParams.set("source", source);

  const headers: any = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const json = await safeFetch<any>(url.toString(), { headers });
    if (json?.data) {
      // Backend tokens live for 10m. Cache locally for 9m to handle silent refresh.
      cache.set(cacheKey, {
        urlData: json.data,
        expiresAt: now + 9 * 60 * 1000,
      });
      saveCache(cache);
    }
    return json?.data || null;
  } catch (err) {
    return null;
  }
}

/**
 * Preload securely signed URLs during idle time for upcoming posts
 */
export function preloadSecurePostUrls(postIds: (number | string)[], source: string, token?: string | null) {
  if (typeof window === "undefined") return;
  const cb = (window as any).requestIdleCallback ?? ((fn: Function) => setTimeout(fn, 250));

  cb(async () => {
    for (const id of postIds) {
      const cacheKey = `${id}-${source}`;
      const cache = getCache();
      const cached = cache.get(cacheKey);

      // Skip if already cached and far from expiry
      if (!cached || cached.expiresAt <= Date.now() + 60000) {
        await fetchSecurePostUrl(id, source, token);
      }
    }
  });
}

/**
 * Conservative media prefetch helper used by Discover.
 * Keeps concurrency small and tries to not interfere with main thread.
 */
export async function prefetchMediaConservative(urls: Array<string | undefined>, opts?: { maxMb?: number }) {
  try {
    const uniq = Array.from(new Set((urls || []).filter(Boolean) as string[]));
    if (!uniq.length) return;
    if (typeof window === "undefined") return;
    // @ts-ignore
    if (navigator?.connection?.saveData) return; // respect save-data

    const runDuringIdle = (fn: () => Promise<void>) =>
      new Promise<void>((resolve) => {
        const cb = (window as any).requestIdleCallback ?? ((cb2: Function) => setTimeout(cb2, 250));
        cb(() => {
          fn().finally(resolve);
        });
      });

    const cache = await caches.open("media-cache-v1");
    const concurrency = 2;
    let idx = 0;
    let usedMb = 0;
    const maxMb = opts?.maxMb ?? 20;

    const worker = async () => {
      while (idx < uniq.length) {
        const u = uniq[idx++];
        if (!u) continue;
        try {
          const req = new Request(u, { method: "GET", mode: "cors" });
          const matched = await cache.match(req);
          if (matched) continue;
          await runDuringIdle(async () => {
            if (isOffline()) return;
            try {
              const res = await fetch(u, { cache: "no-store" });
              if (!res.ok) return;
              cache.put(req, res.clone()).catch(() => { });
              usedMb += 0.5; // best-effort estimate
            } catch (e) { }
          });
          if (usedMb > maxMb) break;
        } catch (e) {
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }).map(() => worker()));
  } catch (err) {
  }
}
/**
 * Create a new social post.
 * Supports multipart/form-data for image/video uploads.
 */
export async function createSocialPost(
  formData: FormData,
  token: string,
  onUploadProgress?: (progress: number) => void
) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL.replace(/\/$/, "")}/api/social/`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    if (onUploadProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onUploadProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      let json;
      try {
        json = JSON.parse(xhr.responseText);
      } catch (e) {
        json = { message: "Failed to parse response" };
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json);
      } else {
        if (xhr.status === 403 || xhr.status === 429) {
          reject(new Error("SECURITY_BLOCK:" + (json?.message || "Action restricted by security engine")));
        } else {
          reject(new Error(json?.message || "Failed to create post"));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(formData);
  });
}

/**
 * Toggle like for a social post
 */
export async function toggleSocialPostLike(postId: number | string, token: string) {
  return safeFetch(`/api/social/${postId}/like`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export type ActivityPayload = {
  social_post_id: number;
  action_type: 'view' | 'like' | 'comment' | 'follow' | 'share';
  watch_time?: number;
  watch_progress?: number;
  completed?: boolean;
  skipped?: boolean;
  replays?: number;
  scroll_velocity_flag?: boolean;
  category?: string;
  token?: string | null;
};

/**
 * Log activity for a social post (view, save, share, etc.)
 */
export async function logSocialActivity(payload: ActivityPayload, token?: string | null) {
  const headers: any = { "Content-Type": "application/json" };
  if (token || payload.token) headers.Authorization = `Bearer ${token || payload.token}`;

  try {
    return await safeFetch("/api/social/activity", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch (e) { return false; }
}

/**
 * Fetch a personalized discovery feed
 */
export async function fetchDiscoverFeed(opts: FetchPostsOptions = {}) {
  const url = new URL(`${(opts.baseUrl || API_BASE_URL).replace(/\/$/, "")}/api/social/discover`);
  if (opts.limit !== undefined) url.searchParams.set("limit", String(opts.limit));
  if (opts.offset !== undefined) url.searchParams.set("offset", String(opts.offset));

  const headers: any = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const json = await safeFetch<any>(url.toString(), {
    signal: opts.signal,
    headers
  });

  const data = json?.data || {};

  return {
    forYou: (data.for_you || []).filter(Boolean).map(mapApiPost),
    trending: (data.trending || []).filter(Boolean).map(mapApiPost),
    following: (data.following || []).filter(Boolean).map(mapApiPost),
    similar: (data.similar || []).filter(Boolean).map(mapApiPost),
  };
}

export async function fetchSmartReels(opts: FetchPostsOptions = {}): Promise<{ posts: Post[], nextCursor: string | null }> {
  const urlObj = new URL(`${(opts.baseUrl || API_BASE_URL).replace(/\/$/, "")}/api/social/reels`);
  if (opts.limit !== undefined) urlObj.searchParams.set("limit", String(opts.limit));
  if (opts.cursor) urlObj.searchParams.set("cursor", String(opts.cursor));
  if (opts.targetUserId) urlObj.searchParams.set("target_user_id", String(opts.targetUserId));
  if (opts.buffer_ids && opts.buffer_ids.length > 0) urlObj.searchParams.set("buffer_ids", opts.buffer_ids.join(","));
  if (opts.is_product_linked) urlObj.searchParams.set("is_product_linked", "true");
  if (opts.softCategory) urlObj.searchParams.set("soft_category", "true");

  const headers: any = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const json = await safeFetch<any>(urlObj.toString(), {
    method: "GET",
    headers,
    signal: opts.signal,
  });

  const apiPosts: any[] = json?.data?.posts && Array.isArray(json.data.posts) ? json.data.posts : [];
  return {
    posts: apiPosts.filter(Boolean).map(mapApiPost),
    nextCursor: json?.data?.nextCursor || null
  };
}

/**
 * Fetch trending background sounds from the global sound library
 */
export async function fetchTrendingSounds(token?: string | null) {
  const headers: any = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const json = await safeFetch<any>("/api/social/sounds/trending", { headers });
  return json?.data || [];
}

/**
 * Record usage of a specific sound
 */
export async function recordSoundUsage(soundId: number | string, token?: string | null) {
  const headers: any = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    await safeFetch(`/api/social/sounds/${soundId}/use`, { method: "POST", headers });
  } catch (err) { }
}
