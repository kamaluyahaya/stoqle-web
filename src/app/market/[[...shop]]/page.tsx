"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import LoginModal from "@/src/components/modal/auth/loginModal";
import ShimmerGrid from "@/src/components/shimmer";
import { fetchMarketFeed, fetchProductById, toggleProductLike } from "@/src/lib/api/productApi";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import ReelsModal from "@/src/components/product/addProduct/modal/reelsModal";
import type { PreviewPayload, ProductSku, ProductFeedItem } from "@/src/types/product";
import { API_BASE_URL } from "@/src/lib/config";
import { MARKET_CACHE } from "@/src/lib/cache";

type Props = {
    params: Promise<{ shop?: string[] }>,
    postCount?: number
};

const slugify = (str: string) =>
    String(str || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

function LikeBurst() {
    const particles = Array.from({ length: 12 });
    const colors = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B"];
    return (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
            {particles.map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
                    animate={{
                        x: Math.cos((i * 30) * Math.PI / 180) * 60,
                        y: Math.sin((i * 30) * Math.PI / 180) * 60,
                        scale: [0.2, 1.2, 1.8, 0],
                        opacity: [1, 1, 1, 0],
                        rotate: [0, 45, 90]
                    }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="absolute"
                >
                    <FaHeart size={12} style={{ color: colors[i % colors.length] }} className="drop-shadow-sm" />
                </motion.div>
            ))}
        </div>
    );
}



