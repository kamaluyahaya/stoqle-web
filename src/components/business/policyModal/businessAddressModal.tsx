"use client";

import React, { useEffect, useState } from "react";
import DefaultInput from "../../input/default-input";
import AddressSelectionModal from "../addressSelectionModal";
import { countries } from "@/src/lib/api/country";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  open: boolean;
  prefKey: string; // e.g. "business_address_info"
  initialValue: string; // JSON string (may be empty)
  onClose: () => void;
  onSave?: (payloadJson: string) => Promise<void> | void;
};

export default function BusinessAddressModal({ open, prefKey, initialValue, onClose, onSave }: Props) {
  const [line1, setLine1] = useState<string>("");
  const [line2, setLine2] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  // const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("NG");


  useEffect(() => {
    if (!open) return;
    setLoading(true);

    try {
      const payload =
        initialValue && initialValue.trim() !== ""
          ? initialValue
          : localStorage.getItem(prefKey);

      const parsed = payload ? JSON.parse(payload) : null;

      if (parsed && typeof parsed === "object") {
        setLine1(
          String(
            parsed.address_line_1 ??
            parsed.line1 ??
            parsed.address1 ??
            ""
          )
        );

        setLine2(
          String(
            parsed.address_line_2 ??
            parsed.line2 ??
            parsed.address2 ??
            ""
          )
        );

        setCity(String(parsed.city ?? ""));
        setState(String(parsed.state ?? ""));
        setPostalCode(String(parsed.postal_code ?? ""));
        setCountry(String(parsed.country ?? "NG"));
      } else {
        setLine1("");
        setLine2("");
        setCity("");
        setState("");
        setPostalCode("");
        setCountry("NG");
      }
    } catch {
      setLine1("");
      setLine2("");
      setCity("");
      setState("");
      setPostalCode("");
      setCountry("NG");
    } finally {
      setLoading(false);
    }
  }, [open, initialValue, prefKey]);


  // prevent background scroll while modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function handleSave() {
    const trimmedLine1 = line1.trim();
    const trimmedLine2 = line2.trim();
    if (!trimmedLine1) {
      window.alert("Address line 1 is required.");
      return;
    }
    if (trimmedLine1.length > 150 || trimmedLine2.length > 150) {
      window.alert("Address lines must be 150 characters or less.");
      return;
    }

    setSaving(true);
    const payloadObj = {
      address_line_1: trimmedLine1,
      address_line_2: trimmedLine2,
      country: city,
      state,
      postal_code: postalCode,
      city: country,
    };

    const payloadJson = JSON.stringify(payloadObj);

    try {
      try {
        localStorage.setItem(prefKey, payloadJson);
      } catch (e) {
        console.error("Failed to persist address to localStorage", e);
      }

      if (onSave) await onSave(payloadJson);
    } catch (e) {
      console.error("Failed to save address", e);
      window.alert("Failed to save business address.");
    } finally {
      setSaving(false);
      onClose();
    }
  }
  const addressValue = [city, state, country].filter(Boolean).join(", ");

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1001] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
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
            className="relative w-full max-w-2xl p-5 bg-white h-[75vh] sm:h-auto lg:rounded-2xl rounded-t-2xl shadow-xl z-10 flex flex-col"
          >

            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Business Address</h3>
              <button onClick={() => (saving ? null : onClose())} className="text-sm px-3 py-1 rounded-md hover:bg-slate-100">
                <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="space-y-3 overflow-y-auto flex-1 mt-5">
              {loading ? (
                <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-2 ">
                    <DefaultInput
                      label="Address 1 "
                      value={line1}
                      onChange={setLine1}
                      placeholder="Street, building, etc."
                      required
                    />

                  </div>
                  <div className="bg-white rounded-2xl p-2 ">
                    <DefaultInput
                      label="Address 2 "
                      value={line2}
                      onChange={setLine2}
                      placeholder="Apartment, suite, landmark (optional)"
                    />


                  </div>
                  <AddressSelectionModal
                    title="Region"
                    hintText="Select country, state, LGA"
                    isRequired
                    hierarchy={countries}
                    value={addressValue}
                    onSelected={(v) => {
                      // expected format: "Kano, Kano State, NG"
                      const parts = v.split(",").map(p => p.trim());

                      setCity(parts[0] ?? "");
                      setState(parts[1] ?? "");
                      setCountry(parts[2] ?? "NG");
                    }}
                  />

                  <div className="text-xs text-slate-500">Tip: Provide a clear address to improve delivery accuracy.</div>
                </div>
              )}
            </div>


            {/* Footer */}
            <div className="mt-5 flex flex-col sm:flex-row justify-end gap-2 w-full">
              <button
                onClick={handleSave} // ✅ call your payload handler
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 rounded-full bg-rose-500 text-white text-sm font-semibold disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
