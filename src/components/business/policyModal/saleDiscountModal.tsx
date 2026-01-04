"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import CategorySelectionModal from "../../input/default-select";

type SaleProps = {
  open: boolean;
  prefKey: string; // default: "business_sales_discount"
  initialValue?: string | null;
  onClose: () => void;
  onSave?: (payloadJson: string) => Promise<void> | void;
};

const DISCOUNT_OPTIONS = [
  "Black Friday",
  "New customer",
  "Cyber Monday",
  "Back to School",
  "Holiday Sale",
  "Clearance",
  "Flash Sale",
  "Loyalty Reward",
  "Birthday Discount",
  "Referral Bonus",
  "Seasonal Offer",
];

export function SaleDiscountModal({
  open,
  prefKey,
  initialValue = null,
  onClose,
  onSave,
}: SaleProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [discountType, setDiscountType] = useState<string>("");
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  useEffect(() => setMounted(true), []);
  
  /* ---------------- Load ---------------- */
  useEffect(() => {
    if (!mounted || !open) return;

    setLoading(true);

    try {
      const raw =
        initialValue?.trim() ||
        localStorage.getItem(prefKey) ||
        "";

      if (!raw) {
        setDiscountType("");
        setDiscountPercent(0);
        return;
      }

      const parsed = JSON.parse(raw);


// ✅ normalize array → object
const obj = Array.isArray(parsed) ? parsed[0] : parsed;

if (obj && typeof obj === "object") {
  setDiscountType(String(obj.type ?? ""));
  setDiscountPercent(
    typeof obj.discount === "number"
      ? obj.discount
      : Number(obj.discount ?? 0)
  );
}

    } catch {
      setDiscountType("");
      setDiscountPercent(0);
    } finally {
      setLoading(false);
    }
  }, [open, initialValue, prefKey, mounted]);

  if (!mounted || !open) return null;

  /* ---------------- Save ---------------- */
  async function handleSave() {
    if (!discountType) return toast("Select a discount type");
    if (discountPercent <= 0) return toast("Set a discount greater than 0%");

    setSaving(true);

    try {
      const payload = {
        type: discountType,
        discount: Math.round(discountPercent),
      };

      const json = JSON.stringify(payload);

      localStorage.setItem(prefKey, json);
      toast.success("Discount saved");

      if (onSave) await onSave(json);
    } finally {
      setSaving(false);
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-75 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => (!saving ? onClose() : null)}
      />

      <div className="relative w-full max-w-xl bg-white rounded-t-2xl lg:rounded-2xl shadow-xl p-5 z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Sale Discount</h3>
          <button
            onClick={() => (!saving ? onClose() : null)}
            className="p-2 rounded-md hover:bg-slate-100"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-slate-600"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M6 6L18 18M6 18L18 6"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 max-h-[60vh] overflow-auto space-y-4">
          <CategorySelectionModal
            title="Select discount"
            options={DISCOUNT_OPTIONS}
            value={discountType}
            onSelected={setDiscountType}
            hintText="Choose a discount"
            isRequired
            triggerLabel="Discount"
          />

          <div className="rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Discount Percentage
                </div>
                <div className="text-xs text-slate-500 mt-1">1–90%</div>
              </div>
              <div className="text-sm font-semibold text-rose-600">
                {Math.round(discountPercent)}%
              </div>
            </div>

            <div className="mt-3">
              <input
                type="range"
                min={1}
                max={90}
                step={1}
                value={discountPercent}
                onChange={(e) =>
                  setDiscountPercent(Number(e.target.value))
                }
                className="w-full"
              />
              <div className="text-xs text-slate-400 mt-2">
                Tip: keep discounts sustainable.
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={() => (!saving ? onClose() : null)}
            className="px-4 py-2 rounded-lg bg-white border"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-rose-500 text-white font-semibold"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
