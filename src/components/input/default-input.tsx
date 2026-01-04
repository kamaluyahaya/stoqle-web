import React, { useState } from "react";

type DefaultInputProps = {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
};

export default function DefaultInput({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  maxLength,
}: DefaultInputProps) {
  const [charCount, setCharCount] = useState(value.length);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!maxLength || val.length <= maxLength) {
      onChange(val);
      setCharCount(val.length);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-white p-2 border-b border-slate-200">
      {/* Label */}
      <span className="text-sm text-slate-600 flex items-center gap-1 lg:min-w-[120px]">
        {label} {required && <span className="text-red-500">*</span>}
      </span>

      {/* Input */}
      <input
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="flex-1 rounded-full px-4 py-2 text-sm text-black caret-red-500 outline-none transition  focus:ring-gray-300"
      />

      {/* Max length */}
      {maxLength && (
        <span className="text-xs text-slate-400">
          {charCount}/{maxLength}
        </span>
      )}
    </div>
  );
}
