// src/lib/mediaCache.ts
export const MEDIA_CACHE = "media-cache-v1";

export async function cachedBlobUrl(url: string, cacheKey?: string) {
  try {
    const cache = await caches.open(MEDIA_CACHE);
    const key = cacheKey ?? url;
    const cached = await cache.match(key);
    if (cached) {
      const blob = await cached.blob();
      return URL.createObjectURL(blob);
    }
    // fallback: return original url (no caching)
    return url;
  } catch (err) {
    console.warn("cachedBlobUrl fail", err);
    return url;
  }
}
