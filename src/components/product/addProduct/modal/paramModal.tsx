// src/components/product/ParamsModal.tsx
"use client";
import DefaultInput from "@/src/components/input/default-input";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  initialData?: { key: string; value: string } | null;
  onClose: () => void;
  onSubmit: (data: { key: string; value: string }) => void;
};

export default function ParamsModal({ open, initialData, onClose, onSubmit }: Props) {
  const [keyText, setKeyText] = useState("");
  const [valueText, setValueText] = useState("");

useEffect(() => {
  // run whenever modal opens/closes OR initialData changes
  if (!open) {
    // clear state on close
    setKeyText("");
    setValueText("");
    return;
  }

  if (initialData) {
    setKeyText(initialData.key);
    setValueText(initialData.value);
  } else {
    // new param -> empty fields
    setKeyText("");
    setValueText("");
  }
}, [open, initialData]);


  if (!open) return null;

  const handleSubmit = () => {
    if (!keyText.trim()) return toast("Parameter key is required");
    if (!valueText.trim()) return toast("Parameter value is required");

    onSubmit({
      key: keyText.trim(),
      value: valueText.trim(),
    });

    // clear local state so next "add" is fresh
    setKeyText("");
    setValueText("");
  };

  return (
 <div className="fixed inset-0 z-75 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
  {/* Backdrop */}
  <div className="absolute inset-0 bg-black/40" onClick={() => onClose()} />

  <div className="relative w-full max-w-2xl bg-white lg:rounded-2xl md:rounded-2xl rounded-t-2xl shadow-xl p-5 z-10
                  h-[75vh] sm:h-auto flex flex-col">
    {/* Header */}
    <div className="flex items-center justify-between border-b border-slate-200">
      <h3 className="text-lg font-semibold mb-4">
          {initialData ? "Edit parameter" : "Add parameter"}
        </h3>
      <button onClick={() => onClose()} className="text-sm px-3 py-1 rounded-md hover:bg-slate-100">
        <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none">
          <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
        

        <div className="space-y-3 overflow-y-auto flex-1 mt-5">
            <DefaultInput label="Key" value={keyText} onChange={setKeyText} placeholder="Key (e.g. Material)" required />
            <DefaultInput label="Value" value={valueText} onChange={setValueText} placeholder="Value (e.g. Leather)" required />
        </div>

       {/* Footer */}
    <div className="mt-5 flex flex-col sm:flex-row justify-end gap-2 w-full">
  <button 
    onClick={handleSubmit} 
    className="w-full sm:w-auto px-4 py-2 rounded-full bg-red-500 text-white text-sm"
  >
    {initialData ? "Edit" : "Add"}
  </button>
</div>
</div>
    </div>
  );
}
