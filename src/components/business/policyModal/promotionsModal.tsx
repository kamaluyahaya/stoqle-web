"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { getNextZIndex } from "@/src/lib/utils/z-index";

// Types
export type Occasion = {
  name: string;
  windowStart: string; // ISO date YYYY-MM-DD
  windowEnd: string; // ISO date YYYY-MM-DD
};

export type PromotionPayload = {
  occasion: string;
  start: string;
  end: string;
  discount: number; // percent
  isActive?: boolean;
};

type Props = {
  open: boolean;
  prefKey: string;
  discountPrefKey?: string;
  initialValue?: string | null;
  occasions?: Occasion[];
  onClose: () => void;
  onSave?: (payloadJson: string) => Promise<void> | void;
};

export function isoDate(d: Date) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

export function parseIsoToLocalDate(iso: string) {
  if (!iso || typeof iso !== "string") return new Date(NaN);
  // keep only the date portion if a time exists
  const datePart = iso.split("T")[0];
  const parts = datePart.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const day = Number(parts[2]);
  return new Date(y, m - 1, day);
}




export const make = (name: string, month0Index: number, day: number, y: number) => {
  const core = new Date(y, month0Index, day);
  const start = addDays(core, -7);
  const end = addDays(core, 7);
  return { name, windowStart: isoDate(start), windowEnd: isoDate(end) };
};

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}



export function toLocalDateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// parse either "YYYY-MM-DD" or full ISO "2026-01-03T00:00:00.000Z" into a local Date at midnight
export function parseAnyDateToLocalMidnight(s: string) {
  if (!s || typeof s !== "string") return new Date(NaN);

  // if it contains a 'T' (full ISO) or time zone marker, use Date(iso)
  if (s.includes("T") || s.includes("Z") || s.length > 10) {
    const d = new Date(s);
    if (isNaN(d.getTime())) return new Date(NaN);
    return toLocalDateOnly(d);
  }

  // otherwise expect "YYYY-MM-DD"
  const parts = s.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const day = Number(parts[2]);
  if ([y, m, day].some((n) => !Number.isFinite(n))) return new Date(NaN);
  return new Date(y, m - 1, day);
}

