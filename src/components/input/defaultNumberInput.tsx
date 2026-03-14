import React, { useState } from "react";

type NumberInputProps = {
  label: string;
  value: number | "";
  onChange: (val: number | "") => void;
  placeholder?: string;
  required?: boolean;
  min?: number; // default = 1
  variant?: "default" | "compact"; // ✅ NEW
};

export default function NumberInput({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  min = 1,
  variant = "default", // ✅ Default
}: NumberInputProps) {
  const isCompact = variant === "compact";
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Allow empty (so user can delete)
    if (raw === "") {
      onChange("");
      return;
    }

    const num = Number(raw);

    // Allow typing, enforce min via the "Next" button in the parent component
    onChange(num);
  };

  return (
    <div className={`flex items-center gap-2 ${isCompact ? "p-1 border-none" : "p-2 border-b border-slate-200"} bg-transparent`}>
      {/* Label - hide if compact to save space, or make tiny */}
      {!isCompact && (
        <span className="text-sm text-slate-600 flex items-center gap-1 lg:min-w-[120px]">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      )}

      {/* Input */}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={handleChange}
        placeholder={placeholder || (isCompact ? label : "")}
        className={`${isCompact ? "px-3 py-1.5 text-xs bg-slate-50 border border-slate-200" : "px-4 py-2 text-sm bg-white"} flex-1 rounded-full text-black caret-red-500 outline-none transition focus:ring-1 focus:ring-red-400`}
      />
    </div>
  );
}
