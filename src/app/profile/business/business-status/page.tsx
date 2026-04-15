// app/business/status/page.tsx   (or src/pages/BusinessStatusPage.tsx)
// Usage: client component in Next.js app router or pages router
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OpenStorePage from "../open-store/page";
import { API_BASE_URL } from "@/src/lib/config";
import Shimmer from "@/src/components/business/business-shimmer";
import { FaStore } from "react-icons/fa";
import EditBusinessProfileWithBusinessInfo from "@/src/components/business/businessActivePanel";
import { Business, BusinessPolicy } from "@/src/types/business";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/src/context/authContext";


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



  useEffect(() => {
    let mounted = true;
    async function load(isPolling = false) {
      if (!isPolling) setLoading(true);
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

        setStaffStatus(payload.data?.staff?.status ?? null);
        setIsBusiness(Boolean(payload.isBusiness));
        setBusiness(payload.data?.business ?? null);
        setBusinessPolicy(payload.data?.policy ?? null);
        setWallet(payload.data?.wallet ?? null);
        setPendingOrdersCount(payload.data?.pendingOrdersCount ?? 0);
        setCustomerDeliveredCount(payload.data?.customerDeliveredCount ?? 0);

        // Removed refreshUser() as it might trigger a re-render loop if not memoized in context
      } catch (err: any) {
        if (!isPolling) setError(err?.message ?? "Failed to load business status");
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
      <div className="min-h-screen bg-slate-50 ">
        <div className="mx-auto space-y-6">
          {/* Header shimmer */}
          <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
            <Shimmer className="h-6 w-48" />
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-3/4" />
          </div>

          {/* Business card shimmer */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <Shimmer className="h-16 w-16 rounded-md" />
              <div className="flex-1 space-y-2">
                <Shimmer className="h-5 w-40" />
                <Shimmer className="h-4 w-24" />
              </div>
            </div>
          </div>

          {/* Details shimmer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg bg-white p-4 shadow-sm space-y-2">
                <Shimmer className="h-3 w-24" />
                <Shimmer className="h-4 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="rounded-2xl bg-white px-6 py-8 shadow-lg w-full max-w-md text-center">
          <h3 className="text-lg font-semibold text-rose-600">Something went wrong</h3>
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
        <h1 className="flex-1 text-center mr-8 font-bold text-slate-900">Business Status</h1>
      </div>

      <div className="">
        {/* Pending Status Section */}
        {status === "pending" && (
          <div className=" border border-slate-100 overflow-hidden">
            <div className="relative h-64 bg-slate-50 flex items-center justify-center p-8">
              <img
                src="/business_pending_review.png"
                alt="Verification Pending"
                className="h-full object-contain rounded mix-blend-multiply"
              />
              <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold tracking-wider  animate-pulse">
                Under Review
              </div>
            </div>

            <div className="p-8">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-3">Verification in Progress</h1>
                <p className="text-slate-500 leading-relaxed max-w-md mx-auto">
                  We've received your business details and our team is currently reviewing them.
                  Typically, this takes <span className="text-slate-900 font-semibold">2–4 hours</span>.
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 mb-8 flex items-center gap-5 border border-slate-100">
                <div className="h-16 w-16 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                  {business?.logo ? (
                    <img src={business.logo} alt="Logo" className="h-full w-full object-cover" />
                  ) : business?.profile_pic ? (
                    <img src={business.profile_pic} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <FaStore className="text-slate-300 w-8 h-8" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900 truncate">{business?.business_name || "New Business"}</h3>
                  <p className="text-sm text-slate-500 truncate">{formatAddress(business?.business_address)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded  tracking-tighter">
                      {business?.business_category || "General"}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 italic">
                      Submitted {business?.created_at ? formatDate(business.created_at) : ""}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => router.push("/market")}
                  className="w-full py-3 bg-red-500 text-white rounded-full  hover:bg-slate-800 transition-all active:scale-[0.98]"
                >
                  Go to Market
                </button>
                <p className="text-center text-xs text-slate-400">
                  You'll receive a notification and email once approved.
                </p>
              </div>
            </div>
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
              <div className="absolute top-4 right-4 bg-rose-600 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider ">
                Action Required
              </div>
            </div>

            <div className="p-8">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-3 text-rose-600">Account Suspended</h1>
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
                  className="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all active:scale-[0.98]"
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
