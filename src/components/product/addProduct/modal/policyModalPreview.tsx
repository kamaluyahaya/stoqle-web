"use client";

import React, { useState } from "react";
import {
  ClipboardDocumentIcon,
  CheckCircleIcon
} from "@heroicons/react/24/outline";
import SevenDayReturnModal from "../../../business/policyModal/sevenDayReturnModal";
import ReturnShippingSubsidyModal from "../../../business/policyModal/returnShippingSubsidyModal";

type PolicyModalProps = {
  open: boolean;
  title?: string | null;
  body?: string | null;
  onClose: () => void;
};

export default function PolicyModal({ open, title, body, onClose }: PolicyModalProps) {
  const [copied, setCopied] = useState(false);
  const [showSevenDayModal, setShowSevenDayModal] = useState(false);
  const [showSubsidyModal, setShowSubsidyModal] = useState(false);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[600000] flex items-end lg:items-center justify-center p-0 lg:p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />

        <div
          className="relative bg-white w-full sm:max-w-sm h-[80vh] sm:h-auto sm:max-h-[85vh] rounded-t-[0.5rem] sm:rounded-[0.5rem] p-4 border-t sm:border border-slate-100 shadow-2xl flex flex-col justify-between"

          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-white sticky top-0 z-30 lg:rounded-t-[0.5rem] md:rounded-t-[0.5rem] rounded-t-[0.5rem] border-b border-slate-50">
            <div className="relative flex items-center px-5 h-14">
              <div className="w-9 h-9" />
              <h3 className="absolute left-1/2 -translate-x-1/2 text-lg font-medium text-slate-800 truncate max-w-[70%] text-center">
                {title ?? "Service Description"}
              </h3>

              <button
                onClick={onClose}
                className="ml-auto w-10 h-10 flex items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all duration-200"
                aria-label="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 bg-white text-sm text-slate-700">
              {(!body || body.trim() === "") ? (
                <div className="text-slate-400 text-center py-10 space-y-3">
                  <div className="font-semibold text-slate-500">No return shipping policy.</div>
                  <div className="text-xs leading-relaxed max-w-[280px] mx-auto">
                    This vendor currently does not provide 7-day no-reason returns or return shipping subsidies for this item.
                  </div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap break-words text-xs leading-relaxed space-y-4">
                  {body.split("\n").map((line, idx) => {
                    const cleanLine = line.trim();
                    const isHeading = cleanLine.endsWith(":") || line.includes("Supported");

                    if (isHeading) {
                      const isSevenDay = cleanLine.toLowerCase().includes("7-day no reason return");
                      const isSubsidy = cleanLine.toLowerCase().includes("return shipping subsidy");

                      return (
                        <div key={idx} className="flex items-center justify-between font-bold text-sm text-slate-800 border-b border-slate-50 pb-1 mt-6 first:mt-0">
                          <span>{line}</span>
                          {(isSevenDay || isSubsidy) && (
                            <button
                              onClick={() => {
                                if (isSevenDay) setShowSevenDayModal(true);
                                else if (isSubsidy) setShowSubsidyModal(true);
                              }}
                              className="text-[11px] font-bold text-red-500 hover:text-red-700 hover:underline transition-colors"
                            >
                              View details
                            </button>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className={line.trim() === "" ? "h-2" : "text-slate-500 text-xs"}>
                        {line}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Deep-dive modals */}
      <SevenDayReturnModal
        open={showSevenDayModal}
        onClose={() => setShowSevenDayModal(false)}
      />
      <ReturnShippingSubsidyModal
        open={showSubsidyModal}
        onClose={() => setShowSubsidyModal(false)}
      />
    </>
  );
}