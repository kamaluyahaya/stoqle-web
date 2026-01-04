// components/business/modals/PaymentInfoModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import DefaultInput from "../../input/default-input";
import CategorySelectionModal from "../../input/default-select-search";
import { toast } from "sonner";

type Props = {
  open: boolean;
  prefKey: string; // e.g. "business_payment_info"
  initialValue: string; // JSON string (may be empty)
  onClose: () => void;
  onSave?: (payloadJson: string) => Promise<void> | void;
};

type PaystackBank = {
  id?: number;
  name: string;
  code: string;
  supports_transfer?: boolean;
  active?: boolean;
};

const CACHE_KEY = "paystack_banks_cache_v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export default function PaymentInfoModal({ open, prefKey, initialValue, onClose, onSave }: Props) {
  const [supportAvailable, setSupportAvailable] = useState<boolean>(true);
  const [podEnabled, setPodEnabled] = useState<boolean>(true);
  const [codEnabled, setCodEnabled] = useState<boolean>(true);

  const [accountNumber, setAccountNumber] = useState<string>("");
  const [accountName, setAccountName] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
  const [bankCode, setBankCode] = useState<string>(""); // numeric code mapped from bankName

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [banksLoading, setBanksLoading] = useState<boolean>(false);

  // Load saved payment info from initialValue or localStorage
  useEffect(() => {
    if (!open) return;
    setLoading(true);

    try {
      if (!initialValue || initialValue.trim() === "") {
        const saved = localStorage.getItem(prefKey) ?? "";
        if (saved) {
          const parsed = JSON.parse(saved);
          applyParsed(parsed);
        } else {
          resetFields();
        }
      } else {
        const parsed = JSON.parse(initialValue);
        applyParsed(parsed);
      }
    } catch (e) {
      resetFields();
    } finally {
      setLoading(false);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValue, prefKey]);

  function resetFields() {
    setSupportAvailable(true);
    setPodEnabled(true);
    setCodEnabled(true);
    setAccountNumber("");
    setAccountName("");
    setBankName("");
    setBankCode("");
  }

  function getBankCodeByName(name: string) {
    const found = banks.find((b) => b.name === name);
    return found ? found.code : "";
  }

  function applyParsed(parsed: any) {
  try {
    if (!parsed || typeof parsed !== "object") {
      resetFields();
      return;
    }

    // 🔑 payment options (IMPORTANT FIX)
    setPodEnabled(
      parsed.pod ??
      parsed.podEnabled ??
      parsed.pod_enabled ??
      parsed.POD ??
      true
    );

    setCodEnabled(
      parsed.cod ??
      parsed.codEnabled ??
      parsed.cod_enabled ??
      parsed.COD ??
      true
    );

    setSupportAvailable(
      parsed.supportAvailable ??
      parsed.support_available ??
      true
    );

    // 🏦 bank details
    setAccountNumber(
      String(
        parsed.accountNumber ??
        parsed.account_number ??
        parsed.acct_num ??
        parsed.acct_no ??
        ""
      )
    );

    setAccountName(
      String(
        parsed.accountName ??
        parsed.account_name ??
        parsed.acct_name ??
        ""
      )
    );

    const bName = String(
      parsed.bankName ??
      parsed.bank_name ??
      parsed.bank ??
      ""
    );
    setBankName(bName);

    const parsedCode = String(
      parsed.bankCode ??
      parsed.bank_code ??
      parsed.acct_bank_code ??
      ""
    );
    setBankCode(parsedCode || getBankCodeByName(bName));
  } catch {
    resetFields();
  }
}


  // prevent background scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Fetch banks (with local cache) when modal opens
  useEffect(() => {
    if (!open) return;

    const loadBanks = async () => {
      setBanksLoading(true);
      try {
        // Try localStorage cache
        const cachedJson = localStorage.getItem(CACHE_KEY);
        if (cachedJson) {
          const cached = JSON.parse(cachedJson) as { ts: number; data: PaystackBank[] };
          if (Date.now() - cached.ts < CACHE_TTL_MS) {
            setBanks(cached.data);
            setBanksLoading(false);
            return;
          }
        }

        // Fetch from your backend endpoint (recommended)
        // The API route /api/paystack-banks should return PaystackBank[] (name & code)
        const res = await fetch("https://api.paystack.co/bank");
        if (!res.ok) throw new Error(`Failed to fetch banks (${res.status})`);
        const payload = (await res.json()) as { status?: boolean; data?: PaystackBank[] } | PaystackBank[];
        const bankList: PaystackBank[] = Array.isArray(payload) ? payload : payload.data ?? [];

        // optional filter: only active banks that support transfer
        const filtered = bankList.filter((b) => (b.active ?? true) && (b.supports_transfer ?? true));

        setBanks(filtered);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: filtered }));
        } catch {}
      } catch (err) {
        console.error("Failed to load Paystack banks:", err);
        toast("Failed to load bank list — please try again later.");
      } finally {
        setBanksLoading(false);
      }
    };

    loadBanks();
  }, [open]);

  const BANK_NAMES = banks.map((b) => b.name);

  // ensure bankCode updates when bankName changes
  useEffect(() => {
    if (!bankName) {
      setBankCode("");
      return;
    }
    const code = getBankCodeByName(bankName);
    setBankCode(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankName]);

  if (!open) return null;

  async function handleSave() {
    if (!accountNumber || accountNumber.trim() === "") {
      toast("Please enter account number");
      return;
    }
    if (!/^\d+$/.test(accountNumber.trim())) {
      toast("Account number must be numeric");
      return;
    }
    if (!accountName || accountName.trim() === "") {
      toast("Please enter account name");
      return;
    }
    if (!bankName || bankName.trim() === "") {
      toast("Please choose a bank");
      return;
    }

    // if bankCode is empty, try to resolve from name
    const resolvedBankCode = bankCode || getBankCodeByName(bankName);
    if (!resolvedBankCode) {
      toast("Bank code not found for selected bank. Please choose another bank or enter bank code.");
      return;
    }

    setSaving(true);

    const payloadObj = {
      supportAvailable: !!supportAvailable,
      pod: !!podEnabled,
      cod: !!codEnabled,
      acct_no: accountNumber.trim(),
      acct_name: accountName.trim(),
      bank_name: bankName.trim(),
      bank_code: resolvedBankCode
    };

    const payloadJson = JSON.stringify(payloadObj);

    try {
      try {
        localStorage.setItem(prefKey, payloadJson);
      } catch (e) {
        console.error("Failed to write payment info to localStorage", e);
      }

      if (onSave) await onSave(payloadJson);

      try {
        console.debug("Payment info saved:", payloadObj);
        toast("Payment info saved.");
      } catch {}
    } catch (e) {
      console.error("Failed to save payment info", e);
      toast("Failed to save payment info.");
    } finally {
      setSaving(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-75 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={() => (saving ? null : onClose())} />

      <div className="relative w-full max-w-2xl bg-white lg:rounded-2xl rounded-t-2xl shadow-xl p-4 z-10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Payment Info</h3>
          <button onClick={() => (saving ? null : onClose())} className="text-sm px-3 py-1 rounded-md hover:bg-slate-100">
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-auto space-y-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-slate-100 ">
                <div className="space-y-3 p-4">
                  <DefaultInput label="Account No." value={accountNumber} onChange={setAccountNumber} placeholder="Account Number" required maxLength={20} />
                  <DefaultInput label="Account name" value={accountName} onChange={setAccountName} placeholder="Account Name" required />

                  <CategorySelectionModal
                    title={banksLoading ? "Loading banks…" : "Select Bank"}
                    options={BANK_NAMES}
                    value={bankName}
                    onSelected={(v) => {
                      setBankName(v);
                      setBankCode(getBankCodeByName(v));
                    }}
                    hintText={banksLoading ? "Banks loading…" : "Choose a Bank"}
                    isRequired
                    triggerLabel="Bank name"
                  />

                 {bankCode ? (
                    <div className="mt-2 text-xs text-red-500 flex flex-wrap items-center gap-1">
                      <span>Your account will be credited when your customer places an order.</span>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                      <span>Bank code not available for the selected item —</span>
                      <span className="font-medium underline">please confirm with provider</span>
                    </div>
                  )}

                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-100 ">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Pay On Delivery (POD)</div>
                    <div className="text-xs text-slate-500 mt-1">Allow customers to pay when item is delivered.</div>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={podEnabled} onChange={(e) => setPodEnabled(e.target.checked)} className="sr-only" />
                    <span className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${podEnabled ? "bg-rose-500" : "bg-slate-200"}`} aria-hidden>
                      <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${podEnabled ? "translate-x-5" : "translate-x-0"}`} />
                    </span>
                  </label>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-100 ">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Cash On Delivery (COD)</div>
                    <div className="text-xs text-slate-500 mt-1">Allow cash payments on delivery (if supported in your area).</div>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={codEnabled} onChange={(e) => setCodEnabled(e.target.checked)} className="sr-only" />
                    <span className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${codEnabled ? "bg-rose-500" : "bg-slate-200"}`} aria-hidden>
                      <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${codEnabled ? "translate-x-5" : "translate-x-0"}`} />
                    </span>
                  </label>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-100 ">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Customer Support Available</div>
                    <div className="text-xs text-slate-500 mt-1">Show contact options and support availability on your store.</div>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={supportAvailable} onChange={(e) => setSupportAvailable(e.target.checked)} className="sr-only" />
                    <span className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${supportAvailable ? "bg-rose-500" : "bg-slate-200"}`} aria-hidden>
                      <span className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${supportAvailable ? "translate-x-5" : "translate-x-0"}`} />
                    </span>
                  </label>
                </div>
              </div>

              <div className="text-xs text-slate-500">Tip: POD and COD are enabled by default. Fill bank details for direct transfers.</div>
            </>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button onClick={() => (saving ? null : onClose())} className="px-4 py-2 rounded-lg bg-white border" disabled={saving}>
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-rose-500 text-white font-semibold" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
