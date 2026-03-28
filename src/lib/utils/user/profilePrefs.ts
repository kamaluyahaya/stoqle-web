// src/lib/utils/user/profilePrefs.ts
export const USER_KEYS = {
  name_id: "user_name_id",
  bio: "user_bio",
  details: "user_details", // gender, dob, location, job, school
  profilePic: "user_profile_pic",
} as const;

const USER_DIRTY_KEY = "user_profile_dirty_keys";

/** Utilities for the dirty set (stored as JSON array) */
function readDirtySet(): string[] {
  try {
    const raw = localStorage.getItem(USER_DIRTY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeDirtySet(keys: string[]) {
  try {
    localStorage.setItem(USER_DIRTY_KEY, JSON.stringify([...new Set(keys)]));
  } catch { }
}

/** Public: mark a key as modified by the user (staged) */
export function markUserDirty(key: string) {
  try {
    const set = new Set(readDirtySet());
    set.add(key);
    writeDirtySet([...set]);
  } catch { }
}

/** Public: remove a key from the dirty set */
export function unmarkUserDirty(key: string) {
  try {
    const set = new Set(readDirtySet());
    set.delete(key);
    writeDirtySet([...set]);
  } catch { }
}

/** Public: clear all dirty markers */
export function clearUserDirty() {
  try {
    localStorage.removeItem(USER_DIRTY_KEY);
  } catch { }
}

/** Public: return dirty keys */
export function getUserDirtyKeys(): string[] {
  return readDirtySet();
}

/** Public: check if a key is dirty */
export function isUserDirty(key: string): boolean {
  try {
    return readDirtySet().includes(key);
  } catch {
    return false;
  }
}

/** load a single staged field (may be empty string or null) */
export async function loadUserField(key: string): Promise<string | null> {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** save a single staged field */
export async function saveUserField(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
  } catch { }
}

/** remove a single staged field */
export async function removeUserField(key: string): Promise<void> {
  try {
    localStorage.removeItem(key);
    unmarkUserDirty(key);
  } catch { }
}

/** clear all staged fields AND clear dirty markers */
export async function clearAllUserStaged(): Promise<void> {
  try {
    Object.values(USER_KEYS).forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch { }
    });
    localStorage.removeItem(USER_DIRTY_KEY);
  } catch { }
}

export function hasPendingUserSync(): boolean {
  try {
    const dirty = readDirtySet();
    return dirty.length > 0;
  } catch {
    return false;
  }
}
