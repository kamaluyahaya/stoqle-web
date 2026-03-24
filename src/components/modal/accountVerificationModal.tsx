"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoCloseOutline, IoChevronBackOutline, IoMailOutline, IoCallOutline } from "react-icons/io5";
import { toast } from "sonner";
import { useAuth } from "@/src/context/authContext";
import { API_BASE_URL } from "@/src/lib/config";
import NumberInput from "@/src/components/input/phoneNumber";

interface AccountVerificationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export default function AccountVerificationModal({ open, onClose, onSuccess }: AccountVerificationModalProps) {
  const { token, user } = useAuth();

  // Decide which verification to start with
  const needsPhone = !user?.phone_no;
  const needsEmail = !user?.email;

  const [verifyType, setVerifyType] = useState<"phone" | "email">(needsPhone ? "phone" : "email");
  const [step, setStep] = useState<"input" | "otp">("input");

  const [phone, setPhone] = useState<number | "">("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      if (!user?.phone_no) {
        setVerifyType("phone");
      } else if (!user?.email) {
        setVerifyType("email");
      }
      setStep("input");
      setOtp(["", "", "", "", "", ""]);
      setLoading(false);
    }
  }, [open, user]);

  // Timer for resend cooldown
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (verifyType === "phone") {
      if (!phone || String(phone).length < 7) {
        toast.error("Please enter a valid phone number");
        return;
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim() || !emailRegex.test(email)) {
        toast.error("Please enter a valid email address");
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = verifyType === "phone" ? "/api/auth/phone/send-otp" : "/api/auth/email/send-otp";
      const body = verifyType === "phone" ? { phone_no: `+234${phone}` } : { email };

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`OTP sent to your ${verifyType}`);
        setStep("otp");
        setCooldown(60);
      } else {
        toast.error(data.message || `Failed to send OTP to ${verifyType}`);
      }
    } catch (err) {
      toast.error("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

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
      pastedData.forEach((char, i) => { if (i < 6) newOtp[i] = char; });
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
      const endpoint = verifyType === "phone" ? "/api/auth/phone/verify-otp" : "/api/auth/email/verify-otp";
      const body = verifyType === "phone" ? { phone_no: `+234${phone}`, otp: code } : { email, otp: code };

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`${verifyType === "phone" ? "Phone" : "Email"} verified!`);

        // Prepare updated user object
        const updatedUser = { ...user };
        if (verifyType === "phone") updatedUser.phone_no = `+234${phone}`;
        else updatedUser.email = email;

        // If we still need to verify the other one, switch mode
        if (verifyType === "phone" && !user?.email && !email) {
          setVerifyType("email");
          setStep("input");
          setOtp(["", "", "", "", "", ""]);
          setCooldown(0);
          setLoading(false);
          return;
        }

        // Complete the process
        onSuccess(updatedUser);
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

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[30000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="w-full max-w-md rounded-[0.5rem] bg-gray-900 border border-slate-700/50 shadow-2xl overflow-hidden relative"
        >
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
            {step === "otp" ? (
              <button
                onClick={() => setStep("input")}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                title="Back"
              >
                <IoChevronBackOutline size={20} className="text-white" />
              </button>
            ) : (
              <div className="w-9" />
            )}

            <div className="flex flex-col items-center">
              <h2 className="text-sm font-bold text-white tracking-tight">
                {step === "input"
                  ? (verifyType === "phone" ? "Verify Mobile Number" : "Verify Email Address")
                  : "Enter Verification Code"
                }
              </h2>
              <div className="flex gap-1 mt-1">
                <div className={`h-1 w-8 rounded-full ${verifyType === "phone" ? "bg-red-500" : "bg-slate-700"}`} />
                <div className={`h-1 w-8 rounded-full ${verifyType === "email" ? "bg-red-500" : "bg-slate-700"}`} />
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              title="Close"
            >
              <IoCloseOutline size={24} className="text-white" />
            </button>
          </div>

          <div className="p-8">
            <AnimatePresence mode="wait">
              {step === "input" ? (
                <motion.div
                  key="input-step"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col items-center gap-4 mb-2">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                      {verifyType === "phone" ? <IoCallOutline size={32} /> : <IoMailOutline size={32} />}
                    </div>
                    <p className="text-slate-400 text-sm text-center px-4">
                      {verifyType === "phone"
                        ? "Confirm your phone number to receive a 6-digit verification code."
                        : "Enter your email address to receive a secure verification code."
                      }
                    </p>
                  </div>

                  <form onSubmit={handleSendOtp} className="space-y-6">
                    {verifyType === "phone" ? (
                      <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl focus-within:border-red-500/50 transition-all">
                        <span className="text-lg font-bold text-white shrink-0 tracking-tight pl-1">+234</span>
                        <div className="flex-1">
                          <NumberInput
                            label=""
                            value={phone}
                            onChange={(val) => setPhone(val)}
                            placeholder="Phone Number"
                            required
                            variant="compact"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl focus-within:border-red-500/50 transition-all">
                        <IoMailOutline className="text-slate-400 ml-1" size={20} />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email Address"
                          className="flex-1 bg-transparent border-none outline-none text-white font-medium placeholder:text-slate-500"
                          required
                          autoFocus
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || (verifyType === "phone" ? !phone : !email)}
                      className="w-full bg-red-500 text-white py-3 rounded-full font-bold transition-all hover:bg-red-600 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3 text-sm tracking-widest shadow-lg shadow-red-500/20"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                  <p className="text-slate-400 text-sm mb-10 text-center">
                    We've sent a code to <br />
                    <span className="text-white font-bold mt-1 inline-block">
                      {verifyType === "phone" ? `+234 ${phone}` : email}
                    </span>
                  </p>

                  <div className="flex justify-between gap-2 mb-10">
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
                        className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-red-500 border-2 rounded-xl transition-all outline-none"
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  <div className="text-center space-y-4">
                    {cooldown > 0 ? (
                      <p className="text-slate-500 text-xs">
                        Didn't get the code? Resend in <span className="font-bold text-slate-300">{cooldown}s</span>
                      </p>
                    ) : (
                      <button
                        onClick={handleSendOtp}
                        className="text-red-500 text-xs font-bold hover:text-red-400 transition-colors uppercase tracking-widest"
                      >
                        Resend New Code
                      </button>
                    )}
                  </div>

                  {loading && (
                    <div className="mt-8 flex justify-center">
                      <div className="w-6 h-6 border-2 border-white/20 border-t-red-500 rounded-full animate-spin" />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="px-8 pb-8 text-center">
            <p className="text-[10px] text-slate-600 leading-relaxed max-w-[240px] mx-auto">
              Stoole uses two-factor verification to ensure your account security and prevent unauthorized access.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
