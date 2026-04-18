// src/components/profile/modals/UserBioModal.tsx
"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DescriptionTextarea from "../../input/defaultDescTextarea";

type Props = {
  open: boolean;
  initialValue: string;
  onClose: () => void;
  onSave: (val: string) => Promise<void> | void;
};

export default function UserBioModal({ open, initialValue, onClose, onSave }: Props) {
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setBio(initialValue || "");
  }, [open, initialValue]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(bio);
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            className="relative bg-white w-full max-w-md rounded-t-[0.5rem] sm:rounded-[0.5rem] shadow-2xl p-6 overflow-hidden"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Edit Bio</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <DescriptionTextarea
                value={bio}
                onChange={setBio}
                placeholder="Tell others about yourself..."
                maxLength={200}
                maxLines={6}
              />
            </div>
            <div className="mt-8 flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-5 py-3 rounded-full font-bold text-sm text-slate-500 hover:bg-slate-50 transition"
              >
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
