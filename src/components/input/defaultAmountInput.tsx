import React, { useState } from "react";

type NumberInputProps = {
    label: string;
    value: number | string | "";
    onChange: (val: number | string | "") => void;
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
        // Remove all non-numeric characters EXCEPT the decimal point
        const clean = e.target.value.replace(/[^0-9.]/g, "");

        if (clean === "") {
            onChange("");
            return;
        }

        // Allow typing only one decimal point
        const parts = clean.split('.');
        if (parts.length > 2) return;

        // Check if it's a valid number format (e.g., '10.', '10.5')
        // We pass it up as a string to allow the user to type decimal points
        onChange(clean);
    };

    // Format helper
    const formatWithCommas = (val: string | number) => {
        const s = val.toString();
        const parts = s.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return parts.join('.');
    };

    const displayValue = formatWithCommas(value);

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
                inputMode="decimal"
                value={displayValue}
                onChange={handleChange}
                placeholder={placeholder || (isCompact ? label : "")}
                className={`${isCompact ? "px-3 py-1.5 text-xs bg-slate-50 border border-slate-200" : "px-4 py-2 text-sm bg-white"} flex-1 rounded-full text-black caret-red-500 outline-none transition focus:ring-1 focus:ring-red-400`}
            />
        </div>
    );
}
