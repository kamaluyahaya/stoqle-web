// src/components/profile/modals/UserNameIdModal.tsx
"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DefaultInput from "../../input/default-input";

type Props = {
  open: boolean;
  initialValue: string; // JSON: { full_name: string, user_id: string }
  onClose: () => void;
  onSave: (payloadJson: string) => Promise<void> | void;
};

export default function UserNameIdModal({ open, initialValue, onClose, onSave }: Props) {
  const [fullName, setFullName] = useState("");
  const [stoqleId, setStoqleId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      try {
        const p = JSON.parse(initialValue);
        setFullName(p.full_name || "");
        setStoqleId(p.stoqle_id || "");
      } catch (e) {
        setFullName("");
        setStoqleId("");
      }
    }
  }, [open, initialValue]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(JSON.stringify({ full_name: fullName }));
    setSaving(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            className="relative bg-white w-full max-w-md rounded-t-[0.5rem] sm:rounded-[0.5rem] shadow-2xl p-6 overflow-hidden"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Edit Name</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <DefaultInput
                label="Full Name"
                placeholder="Enter your name"
                value={fullName}
                onChange={setFullName}
              />
              <div className="space-y-1.5 px-1">
                <label className="text-xs text-slate-500">Stoqle ID</label>
                <div className="px-5 py-2 rounded-2xl bg-slate-100 text-slate-500 text-sm font-medium">
                  @{stoqleId || "---"}
                </div>
                <p className="text-[10px] text-slate-400">Stoqle ID cannot be changed currently.</p>
              </div>
            </div>
            <div className="mt-8 flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-full font-bold text-sm text-slate-500 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 rounded-full font-bold text-sm bg-rose-500 text-white hover:bg-rose-500 transition disabled:opacity-50"
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
