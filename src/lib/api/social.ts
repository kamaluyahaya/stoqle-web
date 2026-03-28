/**
 * Social API service
 * - centralizes fetch logic and mapping from API payload -> Post
 * - exports: fetchSocialPosts, fetchSocialPostById, prefetchMediaConservative
 */

import type { Post } from "@/src/lib/types";

const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;
const NO_IMAGE_PLACEHOLDER = "https://via.placeholder.com/800x600?text=No+Image";

const isVideoUrl = (u?: string) => !!u && VIDEO_EXT_RE.test(u);

/**
 * Map an API response post to our frontend Post shape.
 * Keep this deterministic and side-effect free.
 */
export const mapApiPost = (p: any): Post => {
  const apiId = p.social_post_id ?? Math.floor(Math.random() * 1e6);
  let src: string | undefined;
  let thumbnail: string | undefined;
  const images = Array.isArray(p.images) ? p.images : [];
  
  if (p.cover_type === "video") {
    const videoFile = images.find((i: any) => isVideoUrl(i.image_url));
    const coverFile = images.find((i: any) => !!i.is_cover);
    
    src = videoFile?.image_url;
    thumbnail = coverFile?.image_url;
    
    // Fallback if no video file found but cover exists
    if (!src) src = coverFile?.image_url;
  } else if (images.length > 0) {
    const cover = images.find((i: any) => !!i.is_cover) ?? images[0];
    src = cover?.image_url;
  }

  const allMedia = images.length > 0
    ? images.map((i: any) => ({ url: i.image_url, id: i.social_post_image_id || i.post_image_id || i.id }))
    : src ? [{ url: src, id: p.cover_id || null }] : [];
  
  if (!src && p.cover_type !== "note") {
    src = NO_IMAGE_PLACEHOLDER;
  }
  const isVideo = p.cover_type === "video" || isVideoUrl(src);
  const caption = p.text ?? p.subtitle ?? "";
  const note_caption = p.subtitle ?? "";
  return {
    id: apiId,
    apiId,
    src,
    isVideo,
    caption,
    note_caption,
    user: {
      id: p.user_id ?? p.user?.user_id ?? p.user?.id ?? 0,
      name: p.author_name ?? "Unknown",
      avatar: p.author_pic ?? `https://i.pravatar.cc/100?u=${p.user_id ?? apiId}`,
    },
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
  };
};

type FetchPostsOptions = {
  baseUrl?: string;
  signal?: AbortSignal;
  limit?: number;
  offset?: number;
  category?: string;
  token?: string | null;
};

/**
 * Fetch list of posts from backend and map them to Post[]
 */
export async function fetchSocialPosts(opts: FetchPostsOptions = {}) {
  const base = opts.baseUrl ?? process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined");

  const url = new URL(`${base.replace(/\/$/, "")}/api/social/`);
  if (opts.limit !== undefined) url.searchParams.set("limit", String(opts.limit));
  if (opts.offset !== undefined) url.searchParams.set("offset", String(opts.offset));
  if (opts.category !== undefined) url.searchParams.set("category", String(opts.category));

  const headers: any = { Accept: "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(url.toString(), {
    signal: opts.signal,
    headers
  });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = await res.json();
  const apiPosts: any[] = json?.data?.posts && Array.isArray(json.data.posts) ? json.data.posts : [];
  return apiPosts.map(mapApiPost);
}

/**
 * Fetch a single post by ID
 */
export async function fetchSocialPostById(postId: number, opts: FetchPostsOptions = {}) {
  const base = opts.baseUrl ?? process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined");

  const res = await fetch(`${base.replace(/\/$/, "")}/api/social/${postId}`, {
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Post not found (${res.status})`);
  const json = await res.json();
  return mapApiPost(json?.data ?? json);
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
            try {
              const res = await fetch(u, { cache: "no-store" });
              if (!res.ok) return;
              cache.put(req, res.clone()).catch(() => { });
              usedMb += 0.5; // best-effort estimate
            } catch (e) { }
          });
          if (usedMb > maxMb) break;
        } catch (e) {
          console.warn("prefetch error", e);
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }).map(() => worker()));
  } catch (err) {
    console.warn("prefetchMediaConservative failed", err);
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
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base.replace(/\/$/, "")}/api/social/`);
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
        reject(new Error(json?.message || "Failed to create post"));
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
  const base = process.env.NEXT_PUBLIC_API_URL || "";
  const res = await fetch(`${base.replace(/\/$/, "")}/api/social/${postId}/like`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || "Failed to toggle like");
  return json;
}

/**
 * Log activity for a social post (view, save, share, etc.)
 */
export async function logSocialActivity(
  activity: { social_post_id: number; action_type: string; category?: string; watch_time?: number },
  token?: string
) {
  const base = process.env.NEXT_PUBLIC_API_URL || "";
  if (!base) return;

  try {
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${base.replace(/\/$/, "")}/api/social/activity`, {
      method: "POST",
      headers,
      body: JSON.stringify(activity),
    }).catch(() => { }); // fire and forget
  } catch (e) {
    console.error("Failed to log social activity", e);
  }
}

/**
 * Fetch a personalized discovery feed
 */
export async function fetchDiscoverFeed(opts: FetchPostsOptions = {}) {
  const base = opts.baseUrl ?? process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined");

  const url = new URL(`${base.replace(/\/$/, "")}/api/social/discover`);
  if (opts.limit !== undefined) url.searchParams.set("limit", String(opts.limit));
  if (opts.offset !== undefined) url.searchParams.set("offset", String(opts.offset));

  const headers: any = { Accept: "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(url.toString(), {
    signal: opts.signal,
    headers
  });

  if (!res.ok) throw new Error(`Discovery API returned ${res.status}`);
  const json = await res.json();
  const data = json?.data || {};

  return {
    forYou: (data.for_you || []).map(mapApiPost),
    trending: (data.trending || []).map(mapApiPost),
    following: (data.following || []).map(mapApiPost),
    similar: (data.similar || []).map(mapApiPost),
  };
}
