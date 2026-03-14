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
import AddToCartModal from "./addToCartModal";
import { ProductFeedItem } from "@/src/types/product";
import { API_BASE_URL } from "@/src/lib/config";
import { fetchBusinessProducts, fetchMarketFeed } from "@/src/lib/api/productApi";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
  onCartClick,
  onShopClick,
  origin,
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
  onCartClick?: () => void;
  onShopClick?: () => void;
  origin?: { x: number; y: number };
}) {
  //
  // --- Hooks (always declared in the same order, unconditionally) ---
  //
  const auth = useAuth();
  const { user, token } = auth;
  const [estimation, setEstimation] = useState<{
    distance_km: number;
    travel_time_hours: number;
    estimated_delivery_time: Date;
    shipping_deadline: Date;
    is_available: boolean;
    message?: string;
  } | null>(null);
  const [storedAddress, setStoredAddress] = useState<any>(null);

  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const asideScrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollY = useRef(0);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyModalData, setPolicyModalData] = useState<{ title: string; body: string } | null>(null);

  // promo countdown state (declare before effects)
  const [promoRemaining, setPromoRemaining] = useState<string | null>(null);

  // Variant selection state (now used by AddToCartModal, but kept here for initial prep if needed)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [cartActionType, setCartActionType] = useState<"cart" | "buy">("cart");

  // business data hook (unconditional hook call using payload ID if provided)
  const { businessData, loading: loadingBusiness, error: businessError } = useBusinessPolicy(open, payload?.businessId);

  useEffect(() => {
    const saved = localStorage.getItem("stoqle_delivery_address");
    if (saved) {
      try {
        setStoredAddress(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved address", e);
      }
    }
  }, [open]);

  useEffect(() => {
    async function runEstimation() {
      if (!open || !payload || !businessData?.business) return;

      const vendorLoc = {
        latitude: Number(businessData.business.latitude),
        longitude: Number(businessData.business.longitude),
      };

      // Default to vendor location if no customer address is set, just to show a baseline or skip estimation
      const customerLoc = storedAddress ? {
        latitude: Number(storedAddress.latitude || storedAddress.lat),
        longitude: Number(storedAddress.longitude || storedAddress.lng),
      } : null;

      if (vendorLoc.latitude === undefined || vendorLoc.longitude === undefined || !customerLoc) {
        console.log("Estimation skipped: Missing coordinates", { vendorLoc, customerLoc, storedAddress });
        setEstimation(null);
        return;
      }

      console.log("Running estimation with:", { vendorLoc, customerLoc });
      const policies = (businessData.policy?.shipping || businessData.policy?.shipping_duration || []) as any[];

      const result = await import("@/src/lib/deliveryEstimation").then(m => m.estimateDelivery(
        vendorLoc,
        customerLoc,
        policies
      ));

      setEstimation(result);
    }
    runEstimation();
  }, [open, payload, businessData, storedAddress]);
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
        const res = await fetchBusinessProducts(payload.businessId as number, 6, undefined, payload.productId, token);
        setRecommendedProducts(res?.data?.products || []);
      } catch (err) {
        console.error("Failed to load recommended products:", err);
      } finally {
        setLoadingRecommended(false);
      }
    };
    loadRecommended();
  }, [open, payload?.businessId, payload?.productId]);

  // Pre-select first available combo when modal opens
  useEffect(() => {
    if (open && payload?.hasVariants && payload.variantGroups) {
      const initial: Record<string, string> = {};

      if (payload.useCombinations && payload.skus) {
        // STRICT Priority: Find first enabled & in-stock SKU
        const bestSku = payload.skus.find(s => s.enabled && Number(s.quantity || 0) > 0);

        if (bestSku) {
          payload.variantGroups.forEach(group => {
            const match = group.entries.find(e => bestSku.variantOptionIds.includes(e.id));
            if (match) initial[group.id] = match.id;
          });
        }
      } else {
        payload.variantGroups.forEach(group => {
          const firstInStock = group.entries.find(e => Number(e.quantity ?? 0) > 0);
          if (firstInStock) initial[group.id] = firstInStock.id;
        });
      }
      setSelectedOptions(initial);
    }
  }, [open, payload]);

  const fetchGlobalRecs = useCallback(async (page: number) => {
    if (globalLoading || !globalHasMore || !payload) return;
    setGlobalLoading(true);
    try {
      const res = await fetchMarketFeed(12, page * 12, payload.productId, payload.businessId, false, token);
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

  // Save/Restore State from sessionStorage for "Back" button support
  const saveModalState = useCallback(() => {
    if (!open || !payload?.productId) return;
    const state = {
      selectedIndex,
      selectedOptions,
      scrollPos: asideScrollRef.current?.scrollTop || 0
    };
    sessionStorage.setItem(`stoqle_modal_state_${payload.productId}`, JSON.stringify(state));
  }, [open, payload?.productId, selectedIndex, selectedOptions]);

  useEffect(() => {
    if (!open || !payload?.productId) return;

    const saved = sessionStorage.getItem(`stoqle_modal_state_${payload.productId}`);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (typeof state.selectedIndex === 'number') setSelectedIndex(state.selectedIndex);
        if (state.selectedOptions) setSelectedOptions(state.selectedOptions);

        // Restore scroll after a tick
        if (typeof state.scrollPos === 'number') {
          setTimeout(() => {
            if (asideScrollRef.current) asideScrollRef.current.scrollTop = state.scrollPos;
          }, 50);
        }
      } catch (e) {
        console.error("Failed to restore modal state", e);
      }
    } else {
      // If no saved state, reset to top
      setSelectedIndex(0);
      setSelectedOptions({});
      if (modalRef.current) modalRef.current.scrollTo(0, 0);
      if (asideScrollRef.current) asideScrollRef.current.scrollTo(0, 0);
    }
  }, [open, payload?.productId]);

  // Persist state changes
  useEffect(() => {
    if (open && payload?.productId) {
      saveModalState();
    }
  }, [selectedIndex, selectedOptions, open, payload?.productId, saveModalState]);

  // Track scroll position for persistence
  useEffect(() => {
    const scrollEl = asideScrollRef.current;
    if (!open || !scrollEl) return;

    let timeout: any;
    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(saveModalState, 200);
    };

    scrollEl.addEventListener('scroll', handleScroll);
    return () => {
      scrollEl.removeEventListener('scroll', handleScroll);
      clearTimeout(timeout);
    };
  }, [open, saveModalState]);

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

  // Initialize selected options when payload changes or modal opens (only if not already restored from cache)
  useEffect(() => {
    if (open && payload?.variantGroups && payload.variantGroups.length > 0) {
      // Check if we already have matching selected options (probably from cache)
      const hasSelections = Object.keys(selectedOptions).length > 0;
      if (hasSelections) return;

      const initial: Record<string, string> = {};

      if (payload.useCombinations && payload.skus && payload.skus.length > 0) {
        // STRICT Priority: Find enabled & in-stock SKUs, then pick the one with MIN price
        const availableSkus = payload.skus.filter(s => s.enabled && Number(s.quantity || 0) > 0);
        const candidates = availableSkus.length > 0 ? availableSkus : payload.skus.filter(s => s.enabled);

        if (candidates.length > 0) {
          const cheapestSku = candidates.reduce((prev, curr) => {
            const prevPrice = prev.price !== "" ? Number(prev.price) : Infinity;
            const currPrice = curr.price !== "" ? Number(curr.price) : Infinity;
            return currPrice < prevPrice ? curr : prev;
          }, candidates[0]);

          payload.variantGroups.forEach(group => {
            const match = group.entries.find(e => cheapestSku.variantOptionIds.includes(e.id));
            if (match) initial[group.id] = match.id;
          });
        }
      } else {
        // Non-combination logic: Pick cheapest available in each group
        payload.variantGroups.forEach((group) => {
          if (group.entries && group.entries.length > 0) {
            const sortedEntries = [...group.entries].sort((a, b) => {
              const stockA = Number(a.quantity ?? 0);
              const stockB = Number(b.quantity ?? 0);
              if (stockA > 0 && stockB <= 0) return -1;
              if (stockB > 0 && stockA <= 0) return 1;

              const priceA = a.price !== null && a.price !== undefined ? Number(a.price) : Infinity;
              const priceB = b.price !== null && b.price !== undefined ? Number(b.price) : Infinity;
              return priceA - priceB;
            });
            initial[group.id] = sortedEntries[0].id;
          }
        });
      }
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
    const selectedIds = Object.values(selectedOptions).map(String);
    if (selectedIds.length === 0) return null;

    // Find SKU where all its variantOptionIds are in the current selection
    return payload.skus.find(s =>
      s.variantOptionIds.every(id => selectedIds.includes(String(id)))
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

  // Handlers for AddToCartModal
  const handleAddToCartClick = () => {
    if (!payload) return;

    // Check if vendor is trying to buy their own product
    const currentUserBizId = user?.business_id || (user as any)?.business?.business_id;
    if (currentUserBizId && Number(currentUserBizId) === Number(payload.businessId)) {
      toast.error("You cannot purchase your own product.");
      return;
    }

    setCartActionType("cart");
    setCartModalOpen(true);
  };

  const handleBuyNowClick = () => {
    if (!payload) return;

    // Check if vendor is trying to buy their own product
    const currentUserBizId = user?.business_id || (user as any)?.business?.business_id;
    if (currentUserBizId && Number(currentUserBizId) === Number(payload.businessId)) {
      toast.error("You cannot purchase your own product.");
      return;
    }

    setCartActionType("buy");
    setCartModalOpen(true);
  };

  const handleOpenChatInternal = async () => {
    const p = payload;
    if (!p) return; 

    if (onOpenChat) {
      onOpenChat();
      return;
    }

    const vendorUserId = businessData?.business?.user_id;
    if (!vendorUserId) {
      toast.error("Contact information for this vendor is currently unavailable.");
      return;
    }

    // Check if logged in before redirecting to messages
    if (auth?.ensureLoggedIn) {
      const isLoggedIn = await auth.ensureLoggedIn();
      if (!isLoggedIn) return;
    } else if (!token) {
      toast.error("Please login to message the vendor");
      return;
    }

    // Construct query parameters with product details for context tagging in chat
    const chatParams = new URLSearchParams({
      user: String(vendorUserId),
      product_id: String(p.productId),
      pname: p.title || "",
      pprice: String(discountedPrice || basePrice || ""),
    });

    if (p.productImages?.[0]?.url) {
      chatParams.set("pimg", p.productImages[0].url);
    }

    // Capture current variant selections if any
    if (Object.keys(selectedOptions).length > 0 && p.variantGroups) {
      const selections = p.variantGroups.map(g => {
        const optId = selectedOptions[g.id];
        const opt = g.entries.find(e => e.id === optId);
        return opt ? `${g.title}: ${opt.name}` : null;
      }).filter(Boolean);

      if (selections.length > 0) {
        chatParams.set("pvariant", selections.join(", "));
      }
    }

    // Redirect to messages page with the vendor's user ID and product info.
    router.push(`/messages?${chatParams.toString()}`);
  };

  const handleCartConfirm = (data: { selectedOptions: Record<string, string>; quantity: number; sku: any; address?: any }) => {
    if (!payload) return;
    const finalPayload = { ...payload, ...data } as PreviewPayload;
    if (data.selectedOptions) {
      setSelectedOptions(data.selectedOptions);
    }

    if (cartActionType === "cart") {
      onAddToCart ? onAddToCart(finalPayload) : onConfirm?.();
    } else {
      onBuyNow ? onBuyNow(finalPayload) : onConfirm?.();
    }
    setCartModalOpen(false);
  };

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

  // reset selected index and scroll when modal opens or payload changes
  // (REMOVED: Handled by State Restoration Logic above)

  // Lock background scroll while open
  useEffect(() => {
    if (!open) return;

    // Prevent background scrolling while modal is open
    const originalStyle = window.getComputedStyle(document.body).overflow;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalStyle;
      document.body.style.paddingRight = "0";
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
    if (!url) return "/assets/images/favio.png";
    let formatted = url;
    if (!url.startsWith("http")) {
      formatted = url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    }
    return encodeURI(formatted);
  };

  //
  // --- render ---
  //
  return (
    <>
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-[9999] flex items-center justify-center px-0 py-0 lg:p-4" onMouseDown={onClose} onTouchStart={onClose}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          aria-hidden
        />


        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 30 }}
          transition={{
            type: "spring",
            damping: 25,
            stiffness: 300,
            opacity: { duration: 0.2 },
            scale: { duration: 0.3 }
          }}
          className="relative z-10 w-full h-full lg:w-[96vw] lg:max-w-[1100px] lg:h-[94vh] flex flex-col items-center justify-center"
        >
          {/* Desktop Close Button (Outside but close to modal) */}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="hidden lg:flex absolute -top-5 -right-5 z-[1100] h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white transition-all duration-300 group shadow-lg"
            title="Close"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 transition-transform duration-300 group-hover:rotate-90">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>

          <div
            ref={modalRef}
            onMouseDown={stop}
            onTouchStart={stop}
            role="dialog"
            aria-modal="true"
            className="relative w-full h-full bg-slate-100 flex flex-col overflow-y-auto pb-24 lg:flex lg:flex-row lg:overflow-hidden lg:w-full lg:h-full lg:rounded-2xl lg:pb-0 shadow-2xl"
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
            <MediaViewer
              main={main}
              payload={payload}
              images={images}
              selectedIndex={selectedIndex}
              onIndexChange={setSelectedIndex}
            />

            {/* RIGHT: details */}
            <aside className="w-full lg:w-[380px]  border-l border-slate-100 flex flex-col">
              <div className="px-4 bg-white">
                <div className="flex gap-1 lg:flex-row overflow-auto p-1">
                  <ThumbnailList images={images} video={payload.productVideo} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
                </div>
              </div>

              <div
                ref={asideScrollRef}
                className="flex-1 overflow-auto pb-24 lg:pb-0"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
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
                      <div className="text-xs text-slate-400">
                        {payload.soldCount && payload.soldCount > 0 
                          ? `${payload.soldCount.toLocaleString()}+ Sold` 
                          : "0 Sold"}
                      </div>
                    </div>
                  </div>

                  <div className={`inline-block font-bold rounded-sm text-sm p-2 ${businessData?.policy?.returns?.return_shipping_subsidy === 1 ? "text-emerald-700 bg-emerald-50" : "text-yellow-600 bg-red-50"}`}>
                    {businessData?.policy?.returns?.return_shipping_subsidy === 1 ? "Return shipping subsidy" : "No return shipping subsidy"}
                  </div>

                  <PolicyList
                    businessData={businessData}
                    loading={loadingBusiness}
                    error={businessError}
                    openPolicyModal={openPolicyModal}
                    payload={payload}
                    selectedOptions={selectedOptions}
                    estimation={estimation}
                    storedAddress={storedAddress}
                    onSelectClick={() => {
                      if (payload.variantGroups && payload.variantGroups.length > 0) {
                        setCartActionType("cart");
                        setCartModalOpen(true);
                      }
                    }}
                  />
                </div>

                {/* VARIANTS + params block */}
                <div className="bg-white p-4 mt-2">
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => businessData?.business?.user_id && router.push(`/user/profile/${businessData.business.user_id}`)}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-300 flex items-center justify-center flex-shrink-0">
                        <img
                          src={businessData?.business?.business_logo || businessData?.business?.logo || businessData?.business?.profile_pic || "/assets/images/favio.png"}
                          alt="Shop Logo"
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="leading-tight min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 text-[clamp(10px,3.5vw,14px)] whitespace-nowrap overflow-hidden">
                          {businessData?.business?.business_name ?? businessData?.business?.full_name ?? ""}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{businessData?.business?.stats?.followers?.toLocaleString() ?? "0"}+ Followers</div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        router.push(`/shop/${payload.businessId}`);
                        onClose();
                      }}
                      className="flex-shrink-0 whitespace-nowrap bg-red-500 px-4 py-1.5 rounded-full text-xs text-white hover:bg-red-600 transition"
                    >
                      Visit shop
                    </button>
                  </div>

                  <div className="mt-6">
                    {/* Variant selection has been moved to the Add to Cart modal */}
                  </div>

                </div>





                {/* Shop Recommendation section */}
                {recommendedProducts.length > 0 && (
                  <div className="mt-2 bg-white p-5">
                    <div className="flex items-center justify-center mb-4 border-b border-slate-50 pb-2">
                      <h4 className="text-[11px] font-bold text-slate-600  ">Shop Recommendation</h4>
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
                                saveModalState();
                                router.push(`/shopping-reels?product_id=${p.product_id}`);
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
                      <div className="font-bold text-slate-900 text-[clamp(10px,4vw,15px)] whitespace-nowrap overflow-hidden">
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
                              saveModalState();
                              router.push(`/shopping-reels?product_id=${p.product_id}`);
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
                onAddToCart={handleAddToCartClick}
                onBuyNow={handleBuyNowClick}
                onOpenChat={handleOpenChatInternal}
                onCartClick={onCartClick}
                onShopClick={onShopClick}
                cartCount={cartCount}
                shopLogo={businessData?.business?.logo}
                businessId={payload?.businessId}
              />
            </aside>
          </div>
        </motion.div>
      </div>

      <PolicyModal
        open={policyModalOpen}
        title={policyModalData?.title ?? null}
        body={policyModalData?.body ?? null}
        onClose={closePolicyModal}
        onAddressChange={setStoredAddress}
      />
      <AddToCartModal
        open={cartModalOpen}
        payload={payload}
        businessData={businessData}
        actionType={cartActionType}
        onClose={() => setCartModalOpen(false)}
        onConfirm={handleCartConfirm}
        initialSelectedOptions={selectedOptions}
        storedAddress={storedAddress}
        onAddressChange={setStoredAddress}
      />
    </>
  );
}
