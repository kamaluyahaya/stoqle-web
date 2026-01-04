"use client";

import { ClipboardDocumentListIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/16/solid";
import React, { useEffect, useRef, useState } from "react";

type Role = "user" | "vendor";

type Balances = {
  available: number;
  pending?: number;
  virtualAccount?: string | null;
  currency?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  hintText?: string;
  balances: Balances;
  role?: Role;
  onWithdraw?: (availableAmount: number) => Promise<void> | void;
};

export default function BalanceModal({
  open,
  onClose,
  title = "My Wallet",
  hintText = "View balances",
  balances,
  role = "user",
  onWithdraw,
}: Props) {
  const isCopyingRef = useRef(false);
  const isWithdrawingRef = useRef(false);
  const copiedRef = useRef(false);

  // local render state via refs (keeps component simple and synchronous)
  // if you prefer reactive state (to re-render UI immediately), switch to useState for these
  const fmt = (v: number) => {
    try {
      const currency = balances.currency ?? "USD";
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v);
    } catch (e) {
      return String(v);
    }
  };

  useEffect(() => {
    // simple visual copied indicator lifecycle handled on change of virtualAccount
    let t: ReturnType<typeof setTimeout> | undefined;

    if (copiedRef.current) {
      t = setTimeout(() => {
        copiedRef.current = false;
        // no state update here — if you want the UI to show/hide copied state, convert copiedRef to useState
      }, 2000);
    }

    return () => {
      if (t) clearTimeout(t);
    };
  }, [balances.virtualAccount]);

  async function handleCopyVA() {
    if (!balances.virtualAccount) return;
    try {
      isCopyingRef.current = true;
      await navigator.clipboard.writeText(balances.virtualAccount);
      copiedRef.current = true;
      // small delay is handled by effect above
    } catch (e) {
      // ignore
    } finally {
      isCopyingRef.current = false;
    }
  }

  async function handleWithdraw() {
    if (!onWithdraw) return;
    if (balances.available <= 0) return;
    try {
      isWithdrawingRef.current = true;
      await onWithdraw(balances.available);
      onClose();
    } catch (e) {
      // handle error if needed
    } finally {
      isWithdrawingRef.current = false;
    }
  }
const [showBalance, setShowBalance] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
   const [showPending, setShowPending] = useState(true);
  // prevent scrolling of background while modal is open
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-75 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full sm:w-[640px] max-h-[84vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 text-center">
              <div className="text-lg font-semibold text-slate-900">{title}</div>
            </div>

            <button aria-label="Close" onClick={onClose} className="p-2 rounded-md hover:bg-slate-100">
              <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none">
                <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-4 mb-20" style={{ height: "56vh", overflow: "auto" }}>
            <div className="space-y-4">
              <div className="bg-red-100 rounded-2xl p-4">
      {/* Title row with Transaction History */}
      <div className="flex justify-between items-center text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>Available balance</span>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="p-1 rounded-full hover:bg-slate-200 transition"
          >
            {showBalance ? (
              <EyeIcon className="w-4 h-4 text-slate-500" />
            ) : (
              <EyeSlashIcon className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>
        <button className="text-red-500 text-sm font-medium hover:underline">
          Transaction History
        </button>
      </div>

      {/* Balance and Withdraw row */}
      <div className="mt-2 flex justify-between items-center">
        <div className="text-xl font-semibold text-slate-800">
          {showBalance ? fmt(balances.available) : "••••••"}
        </div>
        <button
          onClick={async () => {
            setIsWithdrawing(true);
            await handleWithdraw();
            setIsWithdrawing(false);
          }}
          disabled={balances.available <= 0}
          className={`py-3 px-4 rounded-full text-sm font-medium transition ${
            balances.available > 0
              ? "bg-red-500 text-white"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          {isWithdrawing ? "Processing..." : role === "vendor" ? "Request payout" : "Withdraw"}
        </button>
      </div>
    </div>

            {/* Right: Virtual account + details */}
           <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 border border-slate-100">
        <div className="flex items-center justify-between">
          {/* Pending balance info */}
          <div>
            <div className="text-xs text-slate-500">Pending balance</div>
            <div className="mt-1 text-lg font-medium text-slate-900">
              {fmt(balances.pending ?? 0)}
            </div>
          </div>

          {/* Icon to view pending transactions */}
          <button
            // onClick={handleViewPending}
            className="p-2 rounded-full hover:bg-slate-100 transition"
            title="View pending transactions"
          >
            <ClipboardDocumentListIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </div>
    </div>

             

            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 mt-2">
                <div className=" items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500">Virtual account</div>
                    <div className="mt-2 font-medium text-slate-900">Bank Number: 6173321783</div>
                    <div className="mt-2 font-medium text-slate-900">Bank name: Palmpay</div>
                    <div className="text-xs text-slate-400 mt-1">Use this account to receive instant top-ups</div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={handleCopyVA}
                      disabled={!balances.virtualAccount}
                      className="py-2 px-3 rounded-full border border-slate-200 text-sm font-medium"
                    >
                      Copy
                    </button>

                  </div>
                </div>
              </div>
             <div className="bg-white rounded-2xl p-4 mt-4 border border-slate-100">
                <div className="text-xs text-slate-500">Account actions</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="py-2 rounded-full border border-slate-200 text-sm font-medium">Top up</button>
                  <button className="py-2 rounded-full border border-slate-200 text-sm font-medium">Transaction history</button>
                </div>
              </div>
          </div>

      </div>
    </div>
  );
}
