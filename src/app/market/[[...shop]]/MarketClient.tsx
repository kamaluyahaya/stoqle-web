"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { fetchProductById, toggleProductLike, logUserActivity } from "@/src/lib/api/productApi";
import { fetchLinkedProductPosts, fetchSmartReels, toggleSocialPostLike } from "@/src/lib/api/social";
// import PostModal from "@/src/components/modal/postModal";
import { FaHeart, FaRegHeart, FaPlay, FaImage } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { PreviewPayload, ProductSku, ProductFeedItem } from "@/src/types/product";

// Dynamically import heavy modals to prevent them from blocking the initial page hydration
const ProductPreviewModal = dynamic(() => import("@/src/components/product/addProduct/modal/previewModal"), { ssr: false });
const ReelsModal = dynamic(() => import("@/src/components/product/addProduct/modal/reelsModal"), { ssr: false });
const PostModal = dynamic(() => import("@/src/components/modal/postModal"), { ssr: false });
const LoginModal = dynamic(() => import("@/src/components/modal/auth/loginModal"), { ssr: false });
const SevenDayReturnModal = dynamic(() => import("@/src/components/business/policyModal/sevenDayReturnModal"), { ssr: false });
const PrivacyPolicyModal = dynamic(() => import("@/src/components/modal/auth/PrivacyPolicyModal"), { ssr: false });
const UserAgreementModal = dynamic(() => import("@/src/components/modal/auth/UserAgreementModal"), { ssr: false });
const HelpCenterModal = dynamic(() => import("@/src/components/modal/HelpCenterModal"), { ssr: false });
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import { fetchBusinessCategories, fetchProductCategories, fetchTrendingProducts, fetchPersonalizedFeed } from "@/src/lib/api/productApi";
import { fetchCartRecommendations } from "@/src/lib/api/cartApi";
import { API_BASE_URL } from "@/src/lib/config";
import { formatUrl } from "@/src/lib/utils/media";
import { MARKET_CACHE } from "@/src/lib/cache";
import { fetchActionableSummary } from "@/src/lib/api/orderApi";
import { toast } from "sonner";
import { ArrowUp, ShoppingCart, WifiOff, RotateCcw, ShieldCheck, ShoppingBag, Truck, RefreshCw, MessageSquare, Lock, ChevronRight } from "lucide-react";
import { idbGet, idbSet } from "@/src/lib/utils/idb";
import { VerifiedBadge, PartnerPill } from "@/src/components/common/VerifiedBadge";
import StoqleLoader from "@/src/components/common/StoqleLoader";
import MasonryGrid from "@/src/components/product/MasonryGrid";
import ProductCard from "@/src/components/product/ProductCard";
import { LikeBurst } from "@/src/components/product/LikeBurst";

type Props = {
    params: Promise<{ shop?: string[] }>;
    postCount?: number;
    /** Pre-resolved category data from the RSC server layer (plain data, not a Promise). */
    initialCategories?: any[] | null;
    hideTabs?: boolean;
    initialCategory?: string;
    softCategory?: boolean;
    relatedVendorIds?: number[];
    hideCartIcon?: boolean;
    disableScrollPersistence?: boolean;
    recommendationMode?: boolean;
    hideSubCategories?: boolean;
};

const slugify = (str: string) =>
    String(str || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");


const LIMIT = 10;
const LIMIT_SOCIAL = 5;




// Shared components extracted to @/src/components/product/







// ─── BLINK-EYE INSTANT CACHE ENGINE ───
// Pre-load from persistence before React even starts parsing the component.
if (typeof window !== "undefined") {
    const catCache = localStorage.getItem("stoqle_business_categories");
    if (catCache && MARKET_CACHE.categories.length === 0) {
        try { MARKET_CACHE.categories = JSON.parse(catCache); } catch (e) { }
    }

    // Legacy Cleanup
    localStorage.removeItem("stoqle_market_cache_products");
    localStorage.removeItem("stoqle_market_cache_time"); // Also clean up the legacy timestamp
}

// ─── IN-MEMORY SUBCATEGORY CACHE (per business category) ───
const SUBCAT_CACHE: Record<string, { name: string; image: string | null }[]> = {};

type SubCat = { name: string; image: string | null };

// ─── FOR-YOU QUICK-ACTION STRIP ───
const FOR_YOU_ITEMS = [
    { label: "Trending", icon: "/assets/icons/market/trending.png", href: null, action: "trending" },
    { label: "Orders", icon: "/assets/icons/market/order.png", href: "/profile/orders", action: null },
    { label: "Cart", icon: "/assets/icons/market/cart.png", href: "/cart", action: null },
    { label: "Service", icon: "/assets/icons/market/service.png", href: "/market/service", action: null },
    { label: "History", icon: "/assets/icons/market/history.png", href: "/market/history", action: null },
] as const;

const ForYouStrip = React.memo(({
    onTrending,
    router,
    onNavigate,
}: {
    onTrending: () => void;
    router: any;
    onNavigate: (href: string) => void;
}) => (
    <div className="flex flex-wrap gap-y-4 gap-x-2 sm:gap-x-4 px-1 py-3">
        {FOR_YOU_ITEMS.map((item) => (
            <button
                key={item.label}
                onClick={() => {
                    if (item.action === "trending") { onTrending(); }
                    else if (item.href) {
                        onNavigate(item.href);
                    }
                }}
                className="flex flex-col items-center gap-1.5 shrink-0 group w-[calc((100%-32px)/5)] sm:w-[calc((100%-48px)/7)] lg:w-[calc((100%-80px)/10)]"
            >
                <div className="w-12 h-12 overflow-hidden flex items-center justify-center group-hover:shadow-md group-hover:border-rose-200 transition-all duration-200">
                    <img
                        src={item.icon}
                        alt={item.label}
                        className="w-8 h-8 object-contain"
                        loading="eager"
                    />
                </div>
                <span className="text-[10px] font-semibold text-slate-500 group-hover:text-rose-500 transition-colors max-w-full px-1 text-center leading-tight line-clamp-1">
                    {item.label}
                </span>
            </button>
        ))}
    </div>
));
ForYouStrip.displayName = "ForYouStrip";

const SubCategoryStrip = React.memo(({
    category,
    onSelect,
    onNavigate,
}: {
    category: string;
    onSelect: (name: string) => void;
    onNavigate: (href: string) => void;
}) => {
    const [subcats, setSubcats] = React.useState<SubCat[]>(() => SUBCAT_CACHE[category] || []);
    const [loading, setLoading] = React.useState(!SUBCAT_CACHE[category]);

    React.useEffect(() => {
        if (!category || category === "For you" || category === "Rules") return;
        if (SUBCAT_CACHE[category]) {
            setSubcats(SUBCAT_CACHE[category]);
            setLoading(false);
            return;
        }
        setLoading(true);
        fetchProductCategories(category)
            .then((res: any) => {
                const data: SubCat[] = res?.data || [];
                SUBCAT_CACHE[category] = data;
                setSubcats(data);
            })
            .catch(() => setSubcats([]))
            .finally(() => setLoading(false));
    }, [category]);

    if (!category || category === "For you" || category === "Rules") return null;

    if (loading) {
        return (
            <div className="flex flex-wrap gap-y-4 gap-x-2 sm:gap-x-4 px-1 py-3">
                {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-[calc((100%-32px)/5)] sm:w-[calc((100%-48px)/7)] lg:w-[calc((100%-80px)/10)]">
                        <div className="w-12 h-12 rounded bg-slate-100 animate-pulse" />
                        <div className="w-10 h-2.5 rounded bg-slate-100 animate-pulse" />
                    </div>
                ))}
            </div>
        );
    }

    if (subcats.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-y-4 gap-x-2 sm:gap-x-4 px-1 py-3">
            {subcats.slice(0, 30).map((sub, idx) => {
                const isActive = false; // Subcategory navigation is now route-based
                return (
                    <button
                        key={idx}
                        onClick={() => onSelect(sub.name)}
                        className="flex flex-col items-center gap-1.5 shrink-0 group w-[calc((100%-32px)/5)] sm:w-[calc((100%-48px)/7)] lg:w-[calc((100%-80px)/10)]"
                    >
                        <div className="w-12 h-12 overflow-hidden flex items-center justify-center transition-all duration-200 group-hover:shadow-md group-hover:border-rose-200">
                            {sub.image ? (
                                <img
                                    src={sub.image}
                                    alt={sub.name}
                                    className="w-full h-full object-contain p-0.5"
                                    loading="lazy"
                                    onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            ) : (
                                <span className={`text-lg font-black ${isActive ? "text-rose-400" : "text-slate-300"}`}>
                                    {sub.name[0]?.toUpperCase()}
                                </span>
                            )}
                        </div>
                        <span className={`text-[10px] font-semibold transition-colors max-w-full px-1 text-center leading-tight truncate ${isActive ? "text-rose-500" : "text-slate-500 group-hover:text-rose-500"
                            }`}>
                            {sub.name}
                        </span>
                    </button>
                );
            })}
        </div>
    );
});
SubCategoryStrip.displayName = "SubCategoryStrip";

