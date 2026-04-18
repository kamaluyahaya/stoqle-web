"use client";

import React from "react";

interface DefaultInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  type?: "text" | "password" | "email" | "number" | "textarea";
  rows?: number;
  className?: string;
  id?: string;
}

export default function DefaultInput({
  value,
  onChange,
  placeholder,
  type = "text",
  rows = 1,
  className = "",
  id,
}: DefaultInputProps) {
  const baseStyles = "w-full py-3 bg-transparent border-b border-slate-200 focus:border-b-rose-500 transition-all duration-300 text-sm text-slate-900 placeholder:text-slate-400 outline-none caret-rose-500";

  if (type === "textarea") {
    return (
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={`${baseStyles} resize-none min-h-[40px] ${className}`}
      />
    );
  }

  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`${baseStyles} ${className}`}
    />
  );
}
