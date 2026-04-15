"use client";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PinVerifyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (pin: string) => void;
    title?: string;
    description?: string;
    isLoading?: boolean;
    errorMessage?: string | null;
}

export default function PinVerifyModal({
    isOpen,
    onClose,
    onSuccess,
    title = "Enter Wallet PIN",
    description = "Enter your 4-digit security code to authorize this transaction.",
    isLoading = false,
    errorMessage = null
}: PinVerifyModalProps) {
    const [pin, setPin] = useState(["", "", "", ""]);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (isOpen) {
            setPin(["", "", "", ""]);
            setTimeout(() => {
                inputRefs.current[0]?.focus();
            }, 100);
        }
    }, [isOpen]);

    // Added: Reset PIN on error
    useEffect(() => {
        if (errorMessage) {
            setPin(["", "", "", ""]);
            inputRefs.current[0]?.focus();
        }
    }, [errorMessage]);

    const handlePinChange = (val: string, index: number) => {
        if (!/^\d*$/.test(val)) return;
        const currentPin = [...pin];
        currentPin[index] = val.slice(-1);
        setPin(currentPin);

        if (val && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }

        if (index === 3 && val) {
            const finalPin = currentPin.join("");
            // Delay slightly to show the last digit dot
            setTimeout(() => {
                onSuccess(finalPin);
                setPin(["", "", "", ""]);
            }, 150);
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
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
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
                        className="relative bg-white w-full max-w-sm rounded-[1rem] shadow-2xl overflow-hidden"
                    >
                        <div className="p-8 space-y-8">
                            <div className="text-center space-y-3">
                                <div className="mx-auto mb-4">
                                    <img src="/assets/images/logos.png" alt="Stoqle Logo" className="w-16 h-16 object-contain mx-auto" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3>
                                <p className="text-xs text-slate-500 font-medium px-4">{description}</p>
                            </div>

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
                                        className="w-14 h-16 bg-slate-50 border-2 border-slate-100 focus:border-red-500/20 focus:bg-white rounded-2xl text-center text-2xl font-black text-slate-900 transition-all outline-none"
                                    />
                                ))}
                            </div>

                            {errorMessage && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-3"
                                >
                                    <div className="text-red-500 mt-0.5 shrink-0 text-xs font-bold font-serif italic border border-red-500 rounded-full w-4 h-4 flex items-center justify-center">!</div>
                                    <p className="text-[11px] font-bold text-red-600 leading-relaxed">{errorMessage}</p>
                                </motion.div>
                            )}

                            {isLoading && (
                                <div className="flex flex-col items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                                    <p className="mt-2 text-[10px] font-black text-slate-400  tracking-widest">Verifying PIN...</p>
                                </div>
                            )}

                            <div className="pt-2 text-center">
                                <button
                                    onClick={onClose}
                                    className="text-[10px] font-black text-slate-400 hover:text-slate-600 transition  tracking-[0.2em]"
                                >
                                    Cancel Transaction
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
