"use client";

import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { PreviewPayload } from "@/src/types/product";
import { getNextZIndex } from "@/src/lib/utils/z-index";
import { ChevronLeftIcon, ChevronRightIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { CheckIcon, HeartIcon, ShareIcon, SparklesIcon, StarIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { VerifiedBadge } from "@/src/components/common/VerifiedBadge";
import SmartShareButton from '@/src/components/share/SmartShareButton';
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { Review, fetchProductReviews } from "@/src/lib/api/reviewApi";
import { FaChevronRight } from "react-icons/fa";
import useBusinessPolicy from "@/src/hooks/useBusinessPolicy";
import { computeDiscountedPrice, parseNumberLike, parsePercent } from "@/src/lib/utils/product/price";
import MediaViewer from "../preview/modal/mediaViewer";
import ThumbnailList from "../preview/thumbnailList";
import PolicyList from "../preview/policyList";
import ActionBar from "../preview/actionBar";
import PolicyModal from "./policyModalPreview";
import ShippingModal from "./shippingModalPreview";
import AddToCartModal from "./addToCartModal";
import ReviewListModal from "./reviewListModal";
import { ProductFeedItem, ReturnPolicy } from "@/src/types/product";
import { API_BASE_URL } from "@/src/lib/config";
import { fetchBusinessProducts, fetchMarketFeed, fetchPersonalizedFeed, logUserActivity } from "@/src/lib/api/productApi";
import { useCallback } from "react";
import { Info } from "lucide-react";
import ReturnShippingSubsidyModal from "@/src/components/business/policyModal/returnShippingSubsidyModal";
import { useRouter } from "next/navigation";
import { addToCartApi } from "@/src/lib/api/cartApi";
import { useAuth } from "@/src/context/authContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { fetchUserAddresses, UserAddress } from "@/src/lib/api/addressApi";
import { formatDuration } from "@/src/lib/utils/product/duration";
import SearchModal from "@/src/components/modal/SearchModal";
import SearchResultsModal from "@/src/components/modal/SearchResultsModal";
import Swal from "sweetalert2";

const slugify = (str: string) =>
  String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

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
  onReelsClick,
  onCartClick,
  onShopClick,
  origin,
  zIndex,
  ignoreRouterBack,
  isFetching,
  isFromReel,
  onExpand,
  onCollapse,
}: {
  open: boolean;
  payload: PreviewPayload | null;
  onClose: () => void;
  onConfirm?: () => void;
  cartCount?: number;
  onAddToCart?: (payload?: PreviewPayload) => void;
  onBuyNow?: (payload?: PreviewPayload) => void;
  onOpenChat?: () => void;
  onProductClick?: (productId: number | string, businessName?: string, e?: any, businessSlug?: string, isSocialPost?: boolean, productSlug?: string) => void;
  onReelsClick?: (productId: number | string, businessName?: string, e?: any, businessSlug?: string, productSlug?: string) => void;
  onCartClick?: () => void;
  onShopClick?: () => void;
  origin?: { x: number; y: number };
  zIndex?: number;
  ignoreRouterBack?: boolean;
  isFetching?: boolean;
  isFromReel?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
}) {
  //
  // --- Hooks (always declared in the same order, unconditionally) ---
  //
  const auth = useAuth();
  const { user, token } = auth;
  const [estimation, setEstimation] = useState<{
    distance_km: number;
    travel_time_hours: number;
    prep_time_hours: number;
    estimated_delivery_time: Date;
    shipping_deadline: Date;
    is_available: boolean;
    message?: string;
  } | null>(null);
  const [storedAddress, setStoredAddress] = useState<any>(null);
  const [addressListOpen, setAddressListOpen] = useState(false);

  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (payload?.productId && modalRef.current) {
      modalRef.current.scrollTo(0, 0);
      setActiveTab("overview");
      setSelectedIndex(0);
      setViewMode("images");
    }
  }, [payload?.productId]);
  const [modalZIndex, setModalZIndex] = useState(() => getNextZIndex());
  useEffect(() => {
    if (open) {
      setModalZIndex(getNextZIndex());
      // Reset expanded state when modal opens
      setIsExpanded(false);
    }
  }, [open]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const asideScrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollY = useRef(0);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyModalData, setPolicyModalData] = useState<{ title: string; body: string; type?: "shipping" | "policy" } | null>(null);

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 1024;
    }
    return false;
  });
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // promo countdown state (declare before effects)
  const [promoRemaining, setPromoRemaining] = useState<string | null>(null);
  const [isSubsidyModalOpen, setIsSubsidyModalOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const wasAlreadyLocked = document.body.classList.contains("overflow-hidden") ||
      window.getComputedStyle(document.body).overflow === "hidden";

    if (!wasAlreadyLocked) {
      document.body.classList.add("overflow-hidden");
    }

    return () => {
      if (!wasAlreadyLocked) {
        document.body.classList.remove("overflow-hidden");
      }
    };
  }, [open]);

  // Variant selection state (now used by AddToCartModal, but kept here for initial prep if needed)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [cartActionType, setCartActionType] = useState<"cart" | "buy">("cart");

  // business data hook (unconditional hook call using payload ID if provided)
  const bizIdentifier = useMemo(() => {
    return payload?.businessSlug || (payload?.businessName ? slugify(payload.businessName) : payload?.businessId);
  }, [payload]);

  const { businessData, loading: loadingBusiness, error: businessError } = useBusinessPolicy(open, bizIdentifier);

  const policy = businessData?.policy ?? null;

  const effectiveReturnPolicy = useMemo(() => {
    // 1. Explicit Overrides
    if (payload?.policyOverrides && !payload.policyOverrides.useStoreDefaultReturn) {
      const over = payload.policyOverrides.returnPolicy;
      return {
        seven_day_no_reason: (over?.['7dayNoReasonReturn'] || over?.sevenDayNoReasonReturn) ? 1 : 0,
        rapid_refund: over?.rapidRefund ? 1 : 0,
        return_shipping_subsidy: over?.returnShippingSubsidy ? 1 : 0,
        late_shipment: over?.lateShipmentCompensation ? 1 : 0,
        fake_one_pay_four: over?.fakeOnePayFour ? 1 : 0,
        return_window: over?.returnWindow ?? 3
      };
    }

    // 2. Direct Product Properties (Priority before store general policy if present)
    const p = payload as any;
    if (p?.late_shipment !== undefined || p?.fake_one_pay_four !== undefined || p?.seven_day_no_reason !== undefined) {
      return {
        ...policy?.returns,
        seven_day_no_reason: p.seven_day_no_reason ?? policy?.returns?.seven_day_no_reason,
        rapid_refund: p.rapid_refund ?? policy?.returns?.rapid_refund,
        return_shipping_subsidy: p.return_shipping_subsidy ?? policy?.returns?.return_shipping_subsidy,
        late_shipment: p.late_shipment ?? policy?.returns?.late_shipment,
        fake_one_pay_four: p.fake_one_pay_four ?? policy?.returns?.fake_one_pay_four,
        return_window: p.return_window ?? policy?.returns?.return_window ?? 3
      };
    }

    // 3. Fallback to Store General Policy
    return policy?.returns ?? ({} as ReturnPolicy);
  }, [payload, policy]);

  const effectiveShippingPolicies = useMemo(() => {
    if (payload?.policyOverrides && !payload.policyOverrides.useStoreDefaultShipping) {
      const over = payload.policyOverrides.shippingPolicy;
      return [
        { kind: "avg", value: over?.avgDuration, unit: over?.avgUnit },
        { kind: "promise", value: over?.promiseDuration, unit: over?.promiseUnit },
        { kind: "delivery_radius_km", value: over?.radiusKm, unit: "km" }
      ];
    }
    return (policy?.shipping || policy?.shipping_duration) ?? [];
  }, [payload?.policyOverrides, policy]);

  const effectivePromotions = useMemo(() => {
    if (payload?.policyOverrides && !payload.policyOverrides.useStoreDefaultPromotions) {
      return payload.policyOverrides.promotions ?? [];
    }
    return policy?.promotions ?? [];
  }, [payload?.policyOverrides, policy]);

  const effectiveSaleDiscounts = useMemo(() => {
    if (payload?.policyOverrides && !payload.policyOverrides.useStoreDefaultPromotions) {
      return payload.policyOverrides.saleDiscount ? [payload.policyOverrides.saleDiscount] : [];
    }
    return policy?.sales_discounts ?? [];
  }, [payload?.policyOverrides, policy]);

  const displayAvgDuration = useMemo(() => {
    if (estimation && !estimation.is_available) return null;
    if (estimation?.is_available && estimation.estimated_delivery_time.getTime() > 0) {
      const now = new Date();
      const diffMs = estimation.estimated_delivery_time.getTime() - now.getTime();
      return formatDuration(Math.max(0, diffMs / (1000 * 60 * 60)), "hours");
    }
    const shippingAvg = effectiveShippingPolicies.find((s: any) => s.kind === "avg" || s.type === "avg");
    return shippingAvg ? formatDuration(shippingAvg.value, shippingAvg.unit) : "8 hours";
  }, [estimation, effectiveShippingPolicies]);

  const avgShipping = useMemo(() => effectiveShippingPolicies.find(s => (s as any).kind === 'avg'), [effectiveShippingPolicies]);
  const customerService = useMemo(() => businessData?.policy?.customer_service, [businessData]);
  const vendorStats = useMemo(() => businessData?.business?.stats, [businessData]);

  const [appBarOpacity, setAppBarOpacity] = useState(0);
  const [showAppBar, setShowAppBar] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"video" | "images" | "styles">("images");

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const sectionRefs = {
    overview: useRef<HTMLDivElement>(null),
    reviews: useRef<HTMLDivElement>(null),
    details: useRef<HTMLDivElement>(null),
    explore: useRef<HTMLDivElement>(null)
  };



  const handleSearchTrigger = () => {
    setIsSearchOpen(true);
  };

  const scrollToSection = (id: string) => {
    const el = sectionRefs[id as keyof typeof sectionRefs].current;
    if (el && modalRef.current) {
      // Offset for sticky appbar + tabbar
      const offset = 100;
      modalRef.current.scrollTo({
        top: el.offsetTop - offset,
        behavior: "smooth"
      });
      setActiveTab(id);
    }
  };

  useEffect(() => {
    const el = modalRef.current;
    if (!el || !open) return;

    const onScroll = () => {
      const scrollPos = el.scrollTop;

      // Only trigger expansion on mobile from Reels
      if (isMobile && isFromReel && !isExpanded && scrollPos > 10) {
        setIsExpanded(true);
        if (onExpand) onExpand();
      }

      // Auto-collapse back to 80% when user scrolls back to top
      if (isMobile && isFromReel && isExpanded && scrollPos <= 5) {
        setIsExpanded(false);
        if (onCollapse) onCollapse();
      }

      // Calculate AppBar Opacity
      const mediaEl = sectionRefs.overview.current;
      const threshold = 100; // start fading 100px before media ends or after some scroll
      const mediaHeight = (mediaEl?.offsetHeight || 400) - 80;

      let opacity = scrollPos / (mediaHeight * 0.6);
      if (opacity > 1) opacity = 1;
      setAppBarOpacity(opacity);
      setShowAppBar(opacity > 0.5);

      // Track active section
      const sections = ["overview", "reviews", "details", "explore"] as const;
      const offset = 120;

      for (const section of sections) {
        const ref = sectionRefs[section].current;
        if (ref) {
          const top = ref.offsetTop - offset;
          const bottom = top + ref.offsetHeight;
          if (scrollPos >= top && scrollPos < bottom) {
            setActiveTab(section);
            break;
          }
        }
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [open]);

  useEffect(() => {
    if (!open || !payload?.productId) return;
    const hasIdle = typeof window !== 'undefined' && 'requestIdleCallback' in window;
    const id = hasIdle
      ? (window as any).requestIdleCallback(() => {
        logUserActivity({
          product_id: Number(payload.productId),
          action_type: 'view',
          category: payload.category
        }, token || undefined).catch(() => { });
      })
      : null;
    const t = id === null
      ? window.setTimeout(() => {
        logUserActivity({
          product_id: Number(payload.productId),
          action_type: 'view',
          category: payload.category
        }, token || undefined).catch(() => { });
      }, 300)
      : null;
    return () => {
      if (id !== null && hasIdle) (window as any).cancelIdleCallback(id);
      if (t !== null) clearTimeout(t);
    };
  }, [open, payload?.productId, payload?.category, token]);


  useEffect(() => {
    if (!open || !token) return;
    // Defer address fetch — user doesn't see the delivery card until they scroll
    const t = setTimeout(() => {
      fetchUserAddresses(token).then(res => {
        const def = res.data.find((a: any) => a.is_default);
        if (def) {
          setStoredAddress({
            recipientName: def.full_name,
            contactNo: def.phone,
            region: `Nigeria, ${def.state}, ${def.city}`,
            address: def.address_line1,
            isDefault: def.is_default,
            latitude: def.latitude,
            longitude: def.longitude,
            address_id: def.address_id
          });
        }
      }).catch(console.error);
    }, 0);
    return () => clearTimeout(t);
  }, [open, token]);

  useEffect(() => {
    async function runEstimation() {
      if (!open || !payload || !businessData?.business) return;

      const vL = businessData.business.latitude !== undefined && businessData.business.latitude !== null ? businessData.business.latitude : (businessData.business as any).lat;
      const vLng = businessData.business.longitude !== undefined && businessData.business.longitude !== null ? businessData.business.longitude : (businessData.business as any).lng;

      const vendorLoc = {
        latitude: vL !== undefined && vL !== null ? Number(vL) : NaN,
        longitude: vLng !== undefined && vLng !== null ? Number(vLng) : NaN,
      };

      let currentCustomerAddress = storedAddress;

      const customerLoc = currentCustomerAddress ? {
        latitude: Number(currentCustomerAddress.latitude || currentCustomerAddress.lat),
        longitude: Number(currentCustomerAddress.longitude || currentCustomerAddress.lng),
      } : null;

      if (isNaN(vendorLoc.latitude) || isNaN(vendorLoc.longitude) || !customerLoc || isNaN(customerLoc.latitude)) {
        console.log("Estimation skipped or invalid coordinates:", { vendorLoc, customerLoc, storedAddress: currentCustomerAddress });
        setEstimation(null);
        return;
      }

      console.log("Running estimation with:", { vendorLoc, customerLoc });
      const result = await import("@/src/lib/deliveryEstimation").then(m => m.estimateDelivery(
        vendorLoc,
        customerLoc,
        effectiveShippingPolicies as any
      ));

      setEstimation(result);
    }
    runEstimation();
  }, [open, payload, businessData, storedAddress, effectiveShippingPolicies]);

  // --- Derived values (safe if payload is null) ---
  const images = useMemo(() => payload?.productImages ?? [], [payload?.productImages]);
  // If selectedIndex is -1, it means the video is selected, so main should be null to let MediaViewer show video
  const main = selectedIndex === -1 ? null : (images[selectedIndex] ?? (images.length > 0 ? images[0] : null));

  const [recommendedProducts, setRecommendedProducts] = useState<ProductFeedItem[]>([]);
  const [loadingRecommended, setLoadingRecommended] = useState(false);

  // Global Recommendations State
  const [globalRecommendations, setGlobalRecommendations] = useState<ProductFeedItem[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalPage, setGlobalPage] = useState(0);
  const [globalHasMore, setGlobalHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [cartClickPos, setCartClickPos] = useState({ x: 0, y: 0 });

  // Extract variant images for "Styles" mode
  const variantEntriesWithImages = useMemo(() => {
    if (!payload?.variantGroups || !Array.isArray(payload.variantGroups)) return [];

    // Per-group awareness: Only include entries from groups where at least one entry has an image
    return payload.variantGroups.flatMap(g => {
      const groupEntries = g.entries || [];
      const hasAnyImage = groupEntries.some((e: any) => e.images && e.images.length > 0);

      // If no entry in this group has an image, we don't show this group in "Styles" mode
      if (!hasAnyImage) return [];

      const firstProductImageUrl = images?.[0]?.url || "";

      return groupEntries.map((e: any) => ({
        ...e,
        groupId: g.id,
        groupTitle: g.title,
        url: e.images?.[0]?.url || (e as any).imagePreviews?.[0] || firstProductImageUrl
      }));
    });
  }, [payload?.variantGroups, images]);

  const hasStyles = variantEntriesWithImages.length > 1;

  useEffect(() => {
    if (!open || !payload?.productId) return;
    // Defer reviews fetch — reviews section is below the fold
    const t = setTimeout(async () => {
      const pId = payload.productId;
      if (!pId) return;
      setLoadingReviews(true);
      try {
        const res = await fetchProductReviews(pId);
        const reviewData = (res as any)?.data?.reviews || (res as any)?.reviews || [];
        setReviews(reviewData);
      } catch (err) {
        console.error("fetchProductReviews error", err);
      } finally {
        setLoadingReviews(false);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [open, payload?.productId]);

  const getRatingStatus = (rating: number) => {
    const r = Math.round(rating);
    if (r >= 5) return "Excellent";
    if (r >= 4) return "Great";
    if (r >= 3) return "Average";
    if (r >= 2) return "Poor";
    return "Dissatisfied";
  };

  const getAverageRating = () => {
    if (reviews.length === 0) return "0.0";
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  };

  const renderStars = (rating: number, size = "w-3 h-3") => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          s <= rating ? (
            <StarIconSolid key={s} className={`${size} text-rose-600`} />
          ) : (
            <StarIcon key={s} className={`${size} text-slate-200`} />
          )
        ))}
      </div>
    );
  };

  useEffect(() => {
    if (!open || !payload?.businessId) return;
    // Defer recommended products — they're at the bottom of the right panel
    const t = setTimeout(async () => {
      setLoadingRecommended(true);
      try {
        const identifier = payload.businessSlug || (payload.businessName ? slugify(payload.businessName) : payload.businessId);
        if (!identifier) return;
        const res = await fetchBusinessProducts(identifier, 6, undefined, payload.productId, token);
        setRecommendedProducts(res?.data?.products || []);
      } catch (err) {
        console.error("Failed to load recommended products:", err);
      } finally {
        setLoadingRecommended(false);
      }
    }, 0);
    return () => clearTimeout(t);
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
      const category = businessData?.business?.business_category || payload?.category;
      const res = await fetchPersonalizedFeed(12, page * 12, token, category);
      const newItems = res?.data || [];

      if (newItems.length < 12) setGlobalHasMore(false);
      setGlobalRecommendations(prev => {
        // filter out current product AND potential duplicates
        const existingIds = new Set(prev.map(p => p.product_id));
        const filtered = newItems.filter((p: any) =>
          p.product_id !== payload.productId && !existingIds.has(p.product_id)
        );
        return [...prev, ...filtered];
      });
      setGlobalPage(page + 1);
    } catch (err) {
      console.error("Failed to load global recommendations:", err);
    } finally {
      setGlobalLoading(false);
    }
  }, [globalLoading, globalHasMore, payload, token, businessData]);

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

    const hasVideo = !!payload?.productVideo?.url;
    if (hasVideo) {
      setViewMode("video");
      setSelectedIndex(-1);
    } else {
      setViewMode("images");
      setSelectedIndex(0);
    }

    if (modalRef.current) modalRef.current.scrollTo(0, 0);
    if (asideScrollRef.current) asideScrollRef.current.scrollTo(0, 0);

    const saved = sessionStorage.getItem(`stoqle_modal_state_${payload.productId}`);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        // We restore options/scroll, but NOT selectedIndex anymore
        if (state.selectedOptions) setSelectedOptions(state.selectedOptions);

        if (typeof state.scrollPos === 'number') {
          setTimeout(() => {
            if (asideScrollRef.current) asideScrollRef.current.scrollTop = state.scrollPos;
          }, 50);
        }
      } catch (e) {
        console.error("Failed to restore modal state", e);
      }
    } else {
      setSelectedOptions({});
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
  // Auto-slide engine: Sequential Discovery Loop (Video -> Images -> Styles -> Loop)
  useEffect(() => {
    if (!open || isPaused || viewMode === "video") return;

    const hasVideo = !!payload?.productVideo?.url;
    const hasImages = images.length > 0;
    const hasStyleList = variantEntriesWithImages.length > 0;

    // Don't slide if only 1 total item across all modes
    const totalMediaCount = (hasVideo ? 1 : 0) + (hasImages ? images.length : 0) + (hasStyleList ? variantEntriesWithImages.length : 0);
    if (totalMediaCount <= 1) return;

    const interval = setInterval(() => {
      if (viewMode === "images") {
        if (selectedIndex < images.length - 1) {
          setSelectedIndex(prev => prev + 1);
        } else {
          // Finished images: go to styles or loop to video
          if (hasStyleList) { setViewMode("styles"); setSelectedIndex(0); }
          else if (hasVideo) { setViewMode("video"); setSelectedIndex(-1); }
          else { setSelectedIndex(0); } // loop images
        }
      }
      else if (viewMode === "styles") {
        if (selectedIndex < variantEntriesWithImages.length - 1) {
          setSelectedIndex(prev => prev + 1);
        } else {
          // Finished styles: back to video or images
          if (hasVideo) { setViewMode("video"); setSelectedIndex(-1); }
          else if (hasImages) { setViewMode("images"); setSelectedIndex(0); }
          else { setSelectedIndex(0); } // loop styles
        }
      }
    }, 3500); // 3.5s interval

    return () => clearInterval(interval);
  }, [open, images.length, variantEntriesWithImages.length, isPaused, selectedIndex, viewMode, payload?.productVideo?.url]);

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

  const promotion = effectivePromotions[0] ?? null;
  const promotionDiscount = parsePercent(promotion?.discount_percent ?? promotion?.discount ?? null);
  const salesDiscount = parsePercent(effectiveSaleDiscounts[0]?.discount_percent ?? effectiveSaleDiscounts[0]?.discount ?? null);

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

  const handleIndexChange = useCallback((idx: number, mode?: "video" | "images" | "styles") => {
    // Auto-expand if clicking an item in the 80% state
    if (isMobile && isFromReel && !isExpanded) {
      setIsExpanded(true);
      onExpand?.();
    }
    const finalMode = mode || viewMode;
    if (mode && mode !== viewMode) setViewMode(mode);
    setSelectedIndex(idx);

    // Auto-select variant if switching to/browsing styles
    if (finalMode === "styles" && variantEntriesWithImages[idx]) {
      const v = variantEntriesWithImages[idx];
      if (selectedOptions[v.groupId] !== v.id) {
        setSelectedOptions((prev) => ({
          ...prev,
          [v.groupId]: v.id,
        }));
      }
    }
  }, [viewMode, variantEntriesWithImages, selectedOptions, isMobile, isFromReel, isExpanded, onExpand]);

  const animateToCart = (startingElement: HTMLElement) => {
    // Priority: Find the cart icon within this modal to avoid background page conflicts (like on the Shop page)
    const cartIcon = modalRef.current?.querySelector("#preview-cart-icon-ref") || document.getElementById("preview-cart-icon-ref");
    if (!cartIcon || !payload) return;

    const startRect = startingElement.getBoundingClientRect();
    const cartRect = cartIcon.getBoundingClientRect();

    const productImg = payload.productImages?.[0]?.url || "/assets/images/favio.png";

    const flyer = document.createElement("div");
    const animId = `fly_${Date.now()}`;
    const style = document.createElement("style");

    // Parabolic arc using transforms for better performance and reliability
    style.innerHTML = `
      @keyframes ${animId} {
        0% {
          transform: translate(${startRect.left}px, ${startRect.top}px) scale(1) rotate(0deg);
          width: ${startRect.width}px;
          height: ${startRect.height}px;
          opacity: 1;
        }
        35% {
          transform: translate(${startRect.left + (cartRect.left - startRect.left) * 0.3}px, ${startRect.top - 250}px) scale(1.2) rotate(-15deg);
          opacity: 1;
        }
        100% {
          transform: translate(${cartRect.left + 10}px, ${cartRect.top + 10}px) scale(0.2) rotate(720deg);
          width: 40px;
          height: 40px;
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);

    flyer.style.position = "fixed";
    flyer.style.top = "0";
    flyer.style.left = "0";
    flyer.style.width = `${startRect.width}px`;
    flyer.style.height = `${startRect.height}px`;
    flyer.style.zIndex = "9999999";
    flyer.style.backgroundImage = `url("${formatUrl(productImg)}")`;
    flyer.style.backgroundColor = "#f43f5e"; // Fallback color
    flyer.style.backgroundSize = "cover";
    flyer.style.backgroundPosition = "center";
    flyer.style.borderRadius = "12px";
    flyer.style.pointerEvents = "none";
    flyer.style.boxShadow = "0 25px 50px -12px rgba(0, 0, 0, 0.5)";
    flyer.style.border = "2px solid white";
    flyer.style.animation = `${animId} 1.2s cubic-bezier(0.215, 0.61, 0.355, 1) forwards`;

    document.body.appendChild(flyer);

    setTimeout(() => {
      flyer.remove();
      style.remove();

      // Impact feedback
      cartIcon.classList.add("scale-115");
      const cartBtn = cartIcon.querySelector('button');
      if (cartBtn) {
        cartBtn.style.color = "#f43f5e";
        cartBtn.style.transform = "translateY(-2px)";
      }

      setTimeout(() => {
        cartIcon.classList.remove("scale-115");
        if (cartBtn) {
          cartBtn.style.color = "";
          cartBtn.style.transform = "";
        }
      }, 500);
    }, 1200);
  };

  const handleAddToCartClick = async (e?: React.MouseEvent) => {
    const startingEl = e?.currentTarget as HTMLElement;
    if (!payload) return;

    // Direct Add to Cart if no variants
    const hasVariants = payload.variantGroups && payload.variantGroups.length > 0;

    if (!hasVariants && Number(payload.quantity || 0) <= 0) {
      toast.error("This product is out of stock!");
      return;
    }

    if (!hasVariants) {
      const loggedIn = await auth.ensureLoggedIn();
      if (!loggedIn) return;

      const currentUserId = user?.user_id || user?.id || user?.id_signup;
      const currentBizId = user?.business_id || user?.business?.business_id || user?.business?.id;
      const productUserId = payload.userId || (payload as any).user_id || businessData?.business?.user_id;
      const productBizId = payload.businessId || (payload as any).business_id || businessData?.business?.business_id;

      if ((currentUserId && productUserId && Number(currentUserId) === Number(productUserId)) ||
        (currentBizId && productBizId && Number(currentBizId) === Number(productBizId))) {
        Swal.fire({
          title: "Not Allowed",
          text: "You cannot purchase your own products.",
          icon: "warning",
          confirmButtonText: "I understand",
          confirmButtonColor: "#f43f5e",
          customClass: {
            container: "!z-[9999999]",
            popup: "rounded-[0.5rem]",
            confirmButton: "rounded-full font-bold px-4 py-2",
          }
        });
        return;
      }

      try {
        await addToCartApi({
          product_id: Number(payload.productId),
          quantity: 1,
        }, token!);

        if (startingEl) {
          animateToCart(startingEl);
        }

        toast.success("Added to cart successfully!");
        window.dispatchEvent(new CustomEvent("cart-updated"));

        // Sync across tabs
        const channel = new BroadcastChannel('stoqle_cart_sync');
        channel.postMessage('update');
        channel.close();

        logUserActivity({ product_id: payload.productId, action_type: 'cart', category: payload.category }, token!);
        return;
      } catch (err: any) {
        toast.error(err?.body?.message || "Failed to add to cart");
        return;
      }
    }

    if (e) setCartClickPos({ x: e.clientX, y: e.clientY });
    else setCartClickPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    setCartActionType("cart");
    setCartModalOpen(true);
  };

  const handleBuyNowClick = (e?: React.MouseEvent) => {
    if (!payload) return;

    if (!payload.hasVariants && Number(payload.quantity || 0) <= 0) {
      toast.error("This product is out of stock!");
      return;
    }

    if (e) setCartClickPos({ x: e.clientX, y: e.clientY });
    else setCartClickPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

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

    // RESTRICT OWNER AT CONFIRMATION
    const currentUserId = user?.user_id || user?.id || user?.id_signup;
    const currentBizId = user?.business_id || (user as any)?.business?.business_id || (user as any)?.business?.id;
    const productUserId = payload.userId || (payload as any).user_id || businessData?.business?.user_id;
    const productBizId = payload.businessId || (payload as any).business_id || businessData?.business?.business_id;

    const isOwnerByAuth = (currentUserId && productUserId && Number(currentUserId) === Number(productUserId)) ||
      (currentBizId && productBizId && Number(currentBizId) === Number(productBizId));

    if (isOwnerByAuth) {
      Swal.fire({
        title: "Not Allowed",
        text: "You cannot purchase your own products.",
        icon: "warning",
        confirmButtonText: "I understand",
        confirmButtonColor: "#f43f5e",
        customClass: {
          container: "!z-[9999999]",
          popup: "rounded-[2rem]",
          confirmButton: "rounded-xl font-bold px-6 py-3",
        }
      });
      setCartModalOpen(false);
      return;
    }

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
    (!(promotion?.start_date || promotion?.start) || new Date(promotion.start_date || promotion.start) <= new Date()) &&
    (!(promotion?.end_date || promotion?.end) || new Date(promotion.end_date || promotion.end) >= new Date());

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

    // Detect if scroll is already locked by a parent modal
    const wasAlreadyLocked = document.body.style.overflow === "hidden";

    if (!wasAlreadyLocked) {
      document.body.style.overflow = "hidden";
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }
    }

    return () => {
      // Only restore if we were the ones who locked it
      if (!wasAlreadyLocked) {
        document.body.style.overflow = "";
        document.body.style.paddingRight = "0";
      }
    };
  }, [open]);

  // countdown for promo (runs only when promotion is active)
  useEffect(() => {
    const promotionEndDate = promotion?.end_date || promotion?.end || null;
    if (!isPromotionActive || !promotionEndDate) {
      setPromoRemaining(null);
      return;
    }

    const pad = (num: number) => String(num).padStart(2, "0");

    const updateCountdown = () => {
      const now = Date.now();
      const endTimestamp = new Date(promotionEndDate).getTime();
      const diff = endTimestamp - now;

      if (diff <= 0) {
        setPromoRemaining("Ended");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      const res = days > 0
        ? `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
        : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

      setPromoRemaining(res);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isPromotionActive, promotion?.end_date, promotion?.end]);

  // Portal-safe: track whether we have a DOM to render into.
  // We use a ref (not useState) to avoid a blank-frame re-render on mount.
  const portalTargetRef = useRef<Element | null>(null);
  if (typeof document !== "undefined" && !portalTargetRef.current) {
    portalTargetRef.current = document.body;
  }

  if (!open || !payload || !portalTargetRef.current) return null;

  const stop = (e: React.MouseEvent | React.TouchEvent) => e.stopPropagation();

  const openPolicyModal = (title: string, body: string, type: "shipping" | "policy" = "policy") => {
    setPolicyModalData({ title, body, type });
    setPolicyModalOpen(true);
  };

  const handlePolicyAddressChange = (addr: any) => {
    setStoredAddress(addr);
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
  return createPortal(
    <>
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed inset-0 flex justify-center px-0 py-0 lg:p-4 ${isMobile && isFromReel ? 'items-end' : 'items-center'}`}
        style={{ zIndex: modalZIndex }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          aria-hidden
        />

        <motion.div
          style={{
            transformOrigin: !isMobile && origin ? `${origin.x}px ${origin.y}px` : "center",
            willChange: "transform, opacity, height",
          }}
          initial={isMobile ? { y: "100%", opacity: 0, height: (isMobile && isFromReel) ? "80%" : "100%" } : { opacity: 0, scale: 0.3, height: "94vh" }}
          animate={
            isMobile
              ? {
                y: 0,
                opacity: 1,
                height: (isMobile && isFromReel) ? (isExpanded ? "100%" : "80%") : "100%"
              }
              : { opacity: 1, scale: 1, height: "94vh" }
          }
          exit={isMobile ? { y: "100%", opacity: 0 } : { opacity: 0, scale: 0.3, height: "94vh" }}
          transition={
            isMobile
              ? (isExpanded
                ? { type: "spring", damping: 30, stiffness: 300 }
                : { type: "tween", duration: 0.15, ease: [0.16, 1, 0.3, 1] })
              : { type: "spring", damping: 25, stiffness: 400, mass: 0.8 }
          }
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className={`relative z-10 w-full lg:w-[96vw] lg:max-w-[1100px] flex flex-col items-center justify-center ${isMobile && isFromReel && !isExpanded ? 'rounded-t-[0.5rem] overflow-hidden' : ''}`}
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
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className={`lg:hidden absolute top-0 inset-x-0 z-[100] transition-all duration-75`}
            style={{
              backgroundColor: `rgba(255, 255, 255, ${appBarOpacity})`,
              boxShadow: appBarOpacity > 0.8 ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none'
            }}
          >
            <div className={`flex items-center px-4 h-14 gap-3 transition-opacity duration-300 ${isFromReel && !isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  if (params.has('product_id')) {
                    router.back();
                  } else {
                    onClose();
                  }
                }}
                aria-label="Back"
                className="h-9 w-9 rounded-full flex items-center justify-center transition-all flex-shrink-0"
                style={{
                  backgroundColor: appBarOpacity > 0.5 ? 'transparent' : 'rgba(0, 0, 0, 0.25)',
                  backdropFilter: appBarOpacity > 0.5 ? 'none' : 'blur(12px)',
                  color: appBarOpacity > 0.5 ? 'rgb(30, 41, 59)' : 'white'
                }}
              >
                <ChevronLeftIcon className="w-6 h-6 stroke-2" />
              </button>

              {/* Centered Search Area with Sliding Background Expansion */}
              <div className="flex-1 flex justify-end items-center h-14 overflow-hidden relative">
                <motion.div
                  onClick={handleSearchTrigger}
                  animate={{
                    width: appBarOpacity >= 0.5 ? "100%" : "36px",
                    backgroundColor: appBarOpacity >= 0.5 ? "rgb(241 245 249)" : "rgba(0, 0, 0, 0.25)",
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="h-9 rounded-full flex items-center cursor-pointer relative overflow-hidden"
                  style={{
                    backdropFilter: appBarOpacity >= 0.5 ? 'none' : 'blur(12px)',
                  }}
                >
                  <div
                    className="flex items-center px-2.5 gap-2 w-full h-full"
                    style={{
                      justifyContent: appBarOpacity >= 0.5 ? 'flex-start' : 'center'
                    }}
                  >
                    <MagnifyingGlassIcon
                      className={`transition-all duration-300 flex-shrink-0 ${appBarOpacity >= 0.5 ? "w-4 h-4 text-slate-400" : "w-5 h-5 text-white"
                        }`}
                    />

                    {appBarOpacity >= 0.5 && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-slate-400 text-sm truncate whitespace-nowrap"
                      >
                        Search stoqle...
                      </motion.span>
                    )}
                  </div>
                </motion.div>
              </div>

              <div className="flex items-center flex-shrink-0 rounded-full" style={{
                backgroundColor: appBarOpacity > 0.5 ? 'transparent' : 'rgba(0, 0, 0, 0.25)',
                backdropFilter: appBarOpacity > 0.5 ? 'none' : 'blur(12px)',
                color: appBarOpacity > 0.5 ? 'rgb(30, 41, 59)' : 'white'
              }}>
                <SmartShareButton
                  productId={payload?.productId ?? 0}
                  title={payload?.title}
                  token={token}
                  variant="icon"
                  zIndex={modalZIndex + 1}
                />
              </div>
            </div>

            {appBarOpacity > 0.8 && (
              <div
                className="flex items-center px-2 overflow-x-auto no-scrollbar pb-1 animate-in fade-in slide-in-from-top-2 duration-500"
                style={{ opacity: (appBarOpacity - 0.8) * 5 }}
              >

                <div className="flex items-center">
                  {["Overview", "Reviews", "Details", "Explore"].map((tab) => {
                    const id = tab.toLowerCase();
                    const active = activeTab === id;
                    return (
                      <button
                        key={tab}
                        onClick={() => scrollToSection(id)}
                        className={`flex-shrink-0 px-4 py-3 text-xs font-bold transition-all relative ${active ? "text-slate-900" : "text-slate-500"
                          }`}
                      >
                        {tab}
                        {active && (
                          <motion.div
                            layoutId="activeTabUnderline"
                            className="absolute bottom-0 left-4 right-4 h-0.5 bg-rose-500 rounded-full"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div
            ref={modalRef}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className={`relative w-full h-full bg-slate-100 flex flex-col overflow-y-auto lg:flex lg:flex-row lg:w-full lg:h-full lg:rounded-2xl shadow-2xl ${isMobile && isFromReel && !isExpanded ? 'rounded-t-[0.5rem]' : ''}`}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {/* Mobile Drag Handle Indicator for 80% mode */}
            {isMobile && isFromReel && !isExpanded && (
              <div className="flex-shrink-0 pt-3 pb-1 bg-white">
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" />
              </div>
            )}

            {/* LEFT: media */}
            <div
              id="overview"
              ref={sectionRefs.overview}
              className="w-full lg:flex-1 lg:h-full flex flex-col bg-slate-100"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              <MediaViewer
                main={viewMode === "images" ? (images[selectedIndex] || null) : viewMode === "styles" ? (variantEntriesWithImages[selectedIndex] || null) : null}
                payload={payload}
                images={images}
                variantImages={variantEntriesWithImages}
                selectedIndex={selectedIndex}
                viewMode={viewMode}
                onIndexChange={handleIndexChange}
                isFromReel={isFromReel}
                isExpanded={isExpanded}
              />
            </div>

            {/* RIGHT: details */}
            <aside className="w-full lg:w-[380px] border-l border-slate-100 flex flex-col">
              {variantEntriesWithImages.length > 0 && (
                <div className="px-4 bg-white">
                  <div className="flex gap-1 lg:flex-row overflow-auto p-1">
                    <ThumbnailList
                      payload={payload}
                      images={images}
                      variantImages={variantEntriesWithImages}
                      selectedIndex={selectedIndex}
                      viewMode={viewMode}
                      onIndexChange={handleIndexChange}
                      onAllStyles={() => handleAddToCartClick()}
                    />
                  </div>
                </div>
              )}

              <div
                ref={asideScrollRef}
                className="flex-1 lg:overflow-auto pb-24 lg:pb-0"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="bg-white p-4">


                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-rose-600">
                        <span className="text-base mr-0.5">₦</span>
                        {basePrice !== null ? basePrice.toLocaleString() : "—"}
                      </span>
                      {(isPromotionActive || isSalesActive) && discountedPrice !== null && (
                        <div className="text-xs bg-rose-500 py-1 px-2 text-white rounded-full font-bold whitespace-nowrap">
                          Discounted price ₦{discountedPrice.toLocaleString()}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-400 font-medium">
                        {(() => {
                          const sCount = Number(payload.soldCount || (payload as any).total_sold || (payload as any).sold_count || 0);
                          return sCount > 0 ? `${sCount.toLocaleString()}+ Sold` : "0 Sold";
                        })()}
                      </div>
                    </div>
                  </div>
                  {isPromotionActive ? (
                    <div className="flex flex-col gap-1 mb-3">
                      <div className="flex items-center justify-between rounded-sm bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600 w-full">
                        <span>{promotion?.title ?? promotion?.occasion ?? "Promotion"} · {promotionDiscount}% Off</span>
                        {promoRemaining && <div className="text-[10px] border-[0.5px] border-rose-500 px-1.5 py-0.5 text-rose-500 rounded-sm">Ends in {promoRemaining}</div>}
                      </div>
                    </div>
                  ) : isSalesActive ? (
                    <div className="flex flex-col gap-1 mb-3">
                      <div className="flex items-center justify-between rounded-sm border-rose-500 border-[0.5px] px-2 py-1 text-xs text-rose-500 w-full">
                        <span>{effectiveSaleDiscounts[0]?.discount_type ?? effectiveSaleDiscounts[0]?.type ?? "Sale"} · {salesDiscount}% Off</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-start gap-3 ">
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-full">
                        <div className="text-lg font-semibold text-slate-900 mb-1">
                          {payload.title || "Product details"}
                        </div>

                        {businessData?.policy?.market_affiliation?.trusted_partner === 1 && (
                          <div className="mb-2 inline-flex">
                            <VerifiedBadge size="sm" label="Verified Partner" showLabel />
                          </div>
                        )}

                        <div className="text-sm font-bold text-slate-900">Description</div>
                        {isFetching && !payload.description ? (
                          <div className="space-y-2 mt-2">
                            <div className="h-3.5 bg-slate-100 animate-pulse rounded-md w-full"></div>
                            <div className="h-3.5 bg-slate-100 animate-pulse rounded-md w-5/6"></div>
                            <div className="h-3.5 bg-slate-100 animate-pulse rounded-md w-2/3"></div>
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{payload.description}</div>
                        )}
                      </div>
                    </div>
                  </div>



                  {effectiveReturnPolicy?.return_shipping_subsidy === 1 && (
                    <div
                      className="inline-flex items-center gap-1.5 font-bold rounded-sm text-sm p-2 text-emerald-700 bg-emerald-50 cursor-pointer hover:bg-emerald-100 transition-colors"
                      onClick={() => setIsSubsidyModalOpen(true)}
                    >
                      Return shipping subsidy
                      <Info className="w-3.5 h-3.5" />
                    </div>
                  )}

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
                  <div>
                    {isFetching && payload.hasVariants && (!payload.variantGroups || payload.variantGroups.length === 0) && (
                      <div className="mt-2 space-y-4">
                        <div className="h-4 bg-slate-100 animate-pulse rounded w-24"></div>
                        <div className="flex gap-2">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="w-12 h-8 bg-slate-100 animate-pulse rounded-md"></div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>


                {/* Reviews */}
                <div id="reviews" ref={sectionRefs.reviews} className="bg-white p-4 mt-2">
                  <div
                    className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50 cursor-pointer active:opacity-60 transition-opacity"
                    onClick={() => reviews.length > 0 && setIsReviewsModalOpen(true)}
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="text-[14px] font-bold text-slate-800">Reviews</h4>
                      <span className="text-xs text-slate-400 font-medium">({reviews.length})</span>
                    </div>
                    {reviews.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-rose-500"> {getRatingStatus(Number(getAverageRating()))} {getAverageRating()}</span>
                        <ChevronRightIcon className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                  </div>

                  {loadingReviews ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-rose-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-400">Loading reviews...</span>
                    </div>
                  ) : reviews.length === 0 ? (
                    <div className="py-2 text-center">
                      <p className="text-sm text-slate-400">No reviews for this product yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {reviews.slice(0, 2).map((review) => (
                        <div key={review.review_id} className="group" >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-5 h-5 rounded-full overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(review.username ? `/${review.username}` : `/user/profile/${review.user_id}`);
                                }}
                              >
                                <img
                                  src={formatUrl(review.profile_pic || "")}
                                  alt={review.full_name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <div
                                  className="text-[12px] text-slate-500 truncate cursor-pointer hover:text-rose-500 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(review.username ? `/${review.username}` : `/user/profile/${review.user_id}`);
                                  }}
                                >
                                  {review.full_name}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">

                                  <span className="text-[10px] bg-rose-100 text-rose-500 px-1 rounded tracking-tight">
                                    {getRatingStatus(review.rating)}
                                  </span>
                                  {renderStars(review.rating, "w-2.5 h-2.5")}
                                </div>
                              </div>
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              {new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </div>
                          <p className="text-[13px] text-slate-600 leading-relaxed pl-[45px] cursor-pointer active:opacity-60 transition-opacity" onClick={() => reviews.length > 0 && setIsReviewsModalOpen(true)}>
                            {review.comment}
                          </p>
                        </div>
                      ))}

                    </div>
                  )}

                </div>

                <div className="bg-white p-5 mt-2">
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        if (onShopClick) {
                          onShopClick();
                          return;
                        }
                        const handle = businessData?.business?.business_slug || businessData?.business?.user_id;
                        const productIdParam = payload?.productId ? `?product_id=${payload.productId}` : "";
                        if (handle) router.push(`/${handle}${productIdParam}`);
                        else if (businessData?.business?.user_id) router.push(`/user/profile/${businessData.business.user_id}${productIdParam}`);
                      }}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-300 flex items-center justify-center flex-shrink-0">
                        <img
                          src={businessData?.business?.business_logo || businessData?.business?.logo || businessData?.business?.profile_pic || payload?.businessLogo || payload?.vendorAvatar || "/assets/images/favio.png"}
                          alt="Shop Logo"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="leading-tight min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 text-[clamp(10px,3.5vw,12px)] whitespace-nowrap overflow-hidden">
                          {businessData?.business?.business_name ?? businessData?.business?.full_name ?? payload?.businessName ?? ""}
                        </div>

                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((star) => {
                              const rating = Number(vendorStats?.avg_rating || 0);
                              return (
                                <StarIconSolid
                                  key={star}
                                  className={`w-2.5 h-2.5 ${star <= rating ? "text-rose-500" : "text-slate-200"}`}
                                />
                              );
                            })}
                          </div>
                          <span className="text-[10px] font-bold text-slate-700">{vendorStats?.avg_rating || "0.0"}</span>
                          <span className="text-[10px] text-slate-400">({vendorStats?.total_reviews?.toLocaleString() || "0"} reviews)</span>
                        </div>

                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          <span className="font-medium text-slate-700">{vendorStats?.followers?.toLocaleString() ?? "0"}</span>+ Followers
                          <span className="mx-1">•</span>
                          <span className="font-medium text-slate-700">{vendorStats?.total_sold?.toLocaleString() ?? "0"}</span>+ Sold
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onShopClick) {
                          onShopClick();
                          return;
                        }
                        const slug = payload?.businessSlug || (payload?.businessName ? slugify(payload.businessName) : payload?.businessId);
                        if (slug) {
                          onClose();
                          router.push(`/shop/${slug}`);
                        }
                      }}
                      className="flex-shrink-0 whitespace-nowrap bg-rose-500 px-4 py-1.5 rounded-full text-xs text-white hover:bg-rose-600 transition"
                    >
                      Visit shop
                    </button>
                  </div>

                  <div className="flex items-center gap-2 py-1 mt-4 border-y border-slate-50  overflow-x-auto no-scrollbar rounded px-2 bg-slate-100">
                    <div className="flex-1 min-w-[30%] text-center">
                      <div className="text-[10px] text-slate-400  mb-2">Item Quality</div>
                      <div className="text-[10px] font-bold text-slate-500">{vendorStats?.positive_percent || 100}% Positive</div>
                    </div>
                    <div className="flex-1 min-w-[35%] text-center border-x border-slate-200 px-4">
                      <div className="text-[10px] text-slate-400  mb-2">Shipping Service</div>
                      <div className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                        Ships in {avgShipping ? `${avgShipping.value} ${avgShipping.unit}` : "Fast Delivery"}
                      </div>
                    </div>
                    <div className="flex-1 min-w-[30%] text-center">
                      <div className="text-[10px] text-slate-400 mb-2 ">Customer Service</div>
                      <div className="text-[10px] font-bold text-slate-500">
                        Reply {customerService?.reply_time || " 2 minutes"}
                      </div>
                    </div>
                  </div>

                  {recommendedProducts.length > 0 && (
                    <>
                      <div className="mt-6 flex items-center justify-between mb-4 pb-2" onClick={() => {
                        const slug = payload.businessSlug || (payload.businessName ? slugify(payload.businessName) : null);
                        if (slug) {
                          router.push(`/shop/${slug}${payload.productId ? `?product_id=${payload.productId}` : ''}`);
                        }
                      }}>
                        <h4 className="text-[13px] font-bold text-slate-600">Shop Recommendations</h4>

                        <ChevronRightIcon className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {recommendedProducts.map((p) => {
                          const price = p.price || 0;
                          const isPromoActive = !!(p.promo_title && p.promo_discount && (!p.promo_end || new Date(p.promo_end) >= new Date()));

                          return (
                            <div key={p.product_id} className="group cursor-pointer" onClick={() => {
                              // Only open reels if it's a social video with a linked product; otherwise stay in preview
                              if (p.product_video && (p as any).linked_product) {
                                saveModalState();
                                if (onReelsClick) onReelsClick(p.product_id, businessData?.business?.business_name, null, businessData?.business?.business_slug, p.slug);
                                else {
                                  const bizName = businessData?.business?.business_name || "store";
                                  const bizSlug = businessData?.business?.business_slug || slugify(bizName);
                                  const prodSlug = p.slug;
                                  router.push(`/market/${bizSlug}${prodSlug ? `/${prodSlug}` : ''}?product_id=${p.product_id}&reels=true`);
                                }
                              } else if (onProductClick) {
                                onProductClick(p.product_id, businessData?.business?.business_name, null, businessData?.business?.business_slug, false, p.slug);
                              }
                            }}>
                              <div className="aspect-square bg-slate-50 rounded-xl overflow-hidden mb-2 relative border border-slate-50 group-hover:border-rose-100 transition-colors">
                                {p.first_image ? <img src={formatUrl(p.first_image)} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-300">No Image</div>}
                                {p.product_video && (
                                  <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md rounded-full p-1.5 z-10 shadow-lg border border-white/20">
                                    <svg className="w-3 h-3 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z" /></svg>
                                  </div>
                                )}
                              </div>
                              <div className="text-[10px] font-semibold text-slate-700 line-clamp-1 mb-1 leading-tight group-hover:text-rose-600 transition-colors">{p.title}</div>

                              {isPromoActive ? (
                                <div className="text-[8px] font-bold text-rose-500 border-rose-500 border-[0.5px] px-1 w-fit mb-1  tracking-tighter leading-tight">
                                  {p.promo_title} {p.promo_discount}% OFF
                                </div>
                              ) : p.sale_type ? (
                                <div className="text-[8px] font-bold text-rose-500 border-rose-500 border-[0.5px] px-1 w-fit mb-1  tracking-tighter leading-tight">
                                  {p.sale_type} {p.sale_discount}% OFF
                                </div>
                              ) : null}

                              <div className="text-[11px] font-bold text-slate-900">₦{Number(price).toLocaleString()}</div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>


                {/* Details Section (Parameters + Images) */}
                <div id="details" ref={sectionRefs.details} className="space-y-2 mt-2">
                  {payload.params.length > 0 && (
                    <div className="bg-white p-4">
                      <div className="flex items-center justify-between mb-4 pb-2">
                        <h4 className="text-[13px] font-bold text-slate-600">Product Parameters</h4>
                      </div>
                      <div className="space-y-1">
                        {payload.params.map((p, i) => (
                          <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
                            <div className="w-24 text-[10px]  tracking-wide text-slate-500 flex-shrink-0">
                              {p.key}
                            </div>
                            <div className="text-xs font-medium text-slate-900">
                              {p.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {payload.productImages?.length > 0 && (
                    <div className="bg-white p-4">
                      <div className="flex items-center justify-between mb-4 pb-2">
                        <h4 className="text-[13px] font-bold text-slate-600">Product Images</h4>
                      </div>
                      <div className="">
                        {payload.productImages.map((img, index) => {
                          if (!img?.url) return null;
                          return (
                            <div key={index} className="w-full flex justify-center bg-slate-50  overflow-hidden">
                              <img src={img.url} alt={img.name ?? `${payload.title} image ${index + 1}`} className="w-full h-auto object-contain" loading="lazy" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Explore Section (Shop Recommendation + Business Info + You Might Also Like) */}
                <div id="explore" ref={sectionRefs.explore} className="space-y-2 mt-2">



                  {/* You Might Also Like this */}
                  <div className="bg-white p-5">

                    <div className="flex items-center justify-center mb-4 border-b border-slate-50 pb-2">
                      <h4 className="text-[12px] font-bold text-slate-400 text-center">- You may also like -</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {globalRecommendations.map((p) => {
                        const price = p.price || 0;
                        const isPromoActive = !!(p.promo_title && p.promo_discount && (!p.promo_end || new Date(p.promo_end) >= new Date()));

                        return (
                          <div key={p.product_id} className="group cursor-pointer" onClick={() => {
                            // Only open reels if it's a social video with a linked product; otherwise stay in preview
                            if (p.product_video && (p as any).linked_product) {
                              saveModalState();
                              if (onReelsClick) onReelsClick(p.product_id, p.business_name, null, p.business_slug, p.slug);
                              else {
                                const bizSlug = p.business_slug || slugify(p.business_name || "store");
                                const prodSlug = p.slug;
                                router.push(`/market/${bizSlug}${prodSlug ? `/${prodSlug}` : ''}?product_id=${p.product_id}&reels=true`);
                              }
                            } else if (onProductClick) {
                              onProductClick(p.product_id, p.business_name, null, p.business_slug, false, p.slug);
                            }
                          }}>
                            <div className="aspect-square bg-slate-50 rounded-xl overflow-hidden mb-2 relative border border-slate-50 group-hover:border-rose-100 transition-colors">
                              {p.first_image ? <img src={formatUrl(p.first_image)} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-300">No Image</div>}
                              {p.product_video && (
                                <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md rounded-full p-1.5 z-10 shadow-lg border border-white/20">
                                  <svg className="w-3 h-3 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z" /></svg>
                                </div>
                              )}
                              {!p.product_video && (
                                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-white/80 backdrop-blur rounded text-[8px] font-bold text-slate-900 border border-slate-200 truncate max-w-[80%]  tracking-tighter shadow-sm">{p.business_name}</div>
                              )}
                            </div>

                            {p.product_video && (
                              <div className="flex items-center gap-1.5 mb-1 px-0.5">
                                <div className="h-4 w-4 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                                  <img
                                    src={formatUrl(p.logo || p.profile_pic || "")}
                                    alt="Vendor"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <span className="truncate text-[9px] font-bold text-slate-500  tracking-tight">
                                  {p.business_name}
                                </span>
                              </div>
                            )}

                            <div className="text-[10px] font-semibold text-slate-700 line-clamp-1 mb-1 leading-tight group-hover:text-rose-600 transition-colors">{p.title}</div>

                            {isPromoActive ? (
                              <div className="text-[8px] font-bold text-rose-500 border-rose-500 border-[0.5px] px-1 w-fit mb-1  tracking-tighter leading-tight">
                                {p.promo_title} {p.promo_discount}% OFF
                              </div>
                            ) : p.sale_type ? (
                              <div className="text-[8px] font-bold text-rose-500 border-rose-500 border-[0.5px] px-1 w-fit mb-1 tracking-tighter leading-tight">
                                {p.sale_type} {p.sale_discount}% OFF
                              </div>
                            ) : null}

                            <div className="text-[11px] font-bold text-slate-900">₦{Number(price).toLocaleString()}</div>
                          </div>
                        );
                      })}
                    </div>
                    {globalHasMore && (
                      <div ref={loaderRef} className="py-8 flex justify-center">
                        <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    {!globalHasMore && globalRecommendations.length > 0 && (
                      <div className="py-8 text-center text-[10px] text-slate-400 font-medium tracking-widest">- The End -</div>
                    )}
                  </div>
                </div>


              </div>

              <ActionBar
                onAddToCart={handleAddToCartClick}
                onBuyNow={handleBuyNowClick}
                onOpenChat={handleOpenChatInternal}
                onCartClick={onCartClick}
                onShopClick={onShopClick}
                cartCount={cartCount}
                productId={payload?.productId}
                shopLogo={businessData?.business?.logo}
                shopProfilePic={businessData?.business?.profile_pic}
                businessId={payload?.businessId}
                businessSlug={payload?.businessSlug}
                businessName={payload?.businessName}
                quantity={payload?.quantity}
                hasVariants={payload?.hasVariants}
              />
            </aside>
          </div>
        </motion.div>
      </div>

      {policyModalData?.type === "shipping" ? (
        <ShippingModal
          key="shipping-modal"
          open={policyModalOpen}
          title={policyModalData?.title ?? null}
          body={policyModalData?.body ?? null}
          deliveryNotice={businessData?.policy?.core?.delivery_notice}
          estimateDuration={displayAvgDuration}
          onClose={closePolicyModal}
          onAddressChange={handlePolicyAddressChange}
        />
      ) : (
        <PolicyModal
          key="policy-modal"
          open={policyModalOpen}
          title={policyModalData?.title ?? null}
          body={policyModalData?.body ?? null}
          onClose={closePolicyModal}
        />
      )}
      <AddToCartModal
        key="add-to-cart-modal"
        open={cartModalOpen}
        payload={payload}
        businessData={businessData}
        actionType={cartActionType}
        onClose={() => setCartModalOpen(false)}
        onConfirm={handleCartConfirm}
        initialSelectedOptions={selectedOptions}
        storedAddress={storedAddress}
        onAddressChange={setStoredAddress}
        origin={cartClickPos}
      />
      <ReviewListModal
        key="review-list-modal"
        open={isReviewsModalOpen}
        onClose={() => setIsReviewsModalOpen(false)}
        reviews={reviews}
        businessData={businessData}
        payload={payload}
        onAddToCart={handleAddToCartClick}
        onBuyNow={handleBuyNowClick}
        onOpenChat={onOpenChat}
        onCartClick={onCartClick}
        onShopClick={onShopClick}
        cartCount={cartCount}
      />

      <SearchModal
        key="search-modal"
        isOpen={isSearchOpen}
        onClose={() => {
          setIsSearchOpen(false);
          setSearchQuery("");
        }}
        initialQuery={searchQuery}
        onSearch={(q) => {
          setSearchQuery(q);
          setIsSearchOpen(false);
          setShowResultsModal(true);
        }}
      />

      <SearchResultsModal
        key="search-results-modal"
        isOpen={showResultsModal}
        onClose={() => {
          setShowResultsModal(false);
          setSearchQuery("");
        }}
        onSearchClick={() => {
          setShowResultsModal(false);
          setIsSearchOpen(true);
        }}
        initialQuery={searchQuery}
      />

      <ReturnShippingSubsidyModal
        open={isSubsidyModalOpen}
        onClose={() => setIsSubsidyModalOpen(false)}
      />
    </>,
    document.body
  );
}
