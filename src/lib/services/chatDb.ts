/**
 * ChatDB: A high-performance IndexedDB wrapper for Stoqle Messaging
 * Purpose: Instant local rendering and offline-first data access
 */

export interface CachedMessage {
  message_id: string | number;
  chat_room_id: string | number;
  sender_id: string | number;
  message_content: string;
  message_type: string;
  sent_at: string;
  status?: "sending" | "sent" | "failed";
  file_url?: string;
  file_type?: string;
  [key: string]: any;
}

export interface CachedRoom {
  chat_room_id: string | number;
  last_message?: string;
  updated_at: string;
  [key: string]: any;
}

class ChatDB {
  private dbName = "stoqle_chat_v1";
  private db: IDBDatabase | null = null;
  private messageCache = new Map<string | number, CachedMessage[]>();
  private roomCache: CachedRoom[] = [];

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 2);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains("messages")) {
          const msgStore = db.createObjectStore("messages", { keyPath: "message_id" });
          msgStore.createIndex("chat_room_id", "chat_room_id", { unique: false });
          msgStore.createIndex("sent_at", "sent_at", { unique: false });
        }

        if (!db.objectStoreNames.contains("rooms")) {
          db.createObjectStore("rooms", { keyPath: "chat_room_id" });
        }

        if (!db.objectStoreNames.contains("media")) {
          db.createObjectStore("media", { keyPath: "url" });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // --- Messages ---
  async saveMessages(messages: CachedMessage[]) {
    if (messages.length > 0) {
      const roomId = messages[0].chat_room_id;
      this.messageCache.set(roomId, messages);
    }

    const db = await this.init();
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    
    messages.forEach(msg => {
      // Don't overwrite sending status with stale data if needed, 
      // but usually API data is the source of truth
      store.put(msg);
    });

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
    });
  }

  async deleteMessages(ids: (string | number)[]) {
    const db = await this.init();
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    ids.forEach(id => store.delete(id));
    this.messageCache.clear();
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
    });
  }

  async getMessages(chatRoomId: string | number, limit = 50): Promise<CachedMessage[]> {
    // ⚡ ULTRA FAST: Try memory cache first
    if (this.messageCache.has(chatRoomId)) {
      return this.messageCache.get(chatRoomId)!;
    }

    const db = await this.init();
    return new Promise((resolve) => {
      const tx = db.transaction("messages", "readonly");
      const store = tx.objectStore("messages");
      const index = store.index("chat_room_id");
      const request = index.getAll(IDBKeyRange.only(chatRoomId));

      request.onsuccess = () => {
        const results = request.result;
        // Sort by date descending locally then return reversed for UI
        const sorted = results.sort((a, b) => 
          new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
        );
        resolve(sorted.slice(-limit));
      };
      request.onerror = () => resolve([]);
    });
  }

  // --- Rooms ---
  async saveRooms(rooms: CachedRoom[]) {
    this.roomCache = rooms;
    const db = await this.init();
    const tx = db.transaction("rooms", "readwrite");
    const store = tx.objectStore("rooms");
    rooms.forEach(room => store.put(room));
  }

  async getRooms(): Promise<CachedRoom[]> {
    // ⚡ ULTRA FAST: Try memory cache first
    if (this.roomCache.length > 0) {
      return this.roomCache;
    }

    const db = await this.init();
    return new Promise((resolve) => {
      const tx = db.transaction("rooms", "readonly");
      const store = tx.objectStore("rooms");
      const request = store.getAll();
      request.onsuccess = () => {
        const sorted = request.result.sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        resolve(sorted);
      };
      request.onerror = () => resolve([]);
    });
  }

  // --- Media Caching (Blobs) ---
  async cacheMedia(url: string, blob: Blob) {
    const db = await this.init();
    const tx = db.transaction("media", "readwrite");
    tx.objectStore("media").put({ url, blob, timestamp: Date.now() });
  }

  async getMedia(url: string): Promise<Blob | null> {
    const db = await this.init();
    return new Promise((resolve) => {
      const tx = db.transaction("media", "readonly");
      const request = tx.objectStore("media").get(url);
      request.onsuccess = () => resolve(request.result?.blob || null);
      request.onerror = () => resolve(null);
    });
  }
}

export const chatDb = new ChatDB();
