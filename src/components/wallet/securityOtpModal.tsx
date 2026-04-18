"use client";
import React, { useState, useEffect, useRef } from "react";
import { FaTimes, FaShieldAlt, FaExclamationTriangle } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

interface SecurityOtpModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (otp: string) => void;
    errorMessage?: string | null;
    isLoading?: boolean;
    channel?: string;
}

export default function SecurityOtpModal({ isOpen, onClose, onSuccess, errorMessage, isLoading, channel = 'Email' }: SecurityOtpModalProps) {
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (isOpen) {
            setOtp(["", "", "", "", "", ""]);
            setTimeout(() => inputRefs.current[0]?.focus(), 300);
        }
    }, [isOpen]);

    const handleOtpChange = (val: string, index: number) => {
        if (!/^\d*$/.test(val)) return;

        const newOtp = [...otp];
        newOtp[index] = val.slice(-1);
        setOtp(newOtp);

        // Move to next
        if (val && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto submit if all 6 filled
        if (index === 5 && val && newOtp.every(d => d !== "")) {
            // We don't auto-submit here so the user can verify, or we can. 
            // In PinModal it auto-submits. Let's auto-submit for better UX.
            onSuccess(newOtp.join(""));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleSubmit = () => {
        const fullOtp = otp.join("");
        if (fullOtp.length === 6) {
            onSuccess(fullOtp);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[1003] flex items-end justify-center sm:items-center p-0 sm:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm shadow-inner"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 30, stiffness: 400 }}
                        className="relative bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden pb-10 sm:pb-0"
                    >
                        <div className="p-8 space-y-8">
                            <div className="flex justify-between items-center">
                                <div className="w-10" /> {/* Spacer */}
                                <div className="text-center space-y-3">
                                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto text-white shadow-xl ring-4 ring-blue-50">
                                        <FaShieldAlt size={24} />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-xl font-black text-slate-900 tracking-tight">Security Code</h4>
                                        <p className="text-xs text-slate-500 font-semibold tracking-tight leading-relaxed max-w-[240px] mx-auto">
                                            Enter the 6-digit code sent to your registered <span className="text-blue-600">{channel}</span>
                                        </p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition text-slate-400">
                                    <FaTimes size={18} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="flex justify-center gap-2 sm:gap-3">
                                    {[0, 1, 2, 3, 4, 5].map((i) => (
                                        <input
                                            key={i}
                                            ref={(el) => { inputRefs.current[i] = el; }}
                                            type="text"
                                            inputMode="numeric"
                                            pattern="\d*"
                                            maxLength={1}
                                            value={otp[i]}
                                            onChange={(e) => handleOtpChange(e.target.value, i)}
                                            onKeyDown={(e) => handleKeyDown(e, i)}
                                            className="w-12 h-16 sm:w-14 sm:h-16 bg-slate-50 border-2 border-slate-100 focus:border-blue-500/20 focus:bg-white rounded-2xl text-center text-3xl font-black text-slate-900 shadow-sm transition-all outline-none"
                                        />
                                    ))}
                                </div>

                                {errorMessage && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="bg-rose-50 border border-rose-100 p-4 rounded-3xl flex items-start gap-3"
                                    >
                                        <FaExclamationTriangle className="text-rose-500 mt-0.5 shrink-0" size={14} />
                                        <p className="text-[11px] font-bold text-rose-600 leading-relaxed  tracking-tight">{errorMessage}</p>
                                    </motion.div>
                                )}

                                <button
                                    onClick={handleSubmit}
                                    disabled={isLoading || otp.join("").length < 6}
                                    className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-xs  tracking-[0.2em] hover:bg-slate-800 transition shadow-lg disabled:opacity-30 disabled:grayscale"
                                >
                                    {isLoading ? "Verifying..." : "Confirm Verification"}
                                </button>
                            </div>

                            <div className="text-center pt-2">
                                <p className="text-[10px] font-black text-slate-300  tracking-widest leading-loose max-w-[300px] mx-auto">
                                    Stoqle staff will never request an otp from you. do not disclose it to anyone.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
