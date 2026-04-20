import React, { useState, useEffect } from "react";
import { FaTimes, FaWallet, FaUser, FaCheckCircle, FaExclamationTriangle, FaLock, FaArrowRight, FaSearch } from "react-icons/fa";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "@/src/lib/config";
import DefaultInput from "../input/default-input";
import NumberInput from "../input/defaultAmountInput";
import PinVerifyModal from "./pinVerifyModal";

interface TransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableBalance: number;
    onBalanceUpdate?: (newBalance: number) => void;
}

interface Recipient {
    identifier: string;
    display_name: string;
    type: string;
    avatar: string | null;
}

export default function TransferModal({ isOpen, onClose, availableBalance: initialBalance, onBalanceUpdate }: TransferModalProps) {
    const [step, setStep] = useState(1); // 1: Recipient Search, 2: Amount, 3: PIN, 4: Success
    const [recipientIdentifier, setRecipientIdentifier] = useState("");
    const [recipient, setRecipient] = useState<Recipient | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [amount, setAmount] = useState("");
    const [pin, setPin] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [availableBalance, setAvailableBalance] = useState(initialBalance);
    const [transferResult, setTransferResult] = useState<any>(null);
    const [recentRecipients, setRecentRecipients] = useState<Recipient[]>([]);
    const [showAllRecents, setShowAllRecents] = useState(false);
    const [suggestions, setSuggestions] = useState<Recipient[]>([]);
    const [notFound, setNotFound] = useState(false);
    const [isPinVerifyOpen, setIsPinVerifyOpen] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("stoqlepay_recents");
        if (saved) {
            try {
                setRecentRecipients(JSON.parse(saved));
            } catch (e) {
                setRecentRecipients([]);
            }
        }
    }, []);

    useEffect(() => {
        setAvailableBalance(initialBalance);
    }, [initialBalance]);

    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setRecipientIdentifier("");
            setRecipient(null);
            setAmount("");
            setPin("");
            setTransferResult(null);
            setShowAllRecents(false);
            setNotFound(false);
        }
    }, [isOpen]);

    // Debounce search
    useEffect(() => {
        if (!recipientIdentifier || recipient) {
            setNotFound(false);
            return;
        }

        // Logic to determine if it's worth searching
        const isEmail = recipientIdentifier.includes("@");
        const numeric = recipientIdentifier.replace(/\D/g, "");
        const isPhone = (numeric.length >= 10);

        if (!isEmail && !isPhone) return;

        const timer = setTimeout(() => {
            handleLookup();
        }, 800); // Wait 800ms after user stops typing

        return () => clearTimeout(timer);
    }, [recipientIdentifier]);

    const handleLookup = async (idToSearch?: string) => {
        const id = idToSearch || recipientIdentifier;
        if (!id) {
            setNotFound(false);
            return;
        }

        // Don't search if currently searching or if this is the already found recipient
        if (isSearching) return;
        if (recipient && (recipient.identifier === id)) {
            setNotFound(false);
            return;
        }

        try {
            setIsSearching(true);
            setNotFound(false);
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/wallet/recipient/lookup?identifier=${encodeURIComponent(id)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                setRecipient({ ...data.data, identifier: id });
                setRecipientIdentifier(id);
                setSuggestions([]);
                setNotFound(false);
            } else {
                setRecipient(null);
                setNotFound(true);
            }
        } catch (err) {
            setRecipient(null);
            setNotFound(true);
        } finally {
            setIsSearching(false);
        }
    };

    const handleIdentifierChange = (val: string) => {
        setRecipientIdentifier(val);
        setRecipient(null);
        setNotFound(false);

        // Filter suggestions
        if (val.length > 0) {
            const filtered = recentRecipients.filter(r =>
                r.display_name.toLowerCase().includes(val.toLowerCase()) ||
                r.identifier.toLowerCase().includes(val.toLowerCase())
            );
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    };

    const saveToRecents = (rec: Recipient) => {
        const updated = [rec, ...recentRecipients.filter(r => r.identifier !== rec.identifier)].slice(0, 20);
        setRecentRecipients(updated);
        localStorage.setItem("stoqlepay_recents", JSON.stringify(updated));
    };

    const handleProceedToAmount = () => {
        if (!recipient) {
            handleLookup(); // Final check
            return;
        }
        setStep(2);
    };

    const handleProceedToPin = () => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount < 50) {
            toast.error("Minimum transfer amount is ₦50");
            return;
        }
        if (numAmount > availableBalance) {
            toast.error("Insufficient balance");
            return;
        }
        setStep(3);
    };

    const handleTransfer = async (verificationPin?: string) => {
        const finalPin = verificationPin || pin;
        if (finalPin.length < 4) {
            toast.error("Enter your 4-digit PIN");
            return;
        }
        try {
            setIsSubmitting(true);
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/wallet/transfer`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    recipient_identifier: recipientIdentifier,
                    amount: parseFloat(amount),
                    pin: finalPin,
                    description: `Transfer to ${recipient?.display_name}`
                }),
            });
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                const newBal = data.data.new_balance;
                setAvailableBalance(newBal);
                if (onBalanceUpdate) onBalanceUpdate(newBal);
                setTransferResult(data.data);

                // Save to recents
                if (recipient) saveToRecents(recipient);

                setStep(4);
                toast.success("Transfer Successful!");
            } else {
                toast.error(data.message || "Transfer failed");
            }
        } catch (err) {
            toast.error("An error occurred during transfer");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4">
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
                            className="relative bg-white w-full max-w-md rounded-[0.5rem] shadow-2xl overflow-hidden"
                        >

                            {/* Header */}
                            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white relative z-10">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 leading-tight">StoqlePay</h3>
                                    <p className="text-[10px] font-black text-emerald-500  tracking-widest mt-1">Available: ₦{availableBalance.toLocaleString()}</p>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition text-slate-400">
                                    <FaTimes size={20} />
                                </button>
                            </div>

                            <div className="p-8">
                                {step === 1 ? (
                                    <div className="space-y-6">
                                        {/* Receiver Account Input */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 tracking-widest px-1">Recipient Account</label>
                                            <div className="relative">
                                                <div className="bg-slate-100 rounded-[1.5rem] overflow-hidden  border-transparent focus-within:bg-white transition relative">
                                                    <DefaultInput
                                                        label="Account"
                                                        value={recipientIdentifier}
                                                        onChange={(val) => handleIdentifierChange(val)}
                                                        placeholder="Enter Phone or Email"
                                                    />
                                                    {isSearching && (
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                            <div className="w-4 h-4 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Not Found Message */}
                                                {notFound && !isSearching && !recipient && (
                                                    <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-rose-50 border border-rose-100 rounded-[1.5rem] flex items-center gap-3 animate-in fade-in slide-in-from-top-1 z-50">
                                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0">
                                                            <FaExclamationTriangle className="text-rose-500" size={14} />
                                                        </div>
                                                        <p className="text-[11px] font-bold text-rose-500">No account found with this details. Please check and try again.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Recipient Details (Found) */}
                                        {recipient && (
                                            <div className="bg-blue-50 rounded-[1.8rem] p-4 flex items-center gap-4 border border-blue-100 animate-in fade-in slide-in-from-top-2">
                                                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                                                    {recipient.avatar ? (
                                                        <img src={recipient.avatar} alt={recipient.display_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <FaUser className="text-blue-200" size={20} />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-black text-slate-900 text-sm truncate">{recipient.display_name}</h4>
                                                    <p className="text-[10px] font-black text-blue-500  tracking-widest">{recipient.type}</p>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-2">
                                                    <button onClick={() => { setRecipient(null); setRecipientIdentifier("") }} className="text-[9px] font-black text-slate-400 hover:text-slate-600 underline">Change</button>
                                                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                                                        <FaCheckCircle className="text-white" size={12} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Recent Transactions */}
                                        {!recipient && recentRecipients.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center px-1">
                                                    <span className="text-[10px] font-black text-slate-400  tracking-widest">Recents</span>
                                                    <button onClick={() => setShowAllRecents(!showAllRecents)} className="text-[9px] font-black text-blue-600 hover:underline">
                                                        {showAllRecents ? 'Collapse' : 'View All'}
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {(showAllRecents ? recentRecipients : recentRecipients.slice(0, 4)).map((r, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => handleLookup(r.identifier)}
                                                            className="flex items-center gap-3 p-3 rounded-2xl border border-slate-50 hover:bg-slate-50 transition text-left group"
                                                        >
                                                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border-2 border-white shadow-sm">
                                                                {r.avatar ? <img src={r.avatar} className="w-full h-full object-cover" /> : <FaUser className="text-slate-300" size={16} />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-600 transition">{r.display_name}</p>
                                                                <p className="text-[10px] text-slate-400 font-medium">{r.identifier}</p>
                                                            </div>
                                                            <FaArrowRight size={10} className="text-slate-200 group-hover:text-blue-400 transform group-hover:translate-x-1 transition" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            onClick={handleProceedToAmount}
                                            disabled={!recipient || isSearching}
                                            className={`w-full py-3 rounded-full text-sm font-medium transition-all
                                    ${recipient && !isSearching
                                                    ? "bg-rose-500 text-white active:scale-95"
                                                    : "bg-slate-100 text-slate-500 cursor-not-allowed"}
                                `}
                                        >
                                            Next
                                        </button>
                                    </div>
                                ) : step === 2 ? (
                                    <div className="space-y-6 animate-in slide-in-from-right-4">
                                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-[2rem] border border-slate-100">
                                            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-white">
                                                {recipient?.avatar ? <img src={recipient.avatar} className="w-full h-full object-cover" /> : <FaUser className="text-slate-300" size={20} />}
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400  tracking-widest">Sending to</p>
                                                <h4 className="font-black text-slate-900 text-sm">{recipient?.display_name}</h4>
                                            </div>
                                            <button onClick={() => setStep(1)} className="ml-auto p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 transition"><FaTimes size={12} /></button>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex justify-between items-end px-1">
                                                <label className="text-[10px] font-black text-slate-400  tracking-widest font-bold">How much? (₦)</label>
                                                <button onClick={() => setAmount(availableBalance.toString())} className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition shadow-sm">MAX BALANCE</button>
                                            </div>
                                            <div className="bg-slate-100 rounded-[2.2rem] overflow-hidden border-2 border-transparent focus-within:border-blue-500/20 focus-within:bg-white transition">
                                                <NumberInput
                                                    label="Amount"
                                                    value={amount}
                                                    onChange={(val) => setAmount(val.toString())}
                                                    placeholder="0.00"
                                                    min={50}
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-4 flex gap-3">
                                            <button onClick={() => setStep(1)} className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-full text-sm font-medium hover:bg-slate-50 transition active:scale-95">Back</button>
                                            <button
                                                onClick={handleProceedToPin}
                                                disabled={!amount || parseFloat(amount) < 50}
                                                className={`flex-[2] py-3 rounded-full text-sm font-medium transition-all
                                        ${(amount && parseFloat(amount) >= 50)
                                                        ? "bg-rose-500 text-white active:scale-95"
                                                        : "bg-slate-100 text-slate-500 cursor-not-allowed"}
                                    `}
                                            >
                                                Review Transfer
                                            </button>
                                        </div>
                                    </div>
                                ) : step === 3 ? (
                                    <div className="space-y-8 animate-in slide-in-from-right-4">
                                        <div className="text-center space-y-2">
                                            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-white shadow-xl">
                                                <FaLock size={24} />
                                            </div>
                                            <h4 className="text-lg font-black text-slate-900">Confirm Transfer</h4>
                                            <p className="text-xs text-slate-500 font-medium">Enter your StoqlePay Wallet PIN</p>
                                        </div>

                                        <div className="bg-slate-50 rounded-[2rem] p-6 space-y-4 border border-slate-100">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="font-black text-slate-400  text-[9px]">Sending to</span>
                                                <span className="font-black text-slate-900">{recipient?.display_name}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="font-black text-slate-400  text-[9px]">Amount</span>
                                                <span className="font-black text-slate-900">₦{parseFloat(amount).toLocaleString()}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
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
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    "Confirm & Send"
                                                )}
                                            </button>
                                            <button onClick={() => setStep(2)} className="w-full py-2 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition">Go Back</button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Success Alert (Step 4) */
                                    <div className="space-y-8 animate-in zoom-in-95 duration-500">
                                        <div className="flex flex-col items-center justify-center text-center space-y-6">
                                            <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center relative">
                                                <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20" />
                                                <FaCheckCircle className="text-emerald-500 relative z-10" size={48} />
                                            </div>

                                            <div className="space-y-3">
                                                <h4 className="text-3xl font-black text-slate-900 tracking-tight">Transfer Sent!</h4>
                                                <p className="text-sm font-medium text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                                                    Successfully sent ₦{parseFloat(amount).toLocaleString()} to {recipient?.display_name}.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-white space-y-4 shadow-inner">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-slate-400  tracking-widest">Reference</span>
                                                <span className="text-xs font-black text-slate-900">{transferResult?.reference}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-slate-400  tracking-widest">New Balance</span>
                                                <span className="text-sm font-black text-slate-900">₦{Number(transferResult?.new_balance).toLocaleString()}</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={onClose}
                                            className="w-full py-3 bg-rose-500 text-white rounded-full text-sm font-medium shadow-md hover:bg-rose-500 active:scale-95 transition"
                                        >
                                            Done
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                                    <FaWallet className="text-blue-500" />
                                </div>
                                <p className="text-[10px] font-black text-slate-500 tracking-tight leading-relaxed">
                                    StoqlePay transfers are internal, zero-fee, and reflect instantly in the recipient's wallet.
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
                    handleTransfer(verifiedPin);
                }}
                title="Authorize Transfer"
                description={`Please enter your 4-digit PIN to authorize the transfer of ₦${parseFloat(amount || '0').toLocaleString()} to ${recipient?.display_name}.`}
            />
        </>
    );
}
