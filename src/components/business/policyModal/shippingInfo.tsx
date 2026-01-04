"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import DescriptionTextarea from "../../input/defaultDescTextarea";

type Unit = "hours" | "days" | "weeks";

type ShippingDurationItem = {
  type: "avg" | "promise";
  value: number; // integer in unit
  unit: Unit;
};

type Props = {
  open: boolean;
  prefKey: string; // localStorage key to read/write, e.g. "business_shipping_info"
  initialValue: string; // JSON string (may be empty)
  onClose: () => void;
  onSave?: (payloadJson: string) => Promise<void> | void;
};

const UNITS: Unit[] = ["hours", "days", "weeks"];

function unitToHoursMultiplier(u: Unit) {
  switch (u) {
    case "days":
      return 24;
    case "weeks":
      return 24 * 7;
    case "hours":
    default:
      return 1;
  }
}
function mapServerKindToType(kind: any): "avg" | "promise" {
  if (kind === "express" || kind === "promise") return "promise";
  return "avg"; // standard → avg
}


function toHours(item: ShippingDurationItem) {
  return item.value * unitToHoursMultiplier(item.unit);
}

function hoursToUnitValue(hours: number, unit: Unit) {
  const mult = unitToHoursMultiplier(unit);
  return Math.ceil(hours / mult);
}

// add this helper near top
function chooseBestDisplayUnitFromHours(hours: number): { unit: Unit; value: number } {
  const HOURS_IN_DAY = 24;
  const HOURS_IN_WEEK = 24 * 7; // 168

  // Prefer weeks for large values
  if (hours >= HOURS_IN_WEEK) {
    return { unit: "weeks", value: Math.ceil(hours / HOURS_IN_WEEK) };
  }
  // Next prefer days
  if (hours >= HOURS_IN_DAY) {
    return { unit: "days", value: Math.ceil(hours / HOURS_IN_DAY) };
  }
  // otherwise keep hours
  return { unit: "hours", value: Math.ceil(hours) };
}

// replace normalizeShippingItem with this version
function normalizeShippingItem(p: any): ShippingDurationItem | null {
  if (!p || typeof p !== "object") return null;

  const type: "avg" | "promise" =
    p.type === "promise" || p.kind === "express" ? "promise" : "avg";

  // server might send hours-only canonical form; accept days/weeks/hours too
  const reportedUnit: Unit = UNITS.includes(p.unit) ? p.unit : "hours";

  // parse numeric value (server might use hours even when original UI used days/weeks)
  const rawValue = Number(p.value);
  const safeValue = Number.isFinite(rawValue) && rawValue > 0 ? Math.trunc(rawValue) : 1;

  // If server reported the value in hours, convert to a friendlier unit for display.
  if (reportedUnit === "hours") {
    const converted = chooseBestDisplayUnitFromHours(safeValue);
    return { type, value: converted.value, unit: converted.unit };
  }

  // otherwise preserve the reported unit (days/weeks) and raw integer value
  return { type, value: Math.trunc(safeValue), unit: reportedUnit };
}

// Optionally you can keep parseInitial as-is, but here's a cleaned version that
// ensures we return [avg, promise] in order.
function parseInitial(
  initial: string | undefined,
  fallbackAvgHours = 16,
  fallbackPromiseHours = 48
) {
  const defaults: ShippingDurationItem[] = [
    { type: "avg", value: fallbackAvgHours, unit: "hours" },
    { type: "promise", value: fallbackPromiseHours, unit: "hours" },
  ];

  if (!initial) return defaults.map((d) => ({ ...d }));

  try {
    const parsed = JSON.parse(initial);

    // ✅ NEW: handle object-based payload
    const rawArray = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.shipping_duration)
      ? parsed.shipping_duration
      : null;

    if (!rawArray) return defaults.map((d) => ({ ...d }));

    const mapped = rawArray
      .map(normalizeShippingItem)
      .filter(Boolean) as ShippingDurationItem[];

    const avg = mapped.find((m) => m.type === "avg") ?? defaults[0];
    const promise = mapped.find((m) => m.type === "promise") ?? defaults[1];

    return [{ ...avg }, { ...promise }];
  } catch {
    return defaults.map((d) => ({ ...d }));
  }
}