export function generateDefaultOccasions(mounted: boolean): Occasion[] {
  if (!mounted) return [];

  const now = new Date();
  const year = now.getFullYear();

  // Comprehensive fixed-date events (month index 0-based)
  const events: Array<[string, number, number]> = [
    ["New Year", 0, 1],
    ["Epiphany", 0, 6],
    ["Valentine's Day", 1, 14],

    // Islamic Events (approximate - changes yearly)
    ["Ramadan Begins", 1, 18],
    ["Iftar Mubarak", 1, 18], // start of Ramadan period
    ["Eid al-Fitr (Sallah)", 2, 20],
    ["Eid al-Adha (Sallah)", 4, 27],

    ["St. Patrick's Day", 2, 17],
    ["Mother's Day", 4, 1],
    ["Easter Monday", 3, 13],
    ["International Workers' Day", 4, 1],
    ["Children's Day", 4, 27],
    ["Democracy Day", 5, 12],
    ["Father's Day", 5, 1],
    ["Independence Day", 9, 1],
    ["Halloween", 9, 31],
    ["Black Friday", 10, 27],
    ["Christmas Eve", 11, 24],
    ["Christmas Day", 11, 25],
    ["Boxing Day", 11, 26],
    ["New Year's Eve", 11, 31],
  ];

  const years = [year - 1, year, year + 1];
  const built: Occasion[] = [];

  // demo sale around today for testing
  built.push({
    name: "Promo Sale",
    windowStart: isoDate(addDays(now, -7)),
    windowEnd: isoDate(addDays(now, 7)),
  });

  // Black Friday broad windows per year (approx last-week window)
  years.forEach((y) =>
    built.push({
      name: "Black Friday",
      windowStart: isoDate(new Date(y, 10, 20)),
      windowEnd: isoDate(new Date(y, 11, 2)),
    })
  );

  // push all fixed-date events (these will be refined by computed movable ones afterwards)
  years.forEach((y) => events.forEach(([name, m, d]) => built.push(make(name, m, d, y))));

  // compute movable holidays (Easter, Good Friday, Mother's Day 2nd Sunday May, Father's Day 3rd Sunday June)
  function getEasterSunday(y: number): Date {
    // Anonymous Gregorian algorithm
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-based
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month, day);
  }

  function nthWeekdayOfMonth(y: number, monthIndex: number, weekday: number, n: number): Date {
    const first = new Date(y, monthIndex, 1);
    const firstWeekday = first.getDay();
    const offset = (weekday - firstWeekday + 7) % 7;
    const day = 1 + offset + (n - 1) * 7;
    return new Date(y, monthIndex, day);
  }

  years.forEach((y) => {
    built.push({
      name: "Ramadan Kareem",
      windowStart: isoDate(new Date(y, 1, 18)), // Feb 18
      windowEnd: isoDate(new Date(y, 2, 20)),   // Mar 20
    });

    built.push({
      name: "Eid al-Fitr (Sallah)",
      windowStart: isoDate(new Date(y, 2, 18)),
      windowEnd: isoDate(new Date(y, 2, 27)),
    });

    built.push({
      name: "Iftar Mubarak",
      windowStart: isoDate(new Date(y, 1, 18)),
      windowEnd: isoDate(new Date(y, 2, 20)),
    });
  });

  years.forEach((y) => {
    const easter = getEasterSunday(y);
    const goodFriday = addDays(easter, -2);
    const easterMonday = addDays(easter, 1);
    const mothersDay = nthWeekdayOfMonth(y, 4, 0, 2); // 2nd Sunday of May
    const fathersDay = nthWeekdayOfMonth(y, 5, 0, 3); // 3rd Sunday of June

    built.push(make("Good Friday", goodFriday.getMonth(), goodFriday.getDate(), y));
    built.push(make("Easter Sunday", easter.getMonth(), easter.getDate(), y));
    built.push(make("Easter Monday", easterMonday.getMonth(), easterMonday.getDate(), y));
    built.push(make("Mother's Day", mothersDay.getMonth(), mothersDay.getDate(), y));
    built.push(make("Father's Day", fathersDay.getMonth(), fathersDay.getDate(), y));

    // Optional Islamic holidays: keep placeholders (these have invalid date strings so they will be ignored by availability checks)
    built.push({ name: `Eid al-Fitr (set manually for ${y})`, windowStart: "-", windowEnd: "-" });
    built.push({ name: `Eid al-Adha (set manually for ${y})`, windowStart: "-", windowEnd: "-" });
  });

  const map = new Map<string, Occasion>();
  built.forEach((o) => map.set(`${o.name}::${o.windowStart}`, o));
  return Array.from(map.values());
}

export function getAvailableOccasionsFrom(occasions: Occasion[]) {
  const now = toLocalDateOnly(new Date());
  return occasions.filter((o) => {
    try {
      const s = parseAnyDateToLocalMidnight(o.windowStart);
      const e = parseAnyDateToLocalMidnight(o.windowEnd);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;
      if (e < s) e.setFullYear(e.getFullYear() + 1);
      return now >= toLocalDateOnly(s) && now <= toLocalDateOnly(e);
    } catch {
      return false;
    }
  });
}


function parseJsonSafe<T>(s?: string | null): T[] {
  try {
    if (!s) return [];
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed as T[];
    return [];
  } catch {
    return [];
  }
}


// Helper used for validation safety (not strictly required with parseCampaignWindow but kept for robustness)
function ensureEndNotBeforeStart(startDateObj: Date, endDateObj: Date, windowEndObj: Date) {
  const e = new Date(endDateObj.getTime());
  let safety = 0;
  while (e < startDateObj && safety < 5) {
    e.setFullYear(e.getFullYear() + 1);
    safety += 1;
    if (e > windowEndObj) break;
  }
  if (e < startDateObj) return new Date(startDateObj.getTime());
  if (e > windowEndObj) return new Date(windowEndObj.getTime());
  return e;
}

