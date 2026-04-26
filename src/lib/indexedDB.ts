/**
 * IndexedDB utility for persistent image caching.
 * Provides a native-app-like experience by storing media locally.
 */

const DB_NAME = "StoqleMediaCache";
const DB_VERSION = 1;
const STORE_NAME = "images";

export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedImage(url: string): Promise<Blob | null> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(url);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("IndexedDB get error:", err);
    return null;
  }
}

export async function saveImageToCache(url: string, blob: Blob): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(blob, url);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("IndexedDB save error:", err);
  }
}

/**
 * Fetches an image and caches it in IndexedDB.
 * Returns a Blob URL that can be used as src.
 */
export async function getOrFetchImage(url: string): Promise<string> {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return url;

  // 1. Try to get from IndexedDB
  const cachedBlob = await getCachedImage(url);
  if (cachedBlob) {
    return URL.createObjectURL(cachedBlob);
  }

  // 2. Fetch from network
  try {
    // 🛡️ SECURITY & CORS SAFETY:
    // Skip caching for external domains that don't explicitly allow CORS fetch (e.g. Google, Pravatar).
    // These are already served from CDNs, so local caching is less critical than our own uploaded media.
    const isExternal = url.includes("googleusercontent.com") || url.includes("pravatar.cc") || url.includes("facebook.com");
    if (isExternal) return url;

    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error("HTTP error " + response.status);
    
    const blob = await response.blob();
    
    // 3. Save to IndexedDB (don't await to not block the UI)
    saveImageToCache(url, blob);
    
    return URL.createObjectURL(blob);
  } catch (err) {
    // Graceful fallback: return original URL without caching if fetch fails (usually CORS)
    return url;
  }
}
