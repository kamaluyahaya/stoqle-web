// src/lib/utils/idb.ts

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("stoqle_market_db", 1);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains("market_cache")) {
                db.createObjectStore("market_cache");
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function idbSet(key: string, val: any): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("market_cache", "readwrite");
    tx.objectStore("market_cache").put(val, key);
    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function idbGet<T>(key: string): Promise<T | null> {
    const db = await openDB();
    const tx = db.transaction("market_cache", "readonly");
    const request = tx.objectStore("market_cache").get(key);
    return new Promise<T | null>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
    });
}
