// src/utils/profilePrefs.ts
export const KEYS = {
  name: "business_name",
  shipping: "business_shipping_info",
  refunds: "business_return_refunds",
  payment: "business_payment_info",
  customerService: "business_customer_service",
  address: "business_address_info",
  market: "business_market_affiliation",
  promo: "business_promotional_sale",
  discount: "business_sales_discount",
  region: "business_region",
  shopProfile: "business_shop_profile",
} as const;

const DIRTY_KEY = "business_policy_dirty_keys";

/** Utilities for the dirty set (stored as JSON array) */
function readDirtySet(): string[] {
  try {
    const raw = localStorage.getItem(DIRTY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}
function writeDirtySet(keys: string[]) {
  try {
    localStorage.setItem(DIRTY_KEY, JSON.stringify([...new Set(keys)]));
  } catch { }
}

/** Public: mark a key as modified by the user (staged) */
export function markDirty(key: string) {
  try {
    const set = new Set(readDirtySet());
    set.add(key);
    writeDirtySet([...set]);
  } catch { }
}

/** Public: remove a key from the dirty set */
export function unmarkDirty(key: string) {
  try {
    const set = new Set(readDirtySet());
    set.delete(key);
    writeDirtySet([...set]);
  } catch { }
}

/** Public: clear all dirty markers */
export function clearDirty() {
  try {
    localStorage.removeItem(DIRTY_KEY);
  } catch { }
}

/** Public: return dirty keys */
export function getDirtyKeys(): string[] {
  return readDirtySet();
}

/** Public: check if a key is dirty */
export function isDirty(key: string): boolean {
  try {
    return readDirtySet().includes(key);
  } catch {
    return false;
  }
}

/** load a single staged field (may be empty string or null) */
export async function loadField(key: string): Promise<string | null> {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** save a single staged field (this does NOT automatically mark dirty;
 *  call markDirty(key) from UI code when user explicitly edits) */
export async function saveField(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
  } catch { }
}

/** remove a single staged field */
export async function removeField(key: string): Promise<void> {
  try {
    localStorage.removeItem(key);
    unmarkDirty(key);
  } catch { }
}

/**
 * clearAll: remove all staged fields AND clear dirty markers.
 * Use this after a successful server sync.
 */
export async function clearAll(): Promise<void> {
  try {
    Object.values(KEYS).forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch { }
    });
    // also remove dirty marker
    localStorage.removeItem(DIRTY_KEY);
  } catch { }
}

/**
 * hasPendingPrefsDataSync:
 * Returns true only if there are explicit dirty keys (i.e. the user edited something),
 * NOT simply because server-mapped state differs from storage.
 */
export function hasPendingPrefsDataSync(): boolean {
  try {
    const dirty = readDirtySet();
    return dirty.length > 0;
  } catch {
    return false;
  }
}
