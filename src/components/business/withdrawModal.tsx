import React, { useState, useEffect } from "react";
import { FaTimes, FaUniversity, FaCreditCard, FaLock, FaCheckCircle, FaExclamationTriangle, FaArrowRight, FaHistory } from "react-icons/fa";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "@/src/lib/config";
import { fetchMyPaymentAccount } from "@/src/lib/api/walletApi";
import { useRouter, useSearchParams } from "next/navigation";
import NumberInput from "../input/defaultAmountInput";
import PinVerifyModal from "./pinVerifyModal";

interface WithdrawModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEditAccount: () => void;
    availableBalance: number;
    activePaymentJson?: string;
    isPaymentDirty?: boolean;
    role?: 'user' | 'vendor';
    onBalanceUpdate?: (newBalance: number) => void;
}

interface WithdrawalRecord {
    withdrawal_id: number;
    amount: number;
    bank_name: string;
    account_number: string;
    status: 'pending' | 'processing' | 'completed' | 'rejected';
    paystack_status: string;
    created_at: string;
    updated_at: string;
}

export default function WithdrawModal({ isOpen, onClose, onEditAccount, availableBalance: initialBalance, activePaymentJson, isPaymentDirty, role = 'user', onBalanceUpdate }: WithdrawModalProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [step, setStep] = useState(1); // 1: Amount + Account View, 2: Final Confirmation, 3: Success Alert
    const [account, setAccount] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [amount, setAmount] = useState("");
    const [activeTab, setActiveTab] = useState<'withdraw' | 'history'>('withdraw');
    const [history, setHistory] = useState<WithdrawalRecord[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [syncingId, setSyncingId] = useState<number | null>(null);
    const [availableBalance, setAvailableBalance] = useState(initialBalance);
    const [showSuccessAlert, setShowSuccessAlert] = useState(false);
    const [withdrawalStatus, setWithdrawalStatus] = useState<any>(null);
    const [pin, setPin] = useState("");
    const [isPinVerifyOpen, setIsPinVerifyOpen] = useState(false);

    const resolveAccount = async () => {
        try {
            setIsLoading(true);
            if (activePaymentJson) {
                try {
                    const parsed = JSON.parse(activePaymentJson);
                    const ani = parsed.acct_no || parsed.account_number;
                    const ana = parsed.acct_name || parsed.account_name;

                    if (ani && parsed.bank_name) {
                        setAccount({
                            account_name: ana,
                            account_number: ani,
                            bank_name: parsed.bank_name,
                            paystack_recipient_code: parsed.paystack_recipient_code,
                            isStaged: !!isPaymentDirty // Only mark as staged if actually unsaved locally
                        });
                    }
                } catch (e) {
                    console.error("JSON parse error on activePaymentJson", e);
                }
            } else {
                // Fallback: Fetch from API directly
                const res = await fetchMyPaymentAccount().catch(() => null);
                if (res?.data?.account) {
                    const acc = res.data.account;
                    setAccount({
                        account_name: acc.account_name,
                        account_number: acc.account_number,
                        bank_name: acc.bank_name,
                        paystack_recipient_code: acc.paystack_recipient_code,
                        isStaged: false
                    });
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            setIsHistoryLoading(true);
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/wallet/withdrawals`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success || data.status === 'success') {
                setHistory(data.data?.history || []);
            }
        } catch (err) {
            console.error("Failed to fetch history", err);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const syncStatus = async (id: number) => {
        try {
            setSyncingId(id);
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/wallet/withdrawals/${id}/sync`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.status === 'success' || data.status === 'success') {
                setHistory((prev: WithdrawalRecord[]) => prev.map((item: WithdrawalRecord) => item.withdrawal_id === id ? data.data.request : item));
                toast.success("Status updated");
            }
        } catch (err) {
            toast.error("Failed to sync status");
        } finally {
            setSyncingId(null);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setAccount(null);
            setError("");
            resolveAccount();
            setAmount("");
            setPin("");
            if (activeTab === 'history') fetchHistory();
        }
    }, [isOpen, activePaymentJson, isPaymentDirty, activeTab]);

    // Polling for instant status change if it was queued/pending
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (showSuccessAlert && withdrawalStatus?.type === 'pending' && withdrawalStatus?.withdrawal_id) {
            console.log(`[WithdrawModal] Starting polling for wdr#${withdrawalStatus.withdrawal_id}`);
            interval = setInterval(async () => {
                try {
                    const token = localStorage.getItem("token");
                    const res = await fetch(`${API_BASE_URL}/api/wallet/withdrawals/${withdrawalStatus.withdrawal_id}/sync`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await res.json();
                    console.log(`[WithdrawModal] Polling wdr#${withdrawalStatus.withdrawal_id} status:`, data.data?.request?.status);

                    if (data.status === 'success' && data.data?.request?.status === 'completed') {
                        console.log(`[WithdrawModal] wdr#${withdrawalStatus.withdrawal_id} COMPLETED. Updating UI.`);
                        setWithdrawalStatus((prev: any) => ({
                            ...prev,
                            type: 'success',
                            message: "Transfer successful! Your account has been credited."
                        }));
                        clearInterval(interval);
                        // Refresh history too
                        fetchHistory();
                    }
                } catch (e) {
                    console.error("[WithdrawModal] Polling error", e);
                }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [showSuccessAlert, withdrawalStatus?.type, withdrawalStatus?.withdrawal_id]);

    const handleProceed = () => {
        const numAmount = parseFloat(amount);
        if (!amount || isNaN(numAmount) || numAmount < 50) {
            toast.error("Minimum withdrawal amount is ₦50");
            return;
        }
        if (numAmount > availableBalance) {
            toast.error("Insufficient available balance");
            return;
        }
        if (!account || !account.account_number) {
            toast.error("No bank account found. Please set one up first.");
            return;
        }
        setStep(2);
    };

    useEffect(() => {
        setAvailableBalance(initialBalance);
    }, [initialBalance]);

    const handleSubmit = async (verificationPin?: string) => {
        try {
            setIsSubmitting(true);
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/wallet/withdrawals`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    amount: parseFloat(amount),
                    pin: verificationPin || pin
                }),
            });
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                const newBal = (data.data?.request?.available_balance !== undefined)
                    ? Number(data.data.request.available_balance)
                    : availableBalance - parseFloat(amount);

                // Deduct balance locally for instant feedback
                setAvailableBalance(newBal);
                if (onBalanceUpdate) onBalanceUpdate(newBal);

                // Set status for alert
                const statusObj = {
                    message: data.message || "Withdrawal successful!",
                    type: data.data?.request?.status === 'completed' ? 'success' : 'pending',
                    withdrawal_id: data.data?.request?.withdrawal_id
                };
                console.log("[WithdrawModal] Created withdrawalStatus:", statusObj);
                setWithdrawalStatus(statusObj);

                // Show Success Alert
                setShowSuccessAlert(true);
                setStep(3);

                // Refresh history in background
                fetchHistory();
            } else {
                toast.error(data.message || "Withdrawal failed");
            }
        } catch (err) {
            toast.error("An error occurred during withdrawal");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewHistory = () => {
        setShowSuccessAlert(false);
        setActiveTab('history');
        setStep(1);
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100002] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={onClose}
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative bg-white w-full max-w-md rounded-[0.5rem] overflow-hidden"
                        >

                            {/* Header */}
                            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                                <div>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setActiveTab('withdraw')}
                                            className={`text-2xl font-black leading-tight transition ${activeTab === 'withdraw' ? 'text-slate-900' : 'text-slate-300 hover:text-slate-400'}`}
                                        >
                                            Withdraw
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('history')}
                                            className={`text-2xl font-black leading-tight transition ${activeTab === 'history' ? 'text-slate-900' : 'text-slate-300 hover:text-slate-400'}`}
                                        >
                                            History
                                        </button>
                                    </div>
                                    <p className="text-[10px] font-black text-emerald-500  tracking-widest mt-1">Available: ₦{availableBalance.toLocaleString()}</p>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition text-slate-400">
                                    <FaTimes size={20} />
                                </button>
                            </div>

                            <div className="p-8">
                                {activeTab === 'withdraw' ? (
                                    <>
                                        {isLoading ? (
                                            <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                                <div className="w-10 h-10 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin" />
                                                <p className="text-[10px] font-black text-slate-400  tracking-[0.2em]">Verifying Account...</p>
                                            </div>
                                        ) : (!account || account.isStaged) ? (
                                            <div className="text-center space-y-6">
                                                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto border border-amber-100">
                                                    <FaExclamationTriangle className="text-amber-500" size={32} />
                                                </div>
                                                <div className="space-y-2">
                                                    <h4 className="font-black text-slate-900 text-xs">
                                                        {!account ? "No Bank Account Found" : "Unsaved Bank Details"}
                                                    </h4>
                                                    <p className="text-xs text-slate-500 font-medium px-4">
                                                        {!account
                                                            ? role === 'vendor'
                                                                ? "Please provide your business bank account details in the \"Payment Info\" section to receive payouts."
                                                                : "To withdraw funds to your bank, you must first provide your account details."
                                                            : "You have provided your details locally, but you must click 'Submit' on the main dashboard to save them before you can withdraw."
                                                        }
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={!account ? onEditAccount : onClose}
                                                    className="w-full py-3 bg-rose-500 text-white rounded-full text-sm font-bold shadow-md active:scale-95 transition"
                                                >
                                                    {!account ? "Set up Account" : (account?.isStaged ? "Go to Dashboard" : "Close")}
                                                </button>
                                            </div>
                                        ) : step === 1 ? (
                                            <div className="space-y-8">
                                                {/* Account Card */}
                                                <div className="bg-slate-900 rounded-[1rem] p-6 text-white shadow-2xl relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition duration-500">
                                                        <FaUniversity size={80} />
                                                    </div>
                                                    <div className="relative z-10">
                                                        <div className="text-[10px] font-black opacity-50  tracking-[0.2em] mb-4">Destination Account</div>
                                                        <div className="space-y-1">
                                                            <h4 className="text-lg font-black tracking-tight">{account.account_name}</h4>
                                                            <p className="text-sm font-bold opacity-70">**** **** {account.account_number?.slice(-4)}</p>
                                                        </div>
                                                        <div className="mt-8 flex items-center justify-between">
                                                            <span className="text-[10px] font-black  tracking-widest bg-white/20 px-3 py-1 rounded-full">{account.bank_name}</span>
                                                            <button onClick={onEditAccount} className="text-[10px] font-black bg-emerald-500 text-white px-4 py-1.5 rounded-full hover:bg-emerald-400 transition">CHANGE</button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Amount Input */}
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-end px-1">
                                                        <label className="text-[10px] font-black text-slate-400  tracking-widest">Enter Amount (₦)</label>
                                                        <button onClick={() => setAmount(availableBalance.toString())} className="text-[9px] font-black text-rose-500 bg-rose-50 px-2.5 py-1 rounded-full hover:bg-rose-100 transition">MAX</button>
                                                    </div>
                                                    <div className=" overflow-hidden border-2 border-transparent focus-within:bg-white transition">
                                                        <NumberInput
                                                            label="Amount"
                                                            value={amount}
                                                            onChange={(val) => setAmount(val.toString())}
                                                            placeholder="0.00"
                                                            min={50}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-3">
                                                    <button
                                                        onClick={handleProceed}
                                                        className={`w-full py-3 rounded-full text-sm font-medium transition-all
                                                ${(amount && parseFloat(amount) >= 50)
                                                                ? "bg-rose-500 text-white active:scale-95"
                                                                : "bg-slate-100 text-slate-500 cursor-not-allowed"}
                                            `}
                                                    >
                                                        Confirm
                                                    </button>
                                                    <p className="text-[10px] text-center font-black text-slate-400 tracking-widest">Funds arrive instantly via Paystack</p>
                                                </div>
                                            </div>
                                        ) : step === 2 ? (
                                            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                                <div className="text-center space-y-2">
                                                    <h4 className="text-lg font-black text-slate-900">Final Confirmation</h4>
                                                    <p className="text-xs text-slate-500 font-medium capitalize">Please review your withdrawal details</p>
                                                </div>

                                                <div className="bg-slate-50 rounded-[1rem] p-8 border border-slate-100 space-y-6">
                                                    <div className="flex justify-between items-center pb-6 border-b border-slate-200/60">
                                                        <span className="text-[10px] font-black text-slate-400  tracking-widest">Withdrawal Amount</span>
                                                        <span className="text-xl font-black text-slate-900">₦{parseFloat(amount).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center pb-6 border-b border-slate-200/60">
                                                        <span className="text-[10px] font-black text-slate-400  tracking-widest">Fee</span>
                                                        <span className="text-sm font-black text-emerald-600  tracking-widest">Free</span>
                                                    </div>
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-[10px] font-black text-slate-400  tracking-widest mt-1">Destination</span>
                                                        <div className="text-right space-y-0.5">
                                                            <p className="text-sm font-black text-slate-900">{account.account_name}</p>
                                                            <p className="text-[11px] font-bold text-slate-500">{account.bank_name}</p>
                                                            <p className="text-[10px] font-medium text-slate-400 tracking-tight">{account.account_number}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => setIsPinVerifyOpen(true)}
                                                    disabled={isSubmitting}
                                                    className={`w-full py-3 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-3
                                            ${(!isSubmitting)
                                                            ? "bg-rose-500 text-white shadow-md active:scale-95"
                                                            : "bg-slate-100 text-slate-500 cursor-not-allowed"}
                                        `}
                                                >
                                                    {isSubmitting ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                            <span>Processing...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FaLock size={14} />
                                                            <span>Confirm Withdrawal</span>
                                                        </>
                                                    )}
                                                </button>
                                                <button onClick={() => setStep(1)} disabled={isSubmitting} className="w-full py-2 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition">Go Back</button>
                                            </div>
                                        ) : step === 3 ? (
                                            /* AWESOME ALERT UI */
                                            <div className="space-y-8 animate-in zoom-in-95 duration-500">
                                                <div className="flex flex-col items-center justify-center text-center space-y-6">
                                                    <div className={`w-24 h-24 rounded-full flex items-center justify-center relative ${withdrawalStatus?.type === 'success' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                                                        <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${withdrawalStatus?.type === 'success' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                                        {withdrawalStatus?.type === 'success' ? (
                                                            <FaCheckCircle className="text-emerald-500 relative z-10" size={48} />
                                                        ) : (
                                                            <FaExclamationTriangle className="text-amber-500 relative z-10" size={48} />
                                                        )}
                                                    </div>

                                                    <div className="space-y-3">
                                                        <h4 className="text-3xl font-black text-slate-900 tracking-tight">
                                                            {withdrawalStatus?.type === 'success' ? "Transfer Sent!" : "Transfer Queued"}
                                                        </h4>
                                                        <p className="text-sm font-medium text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                                                            {withdrawalStatus?.message}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-white space-y-4 shadow-inner">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] font-black text-slate-400  tracking-widest">Amount Sent</span>
                                                        <span className="text-xl font-black text-slate-900">₦{parseFloat(amount).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-start pt-2 border-t border-slate-100">
                                                        <span className="text-[10px] font-black text-slate-400  tracking-widest mt-1">Destination</span>
                                                        <div className="text-right space-y-0.5">
                                                            <p className="text-sm font-black text-slate-900">{account?.account_name}</p>
                                                            <p className="text-[11px] font-bold text-slate-500">{account?.bank_name}</p>
                                                            <p className="text-[10px] font-medium text-slate-400 tracking-tight">{account?.account_number}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-3 pt-4">
                                                    <button
                                                        onClick={handleViewHistory}
                                                        className="w-full py-3 bg-rose-500 text-white rounded-full text-sm font-medium shadow-md active:scale-95 transition flex items-center justify-center gap-3 group"
                                                    >
                                                        <FaHistory size={14} className="group-hover:rotate-12 transition" />
                                                        <span>View Transfer History</span>
                                                    </button>
                                                    <button
                                                        onClick={onClose}
                                                        className="w-full py-2 text-[11px] font-medium text-slate-400 hover:text-slate-900 transition underline"
                                                    >
                                                        Dismiss for now
                                                    </button>
                                                </div>
                                            </div>
                                        ) : null}
                                    </>
                                ) : (
                                    /* History View */
                                    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 pb-6 custom-scrollbar">
                                        {isHistoryLoading ? (
                                            <div className="flex flex-col items-center justify-center py-20">
                                                <div className="w-8 h-8 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin" />
                                            </div>
                                        ) : history.length === 0 ? (
                                            <div className="text-center py-20 space-y-4">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                                                    <FaCreditCard size={24} className="text-slate-200" />
                                                </div>
                                                <p className="text-[10px] font-black text-slate-400  tracking-widest">No withdrawal history found</p>
                                            </div>
                                        ) : (
                                            history.map((item) => (
                                                <div key={item.withdrawal_id} className="p-6 bg-slate-50 rounded-[1.8rem] border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition duration-300">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-black text-slate-900">₦{Number(item.amount).toLocaleString()}</h4>
                                                            <span className={`text-[8px] font-black  px-2 py-0.5 rounded-full border ${item.status === 'completed' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                                                                item.status === 'rejected' ? 'text-rose-500 bg-rose-50 border-rose-100' :
                                                                    'text-amber-600 bg-amber-50 border-amber-100 animate-pulse'
                                                                }`}>
                                                                {item.status}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-400">{item.bank_name} • {item.account_number}</p>
                                                        {item.paystack_status && (
                                                            <p className="text-[9px] font-black text-slate-500  flex items-center gap-1.5 mt-1">
                                                                <span className="w-1 h-1 rounded-full bg-slate-400" />
                                                                Paystack: <span className={item.paystack_status === 'failed' ? 'text-rose-500' : item.paystack_status === 'success' ? 'text-emerald-500' : 'text-blue-500'}>{item.paystack_status}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-black text-slate-400  tracking-tighter">
                                                            {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </p>
                                                        {(item.status === 'processing' || item.status === 'pending') && (
                                                            <button
                                                                onClick={() => syncStatus(item.withdrawal_id)}
                                                                disabled={syncingId === item.withdrawal_id}
                                                                className="mt-2 text-[8px] font-black text-rose-500 bg-rose-50 border border-rose-100 px-3 py-1 rounded-full hover:bg-rose-100 transition active:scale-95 disabled:opacity-50"
                                                            >
                                                                {syncingId === item.withdrawal_id ? "SYNCING..." : "SYNC STATUS"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer info */}
                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                                    <FaCheckCircle className="text-emerald-500" />
                                </div>
                                <p className="text-[10px] font-black text-slate-500 tracking-tight leading-relaxed">
                                    Stoqle uses military-grade encryption to ensure your funds and data are always secure.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <PinVerifyModal
                isOpen={isPinVerifyOpen}
                onClose={() => setIsPinVerifyOpen(false)}
                onSuccess={(verifiedPin) => {
                    setIsPinVerifyOpen(false);
                    handleSubmit(verifiedPin);
                }}
                title="Authorize Withdrawal"
                description={`Please enter your 4-digit PIN to authorize the withdrawal of ₦${parseFloat(amount || '0').toLocaleString()} to ${account?.account_name} (${account?.bank_name}).`}
            />
        </>
    );
}