const ProductCard = React.memo(({
    p,
    index = 0,
    isVideoCover,
    formatUrl,
    handleProductClick,
    handleReelsClick,
    handleLikeClick,
    isLiked,
    likeCount,
    fetchingProduct,
    router,
    isRestored = false
}: any) => {
    const [showBurst, setShowBurst] = useState(false);

    const isPromoActive = useMemo(() => {
        return !!(p.promo_title && p.promo_discount && (!p.promo_end || new Date(p.promo_end) >= new Date()));
    }, [p.promo_title, p.promo_discount, p.promo_end]);

    // Animation variants
    const entryVariants = {
        initial: isRestored ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.95, y: 15 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: isRestored ? { duration: 0 } : { 
            duration: 0.9, 
            delay: Math.min(index * 0.1, 1.2), 
            ease: [0.21, 1.11, 0.81, 0.99] as any
        }
    };

    return (
        <article
            key={`${p.product_id}${isVideoCover ? '-vid' : ''}`}
            onClick={(e) => {
                if (isVideoCover) {
                    handleReelsClick(p.product_id, p.business_name, e);
                } else {
                    handleProductClick(p.product_id, p.business_name, e);
                }
            }}
            className="group flex flex-col rounded-[1.05rem] bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden"
            style={{ 
                willChange: "transform, opacity",
                contentVisibility: "auto",
                containIntrinsicSize: "auto 400px"
            }}
        >
            <div className="relative w-full overflow-hidden bg-slate-100 min-h-[220px]" style={{ aspectRatio: "10/11" }}>
                <motion.div
                    initial={entryVariants.initial}
                    animate={entryVariants.animate}
                    transition={entryVariants.transition}
                    className="w-full h-full"
                >
                {isVideoCover ? (
                    <video
                        src={formatUrl(p.product_video!)} // Removed seeking fragment to prevent blinking
                        poster={formatUrl(p.first_image)}
                        muted
                        loop
                        playsInline
                        preload="auto"
                        className="w-full h-auto min-h-[250px] max-h-[300px] object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                ) : (
                    <div className="relative w-full h-full">
                        <style jsx global>{`
                            @keyframes fadeIn {
                                from { opacity: 0; }
                                to { opacity: 1; }
                            }
                        `}</style>
                        <Image
                            src={formatUrl(p.first_image)}
                            alt={p.title}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                            className="object-cover transition-all duration-700 group-hover:scale-110"
                            priority={p.product_id % 5 < 2}
                            onLoadingComplete={(img) => {
                                img.style.animation = "fadeIn 0.6s ease-in-out forwards";
                            }}
                            style={{ opacity: 0 }}
                        />
                    </div>
                )}

                {isVideoCover && (
                    <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-md rounded-full  z-10  p-1">
                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5.14v14l11-7-11-7z" />
                        </svg>
                    </div>
                )}

                {!isVideoCover && fetchingProduct && (
                    <div className="absolute inset-0 bg-white/30 z-20 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
                </motion.div>
                
                {/* Placeholder frame indicator */}
                <div className="absolute inset-0 -z-10 flex items-center justify-center bg-slate-50/50">
                    <div className="flex flex-col items-center gap-2 opacity-20">
                        <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
                        <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Opening...</span>
                    </div>
                </div>
            </div>

            <div className="p-3">
                {isVideoCover ? (
                    <>
                        <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded p-1 mb-2">
                            <div className="w-8 h-8 relative rounded shrink-0 overflow-hidden border border-slate-200">
                                <Image
                                    src={formatUrl(p.first_image)}
                                    alt="product thumbnail"
                                    fill
                                    sizes="32px"
                                    className="object-cover"
                                />
                            </div>
                            <span className="text-slate-900 text-sm font-bold tracking-tight pr-1">₦{Number(p.price || 0).toLocaleString()}</span>
                            {p.sold_count > 0 && (
                                <span className="text-[10px] text-slate-500 font-medium ml-auto pr-1">{p.sold_count.toLocaleString()} Sold</span>
                            )}
                        </div>
                        <h3 className="text-sm text-slate-800 line-clamp-1 leading-snug mb-2" title={p.title}>
                            {p.title || "Untitled Product"}
                        </h3>
                        <div className="flex items-center justify-between">
                            <div
                                className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (p.business_id) router.push(`/shop/${p.business_id}`);
                                }}
                            >
                                <div className="h-5 w-5 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
                                    <Image
                                        src={p.logo ? formatUrl(p.logo) : (p.profile_pic ? formatUrl(p.profile_pic) : "/assets/images/favio.png")}
                                        fill
                                        sizes="20px"
                                        className="object-cover"
                                        alt="Vendor"
                                    />
                                </div>
                                <span className="truncate text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors max-w-[120px]">
                                    {p.business_name || "Unknown Store"}
                                </span>
                            </div>
                            <div
                                className="flex items-center gap-1 cursor-pointer relative"
                                onClick={(e) => {
                                    if (!isLiked) {
                                        setShowBurst(true);
                                        setTimeout(() => setShowBurst(false), 800);
                                    }
                                    handleLikeClick(e, p.product_id, p.likes_count || 0);
                                }}
                            >
                                {showBurst && <LikeBurst />}

                                <div className="relative w-4 h-4 flex items-center justify-center">
                                    <AnimatePresence>
                                        <motion.div
                                            key={isLiked ? "liked" : "unliked"}
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0.5, opacity: 0 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                            className={`absolute inset-0 flex items-center justify-center ${isLiked ? 'text-red-500' : 'text-slate-400'}`}
                                        >
                                            {isLiked ? <FaHeart className="text-sm" /> : <FaRegHeart className="text-sm" />}
                                        </motion.div>
                                    </AnimatePresence>

                                    {/* Pulse effect */}
                                    {isLiked && (
                                        <motion.div
                                            initial={{ scale: 1, opacity: 1 }}
                                            animate={{ scale: [1, 1.8, 1], opacity: [1, 0.4, 0] }}
                                            transition={{ duration: 0.6 }}
                                            className="absolute text-red-500 pointer-events-none"
                                        >
                                            <FaHeart size={14} />
                                        </motion.div>
                                    )}
                                </div>
                                <span className="text-xs font-semibold text-slate-600 ml-0.5">{likeCount}</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-between pt-1 border-slate-50">
                            <div
                                className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (p.business_id) router.push(`/shop/${p.business_id}`);
                                }}
                            >
                                <div className="h-5 w-5 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
                                    <Image
                                        src={p.logo ? formatUrl(p.logo) : (p.profile_pic ? formatUrl(p.profile_pic) : "/assets/images/favio.png")}
                                        fill
                                        sizes="20px"
                                        className="object-cover"
                                        alt="Vendor"
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1">
                                        <span className="truncate text-[11px] text-orange-600 hover:text-slate-900 transition-colors">
                                            {p.business_name || "Unknown Store"}
                                        </span>
                                        {p.trusted_partner === 1 && (
                                            <svg className="w-3 h-3 text-emerald-700" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <h3 className="text-sm text-slate-800 line-clamp-2 leading-snug mb-2.5" title={p.title}>
                            {p.trusted_partner === 1 && (
                                <span className="inline-flex items-center gap-1 shrink-0 mr-1.5 align-text-bottom">
                                    <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm shadow-sm  tracking-wider">
                                        Partner
                                    </span>
                                </span>
                            )}
                            <span className="align-middle ">{p.title || "Untitled Product"}</span>
                        </h3>

                        <div className=" flex items-center min-h-[16px]">
                            {isPromoActive ? (
                                <span className="text-[10px] font-bold text-rose-500 border-red-500 border px-1 tracking-widest truncate">
                                    {p.promo_title} {p.promo_discount}% OFF
                                </span>
                            ) : p.sale_type ? (
                                <span className="text-[10px] font-bold text-rose-500 border-red-500 border tracking-widest truncate">
                                    {p.sale_type} {p.sale_discount}% Off
                                </span>
                            ) : (p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) <= 4) ? (
                                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest truncate">
                                    Only {Number(p.total_quantity)} Left
                                </span>
                            ) : p.return_shipping_subsidy === 1 ? (
                                <span className="text-[10px] font-bold text-green-700  tracking-widest truncate">
                                    Return Shipping Subsidy
                                </span>
                            ) : p.market_name ? (
                                <span className="text-[10px] font-bold text-rose-500  tracking-widest truncate">
                                    {p.market_name}
                                </span>
                            ) : null}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                            <span className="text-slate-900 text-base">₦{Number(p.price || 0).toLocaleString()}</span>
                        </div>
                    </>
                )}
            </div>
        </article >
    );
}, (prevProps, nextProps) => {
    // Custom comparison: extremely strict to prevent flickering
    return prevProps.p.product_id === nextProps.p.product_id &&
        prevProps.isLiked === nextProps.isLiked &&
        prevProps.likeCount === nextProps.likeCount &&
        prevProps.fetchingProduct === nextProps.fetchingProduct &&
        prevProps.isVideoCover === nextProps.isVideoCover;
});
ProductCard.displayName = "ProductCard";

