"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { geocodeAddress } from "@/src/lib/geocoding";
import { FaChevronLeft, FaPlus, FaStore, FaUser, FaExclamationTriangle } from "react-icons/fa";
import DefaultInput from "../input/default-input";
import { toast } from "sonner";
import { API_BASE_URL } from "@/src/lib/config";
import DefaultSelect from "../input/default-select";
import AddressSelectionModal from "./addressSelectionModal";
import { countries } from "@/src/lib/api/country";
import { fetchBusinessCategories } from "@/src/lib/api/categoryApi";
import CategorySelectionModal from "../input/default-select";
import Swal from "sweetalert2";
import { useAuth } from "@/src/context/authContext";

type StoreType = "individual" | "enterprise" | null;

export default function OpenStoreModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { refreshUser, ensureAccountVerified } = useAuth() as any;
  const [step, setStep] = useState<"choose" | "form">("choose");
  const [storeType, setStoreType] = useState<StoreType>(null);

  // shared form state
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [ninFile, setNinFile] = useState<File | null>(null);
  const [cacFile, setCacFile] = useState<File | null>(null);

  // preview URLs and whether the preview is a PDF
  const [previewNinUrl, setPreviewNinUrl] = useState<string | null>(null);
  const [previewNinIsPdf, setPreviewNinIsPdf] = useState(false);
  const [previewCacUrl, setPreviewCacUrl] = useState<string | null>("/assets/images/cac.png");
  const [previewCacIsPdf, setPreviewCacIsPdf] = useState(false);

  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showGeocodeWarning, setShowGeocodeWarning] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ latitude: number, longitude: number } | null>(null);
  const [businessCategories, setBusinessCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const firstFocusRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => firstFocusRef.current?.focus(), []);

  // Fetch global business categories from DB
  useEffect(() => {
    async function load() {
      try {
        setLoadingCategories(true);
        const data = await fetchBusinessCategories();
        setBusinessCategories(data.map(c => c.name));
      } catch (err) {
        console.error("Failed to load business categories", err);
      } finally {
        setLoadingCategories(false);
      }
    }
    load();
  }, []);

  // create + cleanup object URL when ninFile changes
  useEffect(() => {
    if (!ninFile) {
      // clear preview
      if (previewNinUrl) {
        URL.revokeObjectURL(previewNinUrl);
        setPreviewNinUrl(null);
      }
      setPreviewNinIsPdf(false);
      return;
    }

    const url = URL.createObjectURL(ninFile);
    // revoke previous if any
    if (previewNinUrl) URL.revokeObjectURL(previewNinUrl);
    setPreviewNinUrl(url);
    setPreviewNinIsPdf(ninFile.type === "application/pdf");

    return () => {
      // revoke when effect cleans up (component unmount or file changes)
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ninFile]);

  // create + cleanup object URL when cacFile changes
  useEffect(() => {
    if (!cacFile) {
      if (previewCacUrl && previewCacUrl !== "/assets/images/cac.png") {
        URL.revokeObjectURL(previewCacUrl);
        setPreviewCacUrl("/assets/images/cac.png");
      }
      setPreviewCacIsPdf(false);
      return;
    }

    const url = URL.createObjectURL(cacFile);
    if (previewCacUrl && previewCacUrl !== "/assets/images/cac.png") URL.revokeObjectURL(previewCacUrl);
    setPreviewCacUrl(url);
    setPreviewCacIsPdf(cacFile.type === "application/pdf");

    return () => {
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacFile]);

  function reset() {
    setStep("choose");
    setStoreType(null);
    setBusinessName("");
    setCategory("");
    setAddress("");
    // revoke and clear files + previews
    if (previewNinUrl) {
      try { URL.revokeObjectURL(previewNinUrl); } catch { }
    }
    if (previewCacUrl && previewCacUrl !== "/assets/images/cac.png") {
      try { URL.revokeObjectURL(previewCacUrl); } catch { }
    }
    setNinFile(null);
    setCacFile(null);
    setPreviewNinUrl(null);
    setPreviewNinIsPdf(false);
    setPreviewCacUrl("/assets/images/cac.png");
    setPreviewCacIsPdf(false);
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

  const submitFinal = async (coords?: { latitude: number, longitude: number } | null) => {
    setSubmitting(true);
    try {
      // build formData and send to your API
      const form = new FormData();
      form.append("nin_image", ninFile as File);
      form.append("business_name", businessName.trim());
      form.append("business_category", category.trim());
      form.append("account_type", storeType as string);
      form.append("business_address", address.trim());

      if (coords) {
        form.append("latitude", coords.latitude.toString());
        form.append("longitude", coords.longitude.toString());
      }

      if (cacFile) form.append("cac_image", cacFile as File);

      const token = getAuthToken();

      const res = await fetch(`${API_BASE_URL}/api/business/request`, {
        method: "POST",
        body: form,
        headers: token
          ? {
            Authorization: `Bearer ${token}`,
          }
          : undefined,
        credentials: "include",
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

      await Swal.fire({
        title: "Request Received! 🎉",
        text: payload.message || "Your business registration is now being reviewed. We'll get back to you shortly via email.",
        icon: "success",
        confirmButtonColor: "#EF4444",
        confirmButtonText: "View My Status",
        background: "#F8FAFC",
        customClass: {
          popup: 'rounded-[2rem]',
          confirmButton: 'rounded-full px-8 py-3'
        }
      });

      try {
        onClose();
        reset();
        await refreshUser();
      } catch (e) { }

      window.location.href = "/profile/business/business-status";
    } catch (err: any) {
      console.error("submit error", err);
      toast.error("Submission failed — check console for details");
    } finally {
      setSubmitting(false);
    }
  };

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!storeType) return;

    // ── Verification Gate ────────────────────────────────────────────────────
    // Before any submission logic, ensure the user has both email and phone
    // on their account. If not, the verification modal fires.
    const verified = await ensureAccountVerified();
    if (!verified) {
      toast.warning("Please verify your email and phone number before registering a business.");
      return;
    }

    // ── Standard form validation ─────────────────────────────────────────────
    if (!ninFile) return toast.warning("Please upload NIN");
    if (storeType === "enterprise" && !cacFile) return toast.warning("Please upload CAC");
    if (!businessName.trim()) return toast.warning("Please enter business name");
    if (!category.trim()) return toast.warning("Please select a category");
    if (!address.trim()) return toast.warning("Please enter address");
    if (!agreed) return toast.warning("Please agree to terms");

    setSubmitting(true);
    try {
      const coords = await geocodeAddress(address);
      if (coords) {
        await submitFinal(coords);
      } else {
        setSubmitting(false);
        setShowGeocodeWarning(true);
      }
    } catch (err) {
      console.error("Geocoding/submit error", err);
      await submitFinal(null);
    }
  }

  const headerTitle =
    step === "choose"
      ? "Open a store"
      : storeType === "individual"
        ? "Open Store — Individual"
        : "Open Store — Enterprise";

  const headerSubtitle =
    step === "choose"
      ? "Choose how you want to open a store on Stoqle"
      : storeType === "individual"
        ? "Open your individual merchant account"
        : "Open a verified business account";

  // validation helper: only allow image or pdf
  function validateFileIsImageOrPdf(file: File) {
    if (file.type.startsWith("image/")) return true;
    if (file.type === "application/pdf") return true;
    // some browsers may give empty type for .pdf — check extension as fallback
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) return true;
    return false;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!validateFileIsImageOrPdf(file)) {
        toast.error("Only images (jpg/png) or PDFs are allowed.");
        e.currentTarget.value = ""; // clear input
        return;
      }
      setNinFile(file);
    }
  };

  const handleCacChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!validateFileIsImageOrPdf(file)) {
        toast.error("Only images (jpg/png) or PDFs are allowed.");
        e.currentTarget.value = ""; // clear input
        return;
      }
      setCacFile(file);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div key="main-modal" className="fixed inset-0 z-[10001] flex items-center justify-center p-0 overflow-hidden">
          {/* backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              reset();
              onClose();
            }}
          />

          {/* modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full h-full lg:h-[90vh] lg:max-h-[90vh] sm:w-full lg:max-w-3xl rounded-none lg:rounded-2xl bg-slate-100 shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
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

            {/* Content */}
            <div
              className="overflow-y-auto px-4 sm:px-6 py-4 flex-1 no-scrollbar"
              style={{ paddingBottom: 112 }}
            >
              <form id="openStoreForm" onSubmit={handleSubmit} className="space-y-4 mt-0">
                {step === "choose" && (
                  <div className="flex flex-col gap-4 rounded-2xl p-6 bg-white">
                    <OptionCard
                      title="Individual"
                      subtitle="Suitable for opening a store as an individual without a business license."
                      icon={<FaUser />}
                      onSelect={async () => {
                        const verified = await ensureAccountVerified();
                        if (!verified) {
                          toast.warning("Please verify your email and phone number to open a store.");
                          return;
                        }
                        setStoreType("individual");
                        setStep("form");
                      }}
                    />
                    <div className="border border-slate-100" />

                    <OptionCard
                      title="Enterprise"
                      subtitle='Suitable for entities with a business license, where the business license type displays "Individual Industrial and Commercial Household" or "Company/Enterprise/Sole Proprietorship", etc.'
                      icon={<FaStore />}
                      onSelect={async () => {
                        const verified = await ensureAccountVerified();
                        if (!verified) {
                          toast.warning("Please verify your email and phone number to open a store.");
                          return;
                        }
                        setStoreType("enterprise");
                        setStep("form");
                      }}
                    />
                  </div>
                )}

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
                          {/* Render image or PDF preview */}
                          <div className="w-50 h-40 flex items-center justify-center rounded-xl border-gray-300 overflow-hidden bg-white">
                            {previewNinUrl ? (
                              previewNinIsPdf ? (
                                <embed src={previewNinUrl} type="application/pdf" className="w-full h-full" />
                              ) : (
                                <img src={previewNinUrl} alt="NIN Preview" className="w-full h-full object-contain" />
                              )
                            ) : (
                              <img src="/assets/images/nin.png" alt="NIN Placeholder" className="w-full h-full object-contain" />
                            )}
                          </div>

                          <div
                            role="button"
                            aria-label="Upload NIN"
                            className="absolute top-2 right-2 bg-rose-500 text-white rounded-full p-2 cursor-pointer hover:opacity-95"
                            onClick={() => document.getElementById("ninInput")?.click()}
                          >
                            <FaPlus />
                          </div>
                        </div>
                        <span className="text-xs text-slate-600">Upload NIN ID Card (image or PDF)</span>

                        <input
                          type="file"
                          accept="image/*,application/pdf"
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
                        <span className="text-xs text-slate-600">Upload CAC (business certificate) — image or PDF</span>
                        <div className="text-center bg-gray-200 rounded-xl">
                          <div className="relative w-40 h-40 justify-center mt-2 mx-auto">
                            <div className="w-50 h-40 flex items-center justify-center rounded-xl border-gray-300 overflow-hidden bg-white">
                              {previewCacUrl ? (
                                previewCacIsPdf ? (
                                  <embed src={previewCacUrl} type="application/pdf" className="w-full h-full" />
                                ) : (
                                  <img src={previewCacUrl} alt="CAC Preview" className="w-full h-full object-contain" />
                                )
                              ) : (
                                <img src="/assets/images/cac.png" alt="CAC Placeholder" className="w-full h-full object-contain" />
                              )}
                            </div>

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
                            accept="image/*,application/pdf"
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
                          options={businessCategories.length > 0 ? businessCategories : ["Electronics", "Fashion", "Groceries", "Home", "Beauty", "Toys"]}
                          value={category}
                          onSelected={(v) => setCategory(v)}
                          hintText={loadingCategories ? "Loading categories..." : "Choose a category"}
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

            {/* Footer */}
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
      )}

      {/* Geocode Warning Modal */}
      <AnimatePresence key="geocode-warning-presence">
        {showGeocodeWarning && (
          <div key="geocode-warning-modal" className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setShowGeocodeWarning(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 text-center sm:p-10"
            >
              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500">
                <FaExclamationTriangle size={36} />
              </div>
              <h4 className="text-2xl font-extrabold text-slate-900 mb-4 tracking-tight">Check Your Address</h4>
              <div className="space-y-4 mb-8">
                <p className="text-slate-600 leading-relaxed text-[15px]">
                  Courier may be unable to deliver your order as the address provided, may be missing the
                  <span className="font-bold text-slate-900"> building/house number</span>.
                </p>
                <p className="text-[13px] text-slate-500 italic bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium">
                  "{address}"
                </p>
                <p className="text-sm text-slate-400">
                  Please check if the address provided is correct.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowGeocodeWarning(false)}
                  className="w-full py-4 rounded-2xl font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-xl shadow-slate-200"
                >
                  Edit Address
                </button>
                <button
                  onClick={async () => {
                    setShowGeocodeWarning(false);
                    await submitFinal(null);
                  }}
                  className="w-full py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition border border-transparent hover:border-slate-100 mt-1"
                >
                  It is correct
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AnimatePresence>
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
        <div className="flex-shrink-0 flex items-center justify-center text-3xl">{icon}</div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <p className="text-[12px] text-slate-500 mt-1">{subtitle}</p>
        </div>
      </div>

      <button onClick={onSelect} className="ml-4 flex-shrink-0 rounded-full px-3 py-2 text-rose-500 border border-rose-100 whitespace-nowrap">
        Open store
      </button>
    </div>
  );
}
