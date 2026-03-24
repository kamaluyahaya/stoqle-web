"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoCloseOutline, IoChevronBackOutline } from "react-icons/io5";
import { toast } from "sonner";
import { useAuth } from "@/src/context/authContext";
import { API_BASE_URL } from "@/src/lib/config";
import NumberInput from "@/src/components/input/phoneNumber";

interface PhoneVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PhoneVerificationModal({ isOpen, onClose, onSuccess }: PhoneVerificationModalProps) {
  const { token, _onLoginSuccess, user, onPhoneVerified } = useAuth() as any;
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState<number | "">("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer for resend cooldown
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Handle phone submission
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phone || String(phone).length < 7) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/phone/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone_no: `+234${phone}` }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("OTP sent to your phone");
        setStep("otp");
        setCooldown(60);
      } else {
        toast.error(data.message || "Failed to send OTP");
      }
    } catch (err) {
      toast.error("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit change
  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto focus next
    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

    // Auto submit if complete
    if (newOtp.every(digit => digit !== "") && index === 5) {
      handleVerifyOtp(newOtp.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6).split("");
    if (pastedData.every(char => !isNaN(Number(char)))) {
      const newOtp = [...otp];
      pastedData.forEach((char, i) => {
        if (i < 6) newOtp[i] = char;
      });
      setOtp(newOtp);
      if (newOtp.every(digit => digit !== "")) {
        handleVerifyOtp(newOtp.join(""));
      } else {
        const nextIdx = Math.min(pastedData.length, 5);
        otpInputs.current[nextIdx]?.focus();
      }
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/phone/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone_no: phone, otp: code }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Phone verified!");
        // Update user in context
        const updatedNo = `+234${phone}`;
        const updatedUser = { ...user, phone_no: updatedNo };
        
        if (onPhoneVerified) {
          onPhoneVerified(updatedUser);
        } else {
          _onLoginSuccess(updatedUser, token!);
        }
        onSuccess();
      } else {
        toast.error(data.message || "Invalid OTP");
        setOtp(["", "", "", "", "", ""]);
        otpInputs.current[0]?.focus();
      }
    } catch (err) {
      toast.error("Verification failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[30000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className=" w-full max-w-md rounded-[0.5rem] bg-gray-900 overflow-hidden relative"
        >
          {/* Header */}
          <div className="p-6 flex items-center justify-between border-gray-50">
            {step === "otp" ? (
              <button
                onClick={() => setStep("phone")}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <IoChevronBackOutline size={20} className="text-gray-600" />
              </button>
            ) : (
              <div className="w-9" />
            )}
            <h2 className="text-sm font-bold text-white">
              {step === "phone" ? "Add Your Mobile Number" : "Enter Code"}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <IoCloseOutline size={24} className="text-gray-600" />
            </button>
          </div>

          <div className="p-8">
            <AnimatePresence mode="wait">
              {step === "phone" ? (
                <motion.div
                  key="phone-step"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                >
                  <p className="text-gray-500 text-sm  text-center">
                    Enter your phone number to receive a 6-digit verification code.
                  </p>
                  <form onSubmit={handleSendOtp} className="space-y-6">
                    <div className="flex items-center gap-3 p-2 border-b border-slate-600">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-lg font-bold text-white shrink-0 tracking-tight">+234</span>
                        <div className="flex-1">
                          <NumberInput
                            label=""
                            value={phone}
                            onChange={(val) => setPhone(val)}
                            placeholder="Enter your phone number"
                            required
                            variant="compact"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !phone}
                      className="w-full bg-red-500 text-white py-3 rounded-full font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3 text-sm tracking-widest"
                    >
                      {loading ? (
                        <div className="w-5 h-5  rounded-full animate-spin" />
                      ) : (
                        "Get Code"
                      )}
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="otp-step"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                >
                  <p className="text-slate-400 text-sm mb-8 text-center">
                    We've sent a code to <span className="text-white font-medium">+234 {phone}</span>
                  </p>

                  <div className="flex justify-between gap-2 mb-8">
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { otpInputs.current[idx] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        onPaste={idx === 0 ? handlePaste : undefined}
                        className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold bg-gray-50 border-transparent focus:bg-white focus:border-blue-500 border-2 rounded-xl transition-all outline-none"
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  <div className="text-center">
                    {cooldown > 0 ? (
                      <p className="text-gray-400 text-sm">
                        Resend in <span className="font-medium text-gray-600">{cooldown}s</span>
                      </p>
                    ) : (
                      <button
                        onClick={handleSendOtp}
                        className="text-blue-600 text-sm font-bold hover:text-blue-700 transition-colors"
                      >
                        Resend Code
                      </button>
                    )}
                  </div>

                  {loading && (
                    <div className="mt-6 flex justify-center">
                      <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
