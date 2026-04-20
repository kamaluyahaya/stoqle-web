// src/components/profile/modals/UserLocationModal.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { countries } from "@/src/lib/api/country";

type Props = {
  open: boolean;
  initialValue: string;
  onClose: () => void;
  onSave: (value: string) => Promise<void> | void;
};

export default function UserLocationModal({ open, initialValue, onClose, onSave }: Props) {
  const [level, setLevel] = useState<0 | 1 | 2>(0);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedLga, setSelectedLga] = useState<string | null>(null);
  const [stateQuery, setStateQuery] = useState("");
  const [lgaQuery, setLgaQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // Parse the initial value ("State, LGA") when modal opens
  useEffect(() => {
    if (open) {
      setLevel(0);
      setStateQuery("");
      setLgaQuery("");
      if (initialValue) {
        const parts = initialValue.split(",").map((p) => p.trim());
        // Try to match "Nigeria, State, LGA" or "State, LGA"
        const stateRaw = parts.length >= 3 ? parts[1] : parts[0];
        const lgaRaw = parts.length >= 3 ? parts[2] : parts[1];
        setSelectedState(stateRaw || null);
        setSelectedLga(lgaRaw || null);
      } else {
        setSelectedState(null);
        setSelectedLga(null);
      }
    }
  }, [open, initialValue]);

  useEffect(() => {
    setStateQuery("");
    setLgaQuery("");
  }, [level]);

  const nigeriaStates = useMemo(() => Object.keys(countries["Nigeria"] ?? {}).sort(), []);

  const lgas = useMemo(() => {
    if (!selectedState) return [];
    return (countries["Nigeria"]?.[selectedState] ?? []).slice().sort();
  }, [selectedState]);

  const filteredStates = useMemo(
    () => nigeriaStates.filter((s) => s.toLowerCase().includes(stateQuery.trim().toLowerCase())),
    [nigeriaStates, stateQuery]
  );

  const filteredLgas = useMemo(
    () => lgas.filter((l) => l.toLowerCase().includes(lgaQuery.trim().toLowerCase())),
    [lgas, lgaQuery]
  );

  const handleSelectState = (s: string) => {
    setSelectedState(s);
    setSelectedLga(null);
    setLevel(1);
  };

  const handleSelectLga = async (l: string) => {
    setSelectedLga(l);
    setSaving(true);
    const fullLocation = `Nigeria, ${selectedState}, ${l}`;
    await onSave(fullLocation);
    setSaving(false);
    onClose();
  };

  const currentValue = selectedState
    ? selectedLga
      ? `${selectedState}, ${selectedLga}`
      : selectedState
    : "";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center" role="dialog">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full sm:w-[500px] max-h-[85vh] bg-white rounded-t-[0.5rem] sm:rounded-[0.5rem] overflow-hidden flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {level === 0 ? "Select State" : "Select LGA"}
                </h3>
                {currentValue && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[260px]">{currentValue}</p>
                )}
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Breadcrumb */}
            {level === 1 && (
              <div className="px-5 pb-2 flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setLevel(0)}
                  className="text-xs text-rose-500 font-semibold"
                >
                  ← Back to States
                </button>
                <span className="text-xs text-slate-400">/ {selectedState}</span>
              </div>
            )}

            {/* Search */}
            <div className="px-5 pb-3 shrink-0">
              <input
                className="w-full rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-rose-300 transition"
                placeholder={level === 0 ? "Search state..." : "Search LGA..."}
                value={level === 0 ? stateQuery : lgaQuery}
                onChange={(e) => level === 0 ? setStateQuery(e.target.value) : setLgaQuery(e.target.value)}
                autoFocus
              />
            </div>

            {/* Lists */}
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {level === 0 && (
                <ul>
                  {filteredStates.length === 0
                    ? <p className="text-center text-sm text-slate-400 mt-8">No states found</p>
                    : filteredStates.map((s) => (
                      <li key={s}>
                        <button
                          onClick={() => handleSelectState(s)}
                          className={`w-full text-left px-3 py-3 flex items-center justify-between rounded-xl hover:bg-slate-50 transition ${s === selectedState ? "text-rose-500 font-semibold" : "text-slate-700"
                            }`}
                        >
                          <span className="text-sm">{s}</span>
                          {s === selectedState && (
                            <svg className="h-4 w-4 text-rose-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                        <div className="h-px bg-slate-50 mx-3" />
                      </li>
                    ))
                  }
                </ul>
              )}

              {level === 1 && (
                <ul>
                  {filteredLgas.length === 0
                    ? <p className="text-center text-sm text-slate-400 mt-8">No LGAs found</p>
                    : filteredLgas.map((l) => (
                      <li key={l}>
                        <button
                          onClick={() => !saving && handleSelectLga(l)}
                          disabled={saving}
                          className={`w-full text-left px-3 py-3 flex items-center justify-between rounded-xl hover:bg-slate-50 transition disabled:opacity-50 ${l === selectedLga ? "text-rose-500 font-semibold" : "text-slate-700"
                            }`}
                        >
                          <span className="text-sm">{l}</span>
                          {l === selectedLga && (
                            <svg className="h-4 w-4 text-rose-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                        <div className="h-px bg-slate-50 mx-3" />
                      </li>
                    ))
                  }
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 shrink-0 bg-white">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-500 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                {saving && (
                  <div className="flex items-center gap-2 px-4 text-sm text-slate-500">
                    <div className="animate-spin h-4 w-4 border-2 border-rose-500 border-t-transparent rounded-full" />
                    Saving...
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
