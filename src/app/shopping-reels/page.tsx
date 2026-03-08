"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchMarketFeed, fetchProductById } from "@/src/lib/api/productApi";
import { ProductFeedItem, PreviewPayload, ProductSku } from "@/src/types/product";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import { API_BASE_URL } from "@/src/lib/config";
import { FaPlay, FaPause, FaVolumeMute, FaVolumeUp, FaArrowLeft, FaStore, FaHeart, FaShare } from "react-icons/fa";

import { Suspense } from "react";

const formatUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
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

    const handleProductBuyClick = async (productId: number, businessName?: string) => {
        if (fetchingProduct) return;
        try {
            setFetchingProduct(true);
            const res = await fetchProductById(productId);
            if (res?.data?.product) {
                const dbProduct = res.data.product;

                const mappedPayload: PreviewPayload = {
                    productId: dbProduct.product_id,
                    title: dbProduct.title,
                    description: dbProduct.description,
                    category: dbProduct.category,
                    hasVariants: dbProduct.has_variants === 1,
                    price: dbProduct.price ?? "",
                    quantity: dbProduct.quantity ?? "",
                    samePriceForAll: false,
                    sharedPrice: null,
                    businessId: Number(dbProduct.business_id),
                    productImages: (dbProduct.media || []).filter((m: any) => m.type === "image").map((m: any) => ({ name: "img", url: formatUrl(m.url) })),
                    productVideo: (dbProduct.media || []).find((m: any) => m.type === "video") ? { name: "vid", url: formatUrl(dbProduct.media.find((m: any) => m.type === "video")!.url) } : null,
                    useCombinations: dbProduct.use_combinations === 1,
                    params: (dbProduct.params || []).map((p: any) => ({ key: p.param_key, value: p.param_value })),

                    variantGroups: (dbProduct.variant_groups || []).map((g: any) => ({
                        id: String(g.group_id),
                        title: g.title,
                        allowImages: g.allow_images === 1,
                        entries: (g.options || []).map((o: any) => ({
                            id: String(o.option_id),
                            name: o.name,
                            price: o.price,
                            quantity: o.initial_quantity || 0,
                            images: (o.media || []).map((m: any) => ({ name: "img", url: formatUrl(m.url) }))
                        }))
                    })),

                    skus: (dbProduct.skus || []).map((s: any) => {
                        let vIds: string[] = [];
                        try {
                            vIds = typeof s.variant_option_ids === 'string'
                                ? JSON.parse(s.variant_option_ids)
                                : s.variant_option_ids;
                        } catch (e) { }

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

    const loadInitialSequence = async () => {
        setLoading(true);
        try {
            let initialProduct: ProductFeedItem | null = null;
            if (initialProductId) {
                // Fetch the explicitly clicked product
                const res = await fetchProductById(Number(initialProductId));
                if (res?.data) {
                    const p = res.data.product || res.data;
                    let bestPrice = p.price;
                    if (!bestPrice || bestPrice <= 0) {
                        const allSkus = p.skus?.map((s: any) => s.price).filter((pr: number) => pr > 0) || [];
                        if (allSkus.length > 0) {
                            bestPrice = Math.min(...allSkus);
                        } else {
                            const allOpts = p.variant_groups?.flatMap((g: any) => g.options)?.map((o: any) => o.price).filter((pr: number) => pr > 0) || [];
                            if (allOpts.length > 0) bestPrice = Math.min(...allOpts);
                        }
                    }

                    // Format it to match ProductFeedItem enough for reels
                    initialProduct = {
                        product_id: p.product_id,
                        title: p.title,
                        price: bestPrice || 0,
                        category: p.category,
                        business_id: p.business_id,
                        business_name: p.business_name || "Store",
                        logo: p.logo || null,
                        first_image: p.media?.[0]?.url || "",
                        product_video: "", // Set below if possible
                    };

                    // If product doesn't have a video explicitly as product_video, maybe it's in images type video 
                    if (p.media) {
                        const vid = p.media.find((m: any) => m.type === 'video');
                        if (vid) initialProduct.product_video = vid.url;
                    }
                }
            }

            const feedRes = await fetchMarketFeed(10, 0, undefined, undefined, true);
            const feedProducts = feedRes?.data?.products || [];

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
    };

    useEffect(() => {
        loadInitialSequence();
    }, [initialProductId]);

    const loadMore = useCallback(async () => {
        if (!hasMore || loading) return;
        try {
            const feedRes = await fetchMarketFeed(10, page * 10, undefined, undefined, true);
            const newProducts = feedRes?.data?.products || [];
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
        // Calculate which video is most prominent
        const index = Math.round(scrollPosition / viewHeight);
        if (index !== activeVideoIndex && index >= 0 && index < products.length) {
            setActiveVideoIndex(index);
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
                            <ReelItem
                                product={p}
                                isActive={i === activeVideoIndex}
                                onBuyClick={() => handleProductBuyClick(p.product_id, p.business_name)}
                                isGlobalMuted={isGlobalMuted}
                                setIsGlobalMuted={setIsGlobalMuted}
                            />
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
                        onClose={() => {
                            setModalOpen(false);
                            setSelectedProductPayload(null);
                        }}
                        onProductClick={handleProductBuyClick}
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

function ReelItem({
    product,
    isActive,
    onBuyClick,
    isGlobalMuted,
    setIsGlobalMuted
}: {
    product: ProductFeedItem;
    isActive: boolean;
    onBuyClick: () => void;
    isGlobalMuted: boolean;
    setIsGlobalMuted: (muted: boolean) => void;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!videoRef.current) return;

        // Always enforce muted state when active because of browser policy
        videoRef.current.muted = isGlobalMuted;

        if (isActive) {
            videoRef.current.currentTime = 0;
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // Auto-play prevented, wait for user interaction
                    setIsPlaying(false);
                });
            }
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    }, [isActive, isGlobalMuted]);

    const togglePlay = () => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play();
        }
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
            {videoUrl ? (
                <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-full object-cover"
                    loop
                    playsInline
                    muted={isGlobalMuted}
                    poster={product.first_image ? formatUrl(product.first_image) : undefined}
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
            <div className="absolute right-4 bottom-32 z-20 flex flex-col items-center gap-6">
                <div className="flex flex-col items-center gap-1 group">
                    <button className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-red-500 transition">
                        <FaHeart size={20} />
                    </button>
                    <span className="text-white text-[10px] font-bold drop-shadow-md">Like</span>
                </div>

                <div className="flex flex-col items-center gap-1 group">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/market?product_id=${product.product_id}`);
                        }}
                        className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition"
                    >
                        <FaStore size={18} />
                    </button>
                    <span className="text-white text-[10px] font-bold drop-shadow-md">View Item</span>
                </div>

                <div className="flex flex-col items-center gap-1 group">
                    <button className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition">
                        <FaShare size={18} />
                    </button>
                    <span className="text-white text-[10px] font-bold drop-shadow-md">Share</span>
                </div>
            </div>

            {/* Bottom Info Gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-10" />

            {/* Bottom Info Content */}
            <div className="absolute bottom-0 left-0 right-16 p-5 z-20 flex flex-col pointer-events-auto shadow-2xl">
                <div className="flex items-center gap-2 mb-3" onClick={(e) => e.stopPropagation()}>
                    <div className="w-10 h-10 rounded-full border border-white/20 overflow-hidden bg-slate-800 shrink-0">
                        {product.logo ? (
                            <img src={formatUrl(product.logo)} alt="Store" className="w-full h-full object-cover" />
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
                        <span className="text-white/70 text-[10px] font-medium tracking-wide">Sponsored</span>
                    </div>
                </div>

                <h3 className="text-white text-base font-semibold line-clamp-2 leading-snug drop-shadow-md mb-2">
                    {product.title}
                </h3>

                <div className="flex items-center justify-between mt-1">
                    <div className="text-white font-extrabold text-xl tracking-tight drop-shadow-lg">
                        ₦{Number(product.price).toLocaleString()}
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onBuyClick();
                        }}
                        className="bg-red-600 font-bold text-white text-sm px-5 py-2 rounded-full shadow-lg hover:bg-red-700 hover:scale-105 active:scale-95 transition-all"
                    >
                        Buy Now
                    </button>
                </div>
            </div>
        </div>
    );
}
