"use client";
import React, { useState, useEffect, useRef } from "react";
import { FaTimes, FaLock, FaExclamationTriangle } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

interface WalletPinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (pin: string) => void;
    errorMessage?: string | null;
    isLoading?: boolean;
}

export default function WalletPinModal({ isOpen, onClose, onSuccess, errorMessage, isLoading }: WalletPinModalProps) {
    const [pin, setPin] = useState(["", "", "", ""]);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (isOpen) {
            setPin(["", "", "", ""]);
            setTimeout(() => inputRefs.current[0]?.focus(), 300);
        }
    }, [isOpen]);

    const handlePinChange = (val: string, index: number) => {
        if (!/^\d*$/.test(val)) return;

        const newPin = [...pin];
        newPin[index] = val.slice(-1);
        setPin(newPin);

        // Move to next
        if (val && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto submit
        if (index === 3 && val) {
            onSuccess(newPin.join(""));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === "Backspace" && !pin[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[1002] flex items-end justify-center sm:items-center p-0 sm:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden pb-10 sm:pb-0"
                    >
                        <div className="p-8 space-y-8">
                            <div className="flex justify-between items-center">
                                <div className="w-10" /> {/* Spacer */}
                                <div className="text-center space-y-2">
                                    <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-white shadow-xl">
                                        <FaLock size={24} />
                                    </div>
                                    <h4 className="text-lg font-black text-slate-900">Wallet PIN</h4>
                                    <p className="text-xs text-slate-500 font-medium tracking-tight">Enter your 4-digit StoqlePay PIN</p>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition text-slate-400">
                                    <FaTimes size={18} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="flex justify-center gap-3">
                                    {[0, 1, 2, 3].map((i) => (
                                        <input
                                            key={i}
                                            ref={(el) => { inputRefs.current[i] = el; }}
                                            type="password"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={pin[i]}
                                            onChange={(e) => handlePinChange(e.target.value, i)}
                                            onKeyDown={(e) => handleKeyDown(e, i)}
                                            className="w-14 h-16 bg-slate-50 border-2 border-slate-100 focus:border-rose-500/20 focus:bg-white rounded-2xl text-center text-3xl font-black text-slate-900 transition-all outline-none"
                                        />
                                    ))}
                                </div>

                                {errorMessage && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-3"
                                    >
                                        <FaExclamationTriangle className="text-rose-500 mt-0.5 shrink-0" size={14} />
                                        <p className="text-[11px] font-bold text-rose-500 leading-relaxed">{errorMessage}</p>
                                    </motion.div>
                                )}

                                {isLoading && (
                                    <div className="flex flex-col items-center justify-center py-4">
                                        <div className="w-6 h-6 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
                                        <p className="mt-2 text-[10px] font-black text-slate-400  tracking-widest">Verifying PIN...</p>
                                    </div>
                                )}
                            </div>

                            <div className="text-center">
                                <p className="text-[10px] font-black text-slate-400  tracking-widest leading-relaxed">
                                    Stoqle uses military-grade encryption to ensure your transactions are always secure.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
