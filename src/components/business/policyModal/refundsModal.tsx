// components/business/modals/RefundsModal.tsx
"use client";

import React, { useEffect, useState } from "react";

type Props = {
  open: boolean;
  prefKey: string; // e.g. "business_return_refunds"
  initialValue: string; // JSON string (may be empty)
  onClose: () => void;
  onSave?: (payloadJson: string) => Promise<void> | void;
};

export default function RefundsModal({ open, prefKey, initialValue, onClose, onSave }: Props) {
  const [returnShippingSubsidy, setReturnShippingSubsidy] = useState<boolean>(false);
  const [noReasonReturn7Days, setNoReasonReturn7Days] = useState<boolean>(false);
  const [rapidRefund, setRapidRefund] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [note, setNote] = useState<string>("");

  // parse initialValue robustly (accept both boolean and numeric, multiple key names)
  useEffect(() => {
    if (!open) return;
    setLoading(true);

    try {
      if (!initialValue || initialValue.trim() === "") {
        // defaults: false/false/false
        setReturnShippingSubsidy(false);
        setNoReasonReturn7Days(false);
        setRapidRefund(false);
      } else {
        const parsed = JSON.parse(initialValue);
        if (parsed && typeof parsed === "object") {
          // accept several possible key names that might be in existing payloads
          const readBool = (obj: any, ...keys: string[]) => {
            for (const k of keys) {
              if (k in obj) {
                const v = obj[k];
                if (v === true || v === "true" || v === 1 || v === "1") return true;
                return Boolean(v);
              }
            }
            return false;
          };

          setReturnShippingSubsidy(readBool(parsed, "return_shipping_subsidy", "return_shipping_subsidy_bool"));
          setNoReasonReturn7Days(readBool(parsed, "no_reason_return_7days", "seven_day_no_reason_return", "no_reason_7days"));
          setRapidRefund(readBool(parsed, "rapid_refund", "rapid_refund_bool"));
        } else {
          setReturnShippingSubsidy(false);
          setNoReasonReturn7Days(false);
          setRapidRefund(false);
        }
      }
    } catch (e) {
      // parse fail -> defaults
      setReturnShippingSubsidy(false);
      setNoReasonReturn7Days(false);
      setRapidRefund(false);
    } finally {
      setLoading(false);
    }
  }, [open, initialValue]);

  // prevent background scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  async function handleSave() {
    setSaving(true);
    try {
      // payload: keep Flutter keys, and also include the other common key for compatibility
      const payloadObj: Record<string, any> = {
        return_shipping_subsidy: !!returnShippingSubsidy,
        seven_day_no_reason_return: !!noReasonReturn7Days,
        rapid_refund: !!rapidRefund,
        // also write alternative key used elsewhere
        additional_info: !!noReasonReturn7Days,
        
      };

      const payloadJson = JSON.stringify(payloadObj);

      // persist to localStorage
      try {
        localStorage.setItem(prefKey, payloadJson);
      } catch (e) {
        // ignore localStorage errors (quota/disabled)
        console.error("Failed to write refunds to localStorage", e);
      }

      if (onSave) await onSave(payloadJson);
    } catch (e) {
      console.error("Failed saving refunds", e);
      // optionally you can show a toast here
      window.alert("Failed to save refund settings.");
    } finally {
      setSaving(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-75 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => (saving ? null : onClose())} />

      {/* Modal panel */}
      <div className="relative w-full max-w-2xl bg-white lg:rounded-2xl rounded-t-2xl shadow-xl p-5 z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Returns & Refunds</h3>
          <button
            onClick={() => (saving ? null : onClose())}
            className="text-sm px-3 py-1 rounded-md hover:bg-slate-100"
            aria-label="Close refunds modal"
          >
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="mt-4 max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Return shipping subsidy</div>
                        <div className="text-xs text-slate-500 mt-1">We cover return shipping costs in eligible cases.</div>
                      </div>

                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={returnShippingSubsidy}
                          onChange={(e) => setReturnShippingSubsidy(e.target.checked)}
                          className="sr-only"
                        />
                        <span
                          className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                            returnShippingSubsidy ? "bg-rose-500" : "bg-slate-200"
                          }`}
                          aria-hidden
                        >
                          <span
                            className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                              returnShippingSubsidy ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">7-day no reason return</div>
                        <div className="text-xs text-slate-500 mt-1">Buyers can return items within 7 days without explanation.</div>
                      </div>

                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={noReasonReturn7Days}
                          onChange={(e) => setNoReasonReturn7Days(e.target.checked)}
                          className="sr-only"
                        />
                        <span
                          className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                            noReasonReturn7Days ? "bg-rose-500" : "bg-slate-200"
                          }`}
                          aria-hidden
                        >
                          <span
                            className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                              noReasonReturn7Days ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Rapid refund</div>
                        <div className="text-xs text-slate-500 mt-1">
                          When conditions are met, customers receive an instant refund.
                        </div>
                      </div>

                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rapidRefund}
                          onChange={(e) => setRapidRefund(e.target.checked)}
                          className="sr-only"
                        />
                        <span
                          className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                            rapidRefund ? "bg-rose-500" : "bg-slate-200"
                          }`}
                          aria-hidden
                        >
                          <span
                            className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                              rapidRefund ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              {/* Note */}
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <label className="text-sm font-semibold text-slate-900">Notes</label>
                <p className="text-xs text-slate-500 mt-1 mb-2">Optional info (e.g. Online only, Delivery only)</p>
                <textarea
                  value={note}
                  onChange={(e) => {
                    if (e.target.value.length <= 100) setNote(e.target.value);
                  }}
                  rows={4}
                  placeholder="Optional note (max 100 chars)"
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm resize-none"
                />
                <div className="text-xs text-slate-400 mt-2 text-right">{note.length}/100</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={() => (saving ? null : onClose())}
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
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
