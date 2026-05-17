"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { fetchPersonalizedFeed, toggleProductLike, logUserActivity } from "@/src/lib/api/productApi";
import { toggleSocialPostLike } from "@/src/lib/api/social";
import { formatUrl } from "@/src/lib/utils/media";
import MasonryGrid from "@/src/components/product/MasonryGrid";
import StoqleLoader from "@/src/components/common/StoqleLoader";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const ProductPreviewModal = dynamic(() => import("@/src/components/product/addProduct/modal/previewModal"), { ssr: false });
const ReelsModal = dynamic(() => import("@/src/components/product/addProduct/modal/reelsModal"), { ssr: false });
const PostModal = dynamic(() => import("@/src/components/modal/postModal"), { ssr: false });

import { fetchProductById } from "@/src/lib/api/productApi";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";


const LIMIT = 10;

const slugify = (str: string) =>
    String(str || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

export default function SubcategoryPage() {
    const params = useParams();
    const router = useRouter();
    const { token } = useAuth();

    const [isRestored, setIsRestored] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);

    const category = decodeURIComponent(params.category as string);
    const subcategory = decodeURIComponent(params.subcategory as string);

    const [products, setProducts] = useState<any[]>([]);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal states
    const [previewPayload, setPreviewPayload] = useState<any>(null);
    const [reelsModalOpen, setReelsModalOpen] = useState(false);
    const [postModalOpen, setPostModalOpen] = useState(false);
    const [activePost, setActivePost] = useState<any>(null);
    const [fetchingProductId, setFetchingProductId] = useState<number | string | null>(null);

    // Like states
    const [likeData, setLikeData] = useState<Record<number, { liked: boolean; count: number }>>({});
    const [postLikeData, setPostLikeData] = useState<Record<string, { liked: boolean; count: number }>>({});

    const updateUrl = useCallback((businessSlug?: string, productSlug?: string, businessName?: string) => {
        const urlParams = new URLSearchParams(window.location.search);
        if (productSlug) {
            const biz = businessSlug || (businessName ? slugify(businessName) : 'shop');
            urlParams.set("p", `${biz}/${productSlug}`);
            const newUrl = window.location.pathname + "?" + urlParams.toString();
            window.history.replaceState(window.history.state, "", newUrl);
        } else {
            urlParams.delete("p");
            const search = urlParams.toString();
            const newUrl = window.location.pathname + (search ? "?" + search : "");
            window.history.replaceState(window.history.state, "", newUrl);
        }
    }, []);

    const loaderRef = useRef<HTMLDivElement>(null);

    const fetchPage = useCallback(async (pageNum: number) => {
        try {
            if (pageNum === 0) setLoading(true);
            else setLoadingMore(true);

            const res = await fetchPersonalizedFeed(
                LIMIT,
                pageNum * LIMIT,
                token,
                category,
                false,
                false,
                undefined,
                undefined,
                subcategory
            );

            const newItems = (res?.data || []).map((p: any) => ({ ...p, type: 'product' }));
            if (newItems.length < LIMIT) setHasMore(false);

            if (pageNum === 0) {
                setProducts(newItems);
                setIsRestored(true);
            } else {
                setProducts(prev => [...prev, ...newItems]);
            }
            setError(null);
        } catch (err) {
            setError("Failed to load products");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [category, subcategory, token]);

    useEffect(() => {
        fetchPage(0);
    }, [fetchPage]);

    // Infinite scroll observer
    useEffect(() => {
        if (!hasMore || loading || loadingMore) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setPage(prev => {
                    const next = prev + 1;
                    fetchPage(next);
                    return next;
                });
            }
        }, { threshold: 0.1 });

        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [hasMore, loading, loadingMore, fetchPage]);

    const handleProductClick = async (id: any, name: any, e: any, bslug: any, isSocial: boolean, pslug?: string) => {
        if (isSocial) {
            setActivePost({ id, business_name: name, business_slug: bslug, slug: pslug, user: { name: name } });
            setPostModalOpen(true);
            updateUrl(bslug, pslug, name);
        } else {
            setFetchingProductId(id);
            try {
                const res = await fetchProductById(pslug || id, token);
                if (res?.data?.product) {
                    const mapped = mapProductToPreviewPayload(res.data.product, formatUrl);
                    setPreviewPayload(mapped);
                    updateUrl(bslug, pslug || res.data.product.slug, name);
                }
            } catch (err) {
                toast.error("Failed to load product details");
            } finally {
                setFetchingProductId(null);
            }
        }
    };


    const handleReelsClick = (id: any, name: any, e: any, bslug: any, pslug?: string) => {
        handleProductClick(id, name, e, bslug, false, pslug);
    };

    const handleLikeClick = async (e: any, id: number, currentLiked: boolean, currentCount: number) => {
        e.stopPropagation();
        if (!token) return toast.error("Please login to like products");

        setLikeData(prev => ({
            ...prev,
            [id]: { liked: !currentLiked, count: currentLiked ? currentCount - 1 : currentCount + 1 }
        }));

        try {
            await toggleProductLike(id, token);
        } catch (err) {
            // rollback
            setLikeData(prev => ({
                ...prev,
                [id]: { liked: currentLiked, count: currentCount }
            }));
        }
    };

    const handlePostLikeClick = async (e: any, id: string, currentLiked: boolean, currentCount: number) => {
        e.stopPropagation();
        if (!token) return toast.error("Please login to like posts");

        setPostLikeData(prev => ({
            ...prev,
            [id]: { liked: !currentLiked, count: currentLiked ? currentCount - 1 : currentCount + 1 }
        }));

        try {
            await toggleSocialPostLike(id, token);
        } catch (err) {
            setPostLikeData(prev => ({
                ...prev,
                [id]: { liked: currentLiked, count: currentCount }
            }));
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center gap-3">
                <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
                    <ChevronLeft size={20} className="text-slate-600" />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-bold text-slate-900 truncate uppercase tracking-tight">{subcategory}</h1>
                    <p className="text-[10px] text-slate-500 font-medium truncate">{category}</p>
                </div>
                <button
                    onClick={() => {
                        setIsNavigating(true);
                        router.push('/cart');
                    }}
                    className="relative p-2 rounded-full hover:bg-slate-100 transition-colors"
                >
                    <ShoppingCart size={20} className="text-slate-600" />
                </button>
            </header>

            <main className="px-4 py-4 max-w-[1800px] mx-auto">
                {loading && products.length === 0 ? (
                    <div className="py-20 flex justify-center">
                        <StoqleLoader size={30} />
                    </div>
                ) : error ? (
                    <div className="py-20 text-center">
                        <p className="text-sm text-slate-500">{error}</p>
                        <button onClick={() => fetchPage(0)} className="mt-4 text-rose-500 font-bold text-xs uppercase">Retry</button>
                    </div>
                ) : products.length === 0 ? (
                    <div className="py-20 text-center">
                        <p className="text-sm text-slate-500 font-medium">No products found in this subcategory</p>
                    </div>
                ) : (
                    <>
                        <MasonryGrid
                            items={products}
                            likeData={likeData}
                            postLikeData={postLikeData}
                            fetchingProductId={fetchingProductId}
                            handleProductClick={handleProductClick}
                            handleReelsClick={handleReelsClick}
                            handleLikeClick={handleLikeClick}
                            handlePostLikeClick={handlePostLikeClick}
                            formatUrl={formatUrl}
                            router={router}
                            isRestored={isRestored}
                        />

                        {/* Infinite scroll trigger */}
                        <div ref={loaderRef} className="py-10 flex justify-center min-h-[60px]">
                            {loadingMore && <StoqleLoader size={24} />}
                        </div>
                    </>
                )}
            </main>

            {/* Modals */}
            {previewPayload && (
                <ProductPreviewModal
                    open={!!previewPayload}
                    onClose={() => {
                        setPreviewPayload(null);
                        updateUrl();
                    }}
                    payload={previewPayload}
                />
            )}


            {postModalOpen && activePost && (
                <PostModal
                    open={postModalOpen}
                    onClose={() => {
                        setPostModalOpen(false);
                        updateUrl();
                    }}
                    post={activePost}
                    onToggleLike={() => { }}
                    userToken={token}
                />
            )}

            {isNavigating && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center  pointer-events-none">
                    <StoqleLoader size={30} />
                </div>
            )}

        </div>
    );
}
