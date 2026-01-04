import React, { useState } from "react";

type NumberInputProps = {
  label: string;
  value: number | "";
  onChange: (val: number | "") => void;
  placeholder?: string;
  required?: boolean;
  min?: number; // default = 1
};

export default function NumberInput({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  min = 1,
}: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Allow empty (so user can delete)
    if (raw === "") {
      onChange("");
      return;
    }

    // Numbers only
    if (!/^\d+$/.test(raw)) return;

    const num = Number(raw);

    // Reject <= 0
    if (num < min) return;

    onChange(num);
  };

  return (
    <div className="flex items-center gap-3 bg-white p-2 border-b border-slate-200">
      {/* Label */}
      <span className="text-sm text-slate-600 flex items-center gap-1 lg:min-w-[120px]">
        {label} {required && <span className="text-red-500">*</span>}
      </span>

      {/* Input */}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="flex-1 rounded-full px-4 py-2 text-sm text-black caret-red-500 outline-none transition focus:ring-gray-300"
      />
    </div>
  );
}
