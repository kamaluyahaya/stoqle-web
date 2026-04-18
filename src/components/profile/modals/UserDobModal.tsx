// src/components/profile/modals/UserDobModal.tsx
"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  open: boolean;
  initialValue: string;
  onClose: () => void;
  onSave: (value: string) => Promise<void> | void;
};

export default function UserDobModal({ open, initialValue, onClose, onSave }: Props) {
  const [dob, setDob] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDob(initialValue || "");
  }, [open, initialValue]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(dob);
    setSaving(false);
    onClose();
  };

  // Format display age
  const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
            className="relative bg-white w-full max-w-md rounded-t-[0.5rem] sm:rounded-[0.5rem] shadow-2xl p-6 overflow-hidden"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Date of Birth</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <p className="text-sm text-slate-500 mb-5">Your birthday will not be shown publicly.</p>

            <div className="mb-2">
              <label className="text-xs font-bold text-slate-500  tracking-widest block mb-2">Birthday</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 transition"
              />
            </div>
            {age !== null && age >= 0 && age < 120 && (
              <p className="text-xs text-slate-400 mb-6 pl-1">You are <span className="font-bold text-slate-600">{age} years old</span>.</p>
            )}

            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={onClose} className="px-5 py-3 rounded-full font-bold text-sm text-slate-500 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 rounded-full font-bold text-sm bg-rose-500 text-white hover:bg-rose-600 transition disabled:opacity-50"
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
