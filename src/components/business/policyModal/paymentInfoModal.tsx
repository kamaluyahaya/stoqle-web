// components/business/modals/PaymentInfoModal.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import DefaultInput from "../../input/default-input";
import CategorySelectionModal from "../../input/default-select-search";
import { toast } from "sonner";
import { API_BASE_URL } from "@/src/lib/config";
import { savePaymentAccount } from "@/src/lib/api/walletApi";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import SecurityOtpModal from "../../wallet/securityOtpModal";

type Props = {
  open: boolean;
  prefKey: string; // e.g. "business_payment_info"
  initialValue: string; // JSON string (may be empty)
  onClose: () => void;
  onSave?: (payloadJson: string) => Promise<void> | void;
  role?: "user" | "vendor";
  businessId?: number;
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

export default function PaymentInfoModal({ open, prefKey, initialValue, onClose, onSave, role = "vendor", businessId }: Props) {
  const [supportAvailable, setSupportAvailable] = useState<boolean>(true);
  const [podEnabled, setPodEnabled] = useState<boolean>(true);
  const [codEnabled, setCodEnabled] = useState<boolean>(true);

  const [accountNumber, setAccountNumber] = useState<string>("");
  const [accountName, setAccountName] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
  const [bankCode, setBankCode] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [banksLoading, setBanksLoading] = useState<boolean>(false);

  // OTP Modal states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpChannel, setOtpChannel] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const resolveOtpPromise = useRef<((otp: string | null) => void) | null>(null);
  const [securityVerified, setSecurityVerified] = useState<boolean>(false);
  const [isResolving, setIsResolving] = useState<boolean>(false);

  // Load saved payment info
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
      setPodEnabled(parsed.pod ?? parsed.podEnabled ?? parsed.pod_enabled ?? parsed.POD ?? true);
      setCodEnabled(parsed.cod ?? parsed.codEnabled ?? parsed.cod_enabled ?? parsed.COD ?? true);
      setSupportAvailable(parsed.supportAvailable ?? parsed.support_available ?? true);
      setAccountNumber(String(parsed.accountNumber ?? parsed.account_number ?? parsed.acct_num ?? parsed.acct_no ?? ""));
      setAccountName(String(parsed.accountName ?? parsed.account_name ?? parsed.acct_name ?? ""));
      const bName = String(parsed.bankName ?? parsed.bank_name ?? parsed.bank ?? "");
      setBankName(bName);
      const parsedCode = String(parsed.bankCode ?? parsed.bank_code ?? parsed.acct_bank_code ?? "");
      setBankCode(parsedCode || getBankCodeByName(bName));
    } catch {
      resetFields();
    }
  }

  // Prevent background scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Fetch banks
  useEffect(() => {
    if (!open) return;
    const loadBanks = async () => {
      setBanksLoading(true);
      try {
        const cachedJson = localStorage.getItem(CACHE_KEY);
        if (cachedJson) {
          const cached = JSON.parse(cachedJson);
          if (Date.now() - cached.ts < CACHE_TTL_MS) {
            setBanks(cached.data);
            setBanksLoading(false);
            return;
          }
        }
        const res = await fetch("https://api.paystack.co/bank");
        if (!res.ok) throw new Error(`Failed to fetch banks`);
        const payload = await res.json();
        const bankList = Array.isArray(payload) ? payload : payload.data ?? [];
        const filtered = bankList.filter((b: any) => (b.active ?? true) && (b.supports_transfer ?? true));
        setBanks(filtered);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: filtered }));
      } catch (err) {
        console.error(err);
      } finally {
        setBanksLoading(false);
      }
    };
    loadBanks();
  }, [open]);

  const BANK_NAMES = banks.map((b) => b.name);

  // Auto-resolve account name from Paystack
  useEffect(() => {
    const cleanNum = accountNumber.replace(/\D/g, "");
    if (cleanNum.length === 10 && bankCode) {
      resolveUserAccount(cleanNum, bankCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountNumber, bankCode]);

  async function resolveUserAccount(num: string, code: string) {
    setIsResolving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/wallet/bank/resolve?account_number=${num}&bank_code=${code}`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
          "Accept": "application/json",
        }
      });
      const data = await res.json();
      if (res.ok) {
        if (data.data?.account_name) {
          setAccountName(data.data.account_name);
          Swal.fire({
            icon: "success",
            title: "Account Resolved",
            text: `Linked to: ${data.data.account_name}`,
            confirmButtonColor: "#10b981",
            timer: 2000
          });
        } else {
          setAccountName(""); // clear if no name in data
        }
      } else {
        // Backend failure (400, etc)
        setAccountName(""); // Clear existing name if resolution fails
        Swal.fire({
          icon: "error",
          title: "Resolution Failed",
          text: data.message || "Could not resolve account name. Please check account details.",
          confirmButtonColor: "#f43f5e"
        });
      }
    } catch (err) {
      console.error("Resolution error", err);
      setAccountName(""); // Clear on error
    } finally { setIsResolving(false); }
  }

  // Security Verification Logic
  async function triggerOtpChallenge(channel: string): Promise<string | null> {
    setOtpChannel(channel === 'email' ? 'Registered Email' : 'Registered Phone Number');
    setOtpError(null);
    setShowOtpModal(true);
    return new Promise((resolve) => { resolveOtpPromise.current = resolve; });
  }

  async function handleVerifyOtp(otp: string) {
    setOtpLoading(true);
    setOtpError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/auth/security/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Incorrect OTP");

      setSecurityVerified(true);
      setShowOtpModal(false);
      toast.success("Identity verified.");
      if (resolveOtpPromise.current) resolveOtpPromise.current(otp);
    } catch (err: any) {
      setOtpError(err.message || "Verification failed");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleSave() {
    if (!accountNumber || accountNumber.length < 10) { toast.error("Enter valid account number"); return; }
    if (!bankName) { toast.error("Choose a bank"); return; }

    // Ensure account name was resolved before saving
    if (!accountName || accountName.trim() === "" || isResolving) {
      toast.error("Account name must be resolved and verified before saving.");
      return;
    }

    const resolvedBankCode = bankCode || getBankCodeByName(bankName);
    if (!resolvedBankCode) { toast.error("Invalid bank selection"); return; }

    if (!securityVerified) {
      const { value: channel } = await Swal.fire({
        title: "Security Verification",
        text: "Select where to receive your code:",
        input: "radio",
        inputOptions: { email: "Email Address", phone: "Phone Number" },
        inputValidator: (v) => !v ? "Choose a channel" : null,
        confirmButtonText: "Send OTP",
        confirmButtonColor: "#3b82f6",
        showCancelButton: true
      });
      if (!channel) return;

      setSaving(true);
      try {
        const token = localStorage.getItem("token");
        const req = await fetch(`${API_BASE_URL}/api/auth/security/request-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ channel })
        });
        const resJson = await req.json();
        if (!req.ok) throw new Error(resJson.message || "Failed to send OTP");

        setSaving(false);
        const code = await triggerOtpChallenge(channel);
        if (!code) return;
      } catch (err: any) {
        Swal.fire({ icon: "error", title: "Security Error", text: err.message, confirmButtonColor: "#f43f5e" });
        setSaving(false); return;
      }
    }

    setSaving(true);
    const payloadObj = {
      support_available: !!supportAvailable ? 1 : 0,
      pod_enabled: !!podEnabled ? 1 : 0,
      cod_enabled: !!codEnabled ? 1 : 0,
      account_number: accountNumber.trim(),
      account_name: accountName.trim(),
      bank_name: bankName.trim(),
      bank_code: resolvedBankCode,
      acct_no: accountNumber.trim(),
      acct_name: accountName.trim(),
      bank: bankName.trim(),
    };

    try {
      const token = localStorage.getItem("token");
      if (role === 'user') {
        await savePaymentAccount(payloadObj);
      } else if (role === 'vendor' && businessId) {
        const res = await fetch(`${API_BASE_URL}/api/business/${businessId}/policy/payment`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payloadObj),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || "Paystack verification failed");
        }
      }

      const fullPayload = JSON.stringify({ ...payloadObj, pod: !!podEnabled, cod: !!codEnabled, supportAvailable: !!supportAvailable });
      localStorage.setItem(prefKey, fullPayload);
      if (onSave) await onSave(fullPayload);

      Swal.fire({ icon: "success", title: "Saved", text: "Account verified and saved.", confirmButtonColor: "#10b981", timer: 2000 });
      onClose();
    } catch (e: any) {
      console.error("Save error", e);
      // Properly extract message from e.body (for walletApi) or e.message (for direct fetch)
      const errorMsg = e.body?.message || e.message || "Error saving account";

      Swal.fire({
        icon: "error",
        title: "Failed",
        text: errorMsg,
        confirmButtonColor: "#f43f5e"
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[1001] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => !saving && onClose()}
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl bg-white rounded-t-[0.5rem] sm:rounded-[0.5rem] z-10 flex flex-col overflow-hidden max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-30">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Withdrawal Settings</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payout & Bank Configuration</p>
                </div>
                <button onClick={() => !saving && onClose()} className="p-2 hover:bg-slate-50 rounded-full transition text-slate-400">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M6 6L18 18M6 18L18 6" /></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-10">
                {loading ? (
                  <div className="py-20 flex flex-col items-center justify-center space-y-4">
                    <div className="w-8 h-8 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Syncing securely...</p>
                  </div>
                ) : (
                  <>
                    <section className="space-y-4">
                      <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] px-1">Global Settlement</h4>
                      <div className=" space-y-5">
                        <DefaultInput label="Account Number" value={accountNumber} onChange={setAccountNumber} placeholder="10 Digits" required maxLength={10} />
                        <CategorySelectionModal
                          title="Select Bank" options={BANK_NAMES} value={bankName}
                          onSelected={(v) => { setBankName(v); setBankCode(getBankCodeByName(v)); }}
                          hintText="Choose your bank provider" isRequired triggerLabel="Bank Name"
                        />
                        <DefaultInput label="Account Name" value={isResolving ? "Resolving..." : accountName} disabled={true} placeholder="Resolves automatically" />
                      </div>
                    </section>

                    {role === "vendor" && (
                      <section className="space-y-4">
                        <h4 className="text-[11px] text-slate-900  tracking-[0.2em] px-1">Payment Options</h4>
                        <div className="space-y-3">
                          {[
                            { label: "Pay On Delivery", sub: "Customers pay arrival", val: podEnabled, set: setPodEnabled },
                            { label: "Cash On Delivery", sub: "Accept cash payments", val: codEnabled, set: setCodEnabled },
                            { label: "Support Contact", sub: "Show help options", val: supportAvailable, set: setSupportAvailable }
                          ].map((opt, i) => (
                            <div key={i} className="bg-white border border-slate-100 rounded p-4 flex items-center justify-between ">
                              <div>
                                <div className="text-sm font-black text-slate-900">{opt.label}</div>
                                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-none mt-1">{opt.sub}</div>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={opt.val} onChange={(e) => opt.set(e.target.checked)} className="sr-only" />
                                <div className={`w-10 h-6 rounded-full transition-colors ${opt.val ? 'bg-rose-500' : 'bg-slate-200'}`}>
                                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${opt.val ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                              </label>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                    <p className="text-[10px] font-black text-slate-300  tracking-widest text-center leading-loose">
                      All accounts are verified via Paystack. Stoqle staff will never ask for your code.
                    </p>
                  </>
                )}
              </div>

              <div className="p-4 bg-slate-50 flex items-center gap-4 sticky bottom-0 z-30">
                <button onClick={() => !saving && onClose()} className="flex-1 h-10 bg-white border border-slate-200 rounded-full text-[10px] font-black  tracking-widest text-slate-400 hover:bg-slate-100 transition disabled:opacity-50">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-[2] h-10 bg-rose-500 rounded-full text-[10px] font-black  tracking-widest text-white shadow-lg shadow-rose-100 hover:bg-rose-600 transition disabled:opacity-50">
                  {saving ? "Verifying..." : "Verify & Save Details"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SecurityOtpModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        onSuccess={handleVerifyOtp}
        errorMessage={otpError}
        isLoading={otpLoading}
        channel={otpChannel}
      />
    </>
  );
}
