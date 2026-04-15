"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchMarketFeed, fetchProductById, toggleProductLike, logUserActivity } from "@/src/lib/api/productApi";
import { ProductFeedItem, PreviewPayload, ProductSku } from "@/src/types/product";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import { API_BASE_URL } from "@/src/lib/config";
import { copyToClipboard } from "@/src/lib/utils/utils";
import { FaPlay, FaPause, FaVolumeMute, FaVolumeUp, FaArrowLeft, FaStore, FaHeart, FaRegHeart, FaShare } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useAuth } from "@/src/context/authContext";
import { toast } from "sonner";
import { Suspense } from "react";
import VideoPlayer from "@/src/components/posts/videoPlayer";

const formatUrl = (url: string) => {
    if (!url) return "";
    let formatted = url;
    if (!url.startsWith("http")) {
        formatted = url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    }
    return encodeURI(formatted);
};

function ShoppingReelsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialProductId = searchParams.get("product_id");

    const [products, setProducts] = useState<ProductFeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [activeVideoIndex, setActiveVideoIndex] = useState(0);

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
    const [fetchingProduct, setFetchingProduct] = useState(false);
    const [clickPos, setClickPos] = useState({ x: 0, y: 0 });

    // Audio states (Initialize from localStorage to persist preference)
    const [isGlobalMuted, setIsGlobalMuted] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("reels_muted");
            return saved !== null ? saved === "true" : true;
        }
        return true;
    });
    const [isUserInteracted, setIsUserInteracted] = useState(false);

    // Auto-save mute preference
    useEffect(() => {
        localStorage.setItem("reels_muted", String(isGlobalMuted));
    }, [isGlobalMuted]);

    // Audio interaction listener
    useEffect(() => {
        const onUserInteract = () => {
            if (isUserInteracted) return;
            setIsUserInteracted(true);

            // If user previously preferred unmuted, unmute now on first interaction
            const savedMute = localStorage.getItem("reels_muted");
            if (savedMute === "false") {
                setIsGlobalMuted(false);
            }

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
    }, [isUserInteracted]);

    const observerTarget = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const { token } = useAuth();

    const handleLikeClick = async (productId: number) => {
        // Optimistic update
        setProducts(prev => prev.map(p => {
            if (p.product_id === productId) {
                const wasLiked = p.isLiked;
                return {
                    ...p,
                    isLiked: !wasLiked,
                    likes_count: wasLiked ? Math.max(0, (p.likes_count || 0) - 1) : (p.likes_count || 0) + 1
                };
            }
            return p;
        }));

        if (!token) {
            toast.error("Please login to like products");
            // Revert optimistic update
            setProducts(prev => prev.map(p => {
                if (p.product_id === productId) {
                    const currentlyLiked = p.isLiked;
                    return {
                        ...p,
                        isLiked: !currentlyLiked,
                        likes_count: currentlyLiked ? (p.likes_count || 0) + 1 : Math.max(0, (p.likes_count || 0) - 1)
                    };
                }
                return p;
            }));
            return;
        }

        try {
            const res = await toggleProductLike(productId, token);
            if (res.ok) {
                setProducts(prev => prev.map(p => {
                    if (p.product_id === productId) {
                        return {
                            ...p,
                            likes_count: res.data.count || res.data.likes_count,
                            isLiked: res.data.liked
                        };
                    }
                    return p;
                }));
                if (res.data.liked) {
                    logUserActivity({ product_id: productId, action_type: 'like' }, token);
                }
            }
        } catch (err) {
            console.error("Like failed", err);
        }
    };

    const handleShareClick = (product: ProductFeedItem) => {
        const shareUrl = `${window.location.origin}/shopping-reels?product_id=${product.product_id}`;
        if (navigator.share) {
            navigator.share({
                title: product.title,
                text: `Check out this product from ${product.business_name} on Stoqle!`,
                url: shareUrl,
            }).catch(() => { });
        } else {
            copyToClipboard(shareUrl);
            toast.info("Link copied to clipboard!");
        }
    };

    const handleProductBuyClick = async (productId: number, businessName?: string, e?: React.MouseEvent) => {
        if (fetchingProduct) return;
        if (e) setClickPos({ x: e.clientX, y: e.clientY });
        else setClickPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        try {
            setFetchingProduct(true);
            const res = await fetchProductById(productId);
            if (res?.data?.product) {
                const dbProduct = res.data.product;

                const mappedPayload = mapProductToPreviewPayload(dbProduct, formatUrl);

                const baseInv = (dbProduct.inventory || []).find((inv: any) => !inv.sku_id && !inv.variant_option_id);
                if (baseInv) mappedPayload.quantity = baseInv.quantity;

                setSelectedProductPayload(mappedPayload);
                setModalOpen(true);
            }
        } catch (err) {
            console.error("Failed to fetch product", err);
        } finally {
            setFetchingProduct(false);
        }
    };

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
            business_name: p.business_name || p.business?.business_name || "Store",
            business_slug: p.business_slug || p.business?.business_slug,
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
        setLoading(true);
        try {
            let initialProduct: ProductFeedItem | null = null;
            if (initialProductId) {
                // Fetch the explicitly clicked product
                const res = await fetchProductById(Number(initialProductId));
                if (res?.data) {
                    const p = res.data.product || res.data;
                    initialProduct = mapToFeedItem(p);
                    logUserActivity({ product_id: initialProduct.product_id, action_type: 'view', category: initialProduct.category }, token);
                }
            }

            const feedRes = await fetchMarketFeed(10, 0, undefined, undefined, true);
            const feedProducts = (feedRes?.data?.products || []).map((p: any) => mapToFeedItem(p));

            setProducts(prev => {
                const newArr = initialProduct ? [initialProduct] : [];
                // Add remaining feed avoiding duplicates
                feedProducts.forEach((p: ProductFeedItem) => {
                    if (p.product_id !== initialProduct?.product_id) {
                        newArr.push(p);
                    }
                });
                return newArr;
            });
            if (feedProducts.length < 10) setHasMore(false);
            setPage(1);
        } catch (e) {
            console.error("Failed to load reels", e);
        } finally {
            setLoading(false);
        }
    }, [initialProductId, mapToFeedItem]);

    const updateUrlTimeout = useRef<NodeJS.Timeout | null>(null);

    const updateUrl = useCallback((productId: number | null) => {
        if (updateUrlTimeout.current) clearTimeout(updateUrlTimeout.current);

        updateUrlTimeout.current = setTimeout(async () => {
            const urlParams = new URLSearchParams(window.location.search);
            if (productId) {
                try {
                    const { fetchSecurePostUrl } = require("@/src/lib/api/social");
                    const userToken = typeof window !== "undefined" ? localStorage.getItem("token") : null;
                    const urlData = await fetchSecurePostUrl(productId, "shopping_reels", userToken);

                    urlParams.set("product_id", String(productId));
                    if (urlData && urlData.xsec_token) {
                        urlParams.set("xsec_token", urlData.xsec_token);
                        urlParams.set("xsec_source", "shopping_reels");
                    }
                } catch (err) {
                    urlParams.set("product_id", String(productId));
                }
            } else {
                urlParams.delete("product_id");
                urlParams.delete("xsec_token");
                urlParams.delete("xsec_source");
            }
            const search = urlParams.toString();
            const newUrl = `${window.location.pathname}${search ? `?${search}` : ""}`;
            if (newUrl !== window.location.pathname + window.location.search) {
                window.history.replaceState(window.history.state, "", newUrl);
            }
        }, 500);
    }, []);

    useEffect(() => {
        loadInitialSequence();
    }, [initialProductId]);

    // Scroll to active index when products load or index changes via URL
    useEffect(() => {
        if (products.length > 0 && containerRef.current) {
            const index = products.findIndex(p => p.product_id === Number(initialProductId));
            if (index !== -1 && index !== activeVideoIndex) {
                const viewHeight = containerRef.current.clientHeight;
                containerRef.current.scrollTop = index * viewHeight;
                setActiveVideoIndex(index);
            }
        }
    }, [products.length]); // Only run once when products are first loaded

    const loadMore = useCallback(async () => {
        if (!hasMore || loading) return;
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
        }
    }, [page, hasMore, loading]);

    useEffect(() => {
        const target = observerTarget.current;
        if (!target) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                loadMore();
            }
        }, { threshold: 0.1 });
        observer.observe(target);
        return () => observer.unobserve(target);
    }, [loadMore]);

    // Handle smooth snapping tracking
    const handleScroll = () => {
        if (!containerRef.current) return;
        const scrollPosition = containerRef.current.scrollTop;
        const viewHeight = containerRef.current.clientHeight;
        const index = Math.round(scrollPosition / viewHeight);

        if (index !== activeVideoIndex && index >= 0 && index < products.length) {
            setActiveVideoIndex(index);
            updateUrl(products[index].product_id);
            logUserActivity({ product_id: products[index].product_id, action_type: 'view', category: products[index].category }, token);
        }
    };

    if (loading && products.length === 0) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
                <div className="w-8 h-8 border-4 border-slate-600 border-t-white rounded-full animate-spin mb-4"></div>
                <p>Loading Reels...</p>
            </div>
        );
    }

    return (
        <div className="bg-black w-full h-[calc(100vh-100px)] lg:h-[calc(100vh-40px)] rounded-xl overflow-hidden relative mx-auto shadow-2xl max-w-md border border-slate-800">
            {/* Back button */}
            <button
                onClick={() => router.back()}
                className="absolute top-4 left-4 z-50 bg-black/40 backdrop-blur-md p-2.5 rounded-full text-white hover:bg-black/60 transition"
            >
                <FaArrowLeft size={16} />
            </button>

            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
            >
                {products.length === 0 ? (
                    <div className="h-full w-full flex flex-col items-center justify-center text-white p-5 text-center">
                        <div className="text-4xl mb-3">🎬</div>
                        <h2 className="text-xl font-bold mb-2">No videos yet</h2>
                        <p className="text-slate-400">Stores haven't uploaded videos right now.</p>
                        <button
                            onClick={() => router.push('/market')}
                            className="mt-6 px-6 py-2 bg-red-600 rounded-full font-bold hover:bg-red-700"
                        >
                            Return to Market
                        </button>
                    </div>
                ) : (
                    products.map((p, i) => (
                        <div key={`${p.product_id}-${i}`} className="h-full w-full snap-start relative bg-slate-900 flex justify-center items-center">
                            {Math.abs(i - activeVideoIndex) <= 1 ? (
                                <ReelItem
                                    product={p}
                                    isActive={i === activeVideoIndex}
                                    onBuyClick={(e?: React.MouseEvent) => handleProductBuyClick(p.product_id, p.business_name, e)}
                                    onVendorClick={(bid) => {
                                        const slug = p.business_slug || bid;
                                        router.push(`/shop/${slug}`);
                                    }}
                                    onLikeClick={() => handleLikeClick(p.product_id)}
                                    onShareClick={() => handleShareClick(p)}
                                    isGlobalMuted={isGlobalMuted}
                                    setIsGlobalMuted={setIsGlobalMuted}
                                />
                            ) : (
                                <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center">
                                    <div className="w-8 h-8 border-4 border-slate-800 border-t-white/20 rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>
                    ))
                )}

                {hasMore && products.length > 0 && (
                    <div ref={observerTarget} className="h-20 snap-start flex items-center justify-center text-white">
                        <div className="w-5 h-5 border-2 border-slate-600 border-t-white rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            {
                modalOpen && selectedProductPayload && (
                    <ProductPreviewModal
                        open={modalOpen}
                        payload={selectedProductPayload}
                        origin={clickPos}
                        onClose={() => {
                            setModalOpen(false);
                            setSelectedProductPayload(null);
                        }}
                    // onProductClick={handleProductBuyClick}
                    />
                )
            }
        </div>
    );
}

export default function ShoppingReelsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Loading Reels...</div>}>
            <ShoppingReelsContent />
        </Suspense>
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
                        <span className="text-orange-400 text-[9px] font-bold  tracking-tighter">{p.key}</span>
                        <span className="text-white text-[12px] font-bold  ">{p.value}</span>
                    </div>
                ))}
            </motion.div>
        </div>
    );
}