export default function PromotionsModal({
  open,
  prefKey,
  discountPrefKey = "business_sales_discount",
  initialValue = null,
  occasions,
  onClose,
  onSave,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [modalZIndex, setModalZIndex] = useState(() => getNextZIndex());
  useEffect(() => {
    if (open) {
      setModalZIndex(getNextZIndex());
    }
  }, [open]);
  useEffect(() => setMounted(true), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // editor state
  // selectedOccasionKey is the stable key: `${name}::${windowStart}`
  const [selectedOccasionKey, setSelectedOccasionKey] = useState<string | null>(null);
  const [selectedOccasionName, setSelectedOccasionName] = useState<string | null>(null);

  // auto-assigned, not editable by user
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [discount, setDiscount] = useState<number>(0);
  const [hasChanges, setHasChanges] = useState(false);

  const [joined, setJoined] = useState<PromotionPayload[]>([]);

  const defaultOccasions = useMemo<Occasion[]>(() => {
    return generateDefaultOccasions(mounted);
  }, [mounted]);

  const allOccasions = (occasions && occasions.length) ? occasions : defaultOccasions;

  const availableOccasions = useMemo(() => {
    if (!mounted) return [];
    return getAvailableOccasionsFrom(allOccasions);
  }, [allOccasions, mounted]);



  // parseCampaignWindow
  function parseCampaignWindow(occ: Occasion) {
    const start = parseAnyDateToLocalMidnight(occ.windowStart);
    const end = parseAnyDateToLocalMidnight(occ.windowEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return { start, end };
    if (end < start) end.setFullYear(end.getFullYear() + 1);
    return { start: toLocalDateOnly(start), end: toLocalDateOnly(end) };
  }

  function displayDateOnly(dateStr: string) {
    if (!dateStr) return "";
    return dateStr.slice(0, 10); // YYYY-MM-DD
  }

  // getAvailableOccasionsFrom moved outside

  function normalizePromotionItem(p: any): PromotionPayload {
    if (!p || typeof p !== "object") return p;

    return {
      occasion: String(p.occasion ?? ""),
      start: normalizeDateOnly(String(p.start ?? "")),
      end: normalizeDateOnly(String(p.end ?? "")),
      discount: Number(p.discount) || 0,

      // ✅ strict boolean coercion
      isActive:
        p.isActive === true ||
        p.isActive === 1 ||
        p.isActive === "1",
    };
  }


  useEffect(() => {
    if (!mounted || !open) return;

    setLoading(true);

    try {
      const fromStorage = parseJsonSafe<PromotionPayload>(localStorage.getItem(prefKey));
      const fromInit = parseJsonSafe<PromotionPayload>(initialValue);
      const initialJoinedRaw = fromInit.length ? fromInit : fromStorage;

      // normalize every item we load from storage or initial props
      const initialJoined = Array.isArray(initialJoinedRaw)
        ? initialJoinedRaw.map((p) => normalizePromotionItem(p))
        : [];

      setJoined(initialJoined);

      const discountObjRaw = parseJsonSafe<{ type?: string; discount?: number }>(localStorage.getItem(discountPrefKey))
        ?? parseJsonSafe(initialValue as string);

      const discountObj = Array.isArray(discountObjRaw) ? discountObjRaw[0] : discountObjRaw;
      if (discountObj && typeof discountObj.discount === "number") setDiscount(discountObj.discount);

      // reset editor selections
      setSelectedOccasionKey(null);
      setSelectedOccasionName(null);
      setStartDate("");
      setEndDate("");
    } finally {
      setLoading(false);
    }
  }, [open, prefKey, discountPrefKey, initialValue, mounted]);

  // humanDateLabel

  const selectedOccasionWindow = useMemo(() => {
    if (!mounted) return { min: "", max: "" };
    if (!selectedOccasionKey) return { min: "", max: "" };
    const found = allOccasions.find((o) => `${o.name}::${o.windowStart}` === selectedOccasionKey);
    if (!found) return { min: "", max: "" };
    return { min: found.windowStart, max: found.windowEnd };
  }, [allOccasions, selectedOccasionKey, mounted]);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  useEffect(() => {
    if (!mounted || !open) return;

    setLoading(true);

    try {
      const fromStorage = parseJsonSafe<PromotionPayload>(localStorage.getItem(prefKey));
      const fromInit = parseJsonSafe<PromotionPayload>(initialValue);
      const initialJoined = fromInit.length ? fromInit : fromStorage;
      // setJoined(initialJoined);

      const discountObjRaw = parseJsonSafe<{ type?: string; discount?: number }>(localStorage.getItem(discountPrefKey))
        ?? parseJsonSafe(initialValue as string);

      const discountObj = Array.isArray(discountObjRaw) ? discountObjRaw[0] : discountObjRaw;
      if (discountObj && typeof discountObj.discount === "number") setDiscount(discountObj.discount);

      // reset editor selections
      setSelectedOccasionKey(null);
      setSelectedOccasionName(null);
      setStartDate("");
      setEndDate("");
    } finally {
      setLoading(false);
    }
  }, [open, prefKey, discountPrefKey, initialValue, mounted]);

  function validateCampaign(): string | null {
    if (!selectedOccasionKey) return "Please select an occasion to join.";
    if (!startDate || !endDate) return "Campaign dates not set (internal error).";

    const s = toLocalDateOnly(parseIsoToLocalDate(startDate));
    const e = toLocalDateOnly(parseIsoToLocalDate(endDate));

    const occ = allOccasions.find((o) => `${o.name}::${o.windowStart}` === selectedOccasionKey);
    if (!occ) return "Selected occasion not available.";

    const { start: ws, end: we } = parseCampaignWindow(occ);

    // ensure e is not before s (safety)
    const eAdjusted = ensureEndNotBeforeStart(s, e, we);

    if (s > eAdjusted) return "Campaign dates invalid (start after end).";
    if (s < ws || eAdjusted > we) return `Campaign dates must be within ${isoDate(ws)} — ${isoDate(we)}.`;
    if (!(discount > 0)) return "Please set a discount greater than 0%.";
    return null;
  }
  function normalizeDateOnly(dateStr: string) {
    if (!dateStr || typeof dateStr !== "string") return dateStr;
    return dateStr.slice(0, 10); // YYYY-MM-DD
  }

  async function handleSave() {
    // 👇 only validate if user is actively editing/joining
    //   if (selectedOccasionKey) {
    //     const err = validateCampaign();
    //     if (err) {
    //       toast(err);
    //       return;
    //     }
    //     const payloadJson = JSON.stringify(joined || []); // ✅ ensures empty array
    // localStorage.setItem(prefKey, payloadJson);
    // if (onSave) await onSave(payloadJson);

    //   }

    setSaving(true);
    try {
      // at this point joined[] is already correct
      // const payloadJson = JSON.stringify(joined || []);
      // localStorage.setItem(prefKey, payloadJson);

      // if (onSave) await onSave(payloadJson);

      toast.success("Campaigns saved");
      onClose();
    } finally {
      setSaving(false);
    }
  }


  async function saveCampaignJoin() {
    const err = validateCampaign();
    if (err) return toast(err);
    setSaving(true);
    try {
      const occName = selectedOccasionName ?? (selectedOccasionKey ? allOccasions.find(o => `${o.name}::${o.windowStart}` === selectedOccasionKey)?.name : undefined);

      const newPromo: PromotionPayload = {
        occasion: occName!,
        start: normalizeDateOnly(startDate),
        end: normalizeDateOnly(endDate),
        discount: Number(discount),
        isActive: true, // new joins are active by default
      };

      // Ensure only one campaign is active at a time: disable others when joining/enabling
      const updated = [
        ...(joined || []).map((c) => ({ ...c, isActive: false })).filter((c) => c.occasion !== newPromo.occasion),
        newPromo,
      ];

      localStorage.setItem(prefKey, JSON.stringify(updated));
      setJoined(updated);
      setHasChanges(true);
      if (onSave) await onSave(JSON.stringify(updated));
      toast.success("Campaign joined/updated");

      setSelectedOccasionKey(null);
      setSelectedOccasionName(null);
      setStartDate("");
      setEndDate("");
    } finally {
      setSaving(false);
    }
  }


  function toggleJoinActive(occasion: string) {
    const isEnabling = !(joined || []).find((j) => j.occasion === occasion)?.isActive;
    let updated: PromotionPayload[];

    if (isEnabling) {
      // enable selected, disable all others
      updated = (joined || []).map((j) => (j.occasion === occasion ? { ...j, isActive: true } : { ...j, isActive: false }));
      toast.success(`Campaign ${occasion} enabled`);
    } else {
      // disabling the selected campaign
      updated = (joined || []).map((j) => (j.occasion === occasion ? { ...j, isActive: false } : j));
      toast.success(`Campaign ${occasion} disabled`);
    }

    localStorage.setItem(prefKey, JSON.stringify(updated));
    setJoined(updated);
    setHasChanges(true);
    if (onSave) onSave(JSON.stringify(updated));
  }

  function isCampaignCurrentlyActive(j: PromotionPayload) {
    try {
      const now = toLocalDateOnly(new Date());
      const s = toLocalDateOnly(parseIsoToLocalDate(j.start));
      const e = toLocalDateOnly(parseIsoToLocalDate(j.end));
      const inWindow = !isNaN(s.getTime()) && !isNaN(e.getTime()) && now >= s && now <= e;
      return !!j.isActive && inWindow;
    } catch {
      return !!j.isActive;
    }
  }

  function leaveCampaign(oc: string) {
    const filtered = (joined || []).filter((j) => j.occasion !== oc);
    const payload = filtered.length ? filtered : []; // ensure empty array if nothing left
    localStorage.setItem(prefKey, JSON.stringify(payload));
    setJoined(payload);
    setHasChanges(true);

    if (onSave) onSave(JSON.stringify(payload));
    toast.success("Left campaign");
  }

  // handleOccasionChange now accepts the stable key
  function handleOccasionChange(key: string | null) {
    setSelectedOccasionKey(key);
    setSelectedOccasionName(null);
    setStartDate("");
    setEndDate("");

    if (!key) return;

    const occ = allOccasions.find((o) => `${o.name}::${o.windowStart}` === key);
    if (!occ) return;

    setSelectedOccasionName(occ.name);

    const { start: wStart, end: wEnd } = parseCampaignWindow(occ);
    const today = toLocalDateOnly(new Date());

    const startDefault = today > wStart ? today : wStart;
    const tentativeEnd = addDays(startDefault, 6);
    const endDefault = tentativeEnd > wEnd ? wEnd : tentativeEnd;

    setStartDate(isoDate(startDefault));
    setEndDate(isoDate(endDefault));

    const existing = (joined || []).find((j) => j.occasion === occ.name && j.start === isoDate(startDefault));
    if (existing && typeof existing.discount === "number") {
      setDiscount(existing.discount);
    } else {
      // optional: reset discount to default if not existing
      // setDiscount(0);
    }
  }

  // Edit existing joined campaign: find matching occasion (by name + saved start inside window) and select it
  function handleEditJoined(j: PromotionPayload) {
    // try to find occasion whose window contains the saved start (robust against multiple years)
    const occ = allOccasions.find((o) => {
      if (o.name !== j.occasion) return false;
      const { start: wStart, end: wEnd } = parseCampaignWindow(o);
      const savedStart = toLocalDateOnly(parseIsoToLocalDate(j.start));
      return savedStart >= wStart && savedStart <= wEnd;
    });

    if (occ) {
      setSelectedOccasionKey(`${occ.name}::${occ.windowStart}`);
      setSelectedOccasionName(occ.name);
    } else {
      // fallback: just set human label (no key)
      setSelectedOccasionKey(null);
      setSelectedOccasionName(j.occasion);
    }

    setStartDate(j.start);
    setEndDate(j.end);
    setDiscount(j.discount);
  }

  // human-friendly label
  function humanDateLabel(iso: string) {
    try {
      const d = parseIsoToLocalDate(iso);
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" style={{ zIndex: modalZIndex }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => (saving ? null : onClose())}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-3xl bg-white lg:rounded-2xl rounded-t-2xl shadow-xl p-5 z-10 flex flex-col"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-md font-semibold">Promotions & Campaigns</h3>
              <button onClick={() => (saving ? null : onClose())} className="text-sm px-3 py-1 rounded-md hover:bg-slate-100" aria-label="Close">
                <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="mt-4 max-h-[66vh] overflow-auto space-y-4">
              {/* Join Seasonal Campaigns */}
              <section className="bg-white rounded-2xl p-4 ">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Seasonal Campaigns (Admin created)</div>
                    <div className="text-xs text-slate-500 mt-1">Join campaigns for extra visibility. Joining does not automatically change price.</div>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  {((availableOccasions || []).length === 0) ? (
                    <div className="text-sm text-slate-500">No active campaigns right now.</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {(availableOccasions || []).map((oc) => {
                        const joinedFor = (joined || []).find((j) => j.occasion === oc.name);
                        return (
                          <div key={`${oc.name}::${oc.windowStart}`} className="p-3 rounded-lg border border-slate-100 flex items-center justify-between">
                            <div>
                              <div className="font-medium">{oc.name}</div>
                              <div className="text-xs text-slate-500">{oc.windowStart} → {oc.windowEnd}</div>
                            </div>

                            <div className="flex items-center gap-3">
                              {joinedFor ? (
                                <>
                                  <div className="text-sm text-slate-700">Joined · {joinedFor.discount}%</div>
                                  <button className="px-2 py-1 rounded-md bg-white border text-sm" onClick={() => leaveCampaign(oc.name)}>Leave</button>
                                </>
                              ) : (
                                <button className="px-3 py-2 rounded-lg bg-white border" onClick={() => handleOccasionChange(`${oc.name}::${oc.windowStart}`)}>Join</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Editor row — show fixed start/end as text; only discount editable */}
                  {selectedOccasionKey || selectedOccasionName ? (
                    <div className="p-3 border border-slate-100 rounded-lg">
                      <div className="text-sm font-medium">Joining: {selectedOccasionName ?? "—"}</div>
                      <div className="text-xs text-slate-500 mt-1">This campaign's dates are fixed — you can only set the discount for joined products.</div>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-500">Start</label>
                          <div className="mt-1 text-sm text-slate-800">{startDate ? humanDateLabel(startDate) : "—"}</div>
                          <div className="text-xs text-slate-400">{startDate}</div>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">End</label>
                          <div className="mt-1 text-sm text-slate-800">{endDate ? humanDateLabel(endDate) : "—"}</div>
                          <div className="text-xs text-slate-400">{endDate}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-start justify-between">
                        <div>
                          <label className="text-xs text-slate-500">Discount for joined products</label>
                        </div>
                        <div className="ml-auto text-sm text-rose-500 font-semibold">{discount ? `${Math.round(discount)}%` : "—"}</div>
                      </div>

                      <input type="range" min={0} max={90} step={1} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-full mt-2" />

                      <div className="mt-3 flex justify-end gap-3">
                        <button className="px-3 py-2 rounded-lg bg-white border" onClick={() => { setSelectedOccasionKey(null); setSelectedOccasionName(null); setStartDate(""); setEndDate(""); }}>Cancel</button>
                        <button className="px-3 py-2 rounded-lg bg-rose-500 text-white" onClick={saveCampaignJoin} disabled={saving}>{saving ? "Saving…" : "Join Campaign"}</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              {/* Joined campaigns list */}
              <section className="bg-white rounded-2xl p-5 border border-slate-100 ">
                <div className="text-sm font-semibold">Your joined campaigns</div>
                <div className="mt-3 space-y-2">
                  {((joined || []).length === 0) ? (
                    <div className="text-sm text-slate-500">You haven't joined any campaigns yet.</div>
                  ) : (
                    (joined || []).map((j) => {
                      const currentlyActive = isCampaignCurrentlyActive(j);
                      return (
                        <div key={`${j.occasion}::${j.start}`} className="p-3 rounded-md border border-slate-100 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-3">
                              <div className="font-medium">{j.occasion}</div>
                              {currentlyActive && (
                                <div className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Active</div>
                              )}
                              {!currentlyActive && j.isActive && (
                                <div className="text-xs font-medium text-slate-500 px-2 py-0.5 rounded-full">Not in window</div>
                              )}
                              {!j.isActive && (
                                <div className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Disabled</div>
                              )}
                            </div>

                            <div className="text-xs text-slate-500 mt-1">{displayDateOnly(j.start)} → {displayDateOnly(j.end)}· {j.discount}%</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              className="px-2 py-1 rounded-md bg-white border text-sm"
                              onClick={() => handleEditJoined(j)}
                            >
                              Edit
                            </button>

                            <button className="px-2 py-1 rounded-md bg-white border text-sm" onClick={() => leaveCampaign(j.occasion)}>Remove</button>

                            <button className="px-2 py-1 rounded-md border text-sm" onClick={() => toggleJoinActive(j.occasion)}>
                              {j.isActive ? "Disable" : "Enable"}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`px-4 py-2 rounded-lg font-semibold ${hasChanges
                  ? "bg-rose-500 text-white"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed"
                  }`}
              >
                {saving ? "Saving..." : "Save & Close"}
              </button>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
