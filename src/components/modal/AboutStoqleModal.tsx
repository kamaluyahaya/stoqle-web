"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  XMarkIcon,
  StarIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
  ShoppingBagIcon,
  ChevronRightIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";

import PolicyModal from "./PolicyModal";
import RateAppModal from "./RateAppModal";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AboutStoqleModal({ open, onClose }: Props) {
  const [showRate, setShowRate] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [policyProps, setPolicyProps] = useState({ title: "", endpoint: "" });

  const openPolicy = (title: string, endpoint: string) => {
    setPolicyProps({ title, endpoint });
    setShowPolicy(true);
  };

  const INFO_ROWS = [
    { label: "Rate our app", icon: StarIcon, action: () => setShowRate(true) },
    { label: "User agreement", icon: DocumentTextIcon, action: () => openPolicy("User Agreement", "/api/app/user-agreement") },
    { label: "Privacy Policy", icon: ShieldCheckIcon, action: () => openPolicy("Privacy Policy", "/api/app/privacy-policy") },
    { label: "License information", icon: InformationCircleIcon, action: () => openPolicy("License Information", "/api/app/license") },
    { label: "E-commerce policies", icon: ShoppingBagIcon, action: () => openPolicy("E-commerce Policies", "/api/app/ecommerce-policies") },
  ];

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[600000] bg-black/50"
              onClick={onClose}
            />

            {/* Mobile: Bottom Sheet - 80% height as requested */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 z-[700000] bg-white rounded-t-[0.5rem] shadow-2xl lg:hidden flex flex-col"
              style={{ height: "80vh" }}
            >
              <SheetContent onClose={onClose} rows={INFO_ROWS} />
            </motion.div>

            {/* Desktop: Centered Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="hidden lg:flex flex-col fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[700000] bg-white rounded-[0.5rem] shadow-2xl w-full max-w-sm overflow-hidden"
              style={{ maxHeight: "80vh" }}
            >
              <SheetContent onClose={onClose} rows={INFO_ROWS} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Sub-modals */}
      <RateAppModal open={showRate} onClose={() => setShowRate(false)} />

      <PolicyModal
        open={showPolicy}
        onClose={() => setShowPolicy(false)}
        title={policyProps.title}
        endpoint={policyProps.endpoint}
      />
    </>
  );
}

function SheetContent({ onClose, rows }: { onClose: () => void, rows: any[] }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Pull handle */}
      <div className="flex justify-center pt-3 pb-1 lg:hidden shrink-0">
        <div className="w-10 h-1 bg-slate-200 rounded-full" />
      </div>

      <div className="flex justify-end px-4 pt-2 shrink-0">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <XMarkIcon className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Center Logo and Version */}
      <div className="flex flex-col items-center justify-center pt-2 pb-6 shrink-0">

        <h2 className="text-xl font-extrabold text-slate-100 tracking-tight bg-red-500 px-4 py-1 rounded-full">stoqle</h2>
        <p className="text-sm font-medium text-slate-400 mt-1">Version 1.0.0</p>
      </div>

      {/* Info rows */}
      <div className="px-4 pb-6 flex-1">
        <div className="bg-slate-50 border border-slate-100/50 rounded-2xl overflow-hidden divide-y divide-slate-100">
          {rows.map((row) => (
            <div
              key={row.label}
              onClick={row.action}
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-100 active:bg-slate-200 transition-all group"
            >
              <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100 shrink-0 group-hover:scale-105 transition-transform">
                <row.icon className="w-[18px] h-[18px] text-slate-500" />
              </div>
              <span className="flex-1 text-[15px] font-semibold text-slate-700">{row.label}</span>
              <ChevronRightIcon className="w-4 h-4 text-slate-300 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-8 pt-4 flex flex-col items-center gap-2 text-center border-t border-slate-50 shrink-0">
        <p className="text-xs font-semibold text-slate-400">
          © 2024–2026 Stoqle. All Rights Reserved.
        </p>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <PhoneIcon className="w-3.5 h-3.5 text-red-400" />
          <span>Official Hotline:</span>
          <a
            href="tel:8127494994"
            className="font-semibold text-red-500 hover:underline"
          >
            8127494994
          </a>
        </div>
      </div>
    </div>
  );
}
