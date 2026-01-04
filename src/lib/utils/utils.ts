// src/lib/utils.ts
export function cryptoRandomId(length = 7) {
  return Math.random().toString(36).slice(2, 2 + length);
}
