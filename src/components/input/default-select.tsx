// components/CategorySelectionModal.tsx
"use client";

import React, { useEffect, useState } from "react";

type Props = {
  title?: string;
  options: string[];                 // option labels (single-select)
  value?: string | null;             // current selected value ("Electronics")
  onSelected: (val: string) => void; // callback when user confirms
  hintText?: string;                 // placeholder text shown when value is empty
  isRequired?: boolean;
  triggerLabel?: string;             // label shown on left of trigger row
};


export default function CategorySelectionModal({
  title = "Choose category",
  options,
  value = null,
  onSelected,
  hintText = "Select category",
  isRequired = false,
  triggerLabel = "Category",
}: Props) {
  const [open, setOpen] = useState(false);
  // temporary selection inside modal (so user can change without committing)
  const [tempSelection, setTempSelection] = useState<string | null>(value ?? null);

  // reflect external value -> tempSelection when value changes
  useEffect(() => {
    setTempSelection(value ?? null);
  }, [value]);

  function handleConfirm() {
    if (!tempSelection) return;
    onSelected(tempSelection);
    setOpen(false);
  }

  return (
    <>
      {/* Trigger row (looks like your DefaultSelect style) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-6 bg-white p-2 pb-4 w-full border-b border-slate-200"
      >
        <span className="text-sm text-slate-600 flex items-center gap-1 lg:min-w-[120px]">
          {triggerLabel} {isRequired && <span className="text-red-500">*</span>}
        </span>

        <span className=" text-sm text-slate-800 text-left">
            {value ? (
              value
            ) : (
              <span className="text-slate-500">{hintText}</span>
            )}
          </span>

       
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <button
            aria-label="Close"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* Sheet */}
          <div className="relative w-full sm:w-[640px] max-h-[84vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex-1 text-center">
                  <div className="text-lg font-semibold text-slate-900">{title}</div>
                </div>

                <button
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-md hover:bg-slate-100"
                >
                  <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content: chips */}
            <div className="px-4 py-4" style={{ height: "56vh", overflow: "auto" }}>
              <div className="flex flex-wrap gap-3">
                {options.map((opt) => {
                  const isSelected = opt === tempSelection;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setTempSelection(opt)}
                      className={`rounded-full px-4 py-2 text-sm border transition focus:outline-none
                        ${isSelected
                          ? "border-red-600 bg-red-50 text-red-600"
                          : "border-slate-200 text-slate-800 hover:bg-slate-50"}
                      `}
                      aria-pressed={isSelected}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer: Actions */}
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
                  onClick={handleConfirm}
                  disabled={!tempSelection}
                  className={`flex-1 py-3 rounded-full text-sm font-medium
                    ${tempSelection
                      ? "bg-red-500 text-white"
                      : "bg-slate-100 text-slate-500 cursor-not-allowed"}
                  `}
                >
                  Next
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
