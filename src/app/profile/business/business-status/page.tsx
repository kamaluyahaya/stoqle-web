// app/business/status/page.tsx   (or src/pages/BusinessStatusPage.tsx)
// Usage: client component in Next.js app router or pages router
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OpenStorePage from "../open-store/page";
import { API_BASE_URL } from "@/src/lib/config";
import StoqleLoader from "@/src/components/common/StoqleLoader";
import { FaStore, FaRocket, FaGlobe } from "react-icons/fa";
import EditBusinessProfileWithBusinessInfo from "@/src/components/business/businessActivePanel";
import { Business, BusinessPolicy } from "@/src/types/business";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/src/context/authContext";
import { idbGet, idbSet } from "@/src/lib/utils/idb";
import BusinessWalkthrough from "@/src/components/business/businessWalkthrough";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { ChevronRight, Check, Zap, ShieldCheck, Mail, Phone } from "lucide-react";
import { motion } from "framer-motion";


export default function BusinessStatusPage() {
  const router = useRouter();
  const { refreshUser } = useAuth() as any;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessPolicy, setBusinessPolicy] = useState<BusinessPolicy | null>(null);
  const [isBusiness, setIsBusiness] = useState<boolean | null>(null);
  const [staffStatus, setStaffStatus] = useState<string | null>(null);
  const [wallet, setWallet] = useState<any | null>(null);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [customerDeliveredCount, setCustomerDeliveredCount] = useState<number>(0);
  const [showWalkthrough, setShowWalkthrough] = useState(false);



  useEffect(() => {
    let mounted = true;

    async function load(isPolling = false) {
      if (!isPolling) {
        // 1. Initial hydration from IDB for "Blink-Eye" rendering
        try {
          const cached = await idbGet<any>("business_status_cache");
          if (cached && mounted) {
            setStaffStatus(cached.staffStatus);
            setIsBusiness(cached.isBusiness);
            setBusiness(cached.business);
            setBusinessPolicy(cached.policy);
            setWallet(cached.wallet);
            setPendingOrdersCount(cached.pendingOrdersCount);
            setCustomerDeliveredCount(cached.customerDeliveredCount);
            setLoading(false);
          }
        } catch (e) {
          console.error("IDB hydration error:", e);
        }
      }

      setError(null);

      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) {
          setError("No token found. Please sign in to view business status.");
          if (!isPolling) setLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/api/business/me`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `Request failed with status ${res.status}`);
        }

        const payload = await res.json();
        if (!mounted) return;

        const newData = {
          staffStatus: payload.data?.staff?.status ?? null,
          isBusiness: Boolean(payload.isBusiness),
          business: payload.data?.business ?? null,
          policy: payload.data?.policy ?? null,
          wallet: payload.data?.wallet ?? null,
          pendingOrdersCount: payload.data?.pendingOrdersCount ?? 0,
          customerDeliveredCount: payload.data?.customerDeliveredCount ?? 0,
        };

        setStaffStatus(newData.staffStatus);
        setIsBusiness(newData.isBusiness);
        setBusiness(newData.business);
        setBusinessPolicy(newData.policy);
        setWallet(newData.wallet);
        setPendingOrdersCount(newData.pendingOrdersCount);
        setCustomerDeliveredCount(newData.customerDeliveredCount);

        // Update IDB cache silently
        idbSet("business_status_cache", { ...newData, updatedAt: Date.now() }).catch(console.error);

      } catch (err: any) {
        // If we already have cached data, don't show the error as a full page error unless it's the very first load
        if (!isPolling) {
          const cached = await idbGet("business_status_cache");
          if (!cached) setError(err?.message ?? "Failed to load business status");
        }
      } finally {
        if (mounted && !isPolling) setLoading(false);
      }
    }

    load();

    const handleRefresh = () => load(true);
    window.addEventListener('refresh-business-data', handleRefresh);

    return () => {
      mounted = false;
      window.removeEventListener('refresh-business-data', handleRefresh);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center">
        <StoqleLoader size={30} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="rounded-2xl bg-white px-6 py-8 shadow-lg w-full max-w-md text-center">
          <h3 className="text-lg font-semibold text-rose-500">Something went wrong</h3>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <div className="mt-6 flex gap-3 justify-center">
            <button onClick={() => window.location.reload()} className="rounded-lg px-4 py-2 bg-rose-500 text-white font-medium">Retry</button>
            <button onClick={() => router.push("/")} className="rounded-lg px-4 py-2 border border-slate-200 bg-white">Home</button>
          </div>
        </div>
      </div>
    );
  }

  // No business record
  if (!isBusiness) {
    return (
      <OpenStorePage />
    );
  }

  // business exists
  const status = business?.business_status ?? "pending";

  const formatAddress = (addrJson?: string | null) => {
    if (!addrJson) return "No address provided";
    try {
      const parsed = typeof addrJson === 'string' ? JSON.parse(addrJson) : addrJson;
      const line1 = parsed.address_line_1 || parsed.line1 || "";
      const city = parsed.city || "";
      const state = parsed.state || "";
      return [line1, city, state].filter(Boolean).join(", ");
    } catch {
      return addrJson;
    }
  };

  return (
    <div className="min-h-screen ">
      {/* Mobile Sticky Header with iOS Back Button */}
      <div className="sticky top-0 z-[100] backdrop-blur-md border-gray-100 flex items-center px-4 h-14 lg:hidden">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-slate-800 hover:opacity-70 transition-opacity"
        >
          <ChevronLeftIcon className="w-6 h-6 stroke-[2.5]" />
        </button>
        <h1 className="flex-1 text-center font-bold text-slate-900">Business Status</h1>
        <button
          onClick={() => setShowWalkthrough(true)}
          className="p-2 -mr-2 text-slate-400 hover:text-rose-500 transition-colors"
          title="Show Guide"
        >
          <QuestionMarkCircleIcon className="w-6 h-6 stroke-[2.2]" />
        </button>
      </div>

      <div className="">
        {/* Pending Status Section */}
        {status === "pending" && (
          <div className="max-w-7xl mx-auto px-2 py-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[0.5rem] bg-white"
            >
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-rose-500/5 blur-3xl" />
              <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl" />

              <div className="relative z-10">
                {/* Hero Section */}
                <div className="bg-gradient-to-b from-slate-50 to-white p-8 sm:p-12 text-center border-b border-slate-50">
                  <div className="relative inline-block mb-8">
                    <div className="absolute inset-0 bg-rose-500/20 blur-2xl rounded-full scale-150 animate-pulse" />
                    <div className="relative bg-white rounded-full p-6 shadow-xl border border-rose-50">
                      <FaRocket className="w-12 h-12 text-rose-500" />
                    </div>
                  </div>

                  <h1 className="tex-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-4">
                    Verification in Progress
                  </h1>
                  <p className="text-slate-500 text-sm sm:text-lg leading-relaxed max-w-md mx-auto">
                    Your application is in the final stages of review. We're double-checking everything to ensure your shop launches perfectly.
                  </p>
                </div>

                {/* Progress Steps */}
                <div className="p-2 sm:p-1">
                  <div className="flex justify-between items-start mb-12">
                    {[
                      { label: "Submitted", active: true, done: true },
                      { label: "Reviewing", active: true, done: false },
                      { label: "Approval", active: false, done: false },
                    ].map((step, i, arr) => (
                      <div key={step.label} className="flex flex-col items-center flex-1 relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all duration-500 ${step.done ? "bg-emerald-500 text-white" :
                          step.active ? "bg-rose-500 text-white shadow-lg shadow-rose-200 ring-4 ring-rose-50" :
                            "bg-slate-100 text-slate-400"
                          }`}>
                          {step.done ? <Check className="w-5 h-5" strokeWidth={3} /> : i + 1}
                        </div>
                        <span className={`mt-3 text-xs font-bold  ${step.active ? "text-slate-900" : "text-slate-400"}`}>
                          {step.label}
                        </span>
                        {i < arr.length - 1 && (
                          <div className={`absolute top-5 left-1/2 w-full h-0.5 -z-0 ${arr[i + 1].active ? "bg-rose-500" : "bg-slate-100"
                            }`} />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Business Preview Card */}
                  <div className="bg-slate-50/50 rounded-[0.5rem] p-4 border border-slate-100 backdrop-blur-sm mb-12">
                    {/* Mobile: Business Name & Status - Stacked */}
                    <div className="flex flex-col items-start gap-2 mb-5 sm:hidden border-b border-slate-200/50 pb-4">
                      <h3 className="font-bold sm:text-2xl text-md text-slate-900 truncate w-full">{business?.business_name || "New Business"}</h3>
                      <div className="bg-amber-100 text-amber-700 text-[10px] px-3 py-1 rounded-full shrink-0">
                        Pending Approval
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="h-20 w-20 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                        {business?.logo ? (
                          <img src={business.logo} alt="Logo" className="h-full w-full object-cover" />
                        ) : business?.profile_pic ? (
                          <img src={business.profile_pic} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <FaStore className="text-slate-200 w-10 h-10" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* Desktop: Business Name (Hidden on Mobile) */}
                        <div className="hidden sm:flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-xl text-slate-900 truncate">{business?.business_name || "New Business"}</h3>
                          <div className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full ">Pending</div>
                        </div>

                        <p className="text-sm text-slate-500 truncate mb-3">{formatAddress(business?.business_address)}</p>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-white/50 px-2 py-1 rounded-lg border border-slate-100">
                            <FaGlobe className="w-3 h-3 text-blue-400" />
                            {business?.business_category || "General Store"}
                          </div>
                          <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-300" />
                          <div className="text-xs font-medium text-slate-400 italic">
                            Applied {business?.created_at ? formatDate(business.created_at) : "Today"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Helpful Tips */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                    <div className="p-4 rounded-2xl bg-white border border-slate-100 hover:border-rose-100 transition-colors">
                      <h4 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        While you wait...
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Prepare your product high-quality images and clear descriptions.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-slate-100 hover:border-blue-100 transition-colors">
                      <h4 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-blue-500" />
                        Quick Tip
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Review our seller policies to ensure a smooth launch experience.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <button
                      onClick={() => router.push("/market")}
                      className="group w-full py-3 bg-rose-500 text-white rounded-full text-md hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
                    >
                      Explore the Market
                      <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                    </button>
                    <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      Our team is processing requests in real-time
                    </p>

                    <div className="mt-6 pt-6 border-t border-slate-100">
                      <p className="text-center text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-3">
                        For urgent response
                      </p>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-xs font-bold text-slate-600">
                        <a href="mailto:support@stoqle.com" className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100">
                          <Mail className="w-3.5 h-3.5" />
                          support@stoqle.com
                        </a>
                        <a href="tel:+2348127494994" className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100">
                          <Phone className="w-3.5 h-3.5" />
                          +234 8127494994
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Suspended Status Section */}
        {status === "suspended" && (
          <div className="bg-white rounded-3xl shadow-xl shadow-rose-200/30 border border-rose-50 overflow-hidden">
            <div className="relative h-64 bg-rose-50 flex items-center justify-center p-8">
              <img
                src="/business_suspended_violation.png"
                alt="Account Suspended"
                className="h-full object-contain"
              />
              <div className="absolute top-4 right-4 bg-rose-500 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider ">
                Action Required
              </div>
            </div>

            <div className="p-8">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-3 text-rose-500">Account Suspended</h1>
                <p className="text-slate-500 leading-relaxed max-w-md mx-auto">
                  Your business access has been restricted due to a violation of our community guidelines or terms of service.
                </p>
              </div>

              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 mb-8">
                <h4 className="text-sm font-bold text-rose-900 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Why was my account suspended?
                </h4>
                <p className="text-sm text-rose-700 leading-relaxed">
                  {business?.suspension_reason || "Suspicious activity or repeated violations were detected on your account. Please review our safety guidelines for more information."}
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => router.push("/support")}
                  className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all active:scale-[0.98]"
                >
                  Contact Support / Appeal
                </button>
                <button
                  onClick={() => router.push("/")}
                  className="w-full py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Status Header */}
        {status === "active" && (
          <div className="mb-0">
            <EditBusinessProfileWithBusinessInfo
              apiBase={process.env.NEXT_PUBLIC_API_URL}
              business={business}
              businessPolicy={businessPolicy}
              wallet={wallet}
              pendingOrdersCount={pendingOrdersCount}
              customerDeliveredCount={customerDeliveredCount}
              onRefresh={() => {
                // We'll call load(true) to refresh state without full loading spinner
                const event = new CustomEvent('refresh-business-data');
                window.dispatchEvent(event);
              }}
              onReplayGuide={() => setShowWalkthrough(true)}
            />
          </div>
        )}

        {status === "rejected" && (
          <div className="space-y-6">
            <div className="bg-amber-50 border-y sm:border border-amber-200 sm:rounded-2xl p-4 flex gap-4">
              <div className="shrink-0 text-amber-500 mt-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-amber-900">Document Requirements Not Met</h3>
                <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                  Your submitted documents were rejected. Please update your business details with valid registration files.
                </p>
              </div>
            </div>
            <OpenStorePage />
          </div>
        )}
      </div>

      {status === "active" && (
        <BusinessWalkthrough
          forceShow={showWalkthrough}
          onComplete={() => setShowWalkthrough(false)}
        />
      )}
    </div>
  );
}

/* ---------- small helper components ---------- */

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md p-3 bg-white border">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 font-medium text-slate-900">{value}</div>
    </div>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
