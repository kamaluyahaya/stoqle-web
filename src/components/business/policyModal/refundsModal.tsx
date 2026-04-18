// components/business/modals/RefundsModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [lateShipmentCompensation, setLateShipmentCompensation] = useState<boolean>(false);
  const [fakeOnePayFour, setFakeOnePayFour] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [note, setNote] = useState<string>("");

  // parse initialValue robustly (accept both boolean and numeric, multiple key names)
  useEffect(() => {
    if (!open) return;
    setLoading(true);

    try {
      if (!initialValue || initialValue.trim() === "") {
        // defaults: false
        setReturnShippingSubsidy(false);
        setNoReasonReturn7Days(false);
        setRapidRefund(false);
        setLateShipmentCompensation(false);
        setFakeOnePayFour(false);
      } else {
        const parsed = JSON.parse(initialValue);
        if (parsed && typeof parsed === "object") {
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
          setLateShipmentCompensation(readBool(parsed, "late_shipment_compensation", "late_shipment_compensation_bool"));
          setFakeOnePayFour(readBool(parsed, "fake_one_pay_four", "fake_one_pay_four_bool"));
        } else {
          setReturnShippingSubsidy(false);
          setNoReasonReturn7Days(false);
          setRapidRefund(false);
          setLateShipmentCompensation(false);
          setFakeOnePayFour(false);
        }
      }
    } catch (e) {
      setReturnShippingSubsidy(false);
      setNoReasonReturn7Days(false);
      setRapidRefund(false);
      setLateShipmentCompensation(false);
      setFakeOnePayFour(false);
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

  async function handleSave() {
    setSaving(true);
    try {
      const payloadObj: Record<string, any> = {
        return_shipping_subsidy: !!returnShippingSubsidy,
        seven_day_no_reason_return: !!noReasonReturn7Days,
        rapid_refund: !!rapidRefund,
        late_shipment_compensation: !!lateShipmentCompensation,
        fake_one_pay_four: !!fakeOnePayFour,
        additional_info: !!noReasonReturn7Days,
      };

      const payloadJson = JSON.stringify(payloadObj);

      try {
        localStorage.setItem(prefKey, payloadJson);
      } catch (e) {
        console.error("Failed to write refunds to localStorage", e);
      }

      if (onSave) await onSave(payloadJson);
    } catch (e) {
      console.error("Failed saving refunds", e);
      window.alert("Failed to save refund settings.");
    } finally {
      setSaving(false);
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => (saving ? null : onClose())}
          />

          {/* Modal panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl bg-white lg:rounded-[0.5rem] rounded-t-[0.5rem] shadow-xl p-5 z-10 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-md font-semibold text-center">Returns & Refunds</h3>
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
                <div className="space-y-4 px-1 pb-4">
                  {[
                    { label: "Return shipping subsidy", desc: "We cover return shipping costs in eligible cases.", state: returnShippingSubsidy, setter: setReturnShippingSubsidy },
                    { label: "7-day no reason return", desc: "Buyers can return items within 7 days without explanation.", state: noReasonReturn7Days, setter: setNoReasonReturn7Days },
                    { label: "Rapid refund", desc: "When conditions are met, customers receive an instant refund.", state: rapidRefund, setter: setRapidRefund },
                    { label: "Late shipment compensation", desc: "If shipping is delayed beyond the promised time, you receive compensation.", state: lateShipmentCompensation, setter: setLateShipmentCompensation },
                    { label: "Fake one pay four", desc: "If the product is proven to be counterfeit, we refund four times the price.", state: fakeOnePayFour, setter: setFakeOnePayFour }
                  ].map((item, idx) => (
                    <div key={idx} className="bg-white rounded-[0.5rem] p-4 border border-slate-100  transition-all hover:border-slate-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 pr-4">
                          <div className="text-[12px] font-medium text-slate-900">{item.label}</div>
                          <div className="text-xs text-slate-500 mt-1">{item.desc}</div>
                        </div>
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.state}
                            onChange={(e) => item.setter(e.target.checked)}
                            className="sr-only"
                          />
                          <span className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${item.state ? "bg-rose-500" : "bg-slate-200"}`}>
                            <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${item.state ? "translate-x-5" : "translate-x-0"}`} />
                          </span>
                        </label>
                      </div>
                    </div>
                  ))}


                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => (saving ? null : onClose())}
                className="px-6 py-2.5 rounded-full bg-white border border-slate-200 text-sm font-medium hover:bg-slate-50 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-8 py-2 rounded-full bg-rose-500 text-white text-sm font-bold shadow-lg shadow-rose-500/30 hover:bg-rose-600 active:scale-95 transition-all"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
