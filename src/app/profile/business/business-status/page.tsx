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


export default function BusinessStatusPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessPolicy, setBusinessPolicy] = useState<BusinessPolicy | null>(null);
  const [isBusiness, setIsBusiness] = useState<boolean | null>(null);
  const [staffStatus, setStaffStatus] = useState<string | null>(null);

  

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) {
          // Optionally redirect to login, or show CTA
          setError("No token found. Please sign in to view business status.");
          setLoading(false);
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

        // after you `const payload = await res.json();`

        setStaffStatus(payload.data?.staff?.status ?? null);

        // expected shape: { ok: true, isBusiness: true, data: { business: {...}, staff: {...}, documents: [], policy: null } }

        if (!mounted) return;

        setIsBusiness(Boolean(payload.isBusiness));
        setBusiness(payload.data?.business ?? null);
        setBusinessPolicy(payload.data?.policy ?? null);
        setStaffStatus(payload.data?.staff?.status ?? null);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load business status");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [router]);

if (loading) {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
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

  return (
    <div className="">
        {/* Header */}
       {status === "pending" && (

  <div className="rounded-2xl bg-white p-6 shadow-sm  border-slate-100">
  {/* Header */}
  <div className="flex flex-col items-center text-center">
    <img
      src="/avatars/pending.jpg"
      alt="Business under review"
      className="w-36 h-36 object-contain mb-4 opacity-80"
    />

    <h2 className="text-lg sm:text-sm font-semibold text-slate-900">
      Business details submitted successfully
    </h2>

    <p className="mt-3 max-w-md text-sm sm:text-base text-slate-600 leading-relaxed">
      Your business information has been received and is currently under review.
      This process usually takes <strong>2–4 hours</strong>.
      You’ll be notified once verification is complete.
    </p>
  </div>

  {/* Divider */}
<div className="my-6 h-px bg-slate-100" />

{/* Business summary */}
<div className="flex gap-4 items-start">
  {/* Logo */}
  {business?.logo ? (
    <img
      src={business.logo}
      alt={`${business.business_name} logo`}
      className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
    />
  ) : (
    <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-slate-100 border border-slate-200 text-slate-500 shrink-0">
      <FaStore size={18} />
    </div>
  )}

  {/* Business content */}
  <div className="flex-1 min-w-0">
    {/* Business name — FULL WIDTH */}
    <h3 className="text-base sm:text-lg font-semibold text-slate-900 leading-snug break-words">
      {business?.business_name}
    </h3>

    {/* Details under name */}
    <div className="mt-1 space-y-1">
      <p className="text-sm text-slate-600 leading-snug">
        {business?.business_address}
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
          {business?.business_category || "Business category"}
        </span>

        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full capitalize
            ${
              business?.business_status === "active"
                ? "bg-green-100 text-green-700"
                : business?.business_status === "pending"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
            }
          `}
        >
          {business?.business_status}
        </span>
      </div>
    </div>
  </div>
</div>



    {/* Date */}
    <div className="text-xs text-slate-400 whitespace-nowrap">
      Submitted on{" "}
      {business?.created_at ? formatDate(business.created_at) : "—"}
    </div>

    <button onClick={() => router.push("/market")} className="rounded-lg bg-rose-500 px-4 py-2 flex justify-center text-white font-medium">Discover product</button>
</div>
)}


        {status === "active" &&         <EditBusinessProfileWithBusinessInfo apiBase={process.env.NEXT_PUBLIC_API_URL} business={business} businessPolicy = {businessPolicy} />}


        {status === "rejected" && (
          <>
            <div className="rounded-2xl bg-yellow-50 border border-yellow-200 mb-6 overflow-hidden">
 <div className="marquee-box">
  <p className="marquee-text">
    ⚠️ The uploaded document(s) were rejected. Please provide a valid document so we can continue verification. Common causes: low-quality image, missing fields, expired document, or wrong document type.
  </p>
</div>

</div>


            {/* Render OpenStorePage underneath so user can re-open/update store details */}
              <OpenStorePage />
          </>
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