const MasonryGrid = ({ items, likeData, fetchingProductId, handleProductClick, handleReelsClick, handleLikeClick, formatUrl, router, isRestored }: any) => {
    const [columns, setColumns] = useState(5);

    useEffect(() => {
        const updateColumns = () => {
            const w = window.innerWidth;
            if (w < 700) setColumns(2);
            else if (w < 1210) setColumns(3);
            else if (w < 1430) setColumns(4);
            else setColumns(5);
        };
        updateColumns();
        window.addEventListener('resize', updateColumns);
        return () => window.removeEventListener('resize', updateColumns);
    }, []);

    // Distribute items into columns (Serial Horizontal order)
    const columnData = useMemo(() => {
        const data = Array.from({ length: columns }, () => [] as any[]);
        items.forEach((item: any, index: number) => {
            data[index % columns].push(item);
        });
        return data;
    }, [items, columns]);

    return (
        <div className="flex gap-2 sm:gap-6 items-start w-full max-w-full overflow-hidden">
            {columnData.map((colItems, colIdx) => {
                let visibilityClass = "flex-1 flex flex-col gap-2 sm:gap-6 min-w-0";
                if (colIdx === 2) visibilityClass += " hidden [@media(min-width:700px)]:flex";
                if (colIdx === 3) visibilityClass += " hidden [@media(min-width:1210px)]:flex";
                if (colIdx === 4) visibilityClass += " hidden [@media(min-width:1430px)]:flex";

                return (
                    <div key={colIdx} className={visibilityClass}>
                        {colItems.map((p: any) => {
                            const ld = likeData[p.product_id] || { liked: !!p.isLiked, count: p.likes_count || 0 };
                            return (
                                <ProductCard
                                    key={`${p.product_id}-${p.originalIndex}`}
                                    index={p.originalIndex}
                                    isVideoCover={!!p.product_video}
                                    p={p}
                                    formatUrl={formatUrl}
                                    handleProductClick={(id: number, b: string, e: any) => handleProductClick(id, b, e)}
                                    handleReelsClick={(id: number, b: string, e: any) => handleReelsClick(id, b, e)}
                                    handleLikeClick={handleLikeClick}
                                    isLiked={ld.liked}
                                    likeCount={ld.count}
                                    fetchingProduct={fetchingProductId === p.product_id}
                                    router={router}
                                    isRestored={isRestored}
                                />
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
};



export default function MarketPage({ params, postCount = 100 }: Props) {
    const routeParams = React.use(params);
    const [activeCategory, setActiveCategory] = useState<string>(MARKET_CACHE.category);
    const [products, setProducts] = useState<any[]>(MARKET_CACHE.products);
    const [loading, setLoading] = useState<boolean>(MARKET_CACHE.products.length === 0);
    const [isRestoring, setIsRestoring] = useState<boolean>(MARKET_CACHE.products.length > 0);
    const [error, setError] = useState<string | null>(null);
    const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [reelsModalOpen, setReelsModalOpen] = useState(false);
    const [fetchingProductId, setFetchingProductId] = useState<number | null>(null);
    const [clickPos, setClickPos] = useState({ x: 0, y: 0 });

    // --- Pagination State ---
    const [page, setPage] = useState(MARKET_CACHE.page);
    const [hasMore, setHasMore] = useState(MARKET_CACHE.hasMore);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loaderRef = useRef<HTMLDivElement>(null);
    const LIMIT = 10;

    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, token } = useAuth();
    const [showLoginModal, setShowLoginModal] = useState(false);

    const [likeData, setLikeData] = useState<Record<number, { liked: boolean, count: number }>>(MARKET_CACHE.likeData);
    // const formatUrl = React.useCallback((url: string) => {
    //     if (!url) return "https://via.placeholder.com/800x600?text=No+Image";
    //     if (url.startsWith("http")) return url;
    //     return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    // }, []);

    const handleLikeClick = React.useCallback(async (e: React.MouseEvent, productId: number, baseCount: number) => {
        e.stopPropagation();
        if (!user || !token) {
            setShowLoginModal(true);
            return;
        }

        const current = likeData[productId] || { liked: false, count: baseCount };
        const newLiked = !current.liked;
        const newCount = newLiked ? current.count + 1 : Math.max(0, current.count - 1);

        setLikeData(prev => ({
            ...prev,
            [productId]: { liked: newLiked, count: newCount }
        }));

        try {
            const res = await toggleProductLike(productId, token);
            setLikeData(prev => ({
                ...prev,
                [productId]: { liked: res.data.liked, count: res.data.likes_count }
            }));
        } catch (err) {
            console.error("Like error", err);
            // Revert on error
            setLikeData(prev => ({
                ...prev,
                [productId]: current
            }));
        }
    }, [user, token, likeData]);

    // We could fetch actual categories or just have common ones
    const CATEGORIES = useMemo(
        () => [
            "All",
            "Food & Groceries",
            "Fashion",
            "Home",
            "Sports",
            "Electronics",
            "Beauty",
            "Toys",
            "Crafts",
            "Kids",
            "Pets",
            "Shoes",
            "Automotive",
        ],
        []
    );


    const fetchPage = async (pageNum: number) => {
        if (!hasMore || isLoadingMore) return;

        setIsLoadingMore(true);
        if (pageNum === 0) setLoading(true);

        try {
            const res = await fetchMarketFeed(LIMIT, pageNum * LIMIT, undefined, undefined, false, token);
            const nextProducts: ProductFeedItem[] = res?.data?.products || [];

            // Update likeData based on all fetched products
            const nextLikeData: Record<number, { liked: boolean, count: number }> = {};
            nextProducts.forEach((p) => {
                nextLikeData[p.product_id] = { liked: !!p.isLiked, count: p.likes_count || 0 };
            });
            setLikeData(prev => ({ ...prev, ...nextLikeData }));

            setProducts(prev => {
                const mappedProducts = nextProducts.map((p: any, i: number) => {
                    const mediaImages = (p.media || []).filter((m: any) => m.type === "image").map((m: any) => m.url);
                    return {
                        ...p,
                        originalIndex: (pageNum === 0 ? 0 : prev.length) + i,
                        first_image: mediaImages[0] || p.first_image || (p.media?.[0]?.type === 'image' ? p.media[0].url : "") || "",
                        product_video: p.product_video || p.media?.find((m: any) => m.type === 'video')?.url || "",
                    };
                });
                const existingIds = new Set(prev.map(p => p.product_id));
                const unique = mappedProducts.filter((p) => !existingIds.has(p.product_id));
                const finalProducts = pageNum === 0 ? mappedProducts : [...prev, ...unique];

                // Update cache
                MARKET_CACHE.products = finalProducts;
                MARKET_CACHE.page = pageNum + 1;
                MARKET_CACHE.hasMore = nextProducts.length >= LIMIT;
                MARKET_CACHE.likeData = { ...likeData, ...nextLikeData };

                return finalProducts;
            });

            if (nextProducts.length < LIMIT) {
                setHasMore(false);
            }
            setPage(pageNum + 1);
        } catch (err) {
            setError("Failed to load products. Please try again later.");
        } finally {
            setLoading(false);
            setIsLoadingMore(false);
        }
    };

    // Initial load logic with cache check
    useEffect(() => {
        if (MARKET_CACHE.products.length > 0) {
            setLoading(false);
            return;
        }
        setPage(0);
        setHasMore(true);
        setProducts([]);
        fetchPage(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // Handle Scroll Persistence
    useEffect(() => {
        const handleScroll = () => {
            MARKET_CACHE.scrollPos = window.scrollY;
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Restore Scroll Position
    useEffect(() => {
        if (isRestoring && products.length > 0) {
            const timer = setTimeout(() => {
                window.scrollTo(0, MARKET_CACHE.scrollPos);
                setIsRestoring(false);
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [products, isRestoring]);

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

    // Client-side category filtering
    const filteredProducts = useMemo(() => {
        if (!products || products.length === 0) return [];
        if (activeCategory === "All") return products;
        return products.filter((p) => (p.category || "").toLowerCase() === activeCategory.toLowerCase());
    }, [products, activeCategory]);

    const formatUrl = React.useCallback((url: string) => {
        if (!url) return "https://via.placeholder.com/800x600?text=No+Image";
        let formatted = url;
        if (!url.startsWith("http")) {
            formatted = url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
        }
        return encodeURI(formatted);
    }, []);

    const updateUrl = (productId: number | null, businessName?: string, isReels: boolean = false) => {
        const params = new URLSearchParams(window.location.search);

        if (productId) {
            params.set("product_id", String(productId));
            if (isReels) {
                params.set("reels", "true");
            } else {
                params.delete("reels");
            }
            const slug = businessName ? slugify(businessName) : (routeParams?.shop?.[0] || "product");
            const search = params.toString();
            const newUrl = `/market/${slug}${search ? `?${search}` : ""}`;

            if (newUrl !== window.location.pathname + window.location.search) {
                window.history.pushState(window.history.state, "", newUrl);
            }
        } else {
            params.delete("product_id");
            params.delete("reels");
            const search = params.toString();
            // If we are deep in a shop path, let's keep it or go back to /market
            const newUrl = `/market${search ? `?${search}` : ""}`;

            if (newUrl !== window.location.pathname + window.location.search) {
                window.history.pushState(window.history.state, "", newUrl);
            }
        }
    };

    const handleReelsClick = React.useCallback(async (productId: number, businessName?: string, e?: React.MouseEvent) => {
        if (e) setClickPos({ x: e.clientX, y: e.clientY });

        updateUrl(productId, businessName, true);
        setSelectedProductId(productId);
        setReelsModalOpen(true);
    }, [routeParams?.shop]);

    const handleProductClick = React.useCallback(async (productId: number, businessName?: string, e?: React.MouseEvent) => {
        if (fetchingProductId) return;

        // Capture click position
        if (e) {
            setClickPos({ x: e.clientX, y: e.clientY });
        } else {
            setClickPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        }

        updateUrl(productId, businessName);
        try {
            setFetchingProductId(productId);
            const res = await fetchProductById(productId, token);
            if (res?.data?.product) {
                // Map DB product to PreviewPayload shape so we can recycle the preview modal!
                const dbProduct = res.data.product;

                const mappedPayload: PreviewPayload = {
                    productId: dbProduct.product_id,
                    title: dbProduct.title,
                    description: dbProduct.description,
                    category: dbProduct.category,
                    hasVariants: dbProduct.has_variants === 1,
                    price: dbProduct.price ?? "",
                    quantity: dbProduct.quantity ?? "", // Actually from inventory, but fallback
                    samePriceForAll: false, // We don't necessarily know, defaults to false on display
                    sharedPrice: null,
                    businessId: Number(dbProduct.business_id),
                    productImages: (dbProduct.media || []).filter((m: any) => m.type === "image").map((m: any) => ({ name: "img", url: formatUrl(m.url) })),
                    productVideo: (dbProduct.media || []).find((m: any) => m.type === "video") ? { name: "vid", url: formatUrl(dbProduct.media.find((m: any) => m.type === "video")!.url) } : null,
                    useCombinations: dbProduct.use_combinations === 1,
                    params: (dbProduct.params || []).map((p: any) => ({ key: p.param_key, value: p.param_value })),
                    soldCount: dbProduct.sold_count,
                    variantGroups: (dbProduct.variant_groups || []).map((g: any) => ({
                        id: String(g.group_id),
                        title: g.title,
                        allowImages: g.allow_images === 1,
                        entries: (g.options || []).map((o: any) => {
                            const inventoryMatch = (dbProduct.inventory || []).find((inv: any) => Number(inv.variant_option_id) === Number(o.option_id));
                            return {
                                id: String(o.option_id),
                                name: o.name,
                                price: o.price,
                                quantity: inventoryMatch ? inventoryMatch.quantity : (Number(o.initial_quantity || 0) - Number(o.sold_count || 0)),
                                images: (o.media || []).map((m: any) => ({ name: "img", url: formatUrl(m.url) }))
                            };
                        })
                    })),

                    skus: (dbProduct.skus || []).map((s: any) => {
                        // Safely parse variant IDs array
                        let vIds: string[] = [];
                        try {
                            vIds = typeof s.variant_option_ids === 'string'
                                ? JSON.parse(s.variant_option_ids)
                                : s.variant_option_ids;
                        } catch (e) { }

                        // Try to map inventory quantity if available
                        const inventoryMatch = (dbProduct.inventory || []).find((inv: any) => inv.sku_id === s.sku_id);

                        return {
                            id: String(s.sku_id),
                            sku: s.sku_code || "",
                            name: "Combination",
                            price: s.price,
                            quantity: inventoryMatch ? inventoryMatch.quantity : 0,
                            enabled: s.status === 'active',
                            variantOptionIds: vIds.map(String)
                        } as ProductSku;
                    })
                };

                // If top-level quantity exists in inventory fallback
                const baseInv = (dbProduct.inventory || []).find((inv: any) => !inv.sku_id && !inv.variant_option_id);
                if (baseInv) mappedPayload.quantity = baseInv.quantity;

                setSelectedProductPayload(mappedPayload);
                setModalOpen(true);

                // If on initial load we didn't have the business name, update URL now
                if (dbProduct.business_name) {
                    updateUrl(productId, dbProduct.business_name);
                }
            }
        } catch (err) {
            console.error(err);
            // Don't alert if it's just the initial load failing quietly
        } finally {
            setFetchingProductId(null);
        }
    }, [fetchingProductId, formatUrl, updateUrl]);

    // Handle deep linking from URL and Browser Back/Forward buttons
    useEffect(() => {
        const handleRouteChange = () => {
            const params = new URLSearchParams(window.location.search);
            const productId = params.get("product_id");

            if (productId) {
                const pid = Number(productId);
                const isReels = params.get("reels") === "true";

                if (isReels) {
                    if (!reelsModalOpen) {
                        setSelectedProductId(pid);
                        setReelsModalOpen(true);
                    }
                } else {
                    if (!modalOpen && !fetchingProductId && selectedProductPayload?.productId !== pid) {
                        handleProductClick(pid);
                    }
                }
            } else {
                if (modalOpen) {
                    setModalOpen(false);
                    setSelectedProductPayload(null);
                }
                if (reelsModalOpen) {
                    setReelsModalOpen(false);
                    setSelectedProductId(null);
                }
            }
        };

        // Listen for browser back/forward
        window.addEventListener('popstate', handleRouteChange);

        // Initial check
        handleRouteChange();

        return () => window.removeEventListener('popstate', handleRouteChange);
    }, [modalOpen, fetchingProductId, selectedProductPayload, handleProductClick]);

    return (
        <>
            <section className="min-h-screen bg-slate-50 pb-10 ">
                <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200">
                    <div className="flex px-4 py-3 gap-2 overflow-x-auto no-scrollbar">
                        {CATEGORIES.map((item) => (
                            <button
                                key={item}
                                onClick={() => setActiveCategory(item)}
                                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all ${activeCategory === item ? "bg-slate-900 text-white shadow-md" : "text-slate-600 bg-slate-100 hover:bg-slate-200"
                                    }`}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="p-2 sm:p-4"><ShimmerGrid count={5} /></div>
                ) : error ? (
                    <div className="py-12 flex flex-col items-center justify-center text-sm text-rose-500">
                        <p className="mb-3 font-bold">{error}</p>
                        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition">
                            Retry
                        </button>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="py-12 flex items-center justify-center text-sm text-slate-500 font-medium">No products found in this category.</div>
                ) : (
                    <div className="p-2 sm:p-4 ">
                        <MasonryGrid
                            items={filteredProducts}
                            likeData={likeData}
                            fetchingProductId={fetchingProductId}
                            handleProductClick={handleProductClick}
                            handleReelsClick={handleReelsClick}
                            handleLikeClick={handleLikeClick}
                            formatUrl={formatUrl}
                            router={router}
                            isRestored={isRestoring}
                        />
                    </div>
                )}

                {/* Lazy Load Trigger */}
                <div ref={loaderRef} className="py-10 flex justify-center">
                    {isLoadingMore && hasMore && (
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
                    )}
                    {!hasMore && products.length > 0 && (
                        <p className="text-slate-400 text-xs italic">- THE END -</p>
                    )}
                </div>

            </section >

            {/* Render ProductPreviewModal directly! Reusing your existing component but with real mapping. */}
            <AnimatePresence>
                {
                    modalOpen && selectedProductPayload && (
                        <ProductPreviewModal
                            open={modalOpen}
                            payload={selectedProductPayload}
                            origin={clickPos}
                            onClose={() => {
                                setModalOpen(false);
                                setSelectedProductPayload(null);
                                updateUrl(null);
                            }}
                            onProductClick={handleProductClick}
                        />
                    )
                }
            </AnimatePresence>

            <ReelsModal
                open={reelsModalOpen}
                initialProductId={selectedProductId}
                origin={clickPos}
                onClose={() => {
                    setReelsModalOpen(false);
                    setSelectedProductId(null);
                    updateUrl(null);
                }}
                onActiveProductChange={(pid) => {
                    setSelectedProductId(pid);
                    const params = new URLSearchParams(window.location.search);
                    params.set("reels", "true");
                    params.set("product_id", String(pid));
                    const search = params.toString();
                    const currentUrl = `${window.location.pathname}${search ? `?${search}` : ""}`;
                    window.history.replaceState(window.history.state, "", currentUrl);
                }}
            />

            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
        </>
    );
}
