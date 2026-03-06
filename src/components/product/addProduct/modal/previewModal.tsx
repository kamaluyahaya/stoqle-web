"use client";

import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { PreviewPayload } from "@/src/types/product";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { FaChevronRight } from "react-icons/fa";
import useBusinessPolicy from "@/src/hooks/useBusinessPolicy";
import { computeDiscountedPrice, parseNumberLike, parsePercent } from "@/src/lib/utils/product/price";
import MediaViewer from "../preview/modal/mediaViewer";
import ThumbnailList from "../preview/thumbnailList";
import PolicyList from "../preview/policyList";
import ActionBar from "../preview/actionBar";
import PolicyModal from "./policyModalPreview";
import { ProductFeedItem } from "@/src/types/product";
import { API_BASE_URL } from "@/src/lib/config";
import { fetchBusinessProducts, fetchMarketFeed } from "@/src/lib/api/productApi";
import { useCallback } from "react";
import { useRouter } from "next/navigation";

export default function ProductPreviewModal({
  open,
  payload,
  onClose,
  onConfirm,
  cartCount = 0,
  onAddToCart,
  onBuyNow,
  onOpenChat,
  onProductClick,
}: {
  open: boolean;
  payload: PreviewPayload | null;
  onClose: () => void;
  onConfirm?: () => void;
  cartCount?: number;
  onAddToCart?: (payload?: PreviewPayload) => void;
  onBuyNow?: (payload?: PreviewPayload) => void;
  onOpenChat?: () => void;
  onProductClick?: (productId: number, businessName?: string) => void;
}) {
  //
  // --- Hooks (always declared in the same order, unconditionally) ---
  //
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const lastScrollY = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyModalData, setPolicyModalData] = useState<{ title: string; body: string } | null>(null);

  // promo countdown state (declare before effects)
  const [promoRemaining, setPromoRemaining] = useState<string | null>(null);

  // Variant selection state
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // business data hook (unconditional hook call using payload ID if provided)
  const { businessData, loading: loadingBusiness, error: businessError } = useBusinessPolicy(open, payload?.businessId);

  const [recommendedProducts, setRecommendedProducts] = useState<ProductFeedItem[]>([]);
  const [loadingRecommended, setLoadingRecommended] = useState(false);

  // Global Recommendations State
  const [globalRecommendations, setGlobalRecommendations] = useState<ProductFeedItem[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalPage, setGlobalPage] = useState(0);
  const [globalHasMore, setGlobalHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !payload?.businessId) return;

    const loadRecommended = async () => {
      setLoadingRecommended(true);
      try {
        const res = await fetchBusinessProducts(payload.businessId as number, 6, undefined, payload.productId);
        setRecommendedProducts(res?.data?.products || []);
      } catch (err) {
        console.error("Failed to load recommended products:", err);
      } finally {
        setLoadingRecommended(false);
      }
    };
    loadRecommended();
  }, [open, payload?.businessId, payload?.productId]);

  const fetchGlobalRecs = useCallback(async (page: number) => {
    if (globalLoading || !globalHasMore || !payload) return;
    setGlobalLoading(true);
    try {
      const res = await fetchMarketFeed(12, page * 12, payload.productId, payload.businessId);
      const newItems = res?.data?.products || [];
      if (newItems.length < 12) setGlobalHasMore(false);
      setGlobalRecommendations(prev => {
        // filter out potential duplicates
        const existingIds = new Set(prev.map(p => p.product_id));
        const filtered = newItems.filter((p: any) => !existingIds.has(p.product_id));
        return [...prev, ...filtered];
      });
      setGlobalPage(page + 1);
    } catch (err) {
      console.error("Failed to load global recommendations:", err);
    } finally {
      setGlobalLoading(false);
    }
  }, [globalLoading, globalHasMore, payload]);

  useEffect(() => {
    if (!open) return;
    // reset when modal opens or product changes
    setGlobalRecommendations([]);
    setGlobalPage(0);
    setGlobalHasMore(true);
  }, [open, payload?.productId]);

  useEffect(() => {
    if (!open || !globalHasMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !globalLoading) {
        fetchGlobalRecs(globalPage);
      }
    }, { threshold: 0.1 });

    const currentLoader = loaderRef.current;
    if (currentLoader) observer.observe(currentLoader);

    return () => {
      if (currentLoader) observer.unobserve(currentLoader);
    };
  }, [open, globalHasMore, globalLoading, globalPage, fetchGlobalRecs]);

  // Initialize selected options when payload changes or modal opens
  useEffect(() => {
    if (open && payload?.variantGroups) {
      const initial: Record<string, string> = {};
      payload.variantGroups.forEach(group => {
        if (group.entries.length > 0) {
          // Find the first entry that is actually in stock
          const firstInStock = group.entries.find(e => {
            if (payload.useCombinations && payload.skus) {
              // In combinations, check if ANY enabled SKU with this option has stock
              return payload.skus.some(s =>
                s.enabled &&
                s.variantOptionIds.includes(e.id) &&
                Number(s.quantity || 0) > 0
              );
            }
            // Simple variant quantity check
            return Number(e.quantity ?? 0) > 0;
          });

          // Default to first in-stock, fallback to the very first one if all sold out
          initial[group.id] = firstInStock?.id || group.entries[0].id;
        }
      });
      setSelectedOptions(initial);
    }
  }, [open, payload?.variantGroups, payload?.useCombinations, payload?.skus]);

  //
  // --- Derived values (safe if payload is null) ---
  //
  const images = payload?.productImages ?? [];
  // If selectedIndex is -1, it means the video is selected, so main should be null to let MediaViewer show video
  const main = selectedIndex === -1 ? null : (images[selectedIndex] ?? (images.length > 0 ? images[0] : null));

  // SKU Logic
  const currentSku = useMemo(() => {
    if (!payload?.useCombinations || !payload?.skus) return null;
    const selectedIds = Object.values(selectedOptions);
    if (selectedIds.length === 0) return null;

    // Find SKU where all its variantOptionIds are in the current selection
    return payload.skus.find(s =>
      s.variantOptionIds.every(id => selectedIds.includes(id))
    );
  }, [payload?.useCombinations, payload?.skus, selectedOptions]);

  const promotion = businessData?.policy?.promotions?.[0] ?? null;
  const promotionDiscount = parsePercent(promotion?.discount_percent ?? null);
  const salesDiscount = parsePercent(businessData?.policy?.sales_discounts?.[0]?.discount_percent ?? null);

  // Determine base price: (If samePriceForAll, use sharedPrice) > SKU price > Payload Shared Price > Payload Base Price
  const basePriceValue = useMemo(() => {
    if (payload?.samePriceForAll && payload?.sharedPrice !== null && payload?.sharedPrice !== undefined) {
      return Number(payload.sharedPrice);
    }
    if (payload?.useCombinations && currentSku) {
      return currentSku.price !== "" ? Number(currentSku.price) : parseNumberLike(payload?.sharedPrice ?? payload?.price ?? null);
    }
    if (!payload?.useCombinations && !payload?.samePriceForAll && payload?.variantGroups) {
      for (const group of payload.variantGroups) {
        const selectedId = selectedOptions[group.id];
        if (selectedId) {
          const entry = group.entries.find(e => e.id === selectedId);
          if (entry && entry.price !== undefined && entry.price !== null && String(entry.price) !== "") {
            return Number(entry.price);
          }
        }
      }
    }
    return parseNumberLike(payload?.price ?? null);
  }, [payload, currentSku, selectedOptions]);

  const basePrice = basePriceValue;

  const isPromotionActive =
    basePrice !== null &&
    promotionDiscount !== null &&
    promotionDiscount > 0 &&
    (!promotion?.start_date || new Date(promotion.start_date) <= new Date()) &&
    (!promotion?.end_date || new Date(promotion.end_date) >= new Date());

  const isSalesActive = !isPromotionActive && basePrice !== null && salesDiscount !== null && salesDiscount > 0;

  const effectiveDiscount = isPromotionActive ? promotionDiscount : isSalesActive ? salesDiscount : null;
  const discountedPrice = computeDiscountedPrice(basePrice, effectiveDiscount);

  //
  // --- Effects (still before any early return) ---
  //

  // reset selected index when modal opens or payload changes
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

  // countdown for promo (runs only when promotion is active)
  useEffect(() => {
    const promotionEndDate = promotion?.end_date ?? null;
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

      setPromoRemaining(`${days}ds ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s left`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isPromotionActive, promotion?.end_date]);

  //
  // Now it's safe to early-return the UI if not open or missing payload.
  // (All hooks have already been declared and will execute in the same order.)
  //
  if (!open || !payload) return null;

  //
  // --- helper functions ---
  //
  const stop = (e: React.MouseEvent | React.TouchEvent) => e.stopPropagation();

  const openPolicyModal = (title: string, body: string) => {
    setPolicyModalData({ title, body });
    setPolicyModalOpen(true);
  };
  const closePolicyModal = () => {
    setPolicyModalOpen(false);
    setPolicyModalData(null);
  };

  const formatUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
  };

  //
  // --- render ---
  //
  return (
    <>
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-75 flex items-start justify-center px-0 py-0" onMouseDown={onClose} onTouchStart={onClose}>
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
          className="relative z-10 w-full h-full bg-slate-100 flex flex-col overflow-y-auto pb-24 lg:flex lg:flex-row lg:overflow-hidden lg:w-[96vw] lg:max-w-[1100px] lg:h-[94vh] lg:rounded-2xl lg:pb-0 shadow-2xl"
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
          {/* LEFT: media */}
          <MediaViewer main={main} payload={payload} />

          {/* RIGHT: details */}
          <aside className="w-full lg:w-[380px]  border-l border-slate-100 flex flex-col">
            <div className="px-4 bg-white">
              <div className="flex gap-1 lg:flex-row overflow-auto p-1">
                <ThumbnailList images={images} video={payload.productVideo} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
              </div>
            </div>

            <div className="flex-1 overflow-auto pb-24 lg:pb-0" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="bg-white p-5">
                {/* Pricing / promotion */}
                {isPromotionActive ? (
                  <div className="flex flex-col gap-1 mb-2">
                    <div className="inline-flex items-center rounded-sm bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 w-fit">
                      {promotion?.title ?? "Promotion"} · {promotionDiscount}% OFF
                      {promoRemaining && <div className="text-[11px] border border-red-500 p-2 text-red-500 font-medium ml-2">Ends in {promoRemaining}</div>}
                    </div>
                  </div>
                ) : isSalesActive ? (
                  <div className="flex flex-col gap-1 mb-2">
                    <div className="inline-flex items-center rounded-sm border-red-500 border px-2 py-1 text-xs font-semibold text-red-500 w-fit">{businessData?.policy?.sales_discounts?.[0]?.discount_type ?? "Sale"} · {salesDiscount}% OFF</div>
                  </div>
                ) : null}

                <div className="flex items-start justify-between gap-3 ">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-baseline gap-2">
                        {(isPromotionActive || isSalesActive) && basePrice !== null && <span className="text-sm text-slate-400 line-through">₦ {basePrice!.toLocaleString()}</span>}
                        <span className="text-2xl font-bold text-red-600">{discountedPrice !== null ? `₦ ${discountedPrice.toLocaleString()}` : "—"}</span>
                      </div>

                      <div className="text-lg font-semibold text-slate-900">
                        {businessData?.policy?.market_affiliation?.trusted_partner === 1 && (
                          <span className="bg-emerald-700 text-white text-xs px-2 py-1 rounded-sm align-center mr-2">
                            Verified Partner
                          </span>
                        )}
                        {payload.title || "Untitled product"}
                      </div>


                      <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{payload.description || <span className="text-slate-400">No description</span>}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-400">0 Sold</div>
                  </div>
                </div>

                <div className={`inline-block font-bold rounded-sm text-sm p-2 ${businessData?.policy?.returns?.return_shipping_subsidy === 1 ? "text-emerald-700 bg-emerald-50" : "text-yellow-600 bg-red-50"}`}>
                  {businessData?.policy?.returns?.return_shipping_subsidy === 1 ? "Return shipping subsidy" : "No return shipping subsidy"}
                </div>

                <PolicyList businessData={businessData} loading={loadingBusiness} error={businessError} openPolicyModal={openPolicyModal} />
              </div>

              {/* VARIANTS + params block */}
              <div className="bg-white p-4 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-300 flex items-center justify-center">
                      <img
                        src={businessData?.business?.logo || businessData?.business?.profile_pic || "/assets/images/favio.png"}
                        alt="Shop Logo"
                        className="h-full w-full object-cover"
                      />
                      {/* {businessData?.business?.logo ? <img src={String(businessData.business.logo)} alt="Shop logo" className="w-full h-full object-cover" /> : <div className="text-slate-500">🏬</div>} */}
                    </div>

                    <div className="leading-tight">
                      <div className="font-semibold text-slate-900 text-sm">{businessData?.business?.business_name ?? businessData?.business?.full_name ?? ""}</div>
                      <div className="text-xs text-slate-500">{businessData?.business?.stats?.followers?.toLocaleString() ?? "0"}+ Followers · 0 Sold</div>
                    </div>
                  </div>

                  <button className="bg-red-500 px-4 py-1.5 rounded-full text-xs text-white hover:bg-red-600 transition">Visit shop</button>
                </div>

                <div className="mt-6">
                  <div className="mt-4 space-y-6">
                    {payload.variantGroups.length === 0 && <div className="text-sm text-slate-400 italic">No variants defined</div>}
                    {payload.variantGroups.map((g) => (
                      <div key={g.id} className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{g.title || "Variant Group"}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{g.entries.length} Options</div>
                        </div>

                        <div className={g.entries.some(e => e.images && e.images.length > 0) ? "grid grid-cols-2 gap-3" : "flex flex-wrap gap-2"}>
                          {g.entries.map((e) => {
                            const hasImage = e.images && e.images.length > 0 && (e.images[0].url || (e.images[0] as any).imagePreviews?.[0]);
                            const groupHasImages = g.entries.some(ent => ent.images && ent.images.length > 0);
                            const productFallbackUrl = payload.productImages?.[0]?.url;

                            const isSelected = selectedOptions[g.id] === e.id;

                            // Check stock based on current combinations
                            let stock = Number(e.quantity ?? 0);
                            if (payload.useCombinations) {
                              // Context-aware stock: find the specific SKU for (this choice + other selections)
                              const otherSelectedIds = Object.entries(selectedOptions)
                                .filter(([gid]) => gid !== g.id)
                                .map(([, id]) => id);

                              const matchingSku = payload.skus.find(sku =>
                                sku.variantOptionIds.includes(e.id) &&
                                otherSelectedIds.every(oid => sku.variantOptionIds.includes(oid))
                              );

                              if (matchingSku) {
                                stock = matchingSku.enabled ? Number(matchingSku.quantity || 0) : 0;
                              } else {
                                const relatedSkus = payload.skus.filter(s => s.variantOptionIds.includes(e.id) && s.enabled);
                                stock = relatedSkus.reduce((acc, s) => acc + Number(s.quantity || 0), 0);
                              }
                            }

                            const isOutOfStock = stock <= 0;
                            const isLowStock = stock > 0 && stock <= 3;

                            if (groupHasImages) {
                              const displayUrl = hasImage ? (e.images?.[0].url || (e.images?.[0] as any).imagePreviews?.[0]) : productFallbackUrl;

                              return (
                                <button
                                  key={e.id}
                                  disabled={isOutOfStock}
                                  onClick={() => setSelectedOptions(prev => ({ ...prev, [g.id]: e.id }))}
                                  className={`relative flex flex-col p-2.5 rounded-2xl border transition-all shadow-sm text-left ${isSelected ? "border-red-500 ring-1 ring-red-500 bg-red-50/10" : "border-slate-100 bg-white hover:border-red-200"
                                    } ${isOutOfStock ? "opacity-40 cursor-not-allowed grayscale" : "cursor-pointer"}`}
                                >
                                  {isLowStock && (
                                    <div className="absolute top-1 right-1 z-20 bg-orange-500 text-[8px] text-white px-1.5 py-0.5 rounded-full font-bold uppercase animate-pulse">
                                      {stock} LEFT
                                    </div>
                                  )}
                                  {isOutOfStock && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 rounded-2xl">
                                      <span className="text-[10px] font-bold text-slate-500 uppercase">Sold Out</span>
                                    </div>
                                  )}

                                  {displayUrl ? (
                                    <div className="w-full aspect-square rounded-xl overflow-hidden mb-2 bg-slate-50 border border-slate-50">
                                      <img src={displayUrl} alt={e.name} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className="w-full aspect-square rounded-xl overflow-hidden mb-2 bg-slate-50 flex items-center justify-center text-slate-300">
                                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                  )}
                                  <div className="text-xs font-semibold text-slate-800 line-clamp-1 px-1">{e.name}</div>
                                  {e.price && !payload.useCombinations && !payload.samePriceForAll ? (
                                    <div className="text-[10px] text-red-600 font-bold mt-1 px-1">₦ {Number(e.price).toLocaleString()}</div>
                                  ) : null}
                                </button>
                              );
                            } else {
                              // Simple text chip if no images in the whole group
                              return (
                                <button
                                  key={e.id}
                                  disabled={isOutOfStock}
                                  onClick={() => setSelectedOptions(prev => ({ ...prev, [g.id]: e.id }))}
                                  className={`relative px-4 py-2 rounded-full border text-xs font-semibold transition-all shadow-sm flex items-center gap-2 ${isSelected ? "border-red-500 bg-red-50 text-red-600 ring-1 ring-red-500" : "border-slate-200 bg-white text-slate-800 hover:border-red-400"
                                    } ${isOutOfStock ? "opacity-30 cursor-not-allowed line-through" : "cursor-pointer"}`}
                                >
                                  {isLowStock && (
                                    <span className="flex items-center justify-center bg-orange-500 text-[8px] text-white w-4 h-4 rounded-full font-bold">
                                      {stock}
                                    </span>
                                  )}
                                  <span>{e.name}</span>
                                  {e.price && !payload.useCombinations && !payload.samePriceForAll ? <span className="text-red-600">· ₦{Number(e.price).toLocaleString()}</span> : null}
                                </button>
                              );
                            }
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>





              {/* Shop Recommendation section */}
              {recommendedProducts.length > 0 && (
                <div className="mt-2 bg-white p-5">
                  <div className="flex items-center justify-center mb-4 border-b border-slate-50 pb-2">
                    <h4 className="text-[11px] font-bold text-slate-600 text-center ">-Shop Recommendation-</h4>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {recommendedProducts.map((p) => {
                      const price = p.price || 0;
                      return (
                        <div
                          key={p.product_id}
                          className="group cursor-pointer"
                          onClick={() => {
                            if (p.product_video) {
                              router.push(`/shopping-reels?product_id=${p.product_id}`);
                              onClose();
                            } else if (onProductClick) {
                              onProductClick(p.product_id, businessData?.business?.business_name);
                            }
                          }}
                        >
                          <div className="aspect-square bg-slate-50 rounded-xl overflow-hidden mb-2 relative border border-slate-50 group-hover:border-red-100 transition-colors">
                            {p.first_image ? (
                              <img
                                src={formatUrl(p.first_image)}
                                alt={p.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-300">No Image</div>
                            )}

                            {p.product_video && (
                              <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md rounded-full p-1.5 z-10 shadow-lg border border-white/20">
                                <svg className="w-3 h-3 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M8 5.14v14l11-7-11-7z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-700 line-clamp-1 mb-1 leading-tight group-hover:text-red-600 transition-colors">
                            {p.title}
                          </div>
                          <div className="text-[11px] font-bold text-slate-900">
                            ₦{Number(price).toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {payload.params.length > 0 && (
                <div className="mt-2 bg-white p-4">
                  <div className="flex items-center justify-center mb-4 border-b border-slate-50 pb-2">
                    <h4 className="text-[11px] font-bold text-slate-600 text-center ">- Product Parameters -</h4>
                  </div>

                  <div className="space-y-1">
                    {payload.params.length === 0 ? (
                      <div className="text-sm text-slate-400">No details provided</div>
                    ) : (
                      payload.params.map((p, i) => (
                        <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
                          <div className="w-24 text-[10px] uppercase tracking-wide text-slate-500 flex-shrink-0">
                            {p.key}
                          </div>
                          <div className="text-xs font-medium text-slate-900">
                            {p.value}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* BUSINESS INFO CARD (Followers, etc) */}
              <div className="mt-2 bg-white p-5 border-t border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full overflow-hidden flex-shrink-0 border border-slate-200">
                    <img
                      src={businessData?.business?.logo || businessData?.business?.profile_pic || "/assets/images/favio.png"}
                      alt="Shop Logo"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {businessData?.business?.business_name || "Official Store"}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {businessData?.business?.business_category || "Verified Business"}
                    </div>
                  </div>
                  <button className="bg-red-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-sm hover:bg-red-600 transition">
                    Follow
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-50 pt-4">
                  <div className="text-center">
                    <div className="text-sm font-bold text-slate-900">
                      {businessData?.business?.stats?.followers?.toLocaleString() || "0"}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Followers</div>
                  </div>
                  <div className="text-center border-x border-slate-50">
                    <div className="text-sm font-bold text-slate-900">
                      {businessData?.business?.stats?.following?.toLocaleString() || "0"}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Following</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-slate-900">
                      {businessData?.business?.stats?.posts?.toLocaleString() || "0"}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Posts</div>
                  </div>
                </div>


              </div>

              {/* ALL PRODUCT IMAGES (full, no crop) */}
              {/* ALL PRODUCT IMAGES (no resize, real aspect ratio) */}
              {payload.productImages?.length > 0 && (
                <div className="mt-2 bg-white p-4">

                  <div className="text-xs text-slate-800 mb-3">Product Images</div>

                  <div className="space-y-4">
                    {payload.productImages.map((img, index) => {
                      if (!img?.url) return null;

                      return (
                        <div
                          key={index}
                          className="w-full flex justify-center bg-slate-50 rounded-lg overflow-hidden"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={img.name ?? `${payload.title} image ${index + 1}`}
                            className="w-full h-auto object-contain"
                            loading="lazy"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


              <div className="mt-2 bg-white p-5">
                <div className="flex items-center justify-center mb-4 border-b border-slate-50 pb-2">
                  <h4 className="text-[11px] font-bold text-slate-600 text-center ">- You Might Also Like this -</h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                  {globalRecommendations.map((p) => {
                    const price = p.price || 0;
                    return (
                      <div
                        key={p.product_id}
                        className="group cursor-pointer"
                        onClick={() => {
                          if (p.product_video) {
                            router.push(`/shopping-reels?product_id=${p.product_id}`);
                            onClose();
                          } else if (onProductClick) {
                            onProductClick(p.product_id, p.business_name);
                          }
                        }}
                      >
                        <div className="aspect-square bg-slate-50 rounded-xl overflow-hidden mb-2 relative border border-slate-50 group-hover:border-red-100 transition-colors">
                          {p.first_image ? (
                            <img
                              src={formatUrl(p.first_image)}
                              alt={p.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-300">No Image</div>
                          )}

                          {p.product_video && (
                            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md rounded-full p-1.5 z-10 shadow-lg border border-white/20">
                              <svg className="w-3 h-3 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5.14v14l11-7-11-7z" />
                              </svg>
                            </div>
                          )}

                          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-white/80 backdrop-blur rounded text-[8px] font-bold text-slate-900 border border-slate-200 truncate max-w-[80%] uppercase tracking-tighter shadow-sm">
                            {p.business_name}
                          </div>
                        </div>
                        <div className="text-[10px] font-semibold text-slate-700 line-clamp-1 mb-1 leading-tight group-hover:text-red-600 transition-colors">
                          {p.title}
                        </div>
                        <div className="text-[11px] font-bold text-slate-900">
                          ₦{Number(price).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {globalHasMore && (
                  <div ref={loaderRef} className="py-8 flex justify-center">
                    <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}

                {!globalHasMore && globalRecommendations.length > 0 && (
                  <div className="py-8 text-center text-[10px] text-slate-400 font-medium tracking-widest ">
                    - The End -
                  </div>
                )}

                {globalRecommendations.length === 0 && !globalLoading && !globalHasMore && (
                  <div className="py-8 text-center text-xs text-slate-400 italic">No more recommendations</div>
                )}
              </div>


            </div>

            <ActionBar
              onAddToCart={() => onAddToCart && onAddToCart(payload)}
              onBuyNow={() => onBuyNow && onBuyNow(payload)}
              onOpenChat={() => onOpenChat && onOpenChat()}
              cartCount={cartCount}
              shopLogo={businessData?.business?.logo}
            />
          </aside>
        </div>
      </div>

      <PolicyModal open={policyModalOpen} title={policyModalData?.title ?? null} body={policyModalData?.body ?? null} onClose={closePolicyModal} />
    </>
  );
}
