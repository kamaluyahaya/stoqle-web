"use client";

import { BusinessPolicyResponse, PreviewPayload } from "@/src/types/product";
import React, { useEffect, useRef, useState } from "react";
import {
  LifebuoyIcon,
  BuildingStorefrontIcon,
  ShoppingCartIcon,
  ClockIcon,
  TruckIcon,
  ArrowRightIcon,
  ArrowUturnLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { API_BASE_URL } from "@/src/lib/config";
import PolicyModal from "./policyModalPreview";

export default function ProductPreviewModal({
  open,
  payload,
  onClose,
  onConfirm,
  cartCount = 3,
  onAddToCart,
  onBuyNow,
  onOpenChat,
}: {
  open: boolean;
  payload: PreviewPayload | null;
  onClose: () => void;
  onConfirm?: () => void;
  cartCount?: number;
  onAddToCart?: (payload?: PreviewPayload) => void;
  onBuyNow?: (payload?: PreviewPayload) => void;
  onOpenChat?: () => void;
}) {
  // ------------------------
  // Hooks (ALL hooks must be here, before any early return)
  // ------------------------
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const lastScrollY = useRef<number>(0);

  const [businessData, setBusinessData] = useState<BusinessPolicyResponse["data"] | null>(null);
  const [loadingBusiness, setLoadingBusiness] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);

  const [promoRemaining, setPromoRemaining] = useState<string | null>(null);

  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyModalData, setPolicyModalData] = useState<{
    title: string;
    body: string;
  } | null>(null);

  // ------------------------
  // Derived values (no hooks)
  // ------------------------
  const shopLogo = businessData?.business?.logo ?? businessData?.business?.profile_pic ?? false;
  const shopName = businessData?.business?.business_name ?? businessData?.business?.full_name ?? false;
  // const partner_status = businessData?.policy?.market_affiliation?.trusted_partner ?? false;
  const partner_status = !!businessData?.policy?.market_affiliation?.trusted_partner;


   // safe parsing of promotion + price (handles strings like "10" or "10%")
  const promotion = businessData?.policy?.promotions?.[0] ?? null;
  const promotionTitle = promotion?.title ?? null;
  const promotionStartDate = promotion?.start_date ?? null;
  const promotionEndDate = promotion?.end_date ?? null;

  const promotionDiscountRaw = promotion?.discount_percent ?? null;
  const promotionDiscount =
    promotionDiscountRaw == null
      ? null
      : (() => {
          // remove any % sign and coerce to number
          const cleaned = String(promotionDiscountRaw).replace("%", "").trim();
          const n = Number(cleaned);
          return Number.isFinite(n) ? n : null;
        })();

  // SALES DISCOUNT: used if no active promotion
  const salesDiscountItem = businessData?.policy?.sales_discounts?.[0] ?? null;
  const salesDiscountRaw = salesDiscountItem?.discount_percent ?? null;
  const salesDiscount =
    salesDiscountRaw == null
      ? null
      : (() => {
          const cleaned = String(salesDiscountRaw).replace("%", "").trim();
          const n = Number(cleaned);
          return Number.isFinite(n) ? n : null;
        })();

  // basePrice: try number, then numeric string, else null
  const basePrice =
    payload?.price == null
      ? null
      : typeof payload.price === "number"
      ? payload.price
      : ((): number | null => {
          const p = String(payload.price).trim();
          if (p === "") return null;
          const n = Number(p.replace(/,/g, ""));
          return Number.isFinite(n) ? n : null;
        })();

  // determine promotion active
  const isPromotionActive =
    basePrice !== null &&
    promotionDiscount !== null &&
    promotionDiscount > 0 &&
    (!promotionStartDate || new Date(promotionStartDate) <= new Date()) &&
    (!promotionEndDate || new Date(promotionEndDate) >= new Date());

  // determine sales discount active (only apply if no promotion active)
  const isSalesActive =
    !isPromotionActive &&
    basePrice !== null &&
    salesDiscount !== null &&
    salesDiscount > 0;

  // effective discount to show/apply (promo takes priority)
  const effectiveDiscount = isPromotionActive
    ? promotionDiscount
    : isSalesActive
    ? salesDiscount
    : null;

  const discountedPrice =
    effectiveDiscount !== null && basePrice !== null
      ? Math.round(basePrice * (1 - effectiveDiscount / 100))
      : basePrice;


  // ------------------------
  // Effects (still before any return)
  // ------------------------

  // fetch business details when modal opens
  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const fetchBusiness = async () => {
      setLoadingBusiness(true);
      setBusinessError(null);

      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) {
          setBusinessError("No auth token found.");
          setLoadingBusiness(false);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/api/business/me`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status} — ${text}`);
        }

        const json: BusinessPolicyResponse = await res.json();
        if (!json.ok) throw new Error("API returned ok: false");
        setBusinessData(json.data);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setBusinessError(err.message ?? "Failed to fetch business details");
      } finally {
        setLoadingBusiness(false);
      }
    };

    fetchBusiness();

    return () => controller.abort();
  }, [open]);

  // reset selected index when opened / payload changes
  useEffect(() => {
    if (open) setSelectedIndex(0);
  }, [open, payload]);

  // lock background scroll while open
  useEffect(() => {
    if (!open) return;
    lastScrollY.current = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = "fixed";
    document.body.style.top = `-${lastScrollY.current}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      document.documentElement.style.overflow = "";
      window.scrollTo(0, lastScrollY.current);
    };
  }, [open]);

  // countdown for promo
 useEffect(() => {
  if (!isPromotionActive || !promotionEndDate) {
    setPromoRemaining(null);
    return;
  }

  const pad = (num: number) => String(num).padStart(2, "0");

  const updateCountdown = () => {
    const now = Date.now();
    const end = new Date(promotionEndDate).getTime();
    const diff = end - now;

    if (diff <= 0) {
      setPromoRemaining("Ended");
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    setPromoRemaining(
      `${days}ds ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s left`
    );
  };

  updateCountdown(); // run immediately
  const interval = setInterval(updateCountdown, 1000);
  return () => clearInterval(interval);
}, [isPromotionActive, promotionEndDate]);


  // ------------------------
  // Now it's safe to early-return (no hooks below this)
  // ------------------------
  if (!open || !payload) return null;

  // ------------------------
  // Local helpers / derived UI values
  // ------------------------
  const images = payload.productImages ?? [];
  const main = images[selectedIndex] ?? images[0] ?? null;

  const stop = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  };

  // small helpers to extract the three policy items
  const deliveryNotice = businessData?.policy?.core?.delivery_notice ?? null;
  const shippingPromise = businessData?.policy?.shipping?.find((s) => s.kind === "promise");
  const returnShippingSubsidy = businessData?.policy?.returns?.return_shipping_subsidy;
  const city = businessData?.policy?.address?.city;
  const state = businessData?.policy?.address?.state;
  const address = businessData?.policy?.address?.line1;
  const market_affiliation = businessData?.policy?.market_affiliation?.market_name;
  const business_address = businessData?.business.business_address;
  const returnRapidRefund = businessData?.policy?.returns?.rapid_refund;
  const supportsReturnShippingSubsidy = returnShippingSubsidy === 1;
  const supportsRapidRefund = returnRapidRefund === 1;

  // modal policy openers
  const openPolicyModal = (title: string, body: string) => {
    setPolicyModalData({ title, body });
    setPolicyModalOpen(true);
  };

  const closePolicyModal = () => {
    setPolicyModalOpen(false);
    setPolicyModalData(null);
  };

  // ------------------------
  // JSX
  // ------------------------
  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-75 flex items-start justify-center px-0 py-0"
        onMouseDown={onClose}
        onTouchStart={onClose}
      >
        <div className="absolute inset-0 bg-black/55" aria-hidden />

        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onClose}
          aria-label="Close post"
          className="hidden lg:flex absolute top-5 right-5 z-50 h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/7 transition-shadow shadow-sm"
          title="Close"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/85"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
        </button>

        <div
          ref={modalRef}
          onMouseDown={stop}
          onTouchStart={stop}
          role="dialog"
          aria-modal="true"
          className={
            "relative z-10 w-full h-full bg-slate-100 flex flex-col overflow-y-auto pb-24 lg:flex lg:flex-row lg:overflow-hidden lg:w-[96vw] lg:max-w-[1100px] lg:h-[94vh] lg:rounded-2xl lg:pb-0 shadow-2xl"
          }
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* MOBILE HEADER (sticky) */}
          <header className="lg:hidden sticky top-0 z-30 h-16 flex items-center justify-between px-6 p-5 ">
            <div className="lg:hidden absolute top-4 left-4 z-40">
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={onClose}
                aria-label="Close"
                className="h-9 w-9 rounded-full bg-white/70 backdrop-blur flex items-center justify-center shadow-sm"
                title="Close"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-800">
                  <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </button>
            </div>
          </header>

          {/* Left: media */}
          <div className="flex-1 min-h-[400px] bg-slate-50 flex items-start justify-center relative">
            {main && main.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={main.url} alt={main.name ?? payload.title} className="w-full h-full object-contain" />
            ) : payload.productVideo?.url ? (
              <video src={payload.productVideo.url} controls className="w-full h-full object-contain" />
            ) : (
              <div className="text-sm text-slate-400 mt-20">No preview available</div>
            )}
          </div>

          {/* Right: details + thumbnails */}
          <aside className="w-full lg:w-[380px]  border-l border-slate-100 flex flex-col">
            <div className="px-4 bg-white">
              <div className="flex gap-1 lg:flex-row overflow-auto p-1">
                
                {images.length > 1 && (
  <div className="flex gap-2">
    {images.map((p, i) => (
      <button
        key={i}
        onClick={() => setSelectedIndex(i)}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex-shrink-0 rounded-sm border p-2 ${
          i === selectedIndex
            ? "ring-1 ring-red-500 bg-red-50 border-transparent"
            : "border-slate-100"
        } overflow-hidden focus:outline-none`}
        style={{ width: 60, height: 60 }}
        title={p.name ?? `Image ${i + 1}`}
        aria-pressed={i === selectedIndex}
      >
        {p.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.url}
            alt={p.name ?? `img-${i + 1}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 p-2">
            {p.name ?? "file"}
          </div>
        )}
      </button>
    ))}
  </div>
)}


                {payload.productVideo && (
                  <button
                    onClick={() => { setSelectedIndex(-1); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`flex-shrink-0 rounded-lg border ${selectedIndex === -1 ? "ring-2 ring-red-500 border-transparent" : "border-slate-100"} overflow-hidden focus:outline-none flex items-center justify-center`}
                    style={{ width: 84, height: 84 }}
                    title={payload.productVideo.name ?? "Video preview"}
                    aria-pressed={selectedIndex === -1}
                  >
                    <div className="w-full h-full flex items-center justify-center bg-black/5">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M5 3v18l15-9-15-9z" />
                      </svg>
                    </div>
                  </button>
                )}
              </div>
            </div>

            <div className=" flex-1 overflow-auto pb-24 lg:pb-0" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="bg-white p-5">
                               {/* Promotion / Sales badge */}
                {isPromotionActive ? (
                  <div className="flex flex-col gap-1 mb-2">
                    <div className="inline-flex items-center rounded-sm bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 w-fit">
                      {promotionTitle ?? "Promotion"} · {promotionDiscount}% OFF
                      {promoRemaining && (
                        <div className="text-[11px] border border-red-500 p-2 text-red-500 font-medium ml-2">
                          Ends in {promoRemaining}
                        </div>
                      )}
                    </div>
                  </div>
                ) : isSalesActive ? (
                  <div className="flex flex-col gap-1 mb-2">
                    <div className="inline-flex items-center rounded-sm border-red-500 border px-2 py-1 text-xs font-semibold text-red-500 w-fit">
                      {salesDiscountItem?.discount_type ?? "Sale"} · {salesDiscount}% OFF
                    </div>
                  </div>
                ) : null}



                <div className="flex items-start justify-between gap-3 ">
                  <div className="flex items-center gap-3">
                    <div>
                      {/* Price block: strike original when promo active, show discounted */}
                      <div className="flex items-baseline gap-2">
                       {(isPromotionActive || isSalesActive) && basePrice !== null && (
                          <span className="text-sm text-slate-400 line-through">
                            ₦ {basePrice!.toLocaleString()}
                          </span>
                        )}


                        <span className="text-2xl font-bold text-red-600">
                          {discountedPrice !== null ? `₦ ${discountedPrice.toLocaleString()}` : "—"}
                        </span>
                      </div>

                    <div className="text-lg font-semibold text-slate-900">
                      {partner_status && (
                        <span className="bg-emerald-700 text-white text-xs px-2 py-1 rounded-sm align-center">
                          Verified Partner
                        </span>
                      )}
                      {payload.title || "Untitled product"}
                    </div>
                      
                      {/* business name (if available) */}
                      {/* {businessData?.business?.business_name && (
                        <div className="text-xs text-slate-500 mt-1">Sold by <span className="font-medium text-slate-800">{businessData.business.business_name}</span></div>
                      )} */}
                     </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-400">0 Sold</div>
                  </div>
                </div>

                <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                    {payload.description || <span className="text-slate-400">No description</span>}
                </div>

                <div
                  className={`inline-block font-bold rounded-sm text-sm p-2 ${
                    supportsReturnShippingSubsidy ? "text-emerald-700 bg-emerald-50" : "text-yellow-600 bg-red-50"
                  }`}
                >
                  {supportsReturnShippingSubsidy ? "Return shipping subsidy" : "No return shipping subsidy"}
                </div>

                {/* Policy details modal (render once, reused) */}
                <div className="rounded-lg mt-2 bg-white">
                  <div className="flex items-center justify-between ">
                    <div className="text-sm font-medium text-slate-800">Business policies</div>
                    {loadingBusiness && <div className="text-xs text-slate-400">loading…</div>}
                  </div>

                  {businessError && <div className="mt-2 text-xs text-rose-600">{businessError}</div>}

                  {!loadingBusiness && !businessError && !businessData && (
                    <div className="mt-2 text-xs text-slate-400">No business details available</div>
                  )}

                  {!loadingBusiness && businessData && (
                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                      {/* 1. Promise to ship */}
                      <li>
                        <button
                          type="button"
                          onClick={() =>
                            openPolicyModal(
                              "Shipping Information",
                              deliveryNotice ?? "No delivery notice provided."
                            )
                          }
                          className="w-full flex items-center gap-3 py-1 rounded-md hover:bg-slate-50 text-left"
                          aria-haspopup="dialog"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2 min-w-0">
                              <TruckIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="font-medium text-slate-700 truncate">
                                  Promise to ship within{" "}
                                  {shippingPromise ? `${shippingPromise.value} ${shippingPromise.unit}` : "—"} | Delayed compensation guaranteed
                                </div>
                                <div className={`text-xs mt-1 truncate ${supportsReturnShippingSubsidy ? "text-emerald-600" : "text-slate-500"}`}>
                                  From {[
                                    market_affiliation || address || business_address,
                                    city,
                                    state,
                                  ]
                                    .filter(Boolean)
                                    .join(", ")}
                                </div>
                              </div>
                            </div>
                          </div>

                          <ChevronRightIcon className="w-5 h-5 text-slate-400 shrink-0" />
                        </button>
                      </li>

                      {/* 2. Delay compensation / shipping promise */}
                      <li>
                        <button
                          type="button"
                          onClick={() =>
                            openPolicyModal(
                              "Delay compensation (shipping promise)",
                              shippingPromise ? `Promised: ${shippingPromise.value} ${shippingPromise.unit} (${shippingPromise.kind})` : "No shipping promise configured."
                            )
                          }
                          className="w-full flex items-center gap-3 py-1 rounded-md hover:bg-slate-50 text-left"
                          aria-haspopup="dialog"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2 min-w-0">
                              <ClockIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="font-medium text-slate-700 truncate">Delay compensation (shipping promise)</div>
                              </div>
                            </div>
                          </div>

                          <ChevronRightIcon className="w-5 h-5 text-slate-400 shrink-0" />
                        </button>
                      </li>

                      {/* 3. Return shipping subsidy */}
                      <li>
                        <button
                          type="button"
                          onClick={() =>
                            openPolicyModal(
                              "Return shipping subsidy",
                              supportsReturnShippingSubsidy ? `Return shipping subsidy is supported.${supportsRapidRefund ? " Rapid refund is enabled." : ""}` : "This product does not support return shipping subsidy."
                            )
                          }
                          className="w-full flex items-center gap-3 py-1 rounded-md hover:bg-slate-50 text-left"
                          aria-haspopup="dialog"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2 min-w-0">
                              <ArrowPathIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <div className={`font-medium truncate ${supportsReturnShippingSubsidy ? "text-slate-700" : "text-slate-700"}`}>
                                  {supportsReturnShippingSubsidy ? "Return shipping subsidy · Rapid refund" : "No return shipping subsidy"}
                                </div>
                              </div>
                            </div>
                          </div>

                          <ChevronRightIcon className="w-5 h-5 text-slate-400 shrink-0" />
                        </button>
                      </li>

                      {/* optional extra info */}
                      {businessData.policy?.returns?.additional_info && (
                        <li>
                          <button
                            type="button"
                            onClick={() =>
                              openPolicyModal(
                                "Returns — notes",
                                businessData.policy!.returns!.additional_info!
                              )
                            }
                            className="w-full flex items-center gap-3 py-1 rounded-md hover:bg-slate-50 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2 min-w-0">
                                <LifebuoyIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-800 truncate">Returns — notes</div>
                                  <div className="text-xs text-slate-500 mt-1 truncate">{businessData.policy.returns.additional_info}</div>
                                </div>
                              </div>
                            </div>

                            <ChevronRightIcon className="w-5 h-5 text-slate-400 shrink-0" />
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {/* variants preview condensed */}
              <div className="bg-white p-4 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-300 flex items-center justify-center">
                      {shopLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={String(shopLogo)} alt="Shop logo" className="w-full h-full object-cover" />
                      ) : (
                        <BuildingStorefrontIcon className="w-5 h-5 text-slate-600" />
                      )}
                    </div>

                    <div className="leading-tight">
                      <div className="font-semibold text-slate-900 text-sm">
                        {shopName}
                      </div>
                      <div className="text-xs text-slate-500">
                        105 Followers · 234 Sold
                      </div>
                    </div>
                  </div>

                  <button className="bg-red-500 px-4 py-1.5 rounded-full text-sm font-medium text-white hover:bg-red-600 transition">
                    Visit shop
                  </button>
                </div>
              </div>

              <div className="bg-white p-4 mt-2">
                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">Variants</div>
                    <div className="text-xs text-slate-400">{payload.variantGroups.length} groups</div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {payload.variantGroups.length === 0 && <div className="text-sm text-slate-400">No variant groups</div>}
                    {payload.variantGroups.map((g) => (
                      <div key={g.id} className="p-2 border border-slate-100 rounded-lg bg-slate-50">
                        <div className="text-sm font-medium text-slate-800">{g.title}</div>
                        <div className="text-xs text-slate-500 mt-1">{g.entries.length} options</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 text-sm text-slate-700 whitespace-pre-wrap">
                  {payload.description || <span className="text-slate-400">No description</span>}
                </div>

                {/* params */}
                <div className="mt-6">
                  <div className="text-xs text-slate-500">Params</div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {payload.params.length === 0 && <div className="text-sm text-slate-400">No params</div>}
                    {payload.params.map((p, i) => (
                      <div key={i} className="text-xs px-2 py-1 bg-slate-100 rounded-full">{p.key}: {p.value}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* sticky bottom action bar (mobile & desktop) */}
            <div
              onMouseDown={stop}
              className="fixed lg:sticky left-0 bottom-0 z-40 w-full border-t border-slate-100 bg-white/95 backdrop-blur px-1 py-1"
            >
              <div className="flex items-center gap-1">
                {/* Customer Service */}
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex flex-col items-center justify-center w-14"
                >
                  <div className="rounded-xl bg-white flex items-center justify-center overflow-hidden hover:shadow-sm">
                    {shopLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={String(shopLogo)} alt="Shop logo" className="h-5 w-5 object-cover mb-3 mt-3 border border-slate-300 rounded-full p-1" />
                    ) : (
                      <BuildingStorefrontIcon className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                  <span className="text-[11px] text-slate-800 font-bold">Shop</span>
                </button>

                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => onOpenChat && onOpenChat()}
                  className="flex flex-col items-center justify-center w-14"
                >
                  <div className="h-11 w-11 rounded-xl bg-white flex items-center justify-center hover:shadow-sm">
                    <LifebuoyIcon className="w-5 h-5 text-slate-600" />
                  </div>
                  <span className="font-bold text-[11px] text-slate-800">Service</span>
                </button>

                {/* Cart */}
                <div className="relative flex flex-col items-center ">
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    className="h-11 w-11 rounded-xl bg-white flex items-center justify-center hover:shadow-sm"
                  >
                    <ShoppingCartIcon className="w-5 h-5 text-slate-600" />
                  </button>

                  {cartCount > 0 && (
                    <div className="absolute top-2 right-2 w-1 h-1 p-2 rounded-full bg-rose-500 text-white text-[11px] font-semibold flex items-center justify-center">
                      {cartCount}
                    </div>
                  )}

                  <span className="text-[11px] text-slate-800 font-bold ">Cart</span>
                </div>

                {/* Action buttons — fills remaining space */}
                <div className="ml-auto flex flex-1 overflow-hidden rounded-full bg-white">
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onAddToCart && onAddToCart(payload)}
                    className="flex-1 py-2 text-sm font-bold text-red-500 bg-red-50 hover:bg-red-100 transition"
                  >
                    Add to cart
                  </button>

                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onBuyNow && onBuyNow(payload)}
                    className="flex-1 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 transition"
                  >
                    Buy now
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <PolicyModal open={policyModalOpen} title={policyModalData?.title ?? null} body={policyModalData?.body ?? null} onClose={closePolicyModal} />
    </>
  );
}