export default function ShippingInfoModal({ open, prefKey, initialValue, onClose, onSave }: Props) {
  const [items, setItems] = useState<ShippingDurationItem[]>([
    { type: "avg", value: 16, unit: "hours" },
    { type: "promise", value: 48, unit: "hours" },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deliveryNotice, setDeliveryNotice] = useState("");



  // load defaults + initial items
 useEffect(() => {
  if (!open) return;
  setLoading(true);

  let defaultAvgHours = 16;
  let defaultPromiseHours = 48;
  let initialNotice = "";

  try {
    const raw = localStorage.getItem(`${prefKey}_defaults`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const a = Number(parsed.avg_hours);
        const p = Number(parsed.promise_hours);
        const notice = parsed.delivery_notice;
        if (Number.isFinite(a) && a > 0) defaultAvgHours = Math.trunc(a);
        if (Number.isFinite(p) && p > 0) defaultPromiseHours = Math.trunc(p);
        if (typeof notice === "string") initialNotice = notice;
      }
    }
  } catch {}

  // parse shipping items
  const parsedItems = parseInitial(initialValue, defaultAvgHours, defaultPromiseHours);

  // also extract delivery_notice if present in initialValue
  try {
    if (initialValue) {
      const parsed = JSON.parse(initialValue);
      if (parsed && typeof parsed === "object" && typeof parsed.delivery_notice === "string") {
        initialNotice = parsed.delivery_notice;
      }
    }
  } catch {}

  setItems(parsedItems);
  setDeliveryNotice(initialNotice);

  setLoading(false);
}, [open, initialValue, prefKey]);


  // prevent background scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  function updateItem(index: number, patch: Partial<ShippingDurationItem>) {
    setItems((s) => {
      const copy = [...s];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  }

  function increment(index: number) {
    updateItem(index, { value: items[index].value + 1 });
  }
  function decrement(index: number) {
    if (items[index].value > 1) updateItem(index, { value: items[index].value - 1 });
  }

  


  async function editNumeric(index: number) {
    const current = items[index].value;
    const raw = window.prompt("Enter duration (integer >= 1):", String(current));
    if (raw === null) return;
    const v = parseInt(raw.trim(), 10);
    if (!Number.isFinite(v) || v < 1) {
      toast("Invalid number. Must be an integer >= 1.");
      return;
    }
    updateItem(index, { value: v });
  }

  async function handleSave() {
    setSaving(true);

    // ensure minimum 1
    items.forEach((it, i) => {
      if (!Number.isFinite(it.value) || it.value < 1) updateItem(i, { value: 1 });
    });

    // compute hours
    const avgHours = toHours(items[0]);
    const promiseHours = toHours(items[1]);

    // if promise <= avg, bump promise to avg + 1 hour (keep promise.unit)
    if (promiseHours <= avgHours) {
      const desired = avgHours + 1;
      const newPromiseVal = hoursToUnitValue(desired, items[1].unit);
      updateItem(1, { value: newPromiseVal });
      // reflect immediately so next save persists corrected value
      // small alert to inform user
      toast(
        `Promise must be greater than average. I adjusted the promise to ${newPromiseVal} ${items[1].unit}.`
      );
    }

    // read final items
    const finalItems = (() => {
      // freeze current items state
      return items.map((it) => ({ ...it }));
    })();

    // ensure saved representation has numeric values and type+unit
const payloadJson = JSON.stringify({
  delivery_notice: deliveryNotice.trim(),
  shipping_duration: finalItems.map((it) => ({
    type: it.type,
    value: it.value,
    unit: it.unit,
  })),
  additional_info: "",
});


    try {
      // save payload
      localStorage.setItem(prefKey, payloadJson);

      // update defaults as hours under `${prefKey}_defaults`
      const finalAvgHours = toHours(finalItems[0]);
      const finalPromiseHours = toHours(finalItems[1]);
      try {
        localStorage.setItem(
          `${prefKey}_defaults`,
          JSON.stringify({ avg_hours: finalAvgHours, promise_hours: finalPromiseHours })
        );
      } catch {
        // ignore
      }

      if (onSave) await onSave(payloadJson);
    } catch (e) {
      console.error("Failed to save shipping info", e);
      toast("Failed to save shipping info.");
    } finally {
      setSaving(false);
      onClose();
    }
  }

  function displayTitleFor(item: ShippingDurationItem) {
    const human = `${item.value} ${item.unit}`;
    if (item.type === "avg") return `Ships within ${human} on average`;
    return `Promise to ship within ${human} — delay compensation applied`;
  }

  return (
   <div className="fixed inset-0 z-75 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => (saving ? null : onClose())} />
      

      <div className="relative w-full max-w-2xl bg-white lg:rounded-2xl rounded-t-2xl shadow-xl p-5 z-10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Shipping Info</h3>
          <button
            onClick={() => (saving ? null : onClose())}
            className="text-sm px-3 py-1 rounded-md hover:bg-slate-100"
          >
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none">
                <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
          </button>
          
        </div>

        <div className="mt-4 space-y-4 max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="text-center py-8">Loading…</div>
          ) : (
            items.map((it, idx) => (
              <div
                key={it.type}
                className="p-4 bg-white rounded-lg border border-slate-100 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                   <div className="font-semibold text-slate-900 text-sm sm:text-base">
  {displayTitleFor(it)}
</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {it.type === "avg"
                        ? "Typical average time customers can expect"
                        : "Guaranteed promise — must be greater than average"}
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 whitespace-nowrap">{/* placeholder */}</div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => decrement(idx)}
                      className="w-8 h-8 rounded-md border flex items-center justify-center"
                      aria-label="decrement"
                    >
                      −
                    </button>

                    <div
                      onClick={() => editNumeric(idx)}
                      className="px-4 py-2 bg-rose-50 rounded-md cursor-pointer select-none"
                      role="button"
                      title="Click to enter number"
                    >
                      <div className="text-base sm:text-lg font-semibold">
  {it.value}
</div>
                    </div>

                    <button
                      onClick={() => increment(idx)}
                      className="w-8 h-8 rounded-md border flex items-center justify-center"
                      aria-label="increment"
                    >
                      +
                    </button>
                  </div>

                  <div className="ml-3 inline-flex items-center gap-2 border rounded-md p-1">
                    {UNITS.map((u) => {
                      const selected = it.unit === u;
                      return (
                        <button
                          key={u}
                          onClick={() => updateItem(idx, { unit: u })}
                          className={`px-2 py-1 rounded-sm text-xs sm:text-sm ${
  selected ? "bg-rose-50 font-semibold text-rose-600" : "text-slate-600"
}`}>
                          {u}
                        </button>
                      );
                    })}
                  </div>

                 
                </div>
              </div>
            ))
          )}
        </div>
        <div className="pt-5">
          <DescriptionTextarea
  value={deliveryNotice}
  onChange={setDeliveryNotice}
  placeholder="Write a short delivery notice..."
  maxLength={500}
/>
        </div>


        <div className="mt-4 flex justify-end gap-3">
          
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-full bg-rose-500 text-white font-semibold"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
