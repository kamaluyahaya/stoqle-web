"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FaChevronLeft, FaPlus, FaStore, FaUser } from "react-icons/fa";
import DefaultInput from "../input/default-input";
import { toast } from "sonner";
import { API_BASE_URL } from "@/src/lib/config";
import DefaultSelect from "../input/default-select";
import AddressSelectionModal from "./addressSelectionModal";
import { categories, countries } from "@/src/lib/api/country";
import CategorySelectionModal from "../input/default-select";

type StoreType = "individual" | "enterprise" | null;

export default function OpenStoreModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"choose" | "form">("choose");
  const [storeType, setStoreType] = useState<StoreType>(null);

  // shared form state
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [ninFile, setNinFile] = useState<File | null>(null);
  const [cacFile, setCacFile] = useState<File | null>(null);
  const [previewNin, setPreviewNin] = useState<string | null>(null);
  const [previewCac, setPreviewCac] = useState("/assets/images/cac.png");

  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // const [category, setCategory] = useState<string | null>(null);

  const firstFocusRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => firstFocusRef.current?.focus(), []);

  useEffect(() => {
    if (ninFile) setPreviewNin(URL.createObjectURL(ninFile));
    return () => {
      if (previewNin) URL.revokeObjectURL(previewNin);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ninFile]);

  useEffect(() => {
    if (cacFile) setPreviewCac(URL.createObjectURL(cacFile));
    return () => {
      if (previewCac) URL.revokeObjectURL(previewCac);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacFile]);

  function reset() {
    setStep("choose");
    setStoreType(null);
    setBusinessName("");
    setCategory("");
    setAddress("");
    setNinFile(null);
    setCacFile(null);
    setAgreed(false);
  }

  // try to find a token in localStorage or cookie
  function getAuthToken(): string | null {
    try {
      const lsToken = typeof window !== "undefined" ? (localStorage.getItem("token") || localStorage.getItem("authToken") || null) : null;
      if (lsToken) return lsToken;
      // cookie fallback: look for token or authToken
      if (typeof document !== "undefined") {
        const cookies = document.cookie.split(";").map((c) => c.trim());
        for (const c of cookies) {
          if (c.startsWith("token=")) return decodeURIComponent(c.split("=")[1]);
          if (c.startsWith("authToken=")) return decodeURIComponent(c.split("=")[1]);
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    // basic validation
    if (!storeType) return;
    if (!ninFile) return toast.warning("Please upload NIN");
    if (storeType === "enterprise" && !cacFile) return toast.warning("Please upload CAC");
    if (!businessName.trim()) return toast.warning("Please enter business name");
    if (!category.trim()) return toast.warning("Please select a category");
    if (!address.trim()) return toast.warning("Please enter address");


    if (!agreed) return toast.warning("Please agree to terms");

    setSubmitting(true);
    try {
      // build formData and send to your API
      const form = new FormData();
      form.append("nin_image", ninFile as File);
      form.append("business_name", businessName.trim());
      form.append("business_category", category.trim());
      form.append("account_type", storeType);
      form.append("business_address", address.trim());

      if (cacFile) form.append("cac_image", cacFile as File);
      // optional: referral, logo etc. Add as needed:
      // form.append("referral", referralValue);

      const token = getAuthToken();

      const res = await fetch(`${API_BASE_URL}/api/business/request`, {
        method: "POST",
        body: form,
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
              // DO NOT set Content-Type — browser will set correct multipart boundary
            }
          : undefined,
        credentials: "include", // include cookies if your auth is cookie-based
      });

      if (res.status === 401) {
        toast.error("Unauthorized. Please login and try again.");
        setSubmitting(false);
        return;
      }

      const payload = await res.json().catch(() => ({ ok: res.ok, message: "Invalid JSON response" }));

      if (!res.ok || !payload.ok) {
        const msg = payload?.message || "Failed to submit request";
        toast.error(msg);
        setSubmitting(false);
        return;
      }

      // success: show toast, close modal, reset and redirect
      toast.success(payload.message || "Request submitted — awaiting review");
      // optional: call onClose so modal unmounts quickly
      try {
        onClose();
        reset();
      } catch (e) {
        // ignore
      }

      // navigate to open-store route
      // using assignment to ensure full page navigation
      window.location.href = "/profile/business/business-status";
    } catch (err: any) {
      console.error("submit error", err);
      toast.error("Submission failed — check console for details");
    } finally {
      setSubmitting(false);
    }
  }

  // dynamic header text
  const headerTitle =
    step === "choose"
      ? "Open a store"
      : storeType === "individual"
      ? "Open Store — Individual"
      : "Open Store — Enterprise";

  // small subtitle for form
  const headerSubtitle =
    step === "choose"
      ? "Choose how you want to open a store on Stoqle"
      : storeType === "individual"
      ? "Open your individual merchant account"
      : "Open a verified business account";

  const [preview, setPreview] = useState("/assets/images/nin.png");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNinFile(file);
      setPreview(URL.createObjectURL(file)); // show preview
    }
  };

  const handleCacChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCacFile(file);
      setPreviewCac(URL.createObjectURL(file)); // show preview
    }
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center px-0 py-0">

      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          reset();
          onClose();
        }}
      />

      {/* modal (flex column so header/content/footer layout is simple) */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full h-full lg:h-[90vh] lg:max-h-[90vh] sm:w-full lg:max-w-3xl rounded-none lg:rounded-2xl bg-slate-100 shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header (sticky) */}
        <header className="sticky top-0 z-30 bg-slate-100 px-4 py-3 flex items-center justify-between">
          {step === "form" && (
            <button
              type="button"
              onClick={() => {
                setStep("choose");
                setStoreType(null);
              }}
            >
              <FaChevronLeft className="text-lg" />
            </button>
          )}
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{headerTitle}</h2>
          </div>

          <div className="flex items-center gap-2">
            {/* optional small indicator */}
            {/* close button */}
            <button
              ref={firstFocusRef}
              onClick={() => {
                reset();
                onClose();
              }}
              aria-label="Close modal"
              className="rounded-full p-2 hover:bg-slate-100 focus:outline-none"
            >
              <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none">
                <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </header>

        {/* Content area (scrollable) */}
        {/* We give padding-bottom to account for the fixed footer height (96px) so last content isn't hidden under footer */}
        <div
          className="overflow-y-auto px-4 sm:px-6 py-4 flex-1 no-scrollbar"
          style={{ paddingBottom: 112 }}
        >
          {/* Put the form here and give it an id so the footer submit button can target it */}
          <form id="openStoreForm" onSubmit={handleSubmit} className="space-y-4 mt-0">
            {/* choose step */}
            {step === "choose" && (
              <div className="flex flex-col gap-4 rounded-2xl p-6 bg-white">
                <OptionCard
                  title="Individual"
                  subtitle="Suitable for opening a store as an individual without a business license."
                  icon={<FaUser />}
                  onSelect={() => {
                    setStoreType("individual");
                    setStep("form");
                  }}
                />
                <div className="border border-slate-100" />

                <OptionCard
                  title="Enterprise"
                  subtitle='Suitable for entities with a business license, where the business license type displays "Individual Industrial and Commercial Household" or "Company/Enterprise/Sole Proprietorship", etc.'
                  icon={<FaStore />}
                  onSelect={() => {
                    setStoreType("enterprise");
                    setStep("form");
                  }}
                />
              </div>
            )}

            {/* form step */}
            {step === "form" && (
              <>
                {/* NIN Upload */}
                <div className="rounded-xl bg-white p-4 border-slate-100">
                  <div className="font-bold mb-2">Identity Verification</div>
                  <div className="text-sm text-slate-700 font-medium mb-2">
                    Upload your National Identification Number (NIN) card for verification
                  </div>
                  <div className="text-center bg-gray-200 rounded-xl">
                    <div className="relative w-40 h-40 justify-center mt-2 mx-auto">
                      <img
                        src={preview}
                        alt="NIN Placeholder"
                        className="w-50 h-40 object-contain rounded-xl border-gray-300"
                      />
                      <div
                        role="button"
                        aria-label="Upload NIN"
                        className="absolute top-2 right-2 bg-rose-500 text-white rounded-full p-2 cursor-pointer hover:opacity-95"
                        onClick={() => document.getElementById("ninInput")?.click()}
                      >
                        <FaPlus />
                      </div>
                    </div>
                    <span className="text-xs text-slate-600">Upload NIN ID Card</span>

                    <input
                      type="file"
                      accept="image/*,.pdf"
                      id="ninInput"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                </div>

                {/* CAC Upload for Enterprise */}
                {storeType === "enterprise" && (
                  <div className="rounded-xl bg-white p-4 border-slate-100 mt-4">
                    <div className="font-bold mb-2">Business License</div>
                    <span className="text-xs text-slate-600">Upload CAC (business certificate)</span>
                    <div className="text-center bg-gray-200 rounded-xl">
                      <div className="relative w-40 h-40 justify-center mt-2 mx-auto">
                        <img
                          src={previewCac}
                          alt="CAC Placeholder"
                          className="w-50 h-40 object-contain rounded-xl border-gray-300"
                        />
                        <div
                          role="button"
                          aria-label="Upload CAC"
                          className="absolute top-2 right-2 bg-rose-500 text-white rounded-full p-2 cursor-pointer hover:opacity-95"
                          onClick={() => document.getElementById("cacInput")?.click()}
                        >
                          <FaPlus />
                        </div>
                      </div>
                      <span className="text-xs text-slate-600">Upload CAC</span>

                      <input
                        type="file"
                        accept="image/*,.pdf"
                        id="cacInput"
                        className="hidden"
                        onChange={handleCacChange}
                      />
                    </div>
                  </div>
                )}

                {/* Business Fields — only show if NIN is uploaded (and CAC for enterprise) */}
                {ninFile && (storeType !== "enterprise" || cacFile) && (
                  <div className="bg-white rounded-xl p-2 border border-slate-100 mt-4">
                    <DefaultInput
                      label="Business Name"
                      value={businessName}
                      onChange={setBusinessName}
                      placeholder="Business name"
                      required
                      maxLength={50}
                    />
                    <CategorySelectionModal
                      title="Select category"
                      options={categories}
                      value={category}
                      onSelected={(v) => setCategory(v)}
                      hintText="Choose a category"
                      isRequired
                      triggerLabel="Category"
                    />

                    <AddressSelectionModal
                        title="Address"
                        hintText="Select country, state, LGA"
                        isRequired
                        hierarchy={countries}
                        value={address}
                        
                        onSelected={(v) => setAddress(v)}
                      />

                    
                  </div>
                )}

                {/* Terms */}
                {ninFile && (storeType !== "enterprise" || cacFile) && (
                  <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl bg-white p-4 border-slate-100">
                    <label className="flex items-start gap-3 mt-2">
                      <input
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        type="checkbox"
                        className="mt-1"
                      />
                      <span className="text-sm text-slate-600">
                        I agree to the Stoqle Merchant Service Agreement and Information Use Authorization.
                      </span>
                    </label>
                  </div>
                )}
              </>
            )}
          </form>
        </div>
        {/* Footer (fixed) */}
        {step === "form" && (
          <div className="absolute left-0 right-0 bottom-10 lg:bottom-0 z-40 bg-slate-100 p-4 flex items-center gap-3 justify-end">
            <button
              form="openStoreForm"
              type="submit"
              disabled={submitting}
              className="justify-center px-4 py-2 bg-rose-500 rounded-full text-white disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit for Review"}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function OptionCard({
  title,
  subtitle,
  onSelect,
  icon,
}: {
  title: string;
  subtitle: string;
  onSelect: () => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-start gap-4 flex-1">
        {/* Icon on the left */}
        <div className="flex-shrink-0 flex items-center justify-center text-3xl">{icon}</div>

        {/* Title and subtitle */}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>
      </div>

      {/* Action button */}
      <button onClick={onSelect} className="ml-4 flex-shrink-0 rounded-full px-3 py-2 text-rose-600 border border-rose-100 whitespace-nowrap">
        Open Store
      </button>
    </div>
  );
}
