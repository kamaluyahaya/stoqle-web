/**
 * ChatDB — Stoqle Offline-First Messaging Store
 *
 * Architecture:
 *  - IndexedDB v3 with compound & single-field indexes
 *  - In-memory Map caches for sub-millisecond reads
 *  - Stale "processing" lock recovery (prevents stuck messages after crash/reload)
 *  - Media blob cache with TTL eviction (7 days)
 *  - Safe SSR guard — only initialises in the browser
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type MessageStatus = "sending" | "processing" | "sent" | "failed";

export interface CachedMessage {
  message_id: string | number;
  chat_room_id: string | number;
  sender_id: string | number;
  message_content: string;
  message_type: string;
  sent_at: string;
  status?: MessageStatus;
  file_url?: string;
  file_type?: string;
  file_name?: string;
  [key: string]: any;
}

export interface CachedRoom {
  chat_room_id: string | number;
  last_message?: string;
  updated_at: string;
  is_pinned?: boolean;
  pinned_at?: string | number | null;
  [key: string]: any;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DB_NAME = "stoqle_chat_v3";
const DB_VERSION = 3;
const MEDIA_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const STALE_PROCESSING_TTL_MS = 5 * 60 * 1000; // 5 min — after this, processing locks are released

// ─── ChatDB Class ────────────────────────────────────────────────────────────

class ChatDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  // In-memory layer for instant reads
  private messageCache = new Map<string | number, CachedMessage[]>();
  private roomCache: CachedRoom[] = [];

  // ── Init ──────────────────────────────────────────────────────────────────

  /** Safe singleton initialiser — no-ops on the server. */
  init(): Promise<IDBDatabase> {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") {
      return Promise.reject(new Error("IndexedDB is not available in this environment."));
    }
    if (this.db) return Promise.resolve(this.db);
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // ── messages store ──────────────────────────────────────────────────
        if (!db.objectStoreNames.contains("messages")) {
          const msgStore = db.createObjectStore("messages", { keyPath: "message_id" });
          msgStore.createIndex("by_room", "chat_room_id", { unique: false });
          msgStore.createIndex("by_sent_at", "sent_at", { unique: false });
          msgStore.createIndex("by_status", "status", { unique: false });
        } else {
          // Migrate: add missing indexes on existing store
          const tx = (event.target as IDBOpenDBRequest).transaction!;
          const store = tx.objectStore("messages");
          if (!store.indexNames.contains("by_status")) {
            store.createIndex("by_status", "status", { unique: false });
          }
        }

        // ── rooms store ─────────────────────────────────────────────────────
        if (!db.objectStoreNames.contains("rooms")) {
          db.createObjectStore("rooms", { keyPath: "chat_room_id" });
        }

        // ── media store ─────────────────────────────────────────────────────
        if (!db.objectStoreNames.contains("media")) {
          const mediaStore = db.createObjectStore("media", { keyPath: "url" });
          mediaStore.createIndex("by_timestamp", "timestamp", { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;

        // Handle unexpected DB close (e.g. version upgrade from another tab)
        this.db.onclose = () => {
          this.db = null;
          this.initPromise = null;
        };

        // Recover stale processing locks on startup
        this._recoverStaleLocks().catch(console.warn);

        // Evict old media blobs (non-blocking)
        this._evictStaleMedia().catch(console.warn);

        resolve(this.db);
      };

      request.onerror = () => {
        this.initPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn("[ChatDB] DB upgrade blocked — please close other tabs.");
      };
    });

    return this.initPromise;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Release processing locks that are older than STALE_PROCESSING_TTL_MS.
   *  This prevents messages from getting permanently stuck after a crash/reload. */
  private async _recoverStaleLocks(): Promise<void> {
    const db = await this.init();
    return new Promise<void>((resolve) => {
      const tx = db.transaction("messages", "readwrite");
      const store = tx.objectStore("messages");
      const index = store.index("by_status");
      const req = index.getAll(IDBKeyRange.only("processing"));

      req.onsuccess = () => {
        const stale = (req.result as CachedMessage[]).filter((m) => {
          const age = Date.now() - new Date(m.sent_at).getTime();
          return age > STALE_PROCESSING_TTL_MS;
        });
        stale.forEach((m) => store.put({ ...m, status: "sending" as MessageStatus }));
        tx.oncomplete = () => resolve();
      };
      req.onerror = () => resolve();
    });
  }

  /** Remove media blobs older than MEDIA_TTL_MS to keep storage lean. */
  private async _evictStaleMedia(): Promise<void> {
    const db = await this.init();
    return new Promise<void>((resolve) => {
      const tx = db.transaction("media", "readwrite");
      const store = tx.objectStore("media");
      const index = store.index("by_timestamp");
      const cutoff = Date.now() - MEDIA_TTL_MS;
      const range = IDBKeyRange.upperBound(cutoff);
      const req = index.openCursor(range);

      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  /** Safely run a transaction, returning a fallback value on error. */
  private async _runTx<T>(
    stores: string | string[],
    mode: IDBTransactionMode,
    fn: (tx: IDBTransaction) => Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      const db = await this.init();
      const tx = db.transaction(stores, mode);
      return await fn(tx);
    } catch (err) {
      console.error("[ChatDB] Transaction error:", err);
      return fallback;
    }
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  /** Upsert messages into IndexedDB and update the in-memory cache. */
  async saveMessages(messages: CachedMessage[]): Promise<boolean> {
    if (!messages.length) return true;

    // ⚡ Update memory cache optimistically
    const byRoom = new Map<string | number, CachedMessage[]>();
    messages.forEach((msg) => {
      const rid = msg.chat_room_id;
      if (!byRoom.has(rid)) byRoom.set(rid, []);
      byRoom.get(rid)!.push(msg);
    });

    byRoom.forEach((newMsgs, roomId) => {
      const existing = this.messageCache.get(roomId) ?? [];
      const merged = [...existing];
      newMsgs.forEach((nm) => {
        const idx = merged.findIndex((m) => String(m.message_id) === String(nm.message_id));
        if (idx >= 0) merged[idx] = nm;
        else merged.push(nm);
      });
      merged.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
      this.messageCache.set(roomId, merged);
    });

    return this._runTx<boolean>("messages", "readwrite", (tx) => {
      return new Promise<boolean>((resolve, reject) => {
        const store = tx.objectStore("messages");
        messages.forEach((msg) => store.put(msg));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }, false);
  }

  /** Delete specific message IDs and patch the in-memory cache accordingly. */
  async deleteMessages(ids: (string | number)[]): Promise<boolean> {
    if (!ids.length) return true;

    // Remove from memory cache
    const idSet = new Set(ids.map(String));
    this.messageCache.forEach((msgs, roomId) => {
      const filtered = msgs.filter((m) => !idSet.has(String(m.message_id)));
      if (filtered.length !== msgs.length) this.messageCache.set(roomId, filtered);
    });

    return this._runTx<boolean>("messages", "readwrite", (tx) => {
      return new Promise<boolean>((resolve, reject) => {
        const store = tx.objectStore("messages");
        ids.forEach((id) => store.delete(id));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }, false);
  }

  /** Get messages for a room — memory-first, then IndexedDB. */
  async getMessages(chatRoomId: string | number, limit = 100): Promise<CachedMessage[]> {
    // ⚡ Instant memory read
    if (this.messageCache.has(chatRoomId)) {
      const cached = this.messageCache.get(chatRoomId)!;
      return cached.slice(-limit);
    }

    return this._runTx<CachedMessage[]>("messages", "readonly", (tx) => {
      return new Promise<CachedMessage[]>((resolve) => {
        const store = tx.objectStore("messages");
        const index = store.index("by_room");
        const req = index.getAll(IDBKeyRange.only(chatRoomId));
        req.onsuccess = () => {
          const sorted = (req.result as CachedMessage[]).sort(
            (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
          );
          // Warm the memory cache for subsequent reads
          this.messageCache.set(chatRoomId, sorted);
          resolve(sorted.slice(-limit));
        };
        req.onerror = () => resolve([]);
      });
    }, []);
  }

  /**
   * Efficiently retrieve only messages in 'sending' status using the by_status index.
   * Skips 'processing' messages — those are handled by the active session.
   */
  async getPendingMessages(): Promise<CachedMessage[]> {
    return this._runTx<CachedMessage[]>("messages", "readonly", (tx) => {
      return new Promise<CachedMessage[]>((resolve) => {
        const store = tx.objectStore("messages");
        const index = store.index("by_status");
        const req = index.getAll(IDBKeyRange.only("sending"));
        req.onsuccess = () => resolve(req.result as CachedMessage[]);
        req.onerror = () => resolve([]);
      });
    }, []);
  }

  /** Invalidate the in-memory cache for a specific room (forces a fresh DB read next time). */
  invalidateRoom(chatRoomId: string | number): void {
    this.messageCache.delete(chatRoomId);
  }

  /** Invalidate all in-memory message caches. */
  clearMessageCache(): void {
    this.messageCache.clear();
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────

  /** Upsert rooms and update the in-memory room cache. */
  async saveRooms(rooms: CachedRoom[]): Promise<void> {
    this.roomCache = rooms;
    return this._runTx<void>("rooms", "readwrite", (tx) => {
      return new Promise<void>((resolve) => {
        const store = tx.objectStore("rooms");
        rooms.forEach((r) => store.put(r));
        tx.oncomplete = () => resolve();
      });
    }, undefined as any);
  }

  /** Get all rooms — memory-first, then IndexedDB. Sorted newest-first. */
  async getRooms(): Promise<CachedRoom[]> {
    if (this.roomCache.length > 0) return this.roomCache;

    return this._runTx<CachedRoom[]>("rooms", "readonly", (tx) => {
      return new Promise<CachedRoom[]>((resolve) => {
        const req = tx.objectStore("rooms").getAll();
        req.onsuccess = () => {
          const sorted = (req.result as CachedRoom[]).sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
          this.roomCache = sorted;
          resolve(sorted);
        };
        req.onerror = () => resolve([]);
      });
    }, []);
  }

  // ── Media ──────────────────────────────────────────────────────────────────

  /** Cache a media blob keyed by URL with a TTL timestamp. */
  async cacheMedia(url: string, blob: Blob): Promise<void> {
    return this._runTx<void>("media", "readwrite", (tx) => {
      return new Promise<void>((resolve) => {
        tx.objectStore("media").put({ url, blob, timestamp: Date.now() });
        tx.oncomplete = () => resolve();
      });
    }, undefined as any);
  }

  /** Retrieve a cached media blob — returns null if not cached or expired. */
  async getMedia(url: string): Promise<Blob | null> {
    return this._runTx<Blob | null>("media", "readonly", (tx) => {
      return new Promise<Blob | null>((resolve) => {
        const req = tx.objectStore("media").get(url);
        req.onsuccess = () => {
          const entry = req.result;
          if (!entry) return resolve(null);
          // Inline TTL check
          if (Date.now() - entry.timestamp > MEDIA_TTL_MS) return resolve(null);
          resolve(entry.blob ?? null);
        };
        req.onerror = () => resolve(null);
      });
    }, null);
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const chatDb = new ChatDB();
