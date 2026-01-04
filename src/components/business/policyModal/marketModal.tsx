// components/business/modals/MarketModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import CategorySelectionModal from "../../input/default-select";

type Props = {
  open: boolean;
  prefKey: string; // e.g. "business_market_affiliation"
  initialValue: string; // JSON string (may be empty)
  isTrustedPartner?: boolean; // optional injected flag
  onClose: () => void;
  onSave?: (payloadJson: string) => Promise<void> | void;
};

// sample market options — replace with your real source if needed
const MARKET_OPTIONS = [
  "Kasuwan Barchi",
  "Central Market",
  "Kawo Market",
  "Sabon Gari Market",
  "Local Market",
  "Online Shop",
  "Other",
];

export default function MarketModal({
  open,
  prefKey,
  initialValue,
  isTrustedPartner = false,
  onClose,
  onSave,
}: Props) {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [selectedMarket, setSelectedMarket] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [trustedPartner, setTrustedPartner] = useState<boolean>(isTrustedPartner);

  // parse initialValue robustly
 // Adjusted MarketModal.tsx snippet
const DEFAULT_PAYLOAD = {
  from_market: "",
  note: "",
  trusted_partner: false,
};

useEffect(() => {
  if (!open) return;
  setLoading(true);

  try {
    let payloadStr = initialValue?.trim() || localStorage.getItem(prefKey) || "";
    let parsed = payloadStr ? JSON.parse(payloadStr) : {};

    // Ensure default structure
    parsed = {
      from_market: parsed.from_market ?? parsed.market ?? parsed.market_affiliation ?? "",
      note: parsed.note ?? parsed.notes ?? "",
      trusted_partner:
        typeof parsed.trusted_partner !== "undefined"
          ? Boolean(parsed.trusted_partner)
          : Boolean(isTrustedPartner),
    };

    setSelectedMarket(parsed.from_market);
    setNote(parsed.note);
    setTrustedPartner(parsed.trusted_partner);
  } catch (e) {
    // fallback to default
    setSelectedMarket(DEFAULT_PAYLOAD.from_market);
    setNote(DEFAULT_PAYLOAD.note);
    setTrustedPartner(Boolean(isTrustedPartner));
  } finally {
    setLoading(false);
  }
}, [open, initialValue, prefKey, isTrustedPartner]);

async function handleSave() {
  if (note.length > 100) {
    window.alert("Note must be 100 characters or less.");
    return;
  }

  setSaving(true);

  const payloadObj = {
    from_market: selectedMarket || "",
    note: note.trim(),
    trusted_partner: trustedPartner,
  };

  const payloadJson = JSON.stringify(payloadObj);

  try {
    localStorage.setItem(prefKey, payloadJson);
    if (onSave) await onSave(payloadJson);
  } catch (err) {
    console.error("Failed to save market info", err);
    window.alert("Failed to save market info.");
  } finally {
    setSaving(false);
    onClose();
  }
}

  // prevent background scroll when modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  

  return (
    <div className="fixed inset-0 z-75 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => (saving ? null : onClose())} />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-white lg:rounded-2xl rounded-t-2xl p-5 z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Market Affiliation</h3>
          <button onClick={() => (saving ? null : onClose())} className="text-sm px-3 py-1 rounded-md hover:bg-slate-100">
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
              {/* Market selector */}
              <div className="bg-white rounded-2xl border-slate-100"
              >
                <CategorySelectionModal
                    title="Select Market"
                    options={MARKET_OPTIONS}
                    value={selectedMarket}
                    onSelected={(v) => setSelectedMarket(v)}
                    hintText="Choose a market"
                    isRequired
                    triggerLabel="Market"
                />
              </div>

              {/* Trusted partner row (display only) */}
              <div className="bg-white rounded-2xl p-4 border border-slate-100  flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Trusted Partner Status</div>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1 rounded-full text-sm ${trustedPartner ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {trustedPartner ? "Trusted Partner" : "Not Partner"}
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${trustedPartner ? "bg-emerald-100" : "bg-slate-100"}`}>
                    {trustedPartner ? (
                      <svg className="w-4 h-4 text-emerald-700" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : (
                      <svg className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
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
          <button onClick={() => (saving ? null : onClose())} className="px-4 py-2 rounded-lg bg-white border" disabled={saving}>
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-rose-500 text-white font-semibold" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
