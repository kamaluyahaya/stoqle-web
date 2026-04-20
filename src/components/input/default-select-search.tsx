"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

  // search state
  const [query, setQuery] = useState("");

  // focused index for keyboard navigation within filtered list
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const searchRef = useRef<HTMLInputElement | null>(null);

  // reflect external value -> tempSelection when value changes
  useEffect(() => {
    setTempSelection(value ?? null);
  }, [value]);

  // Reset query & focus when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setFocusedIndex(null);
      // focus the search input after next tick
      setTimeout(() => searchRef.current?.focus(), 120);
    }
  }, [open]);

  // Filter options using simple substring match (case-insensitive)
  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options.slice();

  // If focusedIndex goes out of range, clamp it
  useEffect(() => {
    if (focusedIndex == null) return;
    if (focusedIndex < 0) setFocusedIndex(0);
    else if (focusedIndex >= filtered.length) setFocusedIndex(filtered.length - 1);
  }, [focusedIndex, filtered.length]);

  // Scroll focused item into view when it changes
  useEffect(() => {
    if (focusedIndex == null) return;
    const el = optionRefs.current[focusedIndex];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", behavior: "smooth", inline: "nearest" });
    }
  }, [focusedIndex]);

  function handleConfirm() {
    if (!tempSelection) return;
    onSelected(tempSelection);
    setOpen(false);
  }

  function onKeyDownList(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev == null ? 0 : Math.min(filtered.length - 1, prev + 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev == null ? Math.max(0, filtered.length - 1) : Math.max(0, prev - 1)));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      // if there's a focused item, select it; otherwise if there's exactly one match, select it
      if (focusedIndex != null && filtered[focusedIndex]) {
        setTempSelection(filtered[focusedIndex]);
      } else if (filtered.length === 1) {
        setTempSelection(filtered[0]);
      }
      // if something selected, confirm
      if (tempSelection || filtered.length === 1 || focusedIndex != null) {
        const toConfirm = tempSelection ?? filtered[focusedIndex ?? 0] ?? null;
        if (toConfirm) {
          onSelected(toConfirm);
          setOpen(false);
        }
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  // when user types query, reset focusedIndex to first match
  useEffect(() => {
    if (!query) {
      setFocusedIndex(null);
      return;
    }
    setFocusedIndex(filtered.length ? 0 : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Clear handler
  function clearQuery() {
    setQuery("");
    setFocusedIndex(null);
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  return (
    <>
      {/* Trigger row (looks like your DefaultSelect style) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-6 bg-white p-1 pb-4 w-full border-b border-slate-200"
      >
        <span className="text-sm text-slate-600 flex items-center gap-1 lg:min-w-[120px]">
          {triggerLabel} {isRequired && <span className="text-rose-500">*</span>}
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
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[99999999] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-label="Close"
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.5 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full sm:w-[640px] max-h-[92vh] sm:max-h-[84vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
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

                {/* Search input */}
                <div className="mt-3">
                  <div className="relative">
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={onKeyDownList}
                      placeholder={`Search ${title.toLowerCase()}…`}
                      className="w-full border border-slate-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                    />

                    {query && (
                      <button
                        aria-label="Clear search"
                        onClick={clearQuery}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100"
                      >
                        <svg className="w-4 h-4 text-slate-500" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 6L14 14M6 14L14 6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-slate-500">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</div>
                </div>
              </div>

              {/* Content: chips/list */}
              <div className="px-4 py-4" style={{ height: "56vh", overflow: "auto" }} ref={listRef} onKeyDown={onKeyDownList} tabIndex={-1}>
                <div className="flex flex-wrap gap-3">
                  {filtered.length === 0 && (
                    <div className="py-8 w-full text-center text-sm text-slate-500">No results</div>
                  )}

                  {filtered.map((opt, idx) => {
                    const isSelected = opt === tempSelection;
                    const isFocused = idx === focusedIndex;

                    return (
                      <button
                        key={opt}
                        ref={(el) => {
                          optionRefs.current[idx] = el; // assign the element
                        }}

                        type="button"
                        onClick={() => setTempSelection(opt)}
                        onMouseEnter={() => setFocusedIndex(idx)}
                        className={`rounded-full px-4 py-2 text-sm border transition focus:outline-none
                          ${isSelected
                            ? "border-rose-500 bg-rose-50 text-rose-500"
                            : "border-slate-200 text-slate-800 hover:bg-slate-50"}
                        ${isFocused ? "ring-2 ring-rose-200" : ""}
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
              <div className="sticky lg:bottom-5 md:bottom-5 bottom-15 z-20 bg-white px-4 py-4 pb-[env(safe-area-inset-bottom)]">
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
                        ? "bg-rose-500 text-white"
                        : "bg-slate-100 text-slate-500 cursor-not-allowed"}
                    `}
                  >
                    Next
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