const MarketSkeleton = React.memo(({ category, hideSubCategories }: { category: string, hideSubCategories?: boolean }) => {
    return (
        <div className="px-1 animate-in fade-in duration-500">
            {/* Subcategory Strip Skeleton */}
            {category !== "Rules" && !hideSubCategories && (
                <div className="flex flex-wrap gap-y-4 gap-x-2 sm:gap-x-4 px-1 py-3 mb-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-[calc((100%-32px)/5)] sm:w-[calc((100%-48px)/7)] lg:w-[calc((100%-80px)/10)]">
                            <div className="w-12 h-12 rounded bg-slate-200/60 animate-pulse" />
                            <div className="w-10 h-2.5 rounded bg-slate-200/60 animate-pulse" />
                        </div>
                    ))}
                </div>
            )}

            {/* Product Grid Skeleton (Masonry mimic) */}
            <div className="flex gap-2 sm:gap-6 items-start w-full max-w-full overflow-hidden">
                {[1, 2, 3, 4, 5].map((colIdx) => {
                    let visibilityClass = "flex-1 flex flex-col gap-2 sm:gap-6 min-w-0";
                    if (colIdx === 3) visibilityClass += " hidden [@media(min-width:700px)]:flex";
                    if (colIdx === 4) visibilityClass += " hidden [@media(min-width:1210px)]:flex";
                    if (colIdx === 5) visibilityClass += " hidden [@media(min-width:1430px)]:flex";

                    return (
                        <div key={colIdx} className={visibilityClass}>
                            {Array.from({ length: 3 }).map((_, i) => {
                                // Randomize height for masonry feel
                                const heights = ["h-48", "h-64", "h-72", "h-56"];
                                const h = heights[(i + colIdx) % heights.length];
                                return (
                                    <div key={i} className={`w-full ${h} rounded-2xl bg-slate-200/50 animate-pulse flex flex-col justify-end p-4 gap-2`}>
                                        <div className="w-3/4 h-3 rounded-full bg-slate-200" />
                                        <div className="w-1/2 h-3 rounded-full bg-slate-200" />
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
MarketSkeleton.displayName = "MarketSkeleton";

const RulesSection = ({
    onOpenPrivacy,
    onOpenTerms,
    onOpenReturns,
    onOpenHelp,
    onLinkClick
}: {
    onOpenPrivacy: () => void;
    onOpenTerms: () => void;
    onOpenReturns: () => void;
    onOpenHelp: () => void;
    onLinkClick: (href: string) => void;
}) => {
    const policies = [
        { title: "Privacy policy", onClick: onOpenPrivacy },
        { title: "Terms of service", onClick: onOpenTerms },
        { title: "7days return policy", onClick: onOpenReturns },
        { title: "Shipping Fee coverage", href: "/help/shipping" },
        { title: "Become a vendor", href: "/profile/business/business-status" },
        { title: "Shop owner policy", href: "/help/shop-owner-policy" },
        { title: "Help center", onClick: onOpenHelp },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className=" mx-auto px-4 py-12"
        >
            <div className="p-4">
                <div className="flex flex-col items-center text-center mb-10">
                    <h2 className="text-5xl font-black text-rose-500 mb-2">stoqle</h2>
                </div>

                <div className="flex flex-col">
                    {policies.map((policy, idx) => {
                        const content = (
                            <>
                                <span className="text-slate-800 text-[14px] font-bold group-hover:text-rose-600 transition-colors">
                                    {policy.title}
                                </span>
                                <div className="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-rose-50 transition-colors">
                                    <ChevronRight size={18} className="text-slate-400 group-hover:text-rose-500 transition-colors" />
                                </div>
                            </>
                        );

                        if (policy.onClick) {
                            return (
                                <button
                                    key={idx}
                                    onClick={policy.onClick}
                                    className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0 group hover:px-2 transition-all duration-300 w-full text-left"
                                >
                                    {content}
                                </button>
                            );
                        }

                        return (
                            <button
                                key={idx}
                                onClick={() => onLinkClick(policy.href || "#")}
                                className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 group hover:px-2 transition-all duration-300 w-full text-left"
                            >
                                {content}
                            </button>
                        );
                    })}
                </div>
            </div>
        </motion.div >
    );
};

export default function MarketClient({ params: paramsPromise, initialCategories, hideTabs, initialCategory, softCategory, relatedVendorIds, hideCartIcon, disableScrollPersistence, recommendationMode, hideSubCategories }: Props) {
    const routeParams = React.use(paramsPromise);
    const [activeCategory, setActiveCategory] = useState<string>(initialCategory || "For you");

    // Restore cached category after mount to avoid hydration mismatch
    useEffect(() => {
        if (!initialCategory && MARKET_CACHE.activeCategory !== "For you") {
            setActiveCategory(MARKET_CACHE.activeCategory);
        }
    }, [initialCategory]);
    const [products, setProducts] = useState<any[]>(() => {
        const cached = MARKET_CACHE.categoryData[initialCategory || MARKET_CACHE.activeCategory];
        // If we have cached products, mark them as restored to bypass initial animation
        return cached?.products ? cached.products.map(p => ({ ...p, isRestored: true })) : [];
    });
    const [loading, setLoading] = useState<boolean>(() => {
        const cached = MARKET_CACHE.categoryData[initialCategory || MARKET_CACHE.activeCategory];
        return !cached;
    });
    // Initialize isRestoring based on whether we loaded cached products
    const [isRestoring, setIsRestoring] = useState(() => {
        const cached = MARKET_CACHE.categoryData[initialCategory || MARKET_CACHE.activeCategory];
        return !!(cached && cached.products && cached.products.length > 0);
    });
    const lastOfflineToastRef = useRef<number>(0);

    const showOfflineToast = useCallback(() => {
        if (typeof window === "undefined" || navigator.onLine) return;
        const now = Date.now();
        if (now - lastOfflineToastRef.current > 5000) {
            toast.error("No internet connection. Using cached products.", {
                id: "offline-toast"
            });
            lastOfflineToastRef.current = now;
        }
    }, []);

    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const touchStartY = useRef(0);
    const isPulling = useRef(false);

    const [error, setError] = useState<string | null>(null);
    const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

    const [selectedSocialPost, setSelectedSocialPost] = useState<any | null>(null);
    const [socialPostModalOpen, setSocialPostModalOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [reelsModalOpen, setReelsModalOpen] = useState(false);
    const [fetchingProductId, setFetchingProductId] = useState<number | string | null>(null);
    const [clickPos, setClickPos] = useState({ x: 0, y: 0 });

    // --- Pagination State ---
    const [page, setPage] = useState(() => {
        const cached = MARKET_CACHE.categoryData[initialCategory || MARKET_CACHE.activeCategory];
        return cached?.page || 0;
    });
    const [hasMore, setHasMore] = useState(() => {
        const cached = MARKET_CACHE.categoryData[initialCategory || MARKET_CACHE.activeCategory];
        return cached ? cached.hasMore : true;
    });
    const [socialCursor, setSocialCursor] = useState<string | null>(() => {
        const cached = MARKET_CACHE.categoryData[initialCategory || MARKET_CACHE.activeCategory];
        return cached?.socialCursor || null;
    });
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loaderRef = useRef<HTMLDivElement>(null);
    const tabsRef = useRef<HTMLDivElement>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [showManualLoading, setShowManualLoading] = useState(false);
    const [isOpeningProduct, setIsOpeningProduct] = useState(false);

    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const auth = useAuth();
    const { user, token, isHydrated } = auth;
    const [showLoginModal, setShowLoginModal] = useState(false);

    // --- Policy Modals State ---
    const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
    const [termsModalOpen, setTermsModalOpen] = useState(false);
    const [returnsModalOpen, setReturnsModalOpen] = useState(false);
    const [helpModalOpen, setHelpModalOpen] = useState(false);

    // --- Actionable Orders State ---
    const [actionableData, setActionableData] = useState<{ vendorPendingCount: number, customerDeliveredCount: number, customerOutForDeliveryCount: number } | null>(null);
    const [fetchedCategories, setFetchedCategories] = useState<string[]>([]);
    const [isScrolled, setIsScrolled] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);

    useEffect(() => {
        if (initialCategories && initialCategories.length > 0) {
            setFetchedCategories(initialCategories);
        } else if (MARKET_CACHE.categories.length > 0) {
            setFetchedCategories(MARKET_CACHE.categories);
        }
    }, [initialCategories]);

    // --- Touch pull-to-refresh listener ---
    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleTouchStart = (e: TouchEvent) => {
            if (modalOpen || reelsModalOpen || socialPostModalOpen || privacyModalOpen || termsModalOpen || returnsModalOpen || helpModalOpen) return;
            const containerScrollTop = window.scrollY || document.documentElement.scrollTop;
            if (containerScrollTop <= 2) {
                touchStartY.current = e.touches[0].pageY;
                isPulling.current = true;
            } else {
                isPulling.current = false;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isPulling.current) return;
            const currentY = e.touches[0].pageY;
            const diff = currentY - touchStartY.current;

            if (diff > 0) {
                const distance = Math.min(diff * 0.45, 90);
                setPullDistance(distance);
                if (distance > 10) {
                    if (e.cancelable) e.preventDefault();
                }
            }
        };

        const handleTouchEnd = () => {
            if (!isPulling.current) return;
            isPulling.current = false;

            if (pullDistance > 60) {
                setIsRefreshing(true);
                handleManualRefresh();
                setTimeout(() => {
                    setIsRefreshing(false);
                    setPullDistance(0);
                }, 1500);
            } else {
                setPullDistance(0);
            }
        };

        window.addEventListener("touchstart", handleTouchStart, { passive: false });
        window.addEventListener("touchmove", handleTouchMove, { passive: false });
        window.addEventListener("touchend", handleTouchEnd, { passive: true });

        return () => {
            window.removeEventListener("touchstart", handleTouchStart);
            window.removeEventListener("touchmove", handleTouchMove);
            window.removeEventListener("touchend", handleTouchEnd);
        };
    }, [pullDistance, activeCategory, modalOpen, reelsModalOpen, socialPostModalOpen, privacyModalOpen, termsModalOpen, returnsModalOpen, helpModalOpen]);

    // --- Subcategory search filter ---


    // --- INACTIVITY REFRESH ENGINE ---
    const lastHiddenAt = useRef<number | null>(null);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                lastHiddenAt.current = Date.now();
            } else {
                if (lastHiddenAt.current) {
                    const elapsed = Date.now() - lastHiddenAt.current;
                    const fiveMinutes = 5 * 60 * 1000;
                    if (elapsed >= fiveMinutes) {
                        console.log(`[Market] Inactivity detected (${Math.round(elapsed / 1000 / 60)}m), auto-refreshing feed...`);
                        handleManualRefresh();
                    }
                    lastHiddenAt.current = null;
                }
            }
        };

        window.addEventListener("visibilitychange", handleVisibilityChange);
        return () => window.removeEventListener("visibilitychange", handleVisibilityChange);
    }, []);

    useEffect(() => {
        const handleScrollHeader = () => {
            if (window.scrollY > 50) {
                setIsScrolled(true);
            } else {
                setIsScrolled(false);
            }
            setShowScrollTop(window.scrollY > 400);
        };
        window.addEventListener("scroll", handleScrollHeader, { passive: true });
        return () => window.removeEventListener("scroll", handleScrollHeader);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // --- IDB Initialization & Cross-Tab Sync (Legacy clean up: now handled by categoryData) ---
    // The previous global IDB state for stoqle_market_cache_products was monolithic.
    // Future enhancements can implement a per-category indexeddb cache, but for now
    // memory cache (MARKET_CACHE.categoryData) serves the "blink-eye" soft navigations.


    const handleManualRefresh = () => {
        scrollToTop();
        setShowManualLoading(true);
        setTimeout(() => {
            // Force a full clean refresh
            delete MARKET_CACHE.categoryData[activeCategory];
            setProducts([]); // Clear current products to force the big loader
            setLoading(true); // Show the main loader
            setIsRestoring(false);
            setRefreshKey(Date.now()); // Use timestamp to ensure unique effect trigger
            setShowManualLoading(false);
        }, 400);
    };

    useEffect(() => {
        const handleNavRefresh = (e: any) => {
            if (!e.detail?.path || e.detail.path === "/market") {
                handleManualRefresh();
            }
        };
        window.addEventListener("nav-refresh", handleNavRefresh);
        return () => window.removeEventListener("nav-refresh", handleNavRefresh);
    }, []);

    useEffect(() => {
        // 1. Try Memory Cache (fastest — module-level, survives soft navigations)
        if (MARKET_CACHE.categories.length > 0) {
            setFetchedCategories(MARKET_CACHE.categories);
            return;
        }

        // 2. Try LocalStorage Cache (persists across hard refreshes)
        const cached = localStorage.getItem("stoqle_business_categories");
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const filtered = (parsed || []).filter((c: any) => c !== "Trending");
                if (filtered.length > 0) {
                    setFetchedCategories(filtered);
                    MARKET_CACHE.categories = filtered;
                    // Already have data — server data will still override below if better
                }
            } catch (err) {
                console.error("Failed to parse cached categories", err);
            }
        }

        // 3. Use server-resolved categories if provided (array of category objects),
        //    otherwise fall back to a direct client-side fetch.
        //
        //    NOTE: initialCategories is plain data (already awaited in the RSC layer).
        //    Never treat it as a Promise — Promises are not serializable across the
        //    RSC → Client boundary and arrive as undefined.
        if (Array.isArray(initialCategories) && initialCategories.length > 0) {
            applyCategories(initialCategories);
        } else {
            fetchBusinessCategories()
                .then(res => {
                    if (res?.status === "success" || res?.success || res?.ok) {
                        applyCategories(res.data || res);
                    }
                })
                .catch(err => {
                    if (typeof window !== "undefined" && navigator.onLine) {
                        console.error("fetchCategories error:", err);
                    }
                });
        }

        function applyCategories(data: any[]) {
            const cats = data.map((c: any) => (typeof c === "string" ? c : c.name)).filter(Boolean);
            const finalCats = ["For you", "PARTNERS", ...cats];
            setFetchedCategories(finalCats);
            MARKET_CACHE.categories = finalCats;
            localStorage.setItem("stoqle_business_categories", JSON.stringify(finalCats));
        }
    }, [initialCategories]);

    useEffect(() => {
        if (token) {
            fetchActionableSummary(token)
                .then(res => {
                    if (res?.success) {
                        setActionableData(res.data);
                    }
                })
                .catch(console.error);
        } else {
            setActionableData(null);
        }
    }, [token]);

    const [likeData, setLikeData] = useState<Record<number, { liked: boolean, count: number }>>(MARKET_CACHE.likeData);
    // const formatUrl = React.useCallback((url: string) => {
    //     if (!url) return "https://via.placeholder.com/800x600?text=No+Image";
    //     if (url.startsWith("http")) return url;
    //     return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    // }, []);

    const handleLikeClick = React.useCallback(async (e: React.MouseEvent, productId: number, baseCount: number) => {
        e.stopPropagation();

        const ok = await auth.ensureAccountVerified();
        if (!ok) return;

        const current = likeData[productId] || { liked: false, count: baseCount };
        const newLiked = !current.liked;
        const newCount = newLiked ? current.count + 1 : Math.max(0, current.count - 1);

        setLikeData(prev => ({
            ...prev,
            [productId]: { liked: newLiked, count: newCount }
        }));

        try {
            const res = await toggleProductLike(productId, token!);
            setLikeData(prev => ({
                ...prev,
                [productId]: { liked: res.data.liked, count: res.data.likes_count }
            }));
            if (res.data.liked) {
                const likedProduct = products.find((p: any) => p.product_id === productId);
                logUserActivity({ product_id: productId, action_type: 'like', business_id: likedProduct?.business_id, category: likedProduct?.category }, token!);
            }
        } catch (err) {
            console.error("Like error", err);
            // Revert on error
            setLikeData(prev => ({
                ...prev,
                [productId]: current
            }));
        }
    }, [user, token, likeData]);

    // ── Social post like state (keyed by raw post id string, e.g. "42") ──────
    const [postLikeData, setPostLikeData] = useState<Record<string, { liked: boolean, count: number }>>({});

    const handlePostLikeClick = React.useCallback(async (e: React.MouseEvent, postId: string, initialLiked: boolean, initialCount: number) => {
        e.stopPropagation();

        const ok = await auth.ensureAccountVerified();
        if (!ok) return;

        let finalLiked = !initialLiked;
        let finalCount = finalLiked ? initialCount + 1 : Math.max(0, initialCount - 1);

        // Functional update ensures we handle rapid clicks correctly
        setPostLikeData(prev => {
            const current = prev[postId] ?? { liked: initialLiked, count: initialCount };
            finalLiked = !current.liked;
            finalCount = finalLiked ? current.count + 1 : Math.max(0, current.count - 1);
            return { ...prev, [postId]: { liked: finalLiked, count: finalCount } };
        });

        try {
            const res = await toggleSocialPostLike(postId, token!);
            // Server feedback logic: if res is valid, use its count
            if (res) {
                setPostLikeData(prev => ({
                    ...prev,
                    [postId]: {
                        liked: res.liked !== undefined ? !!res.liked : finalLiked,
                        count: Number(res.likes_count ?? res.likeCount ?? finalCount)
                    }
                }));
            }
        } catch (err) {
            console.error("Post like error", err);
            // Revert slightly based on common error patterns
            setPostLikeData(prev => ({ ...prev, [postId]: { liked: initialLiked, count: initialCount } }));
        }
    }, [auth, token]);

    // We could fetch actual categories or just have common ones
    const CATEGORIES = useMemo(
        () => {
            const base = fetchedCategories.length > 0 ? fetchedCategories : ["For you", "PARTNERS"];
            return [...base, "Rules"];
        },
        [fetchedCategories]
    );


    const fetchPage = async (pageNum: number) => {
        // Rules tab is static; skip fetching
        if (activeCategory === "Rules") {
            setLoading(false);
            setIsLoadingMore(false);
            return;
        }

        // Only guard against hasMore if we are actually paginating (pageNum > 0)
        // Initial loads (pageNum === 0) should always proceed to ensure data freshness or clear loading states.
        if ((!hasMore && pageNum > 0) || isLoadingMore) return;

        setIsLoadingMore(true);
        // Instant Optimization: Only show loading state if we literally have zero products to show
        if (pageNum === 0) {
            if (products.length === 0) setLoading(true);
            setIsRestoring(false);
        }

        try {
            let nextProducts: ProductFeedItem[] = [];
            let nextPosts: any[] = [];
            let currentNextCursor: string | null = null;

            if (activeCategory === "PARTNERS") {
                const res = await fetchPersonalizedFeed(LIMIT, pageNum * LIMIT, token, null, true, softCategory, relatedVendorIds, pageNum === 0 ? refreshKey : undefined);
                nextProducts = res?.data || [];
            } else if (recommendationMode) {
                const res = await fetchCartRecommendations(token!, LIMIT, pageNum * LIMIT);
                nextProducts = res?.data?.items || [];
                // If we got fewer items than requested, we've reached the end
                if (nextProducts.length < LIMIT) setHasMore(false);
            } else {
                const bizCat = activeCategory === "For you" ? null : activeCategory;
                const res = await fetchPersonalizedFeed(LIMIT, pageNum * LIMIT, token, bizCat, false, softCategory, relatedVendorIds, pageNum === 0 ? refreshKey : undefined);
                nextProducts = res?.data || [];

                // Fetch social posts with linked products using the dynamic Smart Reels engine
                try {
                    const { posts, nextCursor } = await fetchSmartReels({
                        limit: LIMIT_SOCIAL,
                        cursor: pageNum === 0 ? null : socialCursor,
                        token: token || undefined,
                        is_product_linked: true,
                        softCategory,
                        business_category: bizCat || undefined,
                        v: pageNum === 0 ? refreshKey : undefined
                    });
                    nextPosts = posts;
                    currentNextCursor = nextCursor;
                    setSocialCursor(nextCursor);
                } catch (err: any) {
                    console.error("Failed to fetch linked social posts", err);
                }
            }

            // If this was an authenticated fetch, mark the category cache as personalized
            if (pageNum === 0) {
                if (!MARKET_CACHE.categoryData[activeCategory]) {
                    MARKET_CACHE.categoryData[activeCategory] = {
                        products: [], page: 0, hasMore: true, scrollPos: 0,
                        socialCursor: null, lastFetchedAt: Date.now(), personalized: !!token
                    };
                } else {
                    MARKET_CACHE.categoryData[activeCategory].personalized = !!token;
                    MARKET_CACHE.categoryData[activeCategory].lastFetchedAt = Date.now();
                }
            }

            // Update likeData based on all fetched products
            const nextLikeData: Record<number, { liked: boolean, count: number }> = {};
            nextProducts.forEach((p: any) => {
                nextLikeData[p.product_id] = { liked: !!p.isLiked, count: p.likes_count || 0 };
            });
            setLikeData(prev => ({ ...prev, ...nextLikeData }));

            setProducts(prev => {
                const mappedProducts = nextProducts.map((p: any) => {
                    const media = p.media || [];
                    const imgs = media.filter((m: any) => m.type === "image");
                    const coverRef = p.first_image || p.image_url;

                    const foundCover = imgs.find((m: any) =>
                        m.is_cover === 1 || (coverRef && m.url && m.url.includes(coverRef))
                    ) || imgs[0];

                    return {
                        ...p,
                        // originalIndex is deferred — assigned after interleaving for correct animation order
                        first_image: foundCover?.url || coverRef || (media[0]?.type === 'image' ? media[0].url : "") || "",
                        product_video: p.product_video || media.find((m: any) => m.type === 'video')?.url || "",
                        followers_count: Number(p.followers_count || 0),
                    };
                });

                const mappedSocialPosts = nextPosts.map((p: any) => {
                    const lp = p.linked_product || {};
                    // Specifically target the product's image, not the post's media
                    const productThumbnail = lp.first_image || lp.image_url || (lp.media && lp.media.find((m: any) => m.type === "image")?.url);

                    return {
                        ...p,
                        product_id: `post-${p.id}`,
                        is_social_post: true,
                        title: p.caption || lp.title || "Social Post",
                        first_image: p.thumbnail || p.src,
                        price: lp.price || 0,
                        logo: p.user?.avatar || null,
                        isLiked: !!(p.liked_by_me || p.liked || p.liked_by_user),
                        likes_count: p.likes_count ?? p.likeCount ?? 0,
                        // Specific product tag metadata
                        linked_image: productThumbnail,
                        product_slug: lp.slug || lp.product_slug || (lp.title ? slugify(lp.title) : null),
                        business_slug: lp.business_slug || p.user?.business_slug || p.business_slug || null,
                        business_name: lp.business_name || p.user?.name || "Vendor",
                        sold_count: lp.total_sold || lp.sold_count || 0,
                        followers_count: Number(lp.followers_count || p.followers_count || 0),
                    };
                });

                // ── Split social posts: fresh vs already-viewed-linked-product ─────
                // Posts whose linked product the user has already interacted with
                // are NEVER inserted mid-feed. They go at the very end.
                const viewedProductIds = new Set(Object.keys(likeData).map(Number));
                const freshPosts: any[] = [];
                const stalePosts: any[] = [];

                mappedSocialPosts.forEach((post: any) => {
                    const linkedId = post.linked_product_id || post.linked_product?.product_id;
                    const alreadySeen = linkedId && (
                        viewedProductIds.has(Number(linkedId)) ||
                        post.interacted_by_user != null ||
                        (post.feed_score != null && post.feed_score < -10000)
                    );
                    if (alreadySeen && !softCategory) {
                        stalePosts.push(post);
                    } else {
                        freshPosts.push(post);
                    }
                });

                // ─── Insertion positions for FRESH posts only ──────────────────────
                const userSeed = user?.id
                    ? (Number(user.id) % 9973) ^ pageNum
                    : (Math.floor(Date.now() / 60_000) % 9973) ^ pageNum;

                const totalProducts = mappedProducts.length;
                const insertionPositions = new Set<number>();
                if (freshPosts.length > 0 && totalProducts > 0) {
                    const baseStep = Math.max(3, Math.floor(totalProducts / (freshPosts.length + 1)));
                    for (let k = 0; k < freshPosts.length; k++) {
                        const jitter = ((userSeed * (k + 7)) % baseStep) - Math.floor(baseStep / 2);
                        const pos = Math.min(totalProducts - 1, Math.max(1, (k + 1) * baseStep + jitter));
                        insertionPositions.add(pos);
                    }
                }

                // Interleave fresh posts at calculated positions
                const combined: any[] = [];
                let socialIdx = 0;
                mappedProducts.forEach((prod: any, i: number) => {
                    combined.push(prod);
                    if (insertionPositions.has(i + 1) && socialIdx < freshPosts.length) {
                        combined.push(freshPosts[socialIdx++]);
                    }
                });
                // Remaining fresh posts
                while (socialIdx < freshPosts.length) {
                    combined.push(freshPosts[socialIdx++]);
                }
                // Stale (viewed-linked-product) posts always at the bottom
                stalePosts.forEach((post: any) => combined.push(post));

                // ─── FINAL DEDUPLICATION ──────────────────────────────────────────
                // Ensure no items are duplicated within the combined batch itself
                const seenInBatch = new Set();
                const deduplicatedCombined: any[] = [];
                combined.forEach(item => {
                    if (!seenInBatch.has(item.product_id)) {
                        deduplicatedCombined.push(item);
                        seenInBatch.add(item.product_id);
                    }
                });


                // ─── Assign originalIndex AFTER combining so animation is serial ──
                // Each item's delay is based on its true visual slot, not on whether
                // it's a product or a social post.
                const baseOffset = pageNum === 0 ? 0 : prev.length;
                deduplicatedCombined.forEach((item, i) => {
                    item.originalIndex = baseOffset + i;
                });

                const existingIds = new Set(prev.map(p => p.product_id));
                const unique = deduplicatedCombined.filter((p) => !existingIds.has(p.product_id));
                const finalProducts = pageNum === 0 ? deduplicatedCombined : [...prev, ...unique];

                if (!hideTabs) {
                    MARKET_CACHE.categoryData[activeCategory] = {
                        products: finalProducts,
                        page: pageNum + 1,
                        hasMore: nextProducts.length >= LIMIT,
                        scrollPos: window.scrollY,
                        socialCursor: currentNextCursor || null,
                        lastFetchedAt: Date.now(),
                        personalized: !!token
                    };
                    MARKET_CACHE.likeData = { ...likeData, ...nextLikeData };
                }

                return finalProducts;
            });

            if (nextProducts.length < LIMIT) {
                setHasMore(false);
            }
            setPage(pageNum + 1);
        } catch (err: any) {
            if (typeof window !== "undefined" && navigator.onLine) {
                console.error("Market fetch error:", err);
            }
            if (typeof window !== "undefined" && !navigator.onLine) {
                showOfflineToast();
                // If it's the first page and we have nothing, try IDB fallback
                if (pageNum === 0 && products.length === 0) {
                    idbGet<any[]>("stoqle_market_cache_products").then((data) => {
                        if (data && data.length > 0) {
                            setProducts(data);
                            if (MARKET_CACHE.categoryData[activeCategory]) {
                                MARKET_CACHE.categoryData[activeCategory].products = data;
                            } else {
                                MARKET_CACHE.categoryData[activeCategory] = {
                                    products: data, page: 0, hasMore: true, scrollPos: 0,
                                    socialCursor: null, lastFetchedAt: Date.now(), personalized: false
                                };
                            }
                            setError(null); // Clear error if we found cache
                        } else {
                            setError("No internet connection and no cached products found.");
                        }
                    }).catch(() => {
                        setError("No internet connection. Please check your network.");
                    });
                } else if (products.length > 0) {
                    // We already have products, just don't clear them
                    setError(null);
                }
            } else {
                setError("Failed to load products. Please try again later.");
            }
        } finally {
            setLoading(false);
            setIsLoadingMore(false);
        }
    };

    // Auto-check online status every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            if (typeof window !== "undefined" && !navigator.onLine && products.length > 0) {
                showOfflineToast();
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [products.length, showOfflineToast]);

    // Initial load logic with cache check
    useEffect(() => {
        if (!isHydrated) return; // Wait for auth state to be resolved from storage

        const CACHE_TTL = 1000 * 60 * 5; // 5 mins
        const cached = MARKET_CACHE.categoryData[activeCategory];

        if (cached && cached.products.length > 0) {
            const isFresh = Date.now() - cached.lastFetchedAt < CACHE_TTL;
            const needsPersonalization = token && !cached.personalized && activeCategory !== "Trending";

            if (!needsPersonalization && isFresh) {
                // Mark loaded cached products as restored to skip sequential animation
                setProducts(cached.products.map(p => ({ ...p, isRestored: true })));
                setPage(cached.page);
                setHasMore(cached.hasMore);
                setSocialCursor(cached.socialCursor);
                setLoading(false);
                setIsRestoring(true);

                // Restore scroll position
                setTimeout(() => {
                    window.scrollTo({ top: cached.scrollPos, behavior: "instant" });
                    // After a short delay, we can turn off the restoring flag so future appends animate
                    setTimeout(() => setIsRestoring(false), 100);
                }, 10);
                return;
            }
        }

        setPage(0);
        setHasMore(true);
        setSocialCursor(null);
        if (products.length === 0) setLoading(true);

        fetchPage(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHydrated, token, activeCategory, refreshKey]);

    const onCategoryChange = useCallback((newCat: string) => {
        if (newCat === activeCategory) {
            handleManualRefresh();
            return;
        }

        // 1. Save current state to cache before switching
        MARKET_CACHE.categoryData[activeCategory] = {
            products,
            page,
            hasMore,
            scrollPos: window.scrollY,
            socialCursor,
            lastFetchedAt: MARKET_CACHE.categoryData[activeCategory]?.lastFetchedAt || Date.now(),
            personalized: MARKET_CACHE.categoryData[activeCategory]?.personalized || !!token
        };

        // 2. Clear current view state to prevent showing wrong products
        const cached = MARKET_CACHE.categoryData[newCat];
        if (cached) {
            // Mark loaded cached products as restored to skip sequential animation
            setProducts(cached.products.map(p => ({ ...p, isRestored: true })));
            setPage(cached.page);
            setHasMore(cached.hasMore);
            setSocialCursor(cached.socialCursor);
            setLoading(false);
            setError(null);
            setIsRestoring(true);

            // Restore scroll position after a micro-task to ensure layout is ready
            setTimeout(() => {
                window.scrollTo({ top: cached.scrollPos, behavior: "instant" });
                // After a short delay, we can turn off the restoring flag so future appends animate
                setTimeout(() => setIsRestoring(false), 100);
            }, 0);
        } else {
            setProducts([]);
            setPage(0);
            setHasMore(true);
            setSocialCursor(null);
            setLoading(true);
            setError(null);
            window.scrollTo({ top: 0, behavior: "instant" });
        }

        setActiveCategory(newCat);
        MARKET_CACHE.activeCategory = newCat;
    }, [activeCategory, products, page, hasMore, socialCursor, token]);

    // Sync active category if initialCategory prop changes (e.g. from cart updates)
    useEffect(() => {
        if (initialCategory && initialCategory !== activeCategory) {
            // If the category actually changed, we MUST clear products and re-fetch
            setActiveCategory(initialCategory);
            // We don't call fetchPage(0) here because the effect above will trigger on activeCategory change
        }
    }, [initialCategory, activeCategory]);

    // Center active tab automatically on change
    useEffect(() => {
        const container = tabsRef.current;
        if (!container) return;

        const activeTab = container.querySelector(`[data-active="true"]`) as HTMLElement;
        if (activeTab) {
            const containerWidth = container.offsetWidth;
            const targetWidth = activeTab.offsetWidth;
            const targetLeft = activeTab.offsetLeft;
            const scrollLeft = targetLeft - (containerWidth / 2) + (targetWidth / 2);
            container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
    }, [activeCategory]);

    // Dynamic Navbar / Header coloring for Partners
    useEffect(() => {
        // Find the main shell header
        const header = document.querySelector('header.fixed.top-0');
        if (!header) return;

        if (activeCategory === "PARTNERS") {
            header.classList.add('is-partners');
        } else {
            header.classList.remove('is-partners');
        }

        return () => {
            header.classList.remove('is-partners');
        };
    }, [activeCategory]);

    // Handle Scroll Persistence
    useEffect(() => {
        if (disableScrollPersistence) return;

        const handleScroll = () => {
            // Guard: Only update market cache if we are actually on a market/shop route
            if (!window.location.pathname.startsWith("/market") && !window.location.pathname.startsWith("/shop")) return;
            if (products.length === 0 || loading) return;

            const currentScroll = window.scrollY;
            if (MARKET_CACHE.categoryData[activeCategory]) {
                MARKET_CACHE.categoryData[activeCategory].scrollPos = currentScroll;
            }
            if (typeof window !== "undefined" && !navigator.onLine) {
                showOfflineToast();
            }
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [activeCategory, products.length, loading]);

    // Initial Mount: Reset to top ONLY if we are not restoring from a specific category cache
    useEffect(() => {
        if (disableScrollPersistence) return;

        if (typeof window !== 'undefined') {
            window.history.scrollRestoration = 'manual';
        }

        if (!isRestoring) {
            window.scrollTo({ top: 0, behavior: "instant" });
        }
    }, []); // Run once on mount

    // Restore Scroll Position when returning to the page
    useEffect(() => {
        if (disableScrollPersistence) return;
        if (isRestoring && products.length > 0) {
            const timer = setTimeout(() => {
                const targetScroll = MARKET_CACHE.categoryData[activeCategory]?.scrollPos || 0;
                window.scrollTo(0, targetScroll);
                // Turn off restoring flag after layout settles
                setTimeout(() => setIsRestoring(false), 150);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [products, isRestoring, activeCategory]);

    // Scroll listener for lazy loading
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !isLoadingMore && !loading) {
                fetchPage(page);
            }
        }, { threshold: 0.1 });

        const currentLoader = loaderRef.current;
        if (currentLoader) observer.observe(currentLoader);

        return () => {
            if (currentLoader) observer.unobserve(currentLoader);
        };
    }, [page, hasMore, isLoadingMore, loading]);

    // Category sorting: Since we fetch by category server-side, we just return the products
    const filteredProducts = useMemo(() => {
        let list = products || [];
        if (activeCategory === "PARTNERS" && list.length > 0) {
            return [{ isIntro: true, product_id: 'intro' }, ...list];
        }
        return list;
    }, [products, activeCategory]);



    const updateUrl = (productId: number | string | null, businessName?: string, isReels: boolean = false, businessSlug?: string, isSocialPost: boolean = false, productSlug?: string, replace: boolean = false) => {
        const params = new URLSearchParams(window.location.search);
        const bizSlug = businessSlug || (businessName ? slugify(businessName) : (routeParams?.shop?.[0] || "shop"));

        if (productId || productSlug) {
            if (isReels) {
                params.set("reels", "true");
            } else {
                params.delete("reels");
            }

            // Context-Aware Routing: Use current base path (market, cart, etc)
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            const currentBase = pathParts[0] || 'market';
            let newUrl = `/${currentBase}/${bizSlug}`;

            // Always prefer slug in the URL — never expose numeric product_id
            params.delete("product_id");
            if (productSlug) {
                newUrl += `/${productSlug}`;
            }

            const search = params.toString();
            newUrl += search ? `?${search}` : "";

            if (newUrl !== window.location.pathname + window.location.search) {
                if (replace || recommendationMode) {
                    window.history.replaceState(window.history.state, "", newUrl);
                } else {
                    window.history.pushState(window.history.state, "", newUrl);
                }
            }
        } else {
            params.delete("product_id");
            params.delete("reels");
            const search = params.toString();
            // If we have a shop/biz slug from props or state, keep it.
            const currentBiz = routeParams?.shop?.[0];
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            const currentBase = pathParts[0] || 'market';
            const newUrl = currentBiz ? `/${currentBase}/${currentBiz}${search ? `?${search}` : ""}` : `/${currentBase}${search ? `?${search}` : ""}`;

            if (newUrl !== window.location.pathname + window.location.search) {
                if (replace) {
                    window.history.replaceState(window.history.state, "", newUrl);
                } else {
                    window.history.pushState(window.history.state, "", newUrl);
                }
            }
        }
    };

    // Global listener to close modals when navigating back via hardware button
    useEffect(() => {
        const parts = pathname.split("/").filter(Boolean);
        // Is this the base market or a shop page without a specific product/reel open?
        const isBaseNavigation = parts.length <= 2 && !searchParams.get("reels");

        if (isBaseNavigation) {
            setSocialPostModalOpen(false);
            setModalOpen(false);
            setReelsModalOpen(false);
            setSelectedSocialPost(null);
        }
    }, [pathname, searchParams]);

    /**
     * EAGER PREFETCH ENGINE
     * 
     * Dynamically imported components (next/dynamic) normally download only when triggered.
     * This creates a 'First-Click Delay' where the user's first tap feels laggy while the code downloads.
     * 
     * We solve this by prefetching all heavy modal chunks in the background once the page is idle.
     */
    useEffect(() => {
        const prefetchModals = () => {
            // Trigger background fetches of the actual JS bundles
            // These catch errors silently because we only care about filling the cache
            import("@/src/components/product/addProduct/modal/previewModal").catch(() => { });
            import("@/src/components/product/addProduct/modal/reelsModal").catch(() => { });
            import("@/src/components/modal/postModal").catch(() => { });
            import("@/src/components/modal/auth/loginModal").catch(() => { });
        };

        if (typeof window !== "undefined") {
            if ("requestIdleCallback" in window) {
                window.requestIdleCallback(() => prefetchModals());
            } else {
                setTimeout(prefetchModals, 2000);
            }
        }
    }, []);

    const handlePrefetch = React.useCallback(async (productId: number | string, productSlug?: string) => {
        const isNumericId = typeof productId === 'number' || (typeof productId === 'string' && /^\d+$/.test(productId));
        const pid = isNumericId ? Number(productId) : null;
        const identifier = productSlug || (isNumericId ? pid : productId);
        if (!identifier) return;

        // Trigger fetchBusinessCategories and fetchProductById in parallel for background warmth
        // This fills the browser's fetch cache and the server-side revalidation cache.
        fetchProductById(identifier, token).catch(() => { });
    }, [token]);

    const handleProductClick = React.useCallback(async (productId: number | string, businessName?: string, e?: React.MouseEvent, businessSlug?: string, isSocialPost: boolean = false, productSlug?: string) => {
        if (fetchingProductId) return;
        setIsOpeningProduct(true);

        // Capture click position
        if (e) {
            setClickPos({ x: e.clientX, y: e.clientY });
        } else {
            setClickPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        }

        if (isSocialPost) {
            const post = products.find(p =>
                p.is_social_post &&
                (p.product_id === productId || p.product_slug === productSlug || p.slug === productSlug)
            );
            if (post) {
                // When watching reels/social posts from market, we want the product slug in the tab
                updateUrl(post.product_id, post.business_name, true, post.business_slug, true, post.product_slug);
                setSelectedSocialPost(post);
                setSocialPostModalOpen(true);
                setIsOpeningProduct(false);
            }
            // If it's a social post but not in list, we might need a dedicated fetch (TBD based on API availability)
            setIsOpeningProduct(false);
            return;
        }

        const isNumericId = typeof productId === 'number' || (typeof productId === 'string' && /^\d+$/.test(productId));
        const pid = isNumericId ? Number(productId) : null;
        const identifier = productSlug || (isNumericId ? pid : productId);

        if (!identifier || identifier === "undefined" || identifier === "null") {
            setFetchingProductId(null);
            return;
        }

        updateUrl(pid, businessName, false, businessSlug, false, productSlug);

        // --- OPTIMISTIC OPEN (High Speed Optimization) ---
        // We open the modal IMMEDIATELY using the basic product data we already have in the list.
        // This ensures the hardware-accelerated animation starts the moment the user taps.
        const optimisticProduct = products.find(p => p.product_id === (pid || productId));
        if (optimisticProduct) {
            const initialPayload = mapProductToPreviewPayload(optimisticProduct, formatUrl);
            setSelectedProductPayload(initialPayload);
            setModalOpen(true);
            setIsOpeningProduct(false);
        }

        try {
            setFetchingProductId(identifier);
            const res = await fetchProductById(identifier, token);
            if (res?.data?.product) {
                const dbProduct = res.data.product;
                const mappedPayload = mapProductToPreviewPayload(dbProduct, formatUrl);

                // If top-level quantity exists in inventory fallback
                const baseInv = (dbProduct.inventory || []).find((inv: any) => !inv.sku_id && !inv.variant_option_id);
                if (baseInv && mappedPayload) mappedPayload.quantity = baseInv.quantity;

                // Update the state with full data (re-renders the already open modal)
                setSelectedProductPayload(mappedPayload);

                // Ensure modal is open if it wasn't already (e.g. product not found in local list)
                if (!modalOpen) {
                    setModalOpen(true);
                }
                setIsOpeningProduct(false);

                // Log view IMMEDIATELY
                logUserActivity({
                    product_id: dbProduct.product_id,
                    action_type: 'view',
                    category: dbProduct.category,
                    business_id: dbProduct.business_id
                }, token).catch(() => { });

                // Update URL with slug (clean URL)
                updateUrl(dbProduct.product_id, dbProduct.business_name, false, dbProduct.business_slug, false, dbProduct.slug || dbProduct.product_slug);
            }
        } catch (err: any) {
            console.error("Critical handleProductClick failed:", {
                message: err?.message || "Unknown error",
                status: err?.status,
                body: err?.body,
                identifier,
                rawError: err,
            });
        } finally {
            setFetchingProductId(null);
            setIsOpeningProduct(false);
        }
    }, [fetchingProductId, formatUrl, updateUrl, token, products, modalOpen]);

    const handleReelsClick = React.useCallback(async (productId: number | string, businessName?: string, e?: React.MouseEvent, businessSlug?: string, productSlug?: string) => {
        handleProductClick(productId, businessName, e, businessSlug, false, productSlug);
    }, [handleProductClick]);

    // Handle deep linking from URL and Browser Back/Forward buttons
    useEffect(() => {
        const handleRouteChange = () => {
            const params = new URLSearchParams(window.location.search);
            const isReels = params.get("reels") === "true";
            const currentPath = window.location.pathname;
            const pathParts = currentPath.split('/').filter(Boolean);

            // URL shape: /{base}/{bizSlug}/{productSlug}
            // We ONLY trigger a modal if we have at least 3 parts (base, biz, product)
            const currentSlug = pathParts.length >= 3 ? pathParts[2] : null;

            if (currentSlug) {
                const alreadyOpenProduct = modalOpen && selectedProductPayload?.slug === currentSlug;
                const alreadyOpenSocial = socialPostModalOpen && (selectedSocialPost?.product_slug === currentSlug || selectedSocialPost?.slug === currentSlug);

                if (isReels) {
                    if (alreadyOpenSocial) {
                        if (modalOpen) setModalOpen(false);
                        return;
                    }
                    if (!fetchingProductId) {
                        const post = products.find(p => p.is_social_post && p.product_slug === currentSlug);
                        if (post) {
                            setSelectedSocialPost(post);
                            setSocialPostModalOpen(true);
                        } else {
                            // If not found in current products list, we try to fetch it
                            // Pass isSocialPost = true so handleProductClick knows how to handle it
                            handleProductClick("", undefined, undefined, undefined, true, currentSlug);
                        }
                    }
                } else {
                    if (alreadyOpenProduct) {
                        if (socialPostModalOpen) setSocialPostModalOpen(false);
                        return;
                    }
                    if (!fetchingProductId) {
                        handleProductClick("", undefined, undefined, undefined, false, currentSlug);
                    }
                }
            } else {
                // If we are at the base /market or /market/shop, close any open modals
                if (modalOpen) {
                    setModalOpen(false);
                    setSelectedProductPayload(null);
                }
                if (reelsModalOpen) {
                    setReelsModalOpen(false);
                    setSelectedProductId(null);
                }
                if (socialPostModalOpen) {
                    setSocialPostModalOpen(false);
                    setSelectedSocialPost(null);
                }
            }
        };

        // Listen for browser back/forward
        window.addEventListener('popstate', handleRouteChange);

        // Initial check
        handleRouteChange();

        return () => window.removeEventListener('popstate', handleRouteChange);
    }, [modalOpen, fetchingProductId, selectedProductPayload, handleProductClick, socialPostModalOpen, selectedSocialPost, products]);

    return (
        <>
            {/* Dynamic Pull-to-Refresh Indicator */}
            {(pullDistance > 0 || isRefreshing) && (
                <div 
                    style={{ 
                        top: isScrolled ? "0px" : "64px",
                        height: `${isRefreshing ? 60 : pullDistance}px`,
                        opacity: isRefreshing ? 1 : Math.min(pullDistance / 40, 1),
                    }}
                    className="fixed left-0 right-0 z-[2600] flex items-center justify-center pointer-events-none transition-all duration-150"
                >
                    <div 
                        style={{
                            transform: `translateY(${isRefreshing ? 12 : Math.max(0, pullDistance - 40)}px)`,
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 shadow-md border border-slate-100 backdrop-blur-sm transition-transform duration-75"
                    >
                        <div 
                            style={{ 
                                transform: isRefreshing ? undefined : `rotate(${pullDistance * 4.5}deg)`,
                                transition: isRefreshing ? "none" : "transform 75ms linear"
                            }}
                            className="flex items-center justify-center shrink-0"
                        >
                            <StoqleLoader size={14} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600">
                            {isRefreshing ? "Refreshing..." : pullDistance > 60 ? "Release to refresh" : "Pull to refresh"}
                        </span>
                    </div>
                </div>
            )}
            <motion.section 
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.1}
                onDragEnd={(e, info) => {
                    // Only handle swipes if no modal is open
                    if (modalOpen || reelsModalOpen || socialPostModalOpen || privacyModalOpen || termsModalOpen || returnsModalOpen || helpModalOpen) return;
                    
                    const threshold = 100;
                    const velocityThreshold = 500;
                    const { offset, velocity } = info;

                    if (Math.abs(offset.x) > threshold || Math.abs(velocity.x) > velocityThreshold) {
                        // Prevent swipe if user is mostly scrolling vertically
                        if (Math.abs(offset.y) > Math.abs(offset.x)) return;

                        const currentIndex = CATEGORIES.indexOf(activeCategory);
                        if (offset.x < -threshold && currentIndex < CATEGORIES.length - 1) {
                            // Swiped Left -> Next Tab
                            onCategoryChange(CATEGORIES[currentIndex + 1]);
                        } else if (offset.x > threshold && currentIndex > 0) {
                            // Swiped Right -> Previous Tab
                            onCategoryChange(CATEGORIES[currentIndex - 1]);
                        }
                    }
                }}
                className={`min-h-screen transition-colors duration-500 pb-10 ${activeCategory === "PARTNERS" ? "bg-[#f0fdf4]" : "bg-slate-50"}`}>
                {!hideTabs && (
                    <div className={`sticky z-20 ${isScrolled ? "top-0 !z-[2500]" : "top-[64px]"} ${activeCategory === "PARTNERS" ? "bg-[#f0fdf4]" : "bg-white"} transition-colors duration-500`}>
                        <div ref={tabsRef} className="flex px-4 py-2.5 gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                            {CATEGORIES.map((item) => (
                                <button
                                    key={item}
                                    data-active={activeCategory === item}
                                    onClick={() => onCategoryChange(item)}
                                    className={`whitespace-nowrap relative rounded-full px-3 py-1.5 text-sm transition-all ${activeCategory === "PARTNERS"
                                        ? item === "PARTNERS"
                                            ? "text-emerald-600 font-bold italic tracking-tighter"
                                            : activeCategory === item
                                                ? "text-white bg-emerald-600 font-bold italic shadow-md shadow-emerald-100"
                                                : "hover:bg-emerald-100 text-emerald-700"
                                        : item === "PARTNERS"
                                            ? "text-emerald-600 font-bold italic tracking-tighter"
                                            : activeCategory === item
                                                ? "text-rose-500 font-bold monospace italic"
                                                : "hover:bg-slate-200 text-slate-600"
                                        }`}
                                >
                                    {item === "PARTNERS" && activeCategory === "PARTNERS" && (
                                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white text-rose-500 text-[7px] font-bold border-[0.5px] border-rose-500 px-1.5 rounded-full z-10  tracking-tighter shadow-sm py-0.5">Verified</span>
                                    )}
                                    {item}
                                </button>
                            ))}
                        </div>

                        {/* Actionable Orders Marquee - hide when scrolled to reduce height */}
                        {!isScrolled && actionableData && (actionableData.vendorPendingCount > 0 || actionableData.customerDeliveredCount > 0 || actionableData.customerOutForDeliveryCount > 0) && (
                            <div
                                className={`w-full py-1.5 overflow-hidden group cursor-pointer ${actionableData.vendorPendingCount > 0
                                    ? "bg-orange-50 border-orange-100"
                                    : "bg-blue-50 border-blue-100"
                                    }`}
                                onClick={() => {
                                    if (actionableData.vendorPendingCount > 0) {
                                        router.push("/profile/business/customer-order");
                                    } else {
                                        router.push("/profile/orders");
                                    }
                                }}
                            >
                                <div className="flex animate-marquee-market whitespace-nowrap">
                                    <div className="flex items-center gap-12 px-4">
                                        {actionableData.vendorPendingCount > 0 ? (
                                            <>
                                                <span className="text-[10px] font-bold text-orange-700  tracking-wider flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                                    ⚠️ You have ({actionableData.vendorPendingCount}) new {actionableData.vendorPendingCount === 1 ? 'order' : 'orders'} waiting to be shipped! Please process them as soon as possible to maintain your vendor rating. Click here to view and ship orders.
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                {actionableData.customerOutForDeliveryCount > 0 && (
                                                    <span className="text-[10px] font-bold text-blue-700 tracking-wider flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                        📦 You have ({actionableData.customerOutForDeliveryCount}) {actionableData.customerOutForDeliveryCount === 1 ? 'order' : 'orders'} out for delivery! Please share the delivery code with the vendor or rider if the product has delivered to you.
                                                    </span>
                                                )}
                                                {actionableData.customerDeliveredCount > 0 && (
                                                    <span className="text-[10px] font-bold text-blue-700 tracking-wider flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                        📦 You have ({actionableData.customerDeliveredCount}) {actionableData.customerDeliveredCount === 1 ? 'order' : 'orders'} delivered! Please click here to confirm receipt and release payment.
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-12 px-4">
                                        {actionableData.vendorPendingCount > 0 ? (
                                            <span className="text-[10px] font-bold text-orange-700 tracking-wider flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                                ⚠️ You have ({actionableData.vendorPendingCount}) new {actionableData.vendorPendingCount === 1 ? 'order' : 'orders'} waiting to be shipped! Please process them as soon as possible.
                                            </span>
                                        ) : (
                                            <>
                                                {actionableData.customerOutForDeliveryCount > 0 && (
                                                    <span className="text-[10px] font-bold text-blue-700 tracking-wider flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                        📦 You have ({actionableData.customerOutForDeliveryCount}) {actionableData.customerOutForDeliveryCount === 1 ? 'order' : 'orders'} out for delivery! Please share the delivery code with the vendor or rider if the product has delivered to you.
                                                    </span>
                                                )}
                                                {actionableData.customerDeliveredCount > 0 && (
                                                    <span className="text-[10px] font-bold text-blue-700 tracking-wider flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                        📦 You have ({actionableData.customerDeliveredCount}) {actionableData.customerDeliveredCount === 1 ? 'order' : 'orders'} delivered! Please click here to confirm receipt and release payment.
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <AnimatePresence>
                    {showManualLoading && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="flex justify-center items-center py-6 bg-slate-50 overflow-hidden"
                        >
                            <div className="flex items-center gap-2 px-6 py-3 ">
                                <StoqleLoader size={20} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {loading ? (
                    <MarketSkeleton category={activeCategory} hideSubCategories={hideSubCategories} />
                ) : error ? (
                    <div className="py-24 flex flex-col items-center justify-center text-center px-4">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mb-6 text-rose-500 shadow-sm border border-rose-100"
                        >
                            {typeof window !== "undefined" && !navigator.onLine ? (
                                <WifiOff size={40} strokeWidth={1.5} />
                            ) : (
                                <RotateCcw size={40} strokeWidth={1.5} className="animate-pulse" />
                            )}
                        </motion.div>
                        <h3 className="text-xl font-black text-slate-900 mb-2 truncate max-w-full px-2">
                            {typeof window !== "undefined" && !navigator.onLine ? "You're Offline" : "Oops! Something went wrong"}
                        </h3>
                        <p className="text-slate-500 mb-8 max-w-xs leading-relaxed">
                            {error}
                        </p>
                        <button
                            onClick={() => {
                                setError(null);
                                fetchPage(0);
                            }}
                            className="flex items-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-full font-black hover:bg-slate-800 active:scale-95 transition-all shadow-lg shadow-slate-200"
                        >
                            <RotateCcw size={18} />
                            Try Reconnecting
                        </button>
                    </div>
                ) : (
                    <div className="px-1">
                        {activeCategory === "Rules" ? (
                            <RulesSection
                                onOpenPrivacy={() => {
                                    setIsOpeningProduct(true);
                                    setTimeout(() => {
                                        setPrivacyModalOpen(true);
                                        setIsOpeningProduct(false);
                                    }, 600);
                                }}
                                onOpenTerms={() => {
                                    setIsOpeningProduct(true);
                                    setTimeout(() => {
                                        setTermsModalOpen(true);
                                        setIsOpeningProduct(false);
                                    }, 600);
                                }}
                                onOpenReturns={() => {
                                    setIsOpeningProduct(true);
                                    setTimeout(() => {
                                        setReturnsModalOpen(true);
                                        setIsOpeningProduct(false);
                                    }, 600);
                                }}
                                onOpenHelp={() => {
                                    setIsOpeningProduct(true);
                                    setTimeout(() => {
                                        setHelpModalOpen(true);
                                        setIsOpeningProduct(false);
                                    }, 600);
                                }}
                                onLinkClick={(href) => {
                                    setIsOpeningProduct(true);
                                    setTimeout(() => {
                                        router.push(href);
                                        // We keep it true for a bit while next.js starts the transition
                                        setTimeout(() => setIsOpeningProduct(false), 1000);
                                    }, 600);
                                }}
                            />
                        ) : (
                            <>
                                {/* ── For You quick-action strip ── */}
                                {activeCategory === "For you" && !hideSubCategories && (
                                    <ForYouStrip
                                        router={router}
                                        onTrending={() => {
                                            // scroll to top so Trending feed is visible
                                            window.scrollTo({ top: 0, behavior: "smooth" });
                                        }}
                                        onNavigate={(href) => {
                                            setIsOpeningProduct(true);
                                            router.push(href);
                                        }}
                                    />
                                )}

                                {/* ── Subcategory strip for business categories ── */}
                                {activeCategory !== "For you" && activeCategory !== "Rules" && !hideSubCategories && (
                                    <SubCategoryStrip
                                        category={activeCategory}
                                        onSelect={(name) => {
                                            const href = `/market/subcategory/${encodeURIComponent(activeCategory)}/${encodeURIComponent(name)}`;
                                            setIsOpeningProduct(true);
                                            router.push(href);
                                        }}
                                        onNavigate={(href) => {
                                            setIsOpeningProduct(true);
                                            router.push(href);
                                        }}
                                    />
                                )}

                                {filteredProducts.length > 0 ? (
                                    <MasonryGrid
                                        items={filteredProducts}
                                        likeData={likeData}
                                        postLikeData={postLikeData}
                                        fetchingProductId={fetchingProductId}
                                        handleProductClick={handleProductClick}
                                        handleReelsClick={handleReelsClick}
                                        handleLikeClick={handleLikeClick}
                                        handlePostLikeClick={handlePostLikeClick}
                                        handlePrefetch={handlePrefetch}
                                        formatUrl={formatUrl}
                                        router={router}
                                        isRestored={isRestoring}
                                        isPartnerTab={activeCategory === "PARTNERS"}
                                    />
                                ) : (
                                    <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                        <div className="w-30 h-30 ">
                                            <img src="/assets/images/cart.png" alt="" />
                                        </div>
                                        <p className="text-sm font-medium">No results found in this category</p>
                                        <button
                                            onClick={() => setActiveCategory("For you")}
                                            className="mt-4 text-xs font-bold text-rose-500 hover:underline"
                                        >
                                            View all products
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Lazy Load Trigger - only show if not in main loading/error state */}
                {!loading && !error && (
                    <div ref={loaderRef} className="py-10 flex justify-center">
                        {isLoadingMore && hasMore && (
                            <StoqleLoader size={30} />
                        )}
                        {!hasMore && products.length > 0 && (
                            <p className="text-slate-400 text-xs italic">- THE END -</p>
                        )}
                    </div>
                )}

            </motion.section >

            {/* Floating Action Buttons */}
            <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-3">
                {/* Scroll to Top */}
                <AnimatePresence>
                    {showScrollTop && (
                        <motion.button
                            initial={{ opacity: 0, y: 20, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.8 }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={scrollToTop}
                            className="w-12 h-12 bg-white text-slate-900 rounded-full shadow-2xl flex items-center justify-center border border-slate-100 hover:bg-slate-50 transition-colors"
                            title="Back to Top"
                        >
                            <ArrowUp className="w-5 h-5" />
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* Shopping Cart Button */}
                {!hideCartIcon && (
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => router.push('/cart')}
                        className="w-12 h-12 bg-white text-slate-900 rounded-full shadow-2xl flex items-center justify-center border border-slate-100 hover:bg-slate-50 transition-colors"
                        title="View Cart"
                    >
                        <ShoppingCart className="w-5 h-5" />
                    </motion.button>
                )}
            </div>

            {/* Render ProductPreviewModal directly! Reusing your existing component but with real mapping. */}
            <AnimatePresence>
                {
                    modalOpen && selectedProductPayload && (
                        <ProductPreviewModal
                            key="market-product-preview-modal"
                            open={modalOpen}
                            payload={selectedProductPayload}
                            origin={clickPos}
                            isFetching={fetchingProductId !== null}
                            onClose={() => {
                                setModalOpen(false);
                                setSelectedProductPayload(null);
                                updateUrl(null, undefined, false, undefined, false, undefined, true);
                            }}
                            onProductClick={handleProductClick}
                            onReelsClick={handleReelsClick}
                        />
                    )
                }
            </AnimatePresence>

            <AnimatePresence>
                {socialPostModalOpen && selectedSocialPost && (
                    <PostModal
                        open={socialPostModalOpen}
                        post={selectedSocialPost}
                        onClose={() => {
                            setSocialPostModalOpen(false);
                            setSelectedSocialPost(null);
                            updateUrl(null, undefined, false, undefined, false, undefined, true);
                        }}
                        onToggleLike={() => { }}
                        userToken={token}
                        isProductLinkedOnly={true}
                        onActivePostChange={(p) => {
                            // Sync URL when swiping in mobile reels
                            // Handle both mapped grid items and raw background-fetched reels
                            const lp = p.linked_product || (p.is_social_post ? {} : p);
                            const prodSlug = p.product_slug || lp.slug || lp.product_slug || (lp.title ? slugify(lp.title) : null);
                            const bizSlug = p.business_slug || lp.business_slug || p.user?.business_slug;
                            const bizName = p.business_name || lp.business_name || p.user?.name;

                            // We use replace: true here so swipe history doesn't grow
                            updateUrl(p.product_id || `post-${p.id}`, bizName, true, bizSlug, true, prodSlug, true);
                        }}
                    />
                )}
            </AnimatePresence>

            <ReelsModal
                open={reelsModalOpen}
                initialProductId={selectedProductId}
                origin={clickPos}
                onClose={() => {
                    setReelsModalOpen(false);
                    setSelectedProductId(null);
                    // Instead of null, restore the preview ID if it exists
                    updateUrl(selectedProductPayload?.productId || null);
                }}
                onActiveProductChange={(pid, bizName, bizSlug) => {
                    setSelectedProductId(pid);
                    const params = new URLSearchParams(window.location.search);
                    params.set("reels", "true");
                    params.set("product_id", String(pid));
                    const search = params.toString();

                    let path = window.location.pathname;
                    const slug = bizSlug || (bizName ? slugify(bizName) : null);
                    if (slug) {
                        path = `/market/${slug}`;
                    }

                    const currentUrl = `${path}${search ? `?${search}` : ""}`;
                    window.history.replaceState(window.history.state, "", currentUrl);
                }}
            />

            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

            {/* Instant Loader Overlay for Product/Post Modal */}
            <AnimatePresence>
                {isOpeningProduct && (
                    <div className="fixed inset-0 z-[999999] flex items-center justify-center pointer-events-none"
                    >
                        <div className="">
                            <StoqleLoader size={30} />
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* --- WARMING INSTANCE (Zero-Delay Optimization) --- 
                We render a hidden instance of the modal once the page has products.
                This ensures React parses the component, initializes hooks, and prepares 
                the animation engine BEFORE the user ever clicks.
            */}
            {isHydrated && products.length > 0 && !modalOpen && (
                <div className="hidden pointer-events-none" aria-hidden="true">
                    <ProductPreviewModal
                        open={false}
                        payload={null}
                        onClose={() => { }}
                    />
                </div>
            )}

            <PrivacyPolicyModal open={privacyModalOpen} onClose={() => setPrivacyModalOpen(false)} />
            <UserAgreementModal open={termsModalOpen} onClose={() => setTermsModalOpen(false)} />
            <SevenDayReturnModal open={returnsModalOpen} onClose={() => setReturnsModalOpen(false)} />
            <HelpCenterModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />

            <style jsx global>{`
                html {
                    scroll-behavior: smooth;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes marquee-market {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-33.33%); }
                }
                .animate-marquee-market {
                    display: flex;
                    animation: marquee-market 30s linear infinite;
                }
                .group:hover .animate-marquee-market {
                    animation-play-state: paused;
                }
                header.fixed.top-0.is-partners {
                    background-color: #f0fdf4 !important; /* light emerald matching bg */
                    color: #059669 !important;
                    box-shadow: 0 4px 12px rgba(5, 150, 105, 0.05) !important;
                    transition: background-color 0.4s ease, color 0.4s ease;
                }
                header.fixed.top-0.is-partners span, 
                header.fixed.top-0.is-partners a,
                header.fixed.top-0.is-partners p,
                header.fixed.top-0.is-partners svg,
                header.fixed.top-0.is-partners h1 {
                    color: #059669 !important;
                }
                header.fixed.top-0.is-partners input {
                    background-color: white !important;
                    color: #059669 !important;
                    border-color: #d1fae5 !important;
                }
                header.fixed.top-0.is-partners input::placeholder {
                    color: #6ee7b7 !important;
                }
            `}</style>
        </>
    );
}
