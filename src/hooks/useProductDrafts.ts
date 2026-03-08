"use client";
import { useState, useEffect, useCallback } from "react";
import { ProductDraft } from "@/src/types/product";
import { cryptoRandomId } from "@/src/lib/utils/utils";

const DB_NAME = "StoqleDraftsDB";
const STORE_NAME = "product_drafts";
const DB_VERSION = 1;

/**
 * Simple IndexedDB wrapper to handle ProductDraft objects which include Files.
 */
class DraftsDB {
    private db: IDBDatabase | null = null;

    async init(): Promise<IDBDatabase> {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: "id" });
                }
            };
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(): Promise<ProductDraft[]> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async put(draft: ProductDraft): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(draft);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async delete(id: string): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

const dbInstance = new DraftsDB();

export default function useProductDrafts() {
    const [drafts, setDrafts] = useState<ProductDraft[]>([]);
    const [loading, setLoading] = useState(true);

    const loadDrafts = useCallback(async () => {
        try {
            const all = await dbInstance.getAll();
            setDrafts(all.sort((a, b) => b.lastSaved - a.lastSaved));
        } catch (e) {
            console.error("Failed to load drafts from IndexedDB", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDrafts();
    }, [loadDrafts]);

    const saveDraft = useCallback(async (data: Omit<ProductDraft, "id" | "lastSaved">, existingId?: string) => {
        const id = existingId || cryptoRandomId();
        const newDraft: ProductDraft = {
            ...data,
            id,
            lastSaved: Date.now(),
        };

        try {
            await dbInstance.put(newDraft);
            await loadDrafts(); // Refresh list
            return id;
        } catch (e) {
            console.error("Failed to save draft to IndexedDB", e);
            throw e;
        }
    }, [loadDrafts]);

    const deleteDraft = useCallback(async (id: string) => {
        try {
            await dbInstance.delete(id);
            await loadDrafts(); // Refresh list
        } catch (e) {
            console.error("Failed to delete draft from IndexedDB", e);
        }
    }, [loadDrafts]);

    return {
        drafts,
        loading,
        saveDraft,
        deleteDraft,
    };
}
