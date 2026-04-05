"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { fetchMarketFeed, fetchProductById, toggleProductLike, logUserActivity } from "@/src/lib/api/productApi";
import { ProductFeedItem, PreviewPayload, ProductSku } from "@/src/types/product";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import ProductPreviewModal from "./previewModal";
import { API_BASE_URL } from "@/src/lib/config";
import { FaPlay, FaPause, FaVolumeMute, FaVolumeUp, FaTimes, FaStore, FaHeart, FaRegHeart, FaShare, FaCheckCircle } from "react-icons/fa";
import { useAuth } from "@/src/context/authContext";
import { toast } from "sonner";

const formatUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
};

const slugify = (str: string) =>
    String(str || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

interface ReelsModalProps {
    open: boolean;
    onClose: () => void;
    initialProductId: number | null;
    onActiveProductChange?: (productId: number, businessName?: string, businessSlug?: string) => void;
    origin?: { x: number; y: number };
}

export default function ReelsModal({ open, onClose, initialProductId, origin, onActiveProductChange }: ReelsModalProps) {
    const { token, ensureLoggedIn } = useAuth();
    const router = useRouter();
    const [products, setProducts] = useState<ProductFeedItem[]>([]);

    // Lock body scroll when open
    useEffect(() => {
        if (!open) return;
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
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [activeVideoIndex, setActiveVideoIndex] = useState(0);

    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
    const [fetchingProduct, setFetchingProduct] = useState(false);
    const [previewOrigin, setPreviewOrigin] = useState<{ x: number; y: number } | null>(null);

    // Audio interaction logic mirrored from reference
    const [isGlobalMuted, setIsGlobalMuted] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("reels_muted");
            return saved !== null ? saved === "true" : true;
        }
        return true;
    });
    const [isUserInteracted, setIsUserInteracted] = useState(false);

    useEffect(() => {
        if (!open) return;
        const onUserInteract = () => {
            if (isUserInteracted) return;
            setIsUserInteracted(true);
            const savedMute = localStorage.getItem("reels_muted");
            if (savedMute === "false") setIsGlobalMuted(false);
            window.removeEventListener("click", onUserInteract);
            window.removeEventListener("keydown", onUserInteract);
            window.removeEventListener("touchstart", onUserInteract);
        };
        window.addEventListener("click", onUserInteract, { passive: true });
        window.addEventListener("keydown", onUserInteract, { passive: true });
        window.addEventListener("touchstart", onUserInteract, { passive: true });
        return () => {
            window.removeEventListener("click", onUserInteract);
            window.removeEventListener("keydown", onUserInteract);
            window.removeEventListener("touchstart", onUserInteract);
        };
    }, [isUserInteracted, open]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("reels_muted", String(isGlobalMuted));
        }
    }, [isGlobalMuted]);

    const containerRef = useRef<HTMLDivElement>(null);
    const observerTarget = useRef<HTMLDivElement>(null);
    const fetchingMore = useRef(false);
    const hasLoadedInitial = useRef(false);

    const mapToFeedItem = useCallback((p: any): ProductFeedItem => {
        let bestPrice = p.price || p.min_sku_price || p.min_variant_price;
        if (!bestPrice || Number(bestPrice) <= 0) {
            const allSkus = p.skus?.map((s: any) => s.price).filter((pr: number) => pr > 0) || [];
            if (allSkus.length > 0) {
                bestPrice = Math.min(...allSkus);
            } else {
                const allOpts = p.variant_groups?.flatMap((g: any) => g.options)?.map((o: any) => o.price).filter((pr: number) => pr > 0) || [];
                if (allOpts.length > 0) bestPrice = Math.min(...allOpts);
            }
        }

        const mediaImages = (p.media || [])
            .filter((m: any) => m.type === "image")
            .map((m: any) => m.url);

        return {
            product_id: p.product_id,
            title: p.title,
            price: bestPrice || 0,
            category: p.category,
            business_id: p.business_id,
            business_slug: p.business_slug || p.business?.business_slug || null,
            business_name: p.business_name || p.business?.business_name || "Store",
            logo: p.logo || p.business?.logo || null,
            first_image: mediaImages[0] || p.first_image || p.media?.[0]?.url || "",
            product_video: p.product_video || p.media?.find((m: any) => m.type === 'video')?.url || "",
            likes_count: p.likes_count || 0,
            isLiked: p.liked || p.isLiked || false,
            trusted_partner: p.trusted_partner || p.business?.trusted_partner || 0,
            images: mediaImages.length > 0 ? mediaImages : (p.first_image ? [p.first_image] : []),
            params: (p.params || []).map((ext: any) => ({
                key: ext.param_key || ext.key,
                value: ext.param_value || ext.value
            }))
        };
    }, []);

    const loadInitialSequence = useCallback(async () => {
        if (hasLoadedInitial.current) return;
        setLoading(true);
        hasLoadedInitial.current = true;
        try {
            let initialProduct: ProductFeedItem | null = null;
            if (initialProductId) {
                const res = await fetchProductById(Number(initialProductId));
                if (res?.data) {
                    const p = res.data.product || res.data;
                    initialProduct = mapToFeedItem(p);
                    logUserActivity({ product_id: initialProduct.product_id, action_type: 'view', category: initialProduct.category }, token);
                }
            }

            const feedRes = await fetchMarketFeed(10, 0, undefined, undefined, true);
            const feedProducts = (feedRes?.data?.products || []).map((p: any) => mapToFeedItem(p));

            setProducts(() => {
                const newArr: ProductFeedItem[] = initialProduct ? [initialProduct] : [];
                feedProducts.forEach((p: ProductFeedItem) => {
                    const skip = initialProduct && p.product_id === initialProduct.product_id;
                    if (!skip) {
                        newArr.push(p);
                    }
                });
                return newArr;
            });
            if (feedProducts.length < 10) setHasMore(false);
            setPage(1);

            // Force reset to first item
            setActiveVideoIndex(0);
            if (containerRef.current) {
                containerRef.current.scrollTop = 0;
            }
        } catch (e) {
            console.error("Failed to load reels", e);
        } finally {
            setLoading(false);
        }
    }, [initialProductId]);

    useEffect(() => {
        if (open) {
            loadInitialSequence();
        }
    }, [open, loadInitialSequence]);

    const loadMore = useCallback(async () => {
        if (!hasMore || fetchingMore.current) return;
        fetchingMore.current = true;
        try {
            const feedRes = await fetchMarketFeed(10, page * 10, undefined, undefined, true);
            const newProducts = (feedRes?.data?.products || []).map((p: any) => mapToFeedItem(p));
            if (newProducts.length < 10) setHasMore(false);
            if (newProducts.length > 0) {
                setProducts(prev => {
                    const existingIds = new Set(prev.map(p => p.product_id));
                    const filtered = newProducts.filter((p: any) => !existingIds.has(p.product_id));
                    return [...prev, ...filtered];
                });
                setPage(p => p + 1);
            }
        } catch (e) {
            console.error(e);
        } finally {
            fetchingMore.current = false;
        }
    }, [page, hasMore]);

    useEffect(() => {
        const target = observerTarget.current;
        if (!target || !open) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                loadMore();
            }
        }, { threshold: 0.1 });
        observer.observe(target);
        return () => observer.unobserve(target);
    }, [loadMore, open]);

    useEffect(() => {
        if (!open) {
            hasLoadedInitial.current = false;
            setProducts([]);
            setActiveVideoIndex(0);
        }
    }, [open]);

    const handleScroll = () => {
        if (!containerRef.current || fetchingProduct) return;
        const scrollPosition = containerRef.current.scrollTop;
        const viewHeight = containerRef.current.clientHeight;
        const index = Math.round(scrollPosition / viewHeight);

        if (index !== activeVideoIndex && index >= 0 && index < products.length) {
            setActiveVideoIndex(index);
            const p = products[index];
            if (onActiveProductChange) onActiveProductChange(p.product_id, p.business_name, p.business_slug);
            logUserActivity({ product_id: p.product_id, action_type: 'view', category: p.category }, token);
        }
    };

    const handleNavigateToReel = useCallback(async (productId: number) => {
        // Close the detail modal so the user can see the video they just reselected
        setDetailModalOpen(false);
        setSelectedProductPayload(null);

        // 2. See if we have this product already
        const existingIndex = products.findIndex(p => p.product_id === productId);
        if (existingIndex !== -1) {
            setActiveVideoIndex(existingIndex);
            if (containerRef.current) {
                containerRef.current.scrollTo({
                    top: existingIndex * containerRef.current.clientHeight,
                    behavior: "smooth"
                });
            }
            if (onActiveProductChange) onActiveProductChange(productId, products[existingIndex].business_name, products[existingIndex].business_slug);
            logUserActivity({ product_id: productId, action_type: 'view', category: products[existingIndex].category }, token);
        } else {
            // If not found, we might need to fetch it and prepend or reload. 
            // For now, simpler to reload or just use the master page logic.
            // But we can try to fetch and prepend to keep it smooth.
            try {
                setLoading(true);
                const res = await fetchProductById(productId);
                if (res?.data) {
                    const p = res.data.product || res.data;
                    const newItem = mapToFeedItem(p);
                    setProducts(prev => [newItem, ...prev]);
                    setActiveVideoIndex(0);
                    if (containerRef.current) {
                        containerRef.current.scrollTop = 0;
                    }
                    if (onActiveProductChange) onActiveProductChange(productId, newItem.business_name, newItem.business_slug);
                    logUserActivity({ product_id: productId, action_type: 'view', category: newItem.category }, token);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
    }, [products, onActiveProductChange, mapToFeedItem]);

    const handleProductBuyClick = async (productId: number, businessNameOrEvent?: string | React.MouseEvent, e?: React.MouseEvent) => {
        if (fetchingProduct) return;

        let clickEvent: React.MouseEvent | undefined;
        if (typeof businessNameOrEvent !== "string") {
            clickEvent = businessNameOrEvent;
        } else {
            clickEvent = e;
        }

        if (clickEvent) setPreviewOrigin({ x: clickEvent.clientX, y: clickEvent.clientY });
        else setPreviewOrigin({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

        try {
            setFetchingProduct(true);
            const res = await fetchProductById(productId, token);
            if (res?.data?.product) {
                const dbProduct = res.data.product;
                const mappedPayload = mapProductToPreviewPayload(dbProduct, formatUrl);
                setSelectedProductPayload(mappedPayload);
                setDetailModalOpen(true);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setFetchingProduct(false);
        }
    };

    const handleLikeClick = async (productId: number) => {
        const ok = await ensureLoggedIn();
        if (!ok || !token) return;

        // Optimistic update
        setProducts(prev => prev.map(p => {
            if (p.product_id === productId) {
                const wasLiked = (p as any).isLiked;
                return {
                    ...p,
                    isLiked: !wasLiked,
                    likes_count: wasLiked ? Math.max(0, (p.likes_count || 0) - 1) : (p.likes_count || 0) + 1
                } as any;
            }
            return p;
        }));

        try {
            const res = await toggleProductLike(productId, token);
            if (res.ok) {
                setProducts(prev => prev.map(p => {
                    if (p.product_id === productId) {
                        return {
                            ...p,
                            likes_count: res.data.count || res.data.likes_count,
                            isLiked: res.data.liked
                        } as any;
                    }
                    return p;
                }));
                if (res.data.liked) {
                    logUserActivity({ product_id: productId, action_type: 'like' }, token);
                }
            }
        } catch (err) {
            console.error("Like failed", err);
            // Revert could be here but optimistic + catch is usually fine for this simple action
        }
    };

    const handleVendorClick = (product: ProductFeedItem) => {
        const identifier = product.business_slug || (product.business_name ? slugify(product.business_name) : null);
        if (!identifier) return;
        // Don't call onClose() so we keep URL state. Browser navigation will naturally hide the modal.
        router.push(`/shop/${identifier}`);
    };

    const handleShareClick = (product: ProductFeedItem) => {
        // Construct a direct link to this reel page which is more reliable
        const shareUrl = `${window.location.origin}/shopping-reels?product_id=${product.product_id}`;

        if (navigator.share) {
            navigator.share({
                title: product.title,
                text: `Check out this product from ${product.business_name} on Stoqle!`,
                url: shareUrl,
            }).catch(() => { });
        } else {
            navigator.clipboard.writeText(shareUrl);
            toast.info("Link copied to clipboard!");
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[11000] flex items-center justify-center pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/90 pointer-events-auto"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{
                            opacity: 0,
                            scale: 0.2,
                            x: origin ? origin.x - (typeof window !== 'undefined' ? window.innerWidth / 2 : 0) : 0,
                            y: origin ? origin.y - (typeof window !== 'undefined' ? window.innerHeight / 2 : 0) : 0
                        }}
                        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                        exit={{
                            opacity: 0,
                            scale: 0.2,
                            x: origin ? origin.x - (typeof window !== 'undefined' ? window.innerWidth / 2 : 0) : 0,
                            y: origin ? origin.y - (typeof window !== 'undefined' ? window.innerHeight / 2 : 0) : 0
                        }}
                        transition={{ type: "spring", damping: 30, stiffness: 280 }}
                        className="relative z-20 w-full max-w-md h-screen sm:h-[90vh] bg-black rounded-none sm:rounded-3xl overflow-hidden shadow-2xl pointer-events-auto sm:border sm:border-white/10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50 bg-black/40 backdrop-blur-md p-3 rounded-full text-white hover:bg-black/60 transition"
                        >
                            <FaTimes size={18} />
                        </button>

                        <div
                            ref={containerRef}
                            onScroll={handleScroll}
                            className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
                        >
                            {loading && products.length === 0 ? (
                                <div className="h-full w-full flex items-center justify-center text-white">
                                    <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                                </div>
                            ) : products.length === 0 ? (
                                <div className="h-full w-full flex flex-col items-center justify-center text-white p-8 text-center">
                                    <p className="text-slate-400">No reels available right now.</p>
                                </div>
                            ) : (
                                products.map((p, i) => (
                                    <div key={`${p.product_id}-${i}`} className="h-full w-full snap-start relative bg-slate-900 flex justify-center items-center">
                                        <ReelItem
                                            product={p}
                                            isActive={i === activeVideoIndex}
                                            shouldPreload={i === activeVideoIndex + 1 || i === activeVideoIndex + 2}
                                            onBuyClick={(e: React.MouseEvent) => handleProductBuyClick(p.product_id, e)}
                                            onVendorClick={() => handleVendorClick(p)}
                                            onLikeClick={() => handleLikeClick(p.product_id)}
                                            onShareClick={() => handleShareClick(p)}
                                            isGlobalMuted={isGlobalMuted}
                                            setIsGlobalMuted={setIsGlobalMuted}
                                        />
                                    </div>
                                ))
                            )}

                            {hasMore && products.length > 0 && (
                                <div ref={observerTarget} className="h-20 snap-start flex items-center justify-center text-white">
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>

                        <ProductPreviewModal
                            open={detailModalOpen}
                            payload={selectedProductPayload}
                            origin={previewOrigin || undefined}
                            onClose={() => {
                                setDetailModalOpen(false);
                                setSelectedProductPayload(null);
                            }}
                            onProductClick={handleProductBuyClick}
                            onReelsClick={handleNavigateToReel}
                        />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

function LikeBurst() {
    const particles = Array.from({ length: 12 });
    const colors = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B"];
    return (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {particles.map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
                    animate={{
                        x: Math.cos((i * 30) * Math.PI / 180) * 70,
                        y: Math.sin((i * 30) * Math.PI / 180) * 70,
                        scale: [0.2, 1.2, 1.8, 0],
                        opacity: [1, 1, 1, 0],
                        rotate: [0, 45, 90]
                    }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="absolute"
                >
                    <FaHeart size={14} style={{ color: colors[i % colors.length] }} className="drop-shadow-sm" />
                </motion.div>
            ))}
        </div>
    );
}

function ProductTicker({ product, params }: { product: any, params?: { key: string; value: string }[] }) {
    const info = (params || []).filter(p => p.value && p.value !== "Untitled" && p.value !== "0.00");
    if (info.length === 0) return null;

    // Split info into 3 lanes for better flow
    const lane1 = info.filter((_, i) => i % 3 === 0);
    const lane2 = info.filter((_, i) => i % 3 === 1);
    const lane3 = info.filter((_, i) => i % 3 === 2);

    return (
        <div className="absolute top-12 left-0 right-0 h-40 z-40 overflow-hidden pointer-events-none flex flex-col gap-3">
            <MarqueeLane items={lane1} speed={12} reverse />
            <MarqueeLane items={lane2} speed={15} />
            <MarqueeLane items={lane3} speed={13} reverse />
        </div>
    );
}

function MarqueeLane({ items, speed, reverse = false }: { items: any[], speed: number, reverse?: boolean }) {
    if (items.length === 0) return null;

    // Triple the items to ensure seamless loop
    const displayItems = [...items, ...items, ...items];

    return (
        <div className="flex whitespace-nowrap overflow-hidden">
            <motion.div
                className="flex gap-8 px-4"
                animate={{ x: reverse ? [0, -1000] : [-1000, 0] }}
                transition={{
                    repeat: Infinity,
                    duration: speed,
                    ease: "linear",
                }}
            >
                {displayItems.map((p, i) => (
                    <div key={i} className="bg-black/50 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/20 shadow-2xl flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                        <span className="text-orange-400 text-[9px] font-black uppercase tracking-tighter">{p.key}</span>
                        <span className="text-white text-[12px] font-bold uppercase tracking-widest">{p.value}</span>
                    </div>
                ))}
            </motion.div>
        </div>
    );
}

import VideoPlayer from "@/src/components/posts/videoPlayer";

function ReelItem({
    product,
    isActive,
    shouldPreload,
    onBuyClick,
    onVendorClick,
    onLikeClick,
    onShareClick,
    isGlobalMuted,
    setIsGlobalMuted
}: any) {
    const [isPlaying, setIsPlaying] = useState(true);
    const [showBurst, setShowBurst] = useState(false);
    const [params, setParams] = useState<{ key: string; value: string }[]>(product.params || []);

    useEffect(() => {
        if (isActive && params.length === 0) {
            fetchProductById(product.product_id).then(res => {
                if (res?.data?.product?.params) {
                    const mappedParams = (res.data.product.params || []).map((p: any) => ({
                        key: p.param_key,
                        value: p.param_value
                    }));
                    setParams(mappedParams);
                }
            }).catch(() => { });
        }
    }, [isActive, product.product_id, params.length]);

    const videoUrl = product.product_video ? formatUrl(product.product_video) : '';

    return (
        <div className="w-full h-full relative">
            <ProductTicker product={product} params={params} />
            
            {videoUrl && (isActive || shouldPreload) ? (
                <VideoPlayer
                    src={videoUrl}
                    poster={product.first_image ? formatUrl(product.first_image) : undefined}
                    autoplay={isActive}
                    loop={true}
                    isMuted={isGlobalMuted}
                    className="w-full h-full"
                />
            ) : videoUrl ? (
                <div className="w-full h-full bg-slate-900 group relative">
                    {product.first_image && (
                         <img src={formatUrl(product.first_image)} alt="" className="w-full h-full object-cover opacity-50 blur-sm" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                         <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                    </div>
                </div>
            ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 bg-slate-800">Video unavailable</div>
            )}

            <button
                onClick={(e) => {
                     e.stopPropagation();
                     setIsGlobalMuted(!isGlobalMuted);
                }}
                className="absolute top-6 right-6 z-20 bg-black/40 backdrop-blur-md p-3 rounded-full text-white hover:bg-black/60 transition"
            >
                {isGlobalMuted ? <FaVolumeMute size={16} /> : <FaVolumeUp size={16} />}
            </button>

            <div
                className="absolute right-4 bottom-20 z-20 flex flex-col items-center gap-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col items-center gap-1">
                    <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (!product.isLiked) {
                                setShowBurst(true);
                                setTimeout(() => setShowBurst(false), 800);
                            }
                            onLikeClick();
                        }}
                        className={`w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center transition-colors relative`}
                    >
                        {showBurst && <LikeBurst />}

                        <AnimatePresence>
                            <motion.div
                                key={product.isLiked ? "liked" : "unliked"}
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                className={`absolute inset-0 flex items-center justify-center ${product.isLiked ? 'text-red-500' : 'text-white'}`}
                            >
                                {product.isLiked ? <FaHeart size={22} /> : <FaRegHeart size={22} />}
                            </motion.div>
                        </AnimatePresence>

                        {/* Pulse effect on like */}
                        {product.isLiked && (
                            <motion.div
                                initial={{ scale: 1, opacity: 1 }}
                                animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 0] }}
                                transition={{ duration: 0.6 }}
                                className="absolute text-red-500 pointer-events-none"
                            >
                                <FaHeart size={22} />
                            </motion.div>
                        )}
                    </motion.button>
                    <span className="text-white text-[10px] font-bold drop-shadow-lg">{product.likes_count || 0}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onShareClick();
                        }}
                        className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition"
                    >
                        <FaShare size={18} />
                    </button>
                    <span className="text-white text-[10px] font-bold drop-shadow-lg">Share</span>
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-5 z-20 bg-gradient-to-t from-black via-transparent to-transparent">
                <div
                    className="flex items-center gap-2 mb-3 cursor-pointer hover:opacity-90 transition-opacity w-fit"
                    onClick={(e) => { e.stopPropagation(); onVendorClick(); }}
                >
                    <div className="w-10 h-10 rounded-full border border-white/20 overflow-hidden bg-slate-800 shadow-lg">
                        {product.logo && <img src={formatUrl(product.logo)} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                            <span className="text-white font-bold text-sm drop-shadow-md">{product.business_name}</span>
                            {product.trusted_partner === 1 && (
                                <FaCheckCircle className="text-blue-400" size={14} />
                            )}
                        </div>
                        {product.category && (
                            <span className="text-white/70 text-[10px] uppercase tracking-wider font-bold">{product.category}</span>
                        )}
                    </div>
                </div>
                <h3
                    className="text-white text-sm font-semibold mb-2 line-clamp-1 cursor-pointer hover:text-slate-200 transition-colors drop-shadow-md"
                    onClick={(e) => { e.stopPropagation(); onBuyClick(e); }}
                >
                    {product.title}
                </h3>

                {((product.images && product.images.length > 0) || product.price) && (
                    <div className="flex items-center justify-between gap-3 mb-1 mt-1">
                        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-xl pr-3 relative">
                            {/* Discount Badge */}
                            {(product.promo_discount || product.sale_discount) && (
                                <div className="absolute -top-6 left-0 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm shadow-lg flex items-center gap-1">
                                    <span>{product.promo_title || product.sale_type || "SALE"}</span>
                                    <span>{product.promo_discount || product.sale_discount}% OFF</span>
                                </div>
                            )}

                            {product.images && product.images.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                    {product.images.slice(0, 2).map((img: string, idx: number) => (
                                        <div
                                            key={idx}
                                            className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0 shadow-lg cursor-pointer hover:scale-105 transition-transform"
                                            onClick={(e) => { e.stopPropagation(); onBuyClick(e); }}
                                        >
                                            <img src={formatUrl(img)} alt="" className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                    {product.images.length > 2 && (
                                        <div
                                            className="w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center cursor-pointer relative overflow-hidden group shadow-lg"
                                            onClick={(e) => { e.stopPropagation(); onBuyClick(e); }}
                                        >
                                            {/* Show the 3rd image behind the counter overlay */}
                                            <img src={formatUrl(product.images[2])} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90 contrast-75" />
                                            <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                                                <span className="text-[10px] text-white font-black drop-shadow-md">{product.images.length}+</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="flex flex-col ml-1">
                                <span className="text-white font-black text-base drop-shadow-lg leading-tight">₦{Number(product.price).toLocaleString()}</span>
                                {(product.promo_discount || product.sale_discount) && (
                                    <span className="text-[9px] text-white/50 line-through font-bold leading-tight">
                                        ₦{Math.round(Number(product.price) / (1 - (product.promo_discount || product.sale_discount || 0) / 100)).toLocaleString()}
                                    </span>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={(e) => { e.stopPropagation(); onBuyClick(e); }}
                            className="bg-red-600 text-white text-[10px] font-black px-5 py-2.5 rounded-full active:scale-95 transition-all shadow-lg hover:bg-red-700 whitespace-nowrap"
                        >
                            Buy Now
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
