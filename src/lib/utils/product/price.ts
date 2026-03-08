export function parseNumberLike(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = String(value).trim();
  if (s === "") return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parsePercent(value: unknown): number | null {
  if (value == null) return null;
  const s = String(value).replace("%", "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function computeDiscountedPrice(base: number | null, discountPercent: number | null) {
  if (base == null) return null;
  if (discountPercent == null) return base;
  return Math.round(base * (1 - discountPercent / 100));
}