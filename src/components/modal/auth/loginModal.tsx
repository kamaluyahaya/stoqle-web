"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_BASE_URL } from "@/src/lib/config";
import { useAuth } from "@/src/context/authContext";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (values: { phone: string; password: string }) => void;
};

type ApiUser = {
  user_id?: number;
  id?: number;
  full_name?: string | null;
  email?: string | null;
  phone_no?: string | null;
  account_status?: string | null;
  // ...other fields if needed
};

export default function LoginModal({ isOpen, onClose }: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const auth = useAuth();

  // user input
  const [identifier, setIdentifier] = useState(""); // phone or email
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");

  // flow state: "initial" -> "otp" -> "profile"
  const [step, setStep] = useState<"initial" | "otp" | "profile">("initial");

  // server-side user info returned after register-or-login / verify
  const [serverUser, setServerUser] = useState<ApiUser | null>(null);

  // loading + error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const original = document.body.style.overflow;
    if (isOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      // reset modal when closed
      setIdentifier("");
      setOtp("");
      setFullName("");
      setStep("initial");
      setServerUser(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  function isEmail(value: string) {
    return value.includes("@");
  }

  async function sendRegisterOrLogin() {
    setError(null);

    if (!identifier.trim()) {
      setError("Enter phone number or email");
      return;
    }

    // basic validation
    if (isEmail(identifier) === false) {
      // treat as phone
      const sanitized = identifier.replace(/[^\d+]/g, "");
      if (sanitized.length < 7) {
        setError("Enter a valid phone number");
        return;
      }
    } else {
      // basic email check
      if (!/\S+@\S+\.\S+/.test(identifier)) {
        setError("Enter a valid email");
        return;
      }
    }

    setLoading(true);
    try {
      const body: any = isEmail(identifier)
        ? { email: identifier.trim() }
        : { phone_no: identifier.trim() };

      const res = await fetch(`${API_BASE_URL}/api/auth/register-or-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        // backend may return structured error
        const message = data?.message || "Failed to request OTP";
        toast.error(message);
        setError(message);
        setLoading(false);
        return;
      }

      // success: OTP sent
      toast.success(data?.message || "OTP sent. Please verify.");
      setServerUser(data?.data?.user ?? null);
      setStep("otp");
    } catch (e: any) {
      toast.error("Network error. Try again.");
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    if (!otp.trim()) {
      setError("Enter the verification code");
      return;
    }

    setLoading(true);
    try {
      const body: any = isEmail(identifier)
        ? { email: identifier.trim(), otp: otp.trim() }
        : { phone_no: identifier.trim(), otp: otp.trim() };

      const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || data?.status === "fail") {
        const message = data?.message || "OTP verification failed";
        toast.error(message);
        setError(message);
        setLoading(false);
        return;
      }

      // Verified
      toast.success(data?.message || "OTP verified");

      // If needsProfile: true -> show full name form
      if (data?.data?.needsProfile) {
        setServerUser(data?.data?.user ?? null);
        setStep("profile");
      } else {
        // logged in: save token + user and redirect to dashboard
        const token = data?.data?.token;
        const user = data?.data?.user;
        if (token && user) {
          auth._onLoginSuccess(user, token);
        }
        onClose();
 window.location.href = "/discover";
      }
    } catch (e: any) {
      toast.error("Network error. Try again.");
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function maskIdentifier(value: string) {
    if (value.includes("@")) {
      const [name, domain] = value.split("@");
      if (name.length <= 2) return `*@${domain}`;
      return `${name.slice(0, 2)}***@${domain}`;
    }

    // phone number
    if (value.length <= 6) return "***";
    return `${value.slice(0, 3)}****${value.slice(-3)}`;
  }

  async function submitFullName() {
    setError(null);
    if (!fullName.trim()) {
      setError("Enter your full name");
      return;
    }
    if (!serverUser?.user_id && !serverUser?.id) {
      setError("User not available. Try logging in again.");
      return;
    }

    setLoading(true);
    try {
      const userId = serverUser.user_id ?? serverUser.id;
      const res = await fetch(`${API_BASE_URL}/api/auth/user/${userId}/name`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName.trim() }),
      });

      const data = await res.json();

      if (!res.ok || data?.status === "fail") {
        const message = data?.message || "Failed to update name";
        toast.error(message, );
        setError(message);
        setLoading(false);
        return;
      }

      // success: receives token + user
      const token = data?.data?.token;
      const user = data?.data?.user;
      if (token && user) {
        auth._onLoginSuccess(user, token);
      }
      // close modal and optionally redirect
      onClose();
      router.push("/discover");
    } catch (e: any) {
      toast.error("Network error. Try again.");
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      ref={wrapperRef}
      className="fixed inset-0 z-[60] flex items-center justify-center lg:px-4 lg:py-6 "
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-black/50 " aria-hidden />

      {/* Modal container */}
      <div
        onMouseDown={stop}
        className="relative z-10 w-full max-w-none h-full lg:max-w-[820px] lg:h-[50vh] bg-white lg:rounded-2xl shadow-2xl overflow-hidden flex flex-col lg:flex-row"
      >
        {/* Mobile close (top-left) */}
        <button
          onClick={() => {
            auth.closeLogin();
            onClose();
          }}
          aria-label="Close"
          className="absolute top-4 left-4 lg:hidden p-2 rounded-md bg-white/60 hover:bg-white transition z-20"
        >
          <svg className="w-5 h-5 text-slate-700" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* RIGHT (inputs) — show first on mobile, second on desktop */}
        <div className="lg:w-1/2 p-6 md:p-8 flex flex-col relative order-1 lg:order-2">
          {/* Desktop close button */}
          <button
            onClick={() => {
              auth.closeLogin();
              onClose();
            }}
            aria-label="Close"
            className="hidden lg:flex absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition"
          >
            <svg className="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="text-slate-800 p-2 mb-6 font-bold text-center">Login with Phone or Email</div>

          <div className="max-w-[420px] w-full mx-auto mt-2">
            {/* INITIAL: send OTP */}
            {step === "initial" && (
              <div className="space-y-4">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Phone number or Email"
                  className="w-full rounded-full bg-gray-100 px-5 py-3 pr-11 text-sm text-slate-500 font-medium caret-red-500 outline-none transition"
                  aria-label="Phone number or email"
                  required
                />

                {error && <div className="text-sm text-rose-500">{error}</div>}

                <div className="pt-6">
                  <button
                    type="button"
                    onClick={sendRegisterOrLogin}
                    disabled={loading}
                    className="w-full py-4 text-sm font-bold bg-rose-600 text-white hover:brightness-95 transition rounded-full"
                  >
                    {loading ? "Requesting..." : "Get verification"}
                  </button>
                </div>

                <div className="pt-3 text-xs text-slate-400">
                  I have read and agree to the User Agreement and Privacy Policy.
                </div>
              </div>
            )}

            {/* OTP step */}
            {step === "otp" && (
              <div className="space-y-4">
                <div className="text-sm text-slate-600 text-center">
                  We sent a verification code to{" "}
                  <span className="font-semibold text-slate-800">
                    {maskIdentifier(identifier)}
                  </span>
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter verification code (OTP)"
                  className="w-full rounded-full bg-gray-100 px-5 py-3 pr-11 text-sm text-slate-500 font-medium caret-red-500 outline-none transition"
                />

                {error && <div className="text-sm text-rose-500">{error}</div>}

                <div className="pt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={verifyOtp}
                    disabled={loading}
                    className="col-span-2 w-full py-3 text-sm font-bold bg-rose-600 text-white hover:brightness-95 transition rounded-full"
                  >
                    {loading ? "Verifying..." : "Verify OTP"}
                  </button>
                </div>

                <div className="pt-3 text-xs text-slate-400 text-center">
                  Didn’t receive it? <button className="text-sky-600 underline" onClick={sendRegisterOrLogin}>Resend</button>
                </div>
              </div>
            )}

            {/* PROFILE step: needs full name */}
            {step === "profile" && (
              <div className="space-y-4">
                <div className="text-sm text-slate-600 text-center">Complete your profile to activate your account.</div>

                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-full bg-gray-100 px-5 py-3 pr-11 text-sm text-slate-500 font-medium caret-red-500 outline-none transition"
                />

                {error && <div className="text-sm text-rose-500">{error}</div>}

                <div className="pt-6">
                  <button
                    type="button"
                    onClick={submitFullName}
                    disabled={loading}
                    className="w-full py-4 text-sm font-bold bg-rose-600 text-white hover:brightness-95 transition rounded-full"
                  >
                    {loading ? "Activating..." : "Activate account"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Floating small footer on desktop */}
          <div className="mt-auto hidden lg:flex items-center justify-center p-4 border-t border-slate-100">
            <div className="text-xs text-slate-400">New users can log in directly.</div>
          </div>
        </div>

        {/* Mobile horizontal OR divider when stacked (kept between inputs and google when stacked) */}
        <div className="lg:hidden w-full flex items-center gap-3 px-6 py-3 order-2">
          <div className="flex-1 h-px bg-slate-200" />
          <div className="text-xs text-slate-400">OR</div>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* LEFT (branding + Google) — moved below inputs on mobile via order classes */}
        <div className="lg:w-1/2 flex flex-col p-8 lg:border-r lg:border-slate-100 order-3 lg:order-1">
          <div className="flex justify-center mb-5">
            <div className="bg-blue-100 text-blue-500 px-4 py-2 font-bold text-sm lg:text-md rounded-full">
              Login to receive personalized content
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <div className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white">
              Stoqle
            </div>

            {/* hidden on mobile per request */}
            <h3 className="text-lg font-semibold text-slate-900 hidden lg:block">
              Welcome back
            </h3>

            <p className="text-sm text-slate-500">Sign in quickly with Google.</p>

            <div className="w-full pt-4 max-w-[420px]">
              <button
                type="button"
                onClick={() => toast("Google sign-in not wired yet")}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-100 bg-slate-200 hover:brightness-95 transition"
              >
                <svg className="w-5 h-5" viewBox="0 0 533.5 544.3" aria-hidden>
                  <path fill="#4285F4" d="M533.5 278.4c0-18.5-1.5-37-4.9-54.7H272v103.6h147.1c-6.3 34-25.6 62.8-54.7 82v68h88.3c51.6-47.6 81.8-117.8 81.8-199z" />
                  <path fill="#34A853" d="M272 544.3c73.6 0 135.4-24.3 180.6-66.2l-88.3-68c-24.5 16.5-56 26.1-92.3 26.1-71 0-131.2-47.9-152.6-112.2H27.4v70.8C71.8 482.5 165.4 544.3 272 544.3z" />
                  <path fill="#FBBC05" d="M119.4 324.9c-10.6-31.7-10.6-65.8 0-97.5V156.6H27.4C-1 204.2-1 299.8 27.4 348.4l92-23.5z" />
                  <path fill="#EA4335" d="M272 107.7c39.4 0 74.7 13.6 102.5 40.2l76.8-76.8C406 23.6 344.2 0 272 0 165.4 0 71.8 61.8 27.4 156.6l92 70.5C140.8 155.6 201 107.7 272 107.7z" />
                </svg>
                <span className="text-sm font-medium text-slate-700">Continue with Google</span>
              </button>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400">
            We’ll never post without your permission.
          </div>
        </div>
      </div>
    </div>
  );
}
