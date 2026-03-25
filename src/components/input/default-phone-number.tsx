import React, { useState } from "react";

type NumberInputProps = {
    label: string;
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    required?: boolean;
    variant?: "default" | "compact";
    maxLength?: number;
};

export default function NumberInput({
    label,
    value,
    onChange,
    placeholder,
    required = false,
    variant = "default",
    maxLength,
}: NumberInputProps) {
    const isCompact = variant === "compact";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const clean = raw.replace(/\D/g, "");
        
        if (maxLength && clean.length > maxLength) return;
        
        onChange(clean);
    };

    return (
        <div className={`flex items-center gap-2 ${isCompact ? "p-1 border-none" : "p-2 border-b border-slate-200"} bg-transparent`}>
            {!isCompact && (
                <span className="text-sm text-slate-600 flex items-center gap-1 lg:min-w-[120px]">
                    {label} {required && <span className="text-red-500">*</span>}
                </span>
            )}

            <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={value}
                onChange={handleChange}
                maxLength={11}
                placeholder={placeholder || (isCompact ? label : "")}
                className={`${isCompact ? "px-3 py-1.5 text-xs bg-slate-50 border border-slate-200" : "px-4 py-2 text-sm bg-white"} flex-1 rounded-full text-black caret-red-500 outline-none transition focus:ring-1 focus:ring-red-400`}
            />

            {maxLength && (
                <span className="text-[10px] text-slate-400 font-bold shrink-0 min-w-[30px] text-right">
                    {value.length}/{maxLength}
                </span>
            )}
        </div>
    );
}
