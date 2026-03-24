"use client";
import React, { useState } from "react";
import { FaChevronLeft } from "react-icons/fa";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "@/src/lib/config";

interface PinSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function PinSetupModal({ isOpen, onClose, onSuccess }: PinSetupModalProps) {
    const [step, setStep] = useState(1); // 1: Enter PIN, 2: Confirm PIN, 3: Success
    const [pin, setPin] = useState(["", "", "", ""]);
    const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

    const handlePinChange = (val: string, index: number, isConfirm: boolean) => {
        if (!/^\d*$/.test(val)) return;
        const currentPin = isConfirm ? [...confirmPin] : [...pin];
        currentPin[index] = val.slice(-1);

        if (isConfirm) setConfirmPin(currentPin);
        else setPin(currentPin);

        // Move to next
        if (val && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto submit if last
        if (index === 3 && val) {
            if (!isConfirm) {
                setStep(2);
                // Clear confirm pin and focus first box of second step
                setConfirmPin(["", "", "", ""]);
                setTimeout(() => inputRefs.current[0]?.focus(), 100);
            } else {
                handleSetup(currentPin.join(""));
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === "Backspace" && !(step === 2 ? confirmPin : pin)[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleSetup = async (finalPin: string) => {
        const pinString = pin.join("");
        if (pinString !== finalPin) {
            toast.error("PINs do not match");
            setConfirmPin(["", "", "", ""]);
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
            return;
        }

        try {
            setIsSubmitting(true);
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/wallet/pin/set`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ pin: pinString }),
            });

            const data = await res.json();
            if (data.status === "success" || data.success) {
                setStep(3);
                toast.success("Wallet PIN set successfully!");
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 2000);
            } else {
                toast.error(data.message || "Failed to set PIN");
            }
        } catch (err) {
            toast.error("An error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
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
                        <div className="p-8 space-y-8">
                            {step === 1 ? (
                                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                    <div className="text-center space-y-3">
                                        <div className="mx-auto mb-4">
                                            <img src="/assets/images/logos.png" alt="Stoqle Logo" className="w-16 h-16 object-contain mx-auto" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Create Wallet PIN</h3>
                                        <p className="text-xs text-slate-500 font-medium px-4">Set a 4-digit security code for your wallet transactions.</p>
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
                                                onChange={(e) => handlePinChange(e.target.value, i, false)}
                                                onKeyDown={(e) => handleKeyDown(e, i)}
                                                autoFocus={i === 0}
                                                className="w-14 h-16 bg-slate-50 border-2 border-slate-100 focus:border-red-500/20 focus:bg-white rounded-2xl text-center text-2xl font-black text-slate-900 transition-all outline-none"
                                            />
                                        ))}
                                    </div>

                                    <div className="pt-4">
                                        <button
                                            disabled={pin.some(d => !d)}
                                            onClick={() => setStep(2)}
                                            className={`w-full py-3 rounded-full text-sm font-medium transition-all
                                        ${!pin.some(d => !d)
                                                    ? "bg-red-500 text-white shadow-md active:scale-95"
                                                    : "bg-slate-100 text-slate-500 cursor-not-allowed"}
                                    `}
                                        >
                                            Continue
                                        </button>
                                    </div>
                                </div>
                            ) : step === 2 ? (
                                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                    <div className="text-center space-y-3 relative">
                                        <button onClick={() => setStep(1)} className="absolute -top-1 -left-1 p-2 text-slate-400 hover:text-slate-600 transition"><FaChevronLeft size={16} /></button>
                                        <div className="mx-auto mb-4">
                                            <img src="/assets/images/logos.png" alt="Stoqle Logo" className="w-16 h-16 object-contain mx-auto" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Confirm PIN</h3>
                                        <p className="text-xs text-slate-500 font-medium px-4">Type your 4-digit security code again to confirm.</p>
                                    </div>

                                    <div className="flex justify-center gap-3">
                                        {[0, 1, 2, 3].map((i) => (
                                            <input
                                                key={i}
                                                ref={(el) => { inputRefs.current[i] = el; }}
                                                type="password"
                                                inputMode="numeric"
                                                maxLength={1}
                                                value={confirmPin[i]}
                                                onChange={(e) => handlePinChange(e.target.value, i, true)}
                                                onKeyDown={(e) => handleKeyDown(e, i)}
                                                autoFocus={i === 0}
                                                className="w-14 h-16 bg-slate-50 border-2 border-slate-100 focus:border-red-500/20 focus:bg-white rounded-2xl text-center text-2xl font-black text-slate-900 transition-all outline-none"
                                            />
                                        ))}
                                    </div>

                                    <div className="pt-4">
                                        <button
                                            onClick={() => handleSetup(confirmPin.join(""))}
                                            disabled={isSubmitting || confirmPin.some(d => !d)}
                                            className={`w-full py-3 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-3
                                        ${(!isSubmitting && !confirmPin.some(d => !d))
                                                    ? "bg-red-500 text-white shadow-md active:scale-95"
                                                    : "bg-slate-100 text-slate-500 cursor-not-allowed"}
                                    `}
                                        >
                                            {isSubmitting ? (
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                "Verify & Finalize"
                                            )}
                                        </button>
                                        <button onClick={() => setStep(1)} className="w-full py-2 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition tracking-tight">Wait, I need to change it</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 space-y-6 animate-in zoom-in-95 duration-500">
                                    <div className="mx-auto mb-4 relative">
                                        <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-20 scale-150" />
                                        <img src="/assets/images/logos.png" alt="Stoqle Logo" className="w-20 h-20 object-contain mx-auto relative z-10" />
                                    </div>
                                    <div className="space-y-3">
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Security Activated!</h3>
                                        <p className="text-sm text-slate-500 font-medium px-8 leading-relaxed">Your wallet PIN is set. You'll receive a confirmation email shortly.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
