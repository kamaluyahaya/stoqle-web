import React, { useState } from "react";

type DescriptionTextareaProps = {
  value: string;
  onChange: (val: string) => void;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  maxLines?: number;
};

export default function DescriptionTextarea({
  value,
  onChange,
  rows = 4,
  placeholder,
  maxLength,
  required = false,
  maxLines,
}: DescriptionTextareaProps) {
  const [charCount, setCharCount] = useState(value.length);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;

    const lines = val.split("\n");

    if (maxLines && lines.length > maxLines) {
      return;
    }

    if (!maxLength || val.length <= maxLength) {
      onChange(val);
      setCharCount(val.length);
    }
  };

  return (
    <div className="w-full space-y-1">
      {/* Textarea */}
      <textarea
        value={value}
        onChange={handleChange}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-5 py-2 pr-11 text-sm text-black caret-rose-500 outline-none transition focus:ring-1 focus:ring-gray-300 resize-none"
      />

      {/* Footer */}
      <div className="flex justify-between text-xs text-slate-400">
        <span>
          {required && <span className="text-rose-500">* </span>}
          Description
        </span>

        {maxLength && (
          <span>
            {charCount}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
