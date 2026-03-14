// components/AddressSelectionModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Hierarchy = {
  [country: string]: {
    [state: string]: string[];
  };
};

type Props = {
  title?: string;
  hintText?: string;
  isRequired?: boolean;
  hierarchy: Hierarchy;
  value?: string | null;
  onSelected: (full: string) => void;
  triggerLabel?: string;
};

/**
 * Feature flags / available countries
 * Keep these outside the component so they are stable and available
 */
const ENABLED_COUNTRIES = ["Nigeria"];

const DISABLED_COUNTRIES = [
  "Ghana",
  "Kenya",
  "Niger",
  "Cameroon",
  "South Africa",
];

export default function AddressSelectionModal({
  title = "Address",
  hintText = "Select country, state, and LGA",
  isRequired = false,
  hierarchy,
  value = null,
  onSelected,
  triggerLabel = "Choose address",
}: Props) {
  const [open, setOpen] = useState(false);

  // selection state inside modal
  const [level, setLevel] = useState<number>(0); // 0 country, 1 state, 2 lga
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedLga, setSelectedLga] = useState<string | null>(null);
  const [stateQuery, setStateQuery] = useState("");
  const [lgaQuery, setLgaQuery] = useState("");

  // reflect external `value` prop ("Country, State, LGA")
  useEffect(() => {
    if (!value) {
      setSelectedCountry(null);
      setSelectedState(null);
      setSelectedLga(null);
      return;
    }
    const parts = value.split(",").map((p) => p.trim());
    setSelectedCountry(parts[0] ?? null);
    setSelectedState(parts[1] ?? null);
    setSelectedLga(parts[2] ?? null);
  }, [value]);

  // Compose the visible country list: enabled first (if present in hierarchy), then disabled placeholders.
  const countries = useMemo(() => {
    const fromHierarchy = Object.keys(hierarchy);
    const enabledInHierarchy = ENABLED_COUNTRIES.filter((c) =>
      fromHierarchy.includes(c)
    );
    // ensure disabled countries are shown (they may not be in hierarchy)
    const combined = [...enabledInHierarchy, ...DISABLED_COUNTRIES];
    // dedupe safety
    return Array.from(new Set(combined));
  }, [hierarchy]);

  const states = useMemo(() => {
    if (!selectedCountry) return [];
    return Object.keys(hierarchy[selectedCountry] ?? {}).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [hierarchy, selectedCountry]);

  const lgas = useMemo(() => {
    if (!selectedCountry || !selectedState) return [];
    return (hierarchy[selectedCountry]?.[selectedState] ?? []).slice().sort();
  }, [hierarchy, selectedCountry, selectedState]);

  const filteredStates = useMemo(
    () =>
      states.filter((s) =>
        s.toLowerCase().includes(stateQuery.trim().toLowerCase())
      ),
    [states, stateQuery]
  );

  const filteredLgas = useMemo(
    () =>
      lgas.filter((l) => l.toLowerCase().includes(lgaQuery.trim().toLowerCase())),
    [lgas, lgaQuery]
  );

  // Prevent advancing when a disabled country is selected
  const canNext = () => {
    if (level === 0)
      return !!selectedCountry && ENABLED_COUNTRIES.includes(selectedCountry);
    if (level === 1) return !!selectedState;
    if (level === 2) return !!selectedLga;
    return false;
  };

  function commitSelectionAndClose() {
    if (selectedCountry && selectedState && selectedLga) {
      const full = `${selectedCountry}, ${selectedState}, ${selectedLga}`;
      onSelected(full);
      setOpen(false);
    }
  }

  // immediate commit on LGA tap
  function handleLgaClick(l: string) {
    setSelectedLga(l);
    if (selectedCountry && selectedState) {
      const full = `${selectedCountry}, ${selectedState}, ${l}`;
      onSelected(full);
    }
    setOpen(false);
  }

  // Reset search queries when changing level
  useEffect(() => {
    setStateQuery("");
    setLgaQuery("");
  }, [level]);

  const ModalContent = () => (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
          {/* backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* sheet */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full sm:w-[640px] max-h-[84vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* header */}
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {level === 0 ? "Select Country" : level === 1 ? "Select State" : "Select LGA"}
                  </h3>
                  <div className="mt-1 text-sm text-slate-500">
                    {level === 0 ? "Choose a country" : level === 1 ? "Choose a state" : "Choose a local government area"}
                  </div>
                </div>
                <button
                  aria-label="Close"
                  className="p-2 rounded-md hover:bg-slate-100"
                  onClick={() => setOpen(false)}
                >
                  <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* breadcrumb */}
            {level > 0 && (
              <div className="px-4 py-3 border-b border-slate-200">
                <div className="flex gap-6 text-sm">
                  <button
                    className="text-left"
                    onClick={() => setLevel(0)}
                  >
                    <div className="text-xs text-slate-400">Country</div>
                    <div className={`mt-1 ${selectedCountry ? "text-slate-900 font-semibold" : "text-slate-500"}`}>
                      {selectedCountry ?? "Please select"}
                    </div>
                  </button>

                  <button
                    className="text-left"
                    onClick={() => selectedCountry && setLevel(1)}
                  >
                    <div className="text-xs text-slate-400">State</div>
                    <div className={`${selectedState ? "text-slate-900 font-semibold" : "text-slate-500"}`}>
                      {selectedState ?? "Please select"}
                    </div>
                  </button>

                  <button
                    className="text-left"
                    onClick={() => selectedState && setLevel(2)}
                  >
                    <div className="text-xs text-slate-400">LGA</div>
                    <div className={`${selectedLga ? "text-slate-900 font-semibold" : "text-slate-500"}`}>
                      {selectedLga ?? "Please select"}
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* body */}
            <div className="px-2 py-3" style={{ height: "56vh", overflow: "hidden" }}>
              {/* level 0: countries */}
              {level === 0 && (
                <div className="h-full overflow-y-auto">
                  <ul>
                    {countries.map((c) => {
                      const isEnabled = ENABLED_COUNTRIES.includes(c);
                      const isSelected = c === selectedCountry;

                      return (
                        <li key={c} className="px-4">
                          <button
                            disabled={!isEnabled}
                            onClick={() => {
                              if (!isEnabled) return;
                              setSelectedCountry(c);
                              setSelectedState(null);
                              setSelectedLga(null);
                              setLevel(1);
                            }}
                            className={`w-full text-left py-3 flex items-center justify-between rounded-xl
                          ${isEnabled ? "hover:bg-slate-50" : "cursor-not-allowed opacity-60"}
                        `}
                          >
                            <div
                              className={`text-sm ${isEnabled
                                  ? isSelected
                                    ? "text-red-600 font-semibold"
                                    : "text-slate-900"
                                  : "text-slate-400"
                                }`}
                            >
                              {c}
                            </div>

                            {!isEnabled ? (
                              <div className="text-xs text-slate-400 italic">Coming soon</div>
                            ) : isSelected ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
                              </svg>
                            ) : null}
                          </button>
                          <div className="h-px bg-slate-100 my-2" />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* level 1: states with search */}
              {level === 1 && (
                <div className="flex flex-col h-full">
                  <div className="px-4 pb-3">
                    <input
                      className="
                  w-full
                  rounded-full
                  bg-gray-100
                  px-5
                  py-2
                  pr-11
                  text-sm
                  text-black
                  caret-red-500
                  outline-none
                  transition
                  focus:ring-1
                  focus:ring-gray-300
                "
                      placeholder="Search state..."
                      value={stateQuery}
                      onChange={(e) => setStateQuery(e.target.value)}
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto px-2">
                    {filteredStates.length === 0 ? (
                      <div className="text-center text-sm text-slate-500 mt-8">No states found</div>
                    ) : (
                      <ul>
                        {filteredStates.map((s) => {
                          const isSelected = s === selectedState;
                          return (
                            <li key={s} className="px-4">
                              <button
                                onClick={() => {
                                  setSelectedState(s);
                                  setSelectedLga(null);
                                  setLevel(2);
                                  setLgaQuery("");
                                }}
                                className="w-full text-left py-3 flex items-center justify-between rounded-xl hover:bg-slate-50"
                              >
                                <div className={`text-sm ${isSelected ? "text-red-600 font-semibold" : "text-slate-900"}`}>{s}</div>
                                {isSelected && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                              <div className="h-px bg-slate-100 my-2" />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* level 2: lgas with search */}
              {level === 2 && (
                <div className="flex flex-col h-full">
                  <div className="px-4 pb-3">
                    <input
                      className="
                    w-full
                    rounded-full
                    bg-gray-100
                    px-5
                    py-2
                    pr-11
                    text-sm
                    text-black
                    caret-red-500
                    outline-none
                    transition
                    focus:ring-1
                    focus:ring-gray-300
                    "
                      placeholder="Search LGA..."
                      value={lgaQuery}
                      onChange={(e) => setLgaQuery(e.target.value)}
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto px-2">
                    {filteredLgas.length === 0 ? (
                      <div className="text-center text-sm text-slate-500 mt-8">No LGAs found</div>
                    ) : (
                      <ul>
                        {filteredLgas.map((l) => {
                          const isSelected = l === selectedLga;
                          return (
                            <li key={l} className="px-4">
                              <button
                                onClick={() => handleLgaClick(l)}
                                className="w-full text-left py-3 flex items-center justify-between rounded-xl hover:bg-slate-50"
                              >
                                <div className={`text-sm ${isSelected ? "text-red-600 font-semibold" : "text-slate-900"}`}>{l}</div>
                                {isSelected && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                              <div className="h-px bg-slate-100 my-2" />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* footer */}


            <div className="sticky lg:bottom-5 md:bottom-5 bottom-15 z-20 bg-white px-4 py-4
                            pb-[env(safe-area-inset-bottom)]">
              <div className="flex gap-3">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 py-3 rounded-full border border-slate-200 text-sm font-medium"
                >
                  Cancel
                </button>

                <button
                  onClick={() => {
                    if (!canNext()) return;
                    if (level === 0) {
                      setLevel(1);
                      return;
                    }
                    if (level === 1) {
                      setLevel(2);
                      return;
                    }
                    if (level === 2) {
                      commitSelectionAndClose();
                    }
                  }}
                  className={`flex-1 py-3 rounded-full text-sm font-medium ${canNext() ? "bg-red-600 text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  {level < 2 ? "Next" : "Select"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // visible trigger row - matches your DefaultSelect style
  return (
    <>
      <div>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setLevel(0);
          }}
          className="flex items-center gap-6 bg-white rounded-xl p-4 w-full"
        >
          <span className="text-sm text-slate-600 flex items-center gap-1 lg:min-w-[120px]">
            {title} {isRequired && <span className="text-red-500">*</span>}
          </span>

          <span className=" text-sm text-slate-800 text-left">
            {value ? (
              value
            ) : (
              <span className="text-slate-400">{hintText}</span>
            )}
          </span>


        </button>
      </div>

      {ModalContent()}
    </>
  );
}
