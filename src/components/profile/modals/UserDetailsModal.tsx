// src/components/profile/modals/UserDetailsModal.tsx
"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DefaultInput from "../../input/default-input";
import DefaultSelect from "../../input/default-select";

type Props = {
  open: boolean;
  initialValue: string; // JSON: { gender, dob, location, job, school }
  onClose: () => void;
  onSave: (payloadJson: string) => Promise<void> | void;
};

export default function UserDetailsModal({ open, initialValue, onClose, onSave }: Props) {
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [location, setLocation] = useState("");
  const [job, setJob] = useState("");
  const [school, setSchool] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      try {
        const p = JSON.parse(initialValue);
        setGender(p.gender || "");
        setDob(p.dob || "");
        setLocation(p.location || "");
        setJob(p.job || "");
        setSchool(p.school || "");
      } catch (e) {
        setGender("");
        setDob("");
        setLocation("");
        setJob("");
        setSchool("");
      }
    }
  }, [open, initialValue]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(JSON.stringify({ gender, dob, location, job, school }));
    setSaving(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1001] flex items-end sm:items-center justify-center">
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
            className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Edit Details</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pb-6 px-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 tracking-widest block">Gender</label>
                <div className="flex gap-2">
                  {['male', 'female', 'other'].map(g => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition ${gender === g ? "bg-rose-500 text-white shadow-md shadow-rose-200" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <DefaultInput
                label="Date of Birth"
                type="date"
                value={dob}
                onChange={setDob}
              />

              <DefaultInput
                label="Region / Location"
                placeholder="Where do you live?"
                value={location}
                onChange={setLocation}
              />

              <DefaultInput
                label="Occupation"
                placeholder="What do you do?"
                value={job}
                onChange={setJob}
              />

              <DefaultInput
                label="School"
                placeholder="Where did you study?"
                value={school}
                onChange={setSchool}
              />
            </div>

            <div className="mt-4 flex gap-3 bg-white pt-4 border-t border-slate-50">
              <button
                onClick={onClose}
                className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-4 rounded-2xl font-bold bg-rose-500 text-white hover:bg-rose-600 transition disabled:opacity-50"
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
