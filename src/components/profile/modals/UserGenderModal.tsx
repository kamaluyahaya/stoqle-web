// src/components/profile/modals/UserGenderModal.tsx
"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoMaleOutline, IoFemaleOutline, IoPersonOutline } from "react-icons/io5";

type Props = {
  open: boolean;
  initialValue: string;
  onClose: () => void;
  onSave: (value: string) => Promise<void> | void;
};

const OPTIONS = [
  { value: "male", label: "Male", icon: <IoMaleOutline size={20} /> },
  { value: "female", label: "Female", icon: <IoFemaleOutline size={20} /> },
  { value: "other", label: "Other", icon: <IoPersonOutline size={20} /> },
];

export default function UserGenderModal({ open, initialValue, onClose, onSave }: Props) {
  const [gender, setGender] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setGender(initialValue || "");
  }, [open, initialValue]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(gender);
    setSaving(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1001] flex items-end sm:items-center justify-center">
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
              <h3 className="text-xl font-bold text-slate-800">Gender</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <p className="text-sm text-slate-500 mb-5">Select the option that best describes you.</p>

            <div className="flex flex-col gap-3 mb-8">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGender(opt.value)}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-semibold transition border-2 ${
                    gender === opt.value
                      ? "bg-rose-50 border-rose-500 text-rose-600"
                      : "bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className={gender === opt.value ? "text-rose-500" : "text-slate-400"}>{opt.icon}</span>
                  {opt.label}
                  {gender === opt.value && (
                    <span className="ml-auto w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center text-white text-xs">✓</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={onClose} className="px-5 py-3 rounded-full font-bold text-sm text-slate-500 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !gender}
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
