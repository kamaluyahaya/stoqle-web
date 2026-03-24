"use client";

import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { PreviewPayload } from "@/src/types/product";
import { ChevronLeftIcon, ChevronRightIcon, MagnifyingGlassIcon, ShareIcon, ClockIcon, ArrowPathIcon, XMarkIcon, ArrowUpOnSquareIcon, StarIcon } from "@heroicons/react/24/outline";
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
import AddToCartModal from "./addToCartModal";
import ReviewListModal from "./reviewListModal";
import { ProductFeedItem } from "@/src/types/product";
import { API_BASE_URL } from "@/src/lib/config";
import { fetchBusinessProducts, fetchMarketFeed, fetchPersonalizedFeed } from "@/src/lib/api/productApi";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { fetchUserAddresses, UserAddress } from "@/src/lib/api/addressApi";
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
  onReelsClick?: (productId: number, businessName?: string) => void;
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

  const policy = businessData?.policy ?? null;

  const effectiveReturnPolicy = useMemo(() => {
    if (payload?.policyOverrides && !payload.policyOverrides.useStoreDefaultReturn) {
      const over = payload.policyOverrides.returnPolicy;
      return {
        seven_day_no_reason: (over?.['7dayNoReasonReturn'] || over?.sevenDayNoReasonReturn) ? 1 : 0,
        rapid_refund: over?.rapidRefund ? 1 : 0,
        return_shipping_subsidy: over?.returnShippingSubsidy ? 1 : 0,
        return_window: over?.returnWindow ?? 3
      };
    }
    return policy?.returns ?? {};
  }, [payload?.policyOverrides, policy]);

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

  const avgShipping = useMemo(() => effectiveShippingPolicies.find(s => (s as any).kind === 'avg'), [effectiveShippingPolicies]);
  const customerService = useMemo(() => businessData?.policy?.customer_service, [businessData]);
  const vendorStats = useMemo(() => businessData?.business?.stats, [businessData]);

  const [appBarOpacity, setAppBarOpacity] = useState(0);
  const [showAppBar, setShowAppBar] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);

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
    if (!open || !token) return;

    // Try to get default address from DB
    fetchUserAddresses(token).then(res => {
      const def = res.data.find((a: any) => a.is_default);
      if (def) {
        const mapped = {
          recipientName: def.full_name,
          contactNo: def.phone,
          region: `Nigeria, ${def.state}, ${def.city}`,
          address: def.address_line1,
          isDefault: def.is_default,
          latitude: def.latitude,
          longitude: def.longitude,
          address_id: def.address_id
        };
        setStoredAddress(mapped);
      }
    }).catch(console.error);
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
  const [recommendedProducts, setRecommendedProducts] = useState<ProductFeedItem[]>([]);
  const [loadingRecommended, setLoadingRecommended] = useState(false);

  // Global Recommendations State
  const [globalRecommendations, setGlobalRecommendations] = useState<ProductFeedItem[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalPage, setGlobalPage] = useState(0);
  const [globalHasMore, setGlobalHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [cartClickPos, setCartClickPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!open || !payload?.productId) return;

    const getReviews = async () => {
      const pId = payload.productId;
      if (!pId) return;

      setLoadingReviews(true);
      try {
        const res = await fetchProductReviews(pId);
        // Correctly handle the nested 'data' property from standard API responses
        const reviewData = (res as any)?.data?.reviews || (res as any)?.reviews || [];
        setReviews(reviewData);
      } catch (err) {
        console.error("fetchProductReviews error", err);
      } finally {
        setLoadingReviews(false);
      }
    };
    getReviews();
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
            <StarIconSolid key={s} className={`${size} text-red-600`} />
          ) : (
            <StarIcon key={s} className={`${size} text-slate-200`} />
          )
        ))}
      </div>
    );
  };

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

    // Force a reset to the first image (index 0) whenever the modal opens
    // This ensures we always start with the cover image as requested.
    // Force a specific start position: 0 (the Cover Image)
    // We ignore any saved index to satisfy the "start at cover" requirement
    setSelectedIndex(0);

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

  // Handlers for AddToCartModal
  const handleAddToCartClick = (e?: React.MouseEvent) => {
    if (!payload) return;

    if (e) setCartClickPos({ x: e.clientX, y: e.clientY });
    else setCartClickPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    // Check if vendor is trying to buy their own product
    const currentUserId = user?.user_id || user?.id || user?.id_signup;
    const currentBizId = user?.business_id || (user as any)?.business?.business_id || (user as any)?.business?.id;

    const productUserId = payload.userId || (payload as any).user_id || businessData?.business?.user_id;
    const productBizId = payload.businessId || (payload as any).business_id || businessData?.business?.business_id;

    const isOwner = (currentUserId && productUserId && Number(currentUserId) === Number(productUserId)) ||
      (currentBizId && productBizId && Number(currentBizId) === Number(productBizId));

    if (isOwner) {
      Swal.fire({
        title: "Not Allowed",
        text: "You cannot purchase your own products.",
        icon: "warning",
        confirmButtonText: "I understand",
        confirmButtonColor: "#f43f5e",
        customClass: {
          popup: "rounded-[2rem]",
          confirmButton: "rounded-xl font-bold px-6 py-3",
        }
      });
      return;
    }

    setCartActionType("cart");
    setCartModalOpen(true);
  };

  const handleBuyNowClick = (e?: React.MouseEvent) => {
    if (!payload) return;

    if (e) setCartClickPos({ x: e.clientX, y: e.clientY });
    else setCartClickPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    // Check if vendor is trying to buy their own product
    const currentUserId = user?.user_id || user?.id || user?.id_signup;
    const currentBizId = user?.business_id || (user as any)?.business?.business_id || (user as any)?.business?.id;

    const productUserId = payload.userId || (payload as any).user_id || businessData?.business?.user_id;
    const productBizId = payload.businessId || (payload as any).business_id || businessData?.business?.business_id;

    const isOwner = (currentUserId && productUserId && Number(currentUserId) === Number(productUserId)) ||
      (currentBizId && productBizId && Number(currentBizId) === Number(productBizId));

    if (isOwner) {
      Swal.fire({
        title: "Not Allowed",
        text: "You cannot purchase your own products.",
        icon: "warning",
        confirmButtonText: "I understand",
        confirmButtonColor: "#f43f5e",
        customClass: {
          popup: "rounded-[2rem]",
          confirmButton: "rounded-xl font-bold px-6 py-3",
        }
      });
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
          style={{
            transformOrigin: origin ? `${origin.x}px ${origin.y}px` : "center"
          }}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.3 }}
          transition={{
            type: "spring",
            damping: 30,
            stiffness: 300
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
            className="relative w-full h-full bg-slate-100 flex flex-col overflow-y-auto lg:flex lg:flex-row lg:w-full lg:h-full lg:rounded-2xl shadow-2xl"
            style={{ WebkitOverflowScrolling: "touch" }}
          >


            <div
              className={`lg:hidden fixed top-0 inset-x-0 z-[100] transition-all duration-75`}
              style={{
                backgroundColor: `rgba(255, 255, 255, ${appBarOpacity})`,
                boxShadow: 'none'
              }}
            >
              <div className="flex items-center px-4 h-14 gap-3">
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={onClose}
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

                <div className="flex items-center flex-shrink-0">
                  <button
                    className="h-9 w-9 rounded-full flex items-center justify-center transition-all flex-shrink-0"
                    style={{
                      backgroundColor: appBarOpacity > 0.5 ? 'transparent' : 'rgba(0, 0, 0, 0.25)',
                      backdropFilter: appBarOpacity > 0.5 ? 'none' : 'blur(12px)',
                      color: appBarOpacity > 0.5 ? 'rgb(30, 41, 59)' : 'white'
                    }}
                  >
                    <ArrowUpOnSquareIcon className="w-5 h-5" />
                  </button>
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
                              className="absolute bottom-0 left-4 right-4 h-0.5 bg-red-500 rounded-full"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* LEFT: media */}
            <div id="overview" ref={sectionRefs.overview} className="w-full lg:flex-1 lg:h-full flex flex-col bg-slate-100">
              <MediaViewer
                main={main}
                payload={payload}
                images={images}
                selectedIndex={selectedIndex}
                onIndexChange={setSelectedIndex}
              />
            </div>

            {/* RIGHT: details */}
            <aside className="w-full lg:w-[380px] border-l border-slate-100 flex flex-col">
              <div className="px-4 bg-white">
                <div className="flex gap-1 lg:flex-row overflow-auto p-1">
                  <ThumbnailList images={images} video={payload.productVideo} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
                </div>
              </div>

              <div
                ref={asideScrollRef}
                className="flex-1 lg:overflow-auto pb-24 lg:pb-0"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="bg-white p-4">


                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-red-600">
                        <span className="text-base mr-0.5">₦</span>
                        {basePrice !== null ? basePrice.toLocaleString() : "—"}
                      </span>
                      {(isPromotionActive || isSalesActive) && discountedPrice !== null && (
                        <div className="text-xs bg-red-500 py-1 px-2 text-white rounded-full font-bold whitespace-nowrap">
                          Discounted price ₦{discountedPrice.toLocaleString()}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-400 font-medium">
                        {payload.soldCount && payload.soldCount > 0
                          ? `${payload.soldCount.toLocaleString()}+ Sold`
                          : "0 Sold"}
                      </div>
                    </div>
                  </div>
                  {isPromotionActive ? (
                    <div className="flex flex-col gap-1 mb-3">
                      <div className="flex items-center justify-between rounded-sm bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 w-full">
                        <span>{promotion?.title ?? promotion?.occasion ?? "Promotion"} · {promotionDiscount}% Off</span>
                        {promoRemaining && <div className="text-[10px] border-[0.5px] border-red-500 px-1.5 py-0.5 text-red-500 rounded-sm">Ends in {promoRemaining}</div>}
                      </div>
                    </div>
                  ) : isSalesActive ? (
                    <div className="flex flex-col gap-1 mb-3">
                      <div className="flex items-center justify-between rounded-sm border-red-500 border-[0.5px] px-2 py-1 text-xs text-red-500 w-full">
                        <span>{effectiveSaleDiscounts[0]?.discount_type ?? effectiveSaleDiscounts[0]?.type ?? "Sale"} · {salesDiscount}% Off</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-start gap-3 ">
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-full">
                        <div className="text-lg font-semibold text-slate-900">
                          {businessData?.policy?.market_affiliation?.trusted_partner === 1 && (
                            <span className="bg-emerald-700 text-white text-xs px-2 py-1 rounded-sm align-center mr-2">
                              Verified Partner
                            </span>
                          )}
                          {payload.title || "Untitled product"}
                        </div>


                        <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{payload.description}</div>
                      </div>
                    </div>
                  </div>



                  {effectiveReturnPolicy?.return_shipping_subsidy === 1 && (
                    <div className="inline-block font-bold rounded-sm text-sm p-2 text-emerald-700 bg-emerald-50">
                      Return shipping subsidy
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
                        <span className="text-sm text-red-500"> {getRatingStatus(Number(getAverageRating()))} {getAverageRating()}</span>
                        <ChevronRightIcon className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                  </div>

                  {loadingReviews ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-red-500 border-t-transparent rounded-full animate-spin" />
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
                                  router.push(`/user/profile/${review.user_id}`);
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
                                  className="text-[12px] text-slate-500 truncate cursor-pointer hover:text-red-500 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/user/profile/${review.user_id}`);
                                  }}
                                >
                                  {review.full_name}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">

                                  <span className="text-[10px] bg-red-100 text-red-500 px-1 rounded tracking-tight">
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

                {recommendedProducts.length > 0 && (
                  <div className="bg-white p-5 mt-2">
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
                          <div className="font-semibold text-slate-900 text-[clamp(10px,3.5vw,12px)] whitespace-nowrap overflow-hidden">
                            {businessData?.business?.business_name ?? businessData?.business?.full_name ?? ""}
                          </div>

                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="flex items-center">
                              {[1, 2, 3, 4, 5].map((star) => {
                                const rating = Number(vendorStats?.avg_rating || 0);
                                return (
                                  <StarIconSolid
                                    key={star}
                                    className={`w-2.5 h-2.5 ${star <= rating ? "text-red-500" : "text-slate-200"}`}
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
                        onClick={() => {
                          router.push(`/shop/${payload.businessId}`);
                          onClose();
                        }}
                        className="flex-shrink-0 whitespace-nowrap bg-red-500 px-4 py-1.5 rounded-full text-xs text-white hover:bg-red-600 transition"
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
                    <div className="mt-6 flex items-center justify-between mb-4 pb-2" onClick={() => { router.push(`/shop/${payload.businessId}`); }}>
                      <h4 className="text-[13px] font-bold text-slate-600">Shop Recommendations</h4>

                      <ChevronRightIcon className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {recommendedProducts.map((p) => {
                        const price = p.price || 0;
                        const isPromoActive = !!(p.promo_title && p.promo_discount && (!p.promo_end || new Date(p.promo_end) >= new Date()));

                        return (
                          <div key={p.product_id} className="group cursor-pointer" onClick={() => {
                            if (p.product_video) {
                              saveModalState();
                              if (onReelsClick) onReelsClick(p.product_id, businessData?.business?.business_name);
                              else {
                                const bizName = businessData?.business?.business_name || "store";
                                const bizSlug = businessData?.business?.business_slug || slugify(bizName);
                                router.push(`/market/${bizSlug}?product_id=${p.product_id}&reels=true`);
                              }
                            } else if (onProductClick) onProductClick(p.product_id, businessData?.business?.business_name);
                          }}>
                            <div className="aspect-square bg-slate-50 rounded-xl overflow-hidden mb-2 relative border border-slate-50 group-hover:border-red-100 transition-colors">
                              {p.first_image ? <img src={formatUrl(p.first_image)} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-300">No Image</div>}
                              {p.product_video && (
                                <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md rounded-full p-1.5 z-10 shadow-lg border border-white/20">
                                  <svg className="w-3 h-3 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z" /></svg>
                                </div>
                              )}
                            </div>
                            <div className="text-[10px] font-semibold text-slate-700 line-clamp-1 mb-1 leading-tight group-hover:text-red-600 transition-colors">{p.title}</div>

                            {isPromoActive ? (
                              <div className="text-[8px] font-bold text-red-500 border-red-500 border-[0.5px] px-1 w-fit mb-1  tracking-tighter leading-tight">
                                {p.promo_title} {p.promo_discount}% OFF
                              </div>
                            ) : p.sale_type ? (
                              <div className="text-[8px] font-bold text-red-500 border-red-500 border-[0.5px] px-1 w-fit mb-1  tracking-tighter leading-tight">
                                {p.sale_type} {p.sale_discount}% OFF
                              </div>
                            ) : null}

                            <div className="text-[11px] font-bold text-slate-900">₦{Number(price).toLocaleString()}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}


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
                            <div className="w-24 text-[10px] uppercase tracking-wide text-slate-500 flex-shrink-0">
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
                      <div className="space-y-4">
                        {payload.productImages.map((img, index) => {
                          if (!img?.url) return null;
                          return (
                            <div key={index} className="w-full flex justify-center bg-slate-50 rounded-lg overflow-hidden">
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
                            if (p.product_video) {
                              saveModalState();
                              if (onReelsClick) onReelsClick(p.product_id, p.business_name);
                              else {
                                const bizSlug = slugify(p.business_name || "store");
                                router.push(`/market/${bizSlug}?product_id=${p.product_id}&reels=true`);
                              }
                            } else if (onProductClick) onProductClick(p.product_id, p.business_name);
                          }}>
                            <div className="aspect-square bg-slate-50 rounded-xl overflow-hidden mb-2 relative border border-slate-50 group-hover:border-red-100 transition-colors">
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

                            <div className="text-[10px] font-semibold text-slate-700 line-clamp-1 mb-1 leading-tight group-hover:text-red-600 transition-colors">{p.title}</div>

                            {isPromoActive ? (
                              <div className="text-[8px] font-bold text-red-500 border-red-500 border-[0.5px] px-1 w-fit mb-1  tracking-tighter leading-tight">
                                {p.promo_title} {p.promo_discount}% OFF
                              </div>
                            ) : p.sale_type ? (
                              <div className="text-[8px] font-bold text-red-500 border-red-500 border-[0.5px] px-1 w-fit mb-1 tracking-tighter leading-tight">
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
                        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
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
                shopLogo={businessData?.business?.logo}
                shopProfilePic={businessData?.business?.profile_pic}
                businessId={payload?.businessId}
              />
            </aside>
          </div>
        </motion.div>
      </div>

      <PolicyModal
        key="policy-modal"
        open={policyModalOpen}
        title={policyModalData?.title ?? null}
        body={policyModalData?.body ?? null}
        onClose={closePolicyModal}
        onAddressChange={handlePolicyAddressChange}
      />
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
    </>
  );
}
