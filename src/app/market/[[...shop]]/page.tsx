"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import LoginModal from "@/src/components/modal/auth/loginModal";
import ShimmerGrid from "@/src/components/shimmer";
import { fetchMarketFeed, fetchProductById, toggleProductLike } from "@/src/lib/api/productApi";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import type { PreviewPayload, ProductSku } from "@/src/types/product";
import { API_BASE_URL } from "@/src/lib/config";

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

export default function MarketPage({ params, postCount = 100 }: Props) {
    const routeParams = React.use(params);
    const [activeCategory, setActiveCategory] = useState<string>("All");
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [fetchingProduct, setFetchingProduct] = useState(false);

    // --- Pagination State ---
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loaderRef = useRef<HTMLDivElement>(null);
    const LIMIT = 10;

    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, token } = useAuth();
    const [showLoginModal, setShowLoginModal] = useState(false);

    const [likeData, setLikeData] = useState<Record<number, { liked: boolean, count: number }>>({});

    const handleLikeClick = async (e: React.MouseEvent, productId: number, baseCount: number) => {
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
    };

    // We could fetch actual categories or just have common ones
    const CATEGORIES = useMemo(
        () => [
            "All",
            "Clothing",
            "Shoes",
            "Electronics",
            "Beauty",
            "Home",
            "Sports",
            "Automotive",
            "Toys",
            "Jewelry"
        ],
        []
    );

    const fetchPage = async (pageNum: number) => {
        if (!hasMore || isLoadingMore) return;

        setIsLoadingMore(true);
        if (pageNum === 0) setLoading(true);

        try {
            const res = await fetchMarketFeed(LIMIT, pageNum * LIMIT);
            const nextProducts = res?.data?.products || [];

            if (nextProducts.length < LIMIT) {
                setHasMore(false);
            }

            setProducts(prev => {
                const existingIds = new Set(prev.map(p => p.product_id));
                const unique = nextProducts.filter((p: any) => !existingIds.has(p.product_id));
                return [...prev, ...unique];
            });
            setPage(pageNum + 1);
        } catch (err) {
            setError("Failed to load products. Please try again later.");
        } finally {
            setLoading(false);
            setIsLoadingMore(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchPage(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
        if (activeCategory === "All") return products;
        return products.filter((p) => (p.category || "").toLowerCase() === activeCategory.toLowerCase());
    }, [products, activeCategory]);

    const formatUrl = (url: string) => {
        if (!url) return "https://via.placeholder.com/800x600?text=No+Image";
        if (url.startsWith("http")) return url;
        return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    };

    const updateUrl = (productId: number | null, businessName?: string) => {
        const params = new URLSearchParams(window.location.search);
        let currentPath = window.location.pathname;
        let newUrl = currentPath;

        if (productId) {
            params.set("product_id", String(productId));
            const slug = businessName ? slugify(businessName) : (routeParams?.shop?.[0] || "product");
            newUrl = `/market/${slug}?${params.toString()}`;
        } else {
            params.delete("product_id");
            const search = params.toString();
            // If we are deep in a shop path, let's keep it or go back to /market
            newUrl = `/market${search ? `?${search}` : ""}`;
        }

        if (newUrl !== window.location.pathname + window.location.search) {
            window.history.pushState({ ...window.history.state, as: newUrl, url: newUrl }, "", newUrl);
        }
    };

    const handleProductClick = async (productId: number, businessName?: string) => {
        if (fetchingProduct) return;
        updateUrl(productId, businessName);
        try {
            setFetchingProduct(true);
            const res = await fetchProductById(productId);
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

                    variantGroups: (dbProduct.variant_groups || []).map((g: any) => ({
                        id: String(g.group_id),
                        title: g.title,
                        allowImages: g.allow_images === 1,
                        entries: (g.options || []).map((o: any) => ({
                            id: String(o.option_id),
                            name: o.name,
                            price: o.price,
                            quantity: o.initial_quantity || 0, // Should be fetched from inventory later if tracking dynamically
                            images: (o.media || []).map((m: any) => ({ name: "img", url: formatUrl(m.url) }))
                        }))
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
            setFetchingProduct(false);
        }
    };

    // Handle deep linking from URL and Browser Back/Forward buttons
    useEffect(() => {
        const handleRouteChange = () => {
            const params = new URLSearchParams(window.location.search);
            const productId = params.get("product_id");

            if (productId) {
                const pid = Number(productId);
                if (!modalOpen && !fetchingProduct && selectedProductPayload?.productId !== pid) {
                    handleProductClick(pid);
                }
            } else if (modalOpen) {
                setModalOpen(false);
                setSelectedProductPayload(null);
            }
        };

        // Listen for browser back/forward
        window.addEventListener('popstate', handleRouteChange);

        // Initial check
        handleRouteChange();

        return () => window.removeEventListener('popstate', handleRouteChange);
    }, [modalOpen, fetchingProduct, selectedProductPayload]);

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
                    <div className="p-4"><ShimmerGrid count={10} /></div>
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
                    <div className="post-grid p-2 sm:p-4 ">
                        {filteredProducts.flatMap((p) => {
                            const isPromoActive = p.promo_title && p.promo_discount && (!p.promo_end || new Date(p.promo_end) >= new Date());

                            const renderCard = (isVideoCover: boolean) => (
                                <article
                                    key={`${p.product_id}${isVideoCover ? '-vid' : ''}`}
                                    onClick={() => {
                                        if (isVideoCover) {
                                            router.push(`/shopping-reels?product_id=${p.product_id}`);
                                        } else {
                                            handleProductClick(p.product_id, p.business_name);
                                        }
                                    }}
                                    className="group flex flex-col rounded-[1.05rem] bg-white cursor-pointer transition-all  border border-slate-100 overflow-hidden"
                                >
                                    <div className="relative w-full aspect-[4/5] bg-slate-100 overflow-hidden">
                                        {isVideoCover ? (
                                            <video
                                                src={formatUrl(p.product_video!)}
                                                autoPlay
                                                muted
                                                loop
                                                playsInline
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                            />
                                        ) : (
                                            <img
                                                src={formatUrl(p.first_image)}
                                                alt={p.title}
                                                loading="lazy"
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            />
                                        )}

                                        {isVideoCover && (
                                            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md rounded-full p-2 z-10 shadow-lg border border-white/20">
                                                <svg className="w-3.5 h-3.5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M8 5.14v14l11-7-11-7z" />
                                                </svg>
                                            </div>
                                        )}

                                        {!isVideoCover && fetchingProduct && <div className="absolute inset-0 bg-white/30 z-20 flex items-center justify-center"><div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div></div>}
                                    </div>




                                    <div className="p-3">
                                        {isVideoCover ? (
                                            <>
                                                <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded p-1 mb-2">
                                                    <img src={formatUrl(p.first_image)} className="w-8 h-8 rounded shrink-0 object-cover border border-slate-200" alt="product thumbnail" />
                                                    <span className="text-slate-900 text-sm font-bold tracking-tight pr-1">₦{Number(p.price || 0).toLocaleString()}</span>
                                                </div>
                                                <h3 className="text-sm font-semibold text-slate-800 line-clamp-1 leading-snug mb-2" title={p.title}>
                                                    {p.title || "Untitled Product"}
                                                </h3>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="h-5 w-5 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                                                            <img
                                                                src={p.logo ? formatUrl(p.logo) : (p.profile_pic ? formatUrl(p.profile_pic) : "/assets/images/favio.png")}
                                                                className="w-full h-full object-cover"
                                                                alt="Vendor"
                                                            />
                                                        </div>
                                                        <span className="truncate text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors max-w-[120px]">
                                                            {p.business_name || "Unknown Store"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 cursor-pointer" onClick={(e) => handleLikeClick(e, p.product_id, p.likes_count || 0)}>
                                                        {(likeData[p.product_id]?.liked) ? <FaHeart className="text-red-500 text-sm" /> : <FaRegHeart className="text-slate-400 text-sm" />}
                                                        <span className="text-xs font-semibold text-slate-600">{likeData[p.product_id]?.count ?? (p.likes_count || 0)}</span>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center justify-between pt-1 border-slate-50">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="h-5 w-5 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                                                            <img
                                                                src={p.logo ? formatUrl(p.logo) : (p.profile_pic ? formatUrl(p.profile_pic) : "/assets/images/favio.png")}
                                                                className="w-full h-full object-cover"
                                                                alt="Vendor"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1">
                                                                <span className="truncate text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                                                                    {p.business_name || "Unknown Store"}
                                                                </span>
                                                                {p.trusted_partner === 1 && (
                                                                    <svg className="w-3 h-3 text-emerald-700" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug mb-2.5" title={p.title}>
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
                                </article>
                            );

                            if (p.product_video) {
                                return [renderCard(false), renderCard(true)];
                            }
                            return [renderCard(false)];
                        })}
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
            {
                modalOpen && selectedProductPayload && (
                    <ProductPreviewModal
                        open={modalOpen}
                        payload={selectedProductPayload}
                        onClose={() => {
                            setModalOpen(false);
                            setSelectedProductPayload(null);
                            updateUrl(null);
                        }}
                        onProductClick={handleProductClick}
                    />
                )
            }

            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
        </>
    );
}
