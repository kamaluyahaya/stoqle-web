"use client";

import React from "react";

interface VerifiedBadgeProps {
    /** Badge label to show on hover or as tooltip. Defaults to "Trusted Partner" */
    label?: string | null;
    /** Badge size variant */
    size?: "xs" | "sm" | "md";
    /** Show the label text inline alongside the icon */
    showLabel?: boolean;
    className?: string;
}

const sizeMap = {
    xs: { icon: "w-3 h-3",   text: "text-[9px]",  gap: "gap-0.5", dot: "w-4 h-4" },
    sm: { icon: "w-3.5 h-3.5", text: "text-[10px]", gap: "gap-1",   dot: "w-5 h-5" },
    md: { icon: "w-4.5 h-4.5", text: "text-xs",     gap: "gap-1.5", dot: "w-6 h-6" },
};

/**
 * 8-pointed star "Trusted Partner" badge — used globally across the app.
 * Drop this anywhere a vendor name is displayed when you have verified_badge === true.
 *
 * Usage:
 *   {vendor.verified_badge && <VerifiedBadge />}
 *   {vendor.verified_badge && <VerifiedBadge showLabel label={vendor.badge_label} size="sm" />}
 */
export function VerifiedBadge({ label = "Trusted Partner", size = "sm", showLabel = false, className = "" }: VerifiedBadgeProps) {
    const s = sizeMap[size];

    return (
        <span
            title={label ?? "Trusted Partner"}
            className={`inline-flex items-center ${s.gap} shrink-0 ${className}`}
        >
            {/* 8-pointed star with animated pulse ring */}
            <span className="relative inline-flex items-center justify-center">
                {/* Pulse ring */}
                <span
                    className={`absolute ${s.dot} rounded-full bg-sky-400 opacity-30 animate-ping pointer-events-none`}
                    style={{ animationDuration: "2.8s" }}
                />
                {/* 8-pointed star: two overlapping squares rotated 0° and 45° */}
                <svg
                    className={`${s.icon} relative z-10 drop-shadow-sm`}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label={label ?? "Trusted Partner"}
                >
                    {/* Square 1 – upright */}
                    <rect x="3" y="3" width="18" height="18" rx="3" fill="#38bdf8" />
                    {/* Square 2 – rotated 45°, creating the 8-point star shape */}
                    <rect
                        x="3" y="3"
                        width="18" height="18"
                        rx="3"
                        fill="#0ea5e9"
                        transform="rotate(45 12 12)"
                    />
                    {/* Star centre circle (lighter) */}
                    <circle cx="12" cy="12" r="4.5" fill="#e0f2fe" />
                    {/* Checkmark */}
                    <path
                        d="M9.5 12.2l1.8 1.8 3.7-3.7"
                        stroke="#0369a1"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />
                </svg>
            </span>

            {showLabel && (
                <span className={`${s.text} font-bold text-sky-700 leading-none tracking-tight`}>
                    {label ?? "Trusted Partner"}
                </span>
            )}
        </span>
    );
}

/**
 * Inline "Partner" pill badge — for use inside product title lines or compact lists.
 */
export function PartnerPill({ label = "Partner", size = "sm" }: { label?: string; size?: "xs" | "sm" }) {
    const textSize = size === "xs" ? "text-[8px] px-1 py-px" : "text-[9px] px-1.5 py-0.5";
    return (
        <span className={`inline-flex items-center gap-0.5 shrink-0 bg-sky-500 text-white ${textSize} font-bold rounded-sm shadow-sm tracking-wider`}>
            {/* Tiny 8-pointed star */}
            <svg className="w-2 h-2 shrink-0" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="4" width="16" height="16" rx="2.5" fill="white" />
                <rect x="4" y="4" width="16" height="16" rx="2.5" fill="rgba(255,255,255,0.7)" transform="rotate(45 12 12)" />
            </svg>
            {label}
        </span>
    );
}

export default VerifiedBadge;
