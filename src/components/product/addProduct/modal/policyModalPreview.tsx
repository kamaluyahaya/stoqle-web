

"use client";

import React, { useMemo, useState } from "react";

type PolicyModalProps = {
  open: boolean;
  title?: string | null;
  body?: string | null;
  onClose: () => void;
};

export default function PolicyModal({ open, title, body, onClose }: PolicyModalProps) {
  const [copied, setCopied] = useState(false);

  // Extract promise duration from body with professional fallbacks
  const promiseDuration = useMemo(() => {
    if (!body) return "48 hours";

    try {
      // 1. Try parsing as JSON
      const parsed = JSON.parse(body);
      const durations = parsed?.shipping_duration || parsed?.shipping || [];
      if (Array.isArray(durations)) {
        const promise = durations.find((d: any) => d.type === "promise" || d.kind === "promise" || d.kind === "express");
        if (promise) {
          return `${promise.value} ${promise.unit}`;
        }
      }
    } catch {
      // 2. If not JSON (string from PolicyList), use robust regex patterns
      const patterns = [
        /promise to ship within (.*?) \(/i,
        /promise to ship within (.*?)(?:\.|,|$)/i,
        /aim to ship within (.*?)(?:\.|,|$)/i,
        /ship within (.*?)(?:\.|,|$)/i
      ];

      for (const p of patterns) {
        const match = body.match(p);
        if (match && match[1]) return match[1].trim();
      }
    }

    return "48 hours"; // Professional default fallback
  }, [body]);

  const formatted = useMemo(() => {
    if (!body) return null;
    const trimmed = body.trim();
    // If JSON string was passed, pretty-print it
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(trimmed);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return body;
      }
    }
    return body;
  }, [body]);

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatted ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-slate-100 lg:rounded-2xl md:rounded-2xl rounded-t-2xl shadow-xl z-10 h-[75vh] sm:h-auto flex flex-col">
        {/* Header */}
        <div className="bg-white pb-5 lg:rounded-2xl md:rounded-2xl rounded-t-2xl">
          <div className="relative flex items-center px-5">
            <div className="w-9 h-9" />
            <h3 className="absolute left-1/2 -translate-x-1/2 text-lg font-medium text-slate-800 truncate max-w-[70%] text-center">
              {title ?? "Shipping Policy"}
            </h3>

            {/* Close button */}
            <button
              onClick={onClose}
              className="ml-auto pt-4 pr-5 rounded-md hover:bg-slate-100"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5 text-slate-600"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M6 6L18 18M6 18L18 6"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className="text-sm text-slate-700 whitespace-pre-wrap p-5">
            Promise to ship within {promiseDuration}, delay compensation guaranteed.
          </div>
        </div>

        {/* Delivery address section */}
        <div className="bg-white mt-2">
          <div className="text-sm text-slate-700 p-5 whitespace-pre-wrap">
            <p>Select delivery address</p>

            <div className="text-center justify-center mt-2">
              <div className="text-slate-400 py-4">
                No address yet, please add an address first
              </div>
              <button className="border border-red-500 px-5 py-2 rounded-full text-red-500">
                Add delivery address
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-auto p-5 bg-white text-sm text-slate-700">
          {formatted == null ? (
            <div className="text-slate-400">No details available.</div>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{formatted}</pre>
          )}
        </div>

        {/* Delivery Notice / Delay Compensation */}
        <div className="bg-white mt-2">
          <div className="text-sm text-slate-700 p-5 whitespace-pre-wrap">
            <p>Delivery Notice</p>

            <div className="text-md font-semibold py-3 text-slate-700 whitespace-pre-wrap">
              Promise to ship within {promiseDuration}, delay compensation guaranteed
            </div>

            <div>
              If you make the payment now, we promise to ship the product within {promiseDuration}.
              If we fail to ship it within the promised time, we will compensate you with a discount coupon of at least 500 naira with no minimum purchase requirement (except for special items and force majeure factors).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}