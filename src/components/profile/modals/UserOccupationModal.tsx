// src/components/profile/modals/UserOccupationModal.tsx
"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DefaultInput from "../../input/default-input";

type Props = {
  open: boolean;
  initialValue: string;
  onClose: () => void;
  onSave: (value: string) => Promise<void> | void;
};

export default function UserOccupationModal({ open, initialValue, onClose, onSave }: Props) {
  const [job, setJob] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setJob(initialValue || "");
  }, [open, initialValue]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(job);
    setSaving(false);
    onClose();
  };

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
              <h3 className="text-xl font-bold text-slate-800">Occupation</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <p className="text-sm text-slate-500 mb-5">What do you do for a living?</p>

            <DefaultInput
              label="Job / Occupation"
              placeholder="e.g. Software Engineer, Designer..."
              value={job}
              onChange={setJob}
            />

            <div className="flex gap-3 mt-8 justify-end">
              <button onClick={onClose} className="px-5 py-3 rounded-full font-bold text-sm text-slate-500 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 rounded-full font-bold text-sm bg-rose-500 text-white hover:bg-rose-500 transition disabled:opacity-50"
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