function ReelItem({
    product,
    isActive,
    onBuyClick,
    onVendorClick,
    onLikeClick,
    onShareClick,
    isGlobalMuted,
    setIsGlobalMuted
}: {
    product: ProductFeedItem;
    isActive: boolean;
    onBuyClick: (e?: React.MouseEvent) => void;
    onVendorClick: (businessId: number | string) => void;
    onLikeClick: () => void;
    onShareClick: () => void;
    isGlobalMuted: boolean;
    setIsGlobalMuted: (muted: boolean) => void;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [showBurst, setShowBurst] = useState(false);
    const [params, setParams] = useState<{ key: string; value: string }[]>(product.params || []);
    const router = useRouter();

    useEffect(() => {
        if (isActive && params.length === 0) {
            // Fetch full product details for params if missing
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

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!videoRef.current) return;
        const nextMute = !isGlobalMuted;
        videoRef.current.muted = nextMute;
        setIsGlobalMuted(nextMute);
    };

    const videoUrl = product.product_video ? formatUrl(product.product_video) : '';

    return (
        <div className="w-full h-full sm:max-w-[450px] sm:border-x sm:border-white/10 relative" onClick={togglePlay}>
            <ProductTicker product={product} params={params} />
            {videoUrl ? (
                <VideoPlayer
                    videoId={String(product.product_id)}
                    src={videoUrl}
                    poster={product.first_image ? formatUrl(product.first_image) : undefined}
                    isMuted={isGlobalMuted}
                    isPaused={!isPlaying}
                    autoplay={isActive}
                    videoClassName="w-full h-full object-cover"
                    onMuteChange={setIsGlobalMuted}
                />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-800">
                    <p>Video unavailable</p>
                </div>
            )}

            {/* Play/Pause Overlay */}
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                    <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm text-white/80 pl-1">
                        <FaPlay size={24} />
                    </div>
                </div>
            )}

            {/* Mute toggle button */}
            <button
                onClick={toggleMute}
                className="absolute top-6 right-6 z-20 bg-black/40 backdrop-blur-md p-3 rounded-full text-white hover:bg-black/60 transition"
            >
                {isGlobalMuted ? <FaVolumeMute size={16} /> : <FaVolumeUp size={16} />}
            </button>

            {/* Right side interactions */}
            <div
                className="absolute right-4 bottom-32 z-20 flex flex-col items-center gap-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col items-center gap-1 group">
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
                                {product.isLiked ? <FaHeart size={20} /> : <FaRegHeart size={20} />}
                            </motion.div>
                        </AnimatePresence>

                        {/* Pulse effect */}
                        {product.isLiked && (
                            <motion.div
                                initial={{ scale: 1, opacity: 1 }}
                                animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 0] }}
                                transition={{ duration: 0.6 }}
                                className="absolute text-red-500 pointer-events-none"
                            >
                                <FaHeart size={20} />
                            </motion.div>
                        )}
                    </motion.button>
                    <span className="text-white text-[10px] font-bold drop-shadow-md">{product.likes_count || 0}</span>
                </div>

                <div className="flex flex-col items-center gap-1 group">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            router.push(`/market?product_id=${product.product_id}`);
                        }}
                        className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition"
                    >
                        <FaStore size={18} />
                    </button>
                    <span className="text-white text-[10px] font-bold drop-shadow-md">View Item</span>
                </div>

                <div className="flex flex-col items-center gap-1 group">
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
                    <span className="text-white text-[10px] font-bold drop-shadow-md">Share</span>
                </div>
            </div>

            {/* Bottom Info Gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-10" />

            {/* Bottom Info Content */}
            <div className="absolute bottom-0 left-0 right-16 p-5 z-20 flex flex-col pointer-events-auto shadow-2xl">
                <div
                    className="flex items-center gap-2 mb-3 cursor-pointer hover:opacity-90 transition-opacity w-fit"
                    onClick={(e) => {
                        e.stopPropagation();
                        onVendorClick(product.business_id);
                    }}
                >
                    <div className="w-10 h-10 rounded-full border border-white/20 overflow-hidden bg-slate-800 shrink-0 relative">
                        {product.logo ? (
                            <Image src={formatUrl(product.logo)} alt="Store" fill sizes="40px" className="object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs">{product.business_name?.charAt(0) || 'V'}</div>
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-white font-bold text-sm leading-tight flex items-center gap-1">
                            {product.business_name || "Unknown Store"}
                            {product.trusted_partner === 1 && (
                                <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                </svg>
                            )}
                        </span>
                        {product.category && (
                            <span className="text-white/70 text-[10px] font-bold  tracking-wider">{product.category}</span>
                        )}
                    </div>
                </div>

                <h3 className="text-white text-base font-semibold line-clamp-2 leading-snug drop-shadow-md mb-2">
                    {product.title}
                </h3>

                {((product.images && product.images.length > 0) || product.price) && (
                    <div className="flex items-center justify-between gap-3 mt-1">
                        <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-xl pr-3">
                            {product.images && product.images.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                    {product.images.slice(0, 2).map((img: string, idx: number) => (
                                        <div
                                            key={idx}
                                            className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0 shadow-lg relative"
                                        >
                                            <Image src={formatUrl(img)} alt="" fill sizes="40px" className="object-cover" />
                                        </div>
                                    ))}
                                    {product.images.length > 2 && (
                                        <div
                                            className="w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center cursor-pointer relative overflow-hidden group shadow-lg"
                                            onClick={(e) => { e.stopPropagation(); onBuyClick(e); }}
                                        >
                                            {/* Show the 3rd image behind the counter overlay */}
                                            <Image src={formatUrl(product.images[2])} alt="" fill sizes="40px" className="object-cover opacity-90 contrast-75" />
                                            <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                                                <span className="text-[10px] text-white font-bold drop-shadow-md">{product.images.length}+</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <span className="text-white font-bold text-base drop-shadow-lg ml-1">₦{Number(product.price).toLocaleString()}</span>
                        </div>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onBuyClick(e);
                            }}
                            className="bg-red-600 font-bold text-white text-[10px] px-4 py-2.5 rounded-full shadow-lg hover:bg-red-700 active:scale-95 transition-all whitespace-nowrap"
                        >
                            Buy Now
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
