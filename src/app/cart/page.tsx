"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { fetchCartApi, updateCartQuantityApi, removeFromCartApi } from "@/src/lib/api/cartApi";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import ShimmerGrid from "@/src/components/shimmer";
import Image from "next/image";
import {
    TrashIcon,
    MinusIcon,
    PlusIcon,
    ShoppingBagIcon,
    ArrowLeftIcon,
    ChevronRightIcon,
    ChevronLeftIcon,
    ShoppingCartIcon,
    CheckIcon
} from "@heroicons/react/24/outline";
import { fetchMarketFeed, fetchProductById, toggleProductLike, logUserActivity, fetchPersonalizedFeed } from "@/src/lib/api/productApi";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import ReelsModal from "@/src/components/product/addProduct/modal/reelsModal";
import PostModal from "@/src/components/modal/postModal";
import { fetchLinkedProductPosts, fetchSocialPostById, toggleSocialPostLike } from "@/src/lib/api/social";
import PhoneVerificationModal from "@/src/components/modal/phoneVerificationModal";
import { VerifiedBadge } from "@/src/components/common/VerifiedBadge";
import { fetchVendorBadgesBatch, type VendorBadge } from "@/src/lib/api/vendorApi";
import type { PreviewPayload, ProductSku } from "@/src/types/product";
import { API_BASE_URL } from "@/src/lib/config";
import { toast } from "sonner";
import { fetchUserAddresses, UserAddress } from "@/src/lib/api/addressApi";
import dynamic from "next/dynamic";
import { estimateDelivery, EstimationResult } from "@/src/lib/deliveryEstimation";

const MarketClient = dynamic(() => import("../market/[[...shop]]/MarketClient"), { ssr: false, loading: () => <ShimmerGrid count={10} /> });

interface CartItem {
    cart_id: number;
    user_id: number;
    product_id: number;
    sku_id: number | null;
    variant_option_ids: string[] | null;
    quantity: number;
    product_title: string;
    base_price: number;
    has_variants: number;
    use_combinations: number;
    business_name: string;
    business_id: number;
    business_slug?: string;
    business_logo: string;
    sku_price: number | null;
    sku_code: string | null;
    variant_label?: string;
    product_image: string;
    price: number; // resolved price
    total_quantity?: number; // actual stock from inventory join if added
    return_shipping_subsidy?: number;
    seven_day_no_reason?: number;
    rapid_refund?: number;
    sales_discounts?: any[];
    business_latitude: number;
    business_longitude: number;
    shipping_policies: any[];
    category?: string;
    profile_pic?: string;
}


export default function CartPage() {
    const router = useRouter();
    const { user, token, isHydrated } = useAuth();
    const [items, setItems] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingIds, setUpdatingIds] = useState<number[]>([]);

    // Recommendations State (Deprecated - Now using MarketClient)
    const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [reelsModalOpen, setReelsModalOpen] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
    const [selectedSocialPost, setSelectedSocialPost] = useState<any | null>(null);
    const [fetchingProduct, setFetchingProduct] = useState(false);
    const [phoneModalOpen, setPhoneModalOpen] = useState(false);
    const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
    const [likeData, setLikeData] = useState<Record<number, { liked: boolean, count: number }>>({});
    const [editingCartId, setEditingCartId] = useState<number | null>(null);
    const [selectedCartIds, setSelectedCartIds] = useState<number[]>([]);
    const [address, setAddress] = useState<UserAddress | null>(null);
    const [vendorBadges, setVendorBadges] = useState<Record<number, VendorBadge>>({});
    const [isClient, setIsClient] = useState(false);

    const marketParams = useMemo(() => Promise.resolve({ shop: [] }), []);

    const fetchCart = async () => {
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            const res = await fetchCartApi(token);
            if (res.status === 'success') {
                const fetchedItems: CartItem[] = res.data?.items || [];

                // Deduplicate by cart_id to prevent "duplicate key" crashes
                const uniqueItems = fetchedItems.filter((item, index, self) =>
                    index === self.findIndex((t) => t.cart_id === item.cart_id)
                );

                setItems(uniqueItems);

                // Batch-fetch vendor badges in one round-trip (non-blocking)
                const uniqueBusinessIds = [...new Set(uniqueItems.map(i => i.business_id))];
                if (uniqueBusinessIds.length > 0) {
                    fetchVendorBadgesBatch(uniqueBusinessIds)
                        .then(badges => setVendorBadges(badges))
                        .catch(() => { });
                }

                const savedIds = sessionStorage.getItem("stoqle_checkout_ids");
                if (savedIds) {
                    try {
                        const parsed = JSON.parse(savedIds);
                        if (Array.isArray(parsed)) {
                            const validIds = parsed.filter(id => fetchedItems.some(item => item.cart_id === id));
                            setSelectedCartIds(validIds);
                        }
                    } catch (e) {
                        setSelectedCartIds([]);
                    }
                    sessionStorage.removeItem("stoqle_checkout_ids");
                } else {
                    setSelectedCartIds([]);
                }
            }
        } catch (err) {
            console.error("Fetch cart error", err);
            toast.error("Failed to load cart");
        } finally {
            setLoading(false);
        }
    };

    const fetchDefaultAddress = async () => {
        if (!token) return;
        try {
            const res = await fetchUserAddresses(token);
            if (res.status === 'success' && res.data?.addresses) {
                const defaultAddr = res.data.addresses.find((a: UserAddress) => a.is_default);
                if (defaultAddr) setAddress(defaultAddr);
            }
        } catch (err) {
            console.error("Fetch address error", err);
        }
    };

    const fetchRecommendations = async () => {
        // Now handled by MarketClient instance below
    };

    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        if (!isHydrated) return;

        window.scrollTo(0, 0);
        fetchRecommendations();

        if (token) {
            fetchCart();
            fetchDefaultAddress();
        } else {
            // User definitely not logged in after hydration
            setLoading(false);
        }

        // Real-time synchronization
        const handleCartUpdate = () => {
            fetchCart();
        };

        const handleScroll = () => {
            if (window.scrollY > 50) {
                setIsScrolled(true);
            } else {
                setIsScrolled(false);
            }
        };

        window.addEventListener("cart-updated", handleCartUpdate);
        window.addEventListener("scroll", handleScroll, { passive: true });

        // Sync across tabs
        const channel = typeof window !== 'undefined' ? new BroadcastChannel('stoqle_cart_sync') : null;
        if (channel) {
            channel.onmessage = (event) => {
                if (event.data === 'update') {
                    fetchCart();
                }
            };
        }

        return () => {
            window.removeEventListener("cart-updated", handleCartUpdate);
            if (channel) channel.close();
        };
    }, [token, isHydrated]);

    const handleUpdateQuantity = async (cartId: number, newQty: number) => {
        if (newQty < 1) return;
        setUpdatingIds(prev => [...prev, cartId]);
        try {
            const res = await updateCartQuantityApi(cartId, newQty, token!);
            if (res.status) {
                setItems(prev => prev.map(item =>
                    item.cart_id === cartId ? { ...item, quantity: newQty } : item
                ));
                // Broadcast update
                const channel = new BroadcastChannel('stoqle_cart_sync');
                channel.postMessage('update');
                channel.close();
            }
        } catch (err) {
            toast.error("Failed to update quantity");
        } finally {
            setUpdatingIds(prev => prev.filter(id => id !== cartId));
        }
    };

    const handleRemoveItem = async (cartId: number) => {
        try {
            const res = await removeFromCartApi(cartId, token!);
            if (res.status) {
                setItems(prev => prev.filter(item => item.cart_id !== cartId));
                toast.success("Item removed");
                // Broadcast update
                const channel = new BroadcastChannel('stoqle_cart_sync');
                channel.postMessage('update');
                channel.close();
            }
        } catch (err) {
            toast.error("Failed to remove item");
        }
    };

    const toggleItemSelection = (cartId: number) => {
        setSelectedCartIds(prev =>
            prev.includes(cartId)
                ? prev.filter(id => id !== cartId)
                : [...prev, cartId]
        );
    };

    const toggleShopSelection = (businessId: number, itemIds: number[]) => {
        const allSelected = itemIds.every(id => selectedCartIds.includes(id));
        if (allSelected) {
            setSelectedCartIds(prev => prev.filter(id => !itemIds.includes(id)));
        } else {
            setSelectedCartIds(prev => Array.from(new Set([...prev, ...itemIds])));
        }
    };

    const availableItems = useMemo(() => {
        return items.filter(item => (item.total_quantity ?? 0) > 0);
    }, [items]);

    const isAllSelected = useMemo(() => {
        return availableItems.length > 0 && availableItems.every(item => selectedCartIds.includes(item.cart_id));
    }, [availableItems, selectedCartIds]);

    const handleToggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedCartIds([]);
        } else {
            setSelectedCartIds(availableItems.map(item => item.cart_id));
        }
    };

    const groupedItems = useMemo(() => {
        const groupList: {
            business_id: number;
            business_name: string;
            business_logo: string;
            profile_pic?: string;
            business_slug?: string;
            items: CartItem[];
            estimation: EstimationResult | null;
        }[] = [];
        if (!items || !Array.isArray(items)) return groupList;

        const available = items.filter(item => (item.total_quantity ?? 0) > 0);
        available.forEach(item => {
            let group = groupList.find(g => g.business_id === item.business_id);
            if (!group) {
                let est: EstimationResult | null = null;
                if (address && item.business_latitude && item.business_longitude) {
                    est = estimateDelivery(
                        { latitude: Number(item.business_latitude), longitude: Number(item.business_longitude) },
                        { latitude: Number(address.latitude), longitude: Number(address.longitude) },
                        item.shipping_policies || []
                    );
                }

                group = {
                    business_id: item.business_id,
                    business_name: item.business_name,
                    business_logo: item.business_logo || item.profile_pic || "",
                    profile_pic: item.profile_pic,
                    business_slug: item.business_slug,
                    items: [],
                    estimation: est
                };
                groupList.push(group);
            }
            group.items.push(item);
        });
        return groupList;
    }, [items, address]);

    const cartVendorIds = useMemo(() => {
        if (!items || !Array.isArray(items)) return [];
        return Array.from(new Set(items.map(item => item.business_id)));
    }, [items]);

    const relatedCategory = useMemo(() => {
        if (!items || items.length === 0) return undefined;
        // Logic: Pick the first available category from the items in the cart
        const itemWithCategory = items.find(item => item.category);
        return itemWithCategory?.category;
    }, [items]);

    const outOfStockItems = useMemo(() => {
        if (!items || !Array.isArray(items)) return [];
        return items.filter(item => (item.total_quantity ?? 0) <= 0);
    }, [items]);

    const totalPrice = useMemo(() => {
        if (!items || !Array.isArray(items)) return 0;
        return items
            .filter(item => (item.total_quantity ?? 0) > 0 && selectedCartIds.includes(item.cart_id))
            .reduce((acc, item) => acc + (item.price * item.quantity), 0);
    }, [items, selectedCartIds]);

    const formatUrl = (url: string) => {
        if (!url) return "";
        let formatted = url;
        if (!url.startsWith("http")) {
            formatted = url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
        }
        return encodeURI(formatted);
    };

    const updateUrl = useCallback((productId: number | string | null, replace: boolean = false, isReels: boolean = false) => {
        const urlParams = new URLSearchParams(window.location.search);
        if (productId) {
            urlParams.set("product_id", String(productId));
            if (isReels) urlParams.set("reels", "true");
            else urlParams.delete("reels");
        } else {
            urlParams.delete("product_id");
            urlParams.delete("reels");
        }
        const search = urlParams.toString();
        const newUrl = `${window.location.pathname}${search ? `?${search}` : ""}`;
        if (newUrl !== window.location.pathname + window.location.search) {
            if (replace) {
                window.history.replaceState(window.history.state, "", newUrl);
            } else {
                window.history.pushState(window.history.state, "", newUrl);
            }
        }
    }, []);

    const handleProductClick = async (productId: number | string, businessName?: string, e?: any, businessSlug?: string, isSocialPost?: boolean, productSlug?: string) => {
        if (fetchingProduct) return;

        let actualEvent: React.MouseEvent | undefined = e;
        let replaceUrl = false;
        let isSocial = isSocialPost || (typeof productId === 'string' && productId.startsWith('post-'));

        if (actualEvent) {
            setClickPos({ x: actualEvent.clientX, y: actualEvent.clientY });
        } else {
            setClickPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        }

        // --- OPTIMISTIC OPEN for Social Posts (Deprecated for local feed) ---

        if (!isSocial) updateUrl(productId, replaceUrl);

        try {
            setFetchingProduct(true);
            if (isSocial) {
                const realId = String(productId).replace('post-', '');
                const res = await fetchSocialPostById(Number(realId), { token: token! });
                if (res) {
                    setSelectedSocialPost(res);
                }
            } else {
                const identifier = productSlug || productId;
                const res = await fetchProductById(identifier);
                if (res?.data?.product) {
                    const dbProduct = res.data.product;
                    const mappedPayload = mapProductToPreviewPayload(dbProduct, formatUrl);
                    const baseInv = (dbProduct.inventory || []).find((inv: any) => !inv.sku_id && !inv.variant_option_id);
                    if (baseInv) mappedPayload.quantity = baseInv.quantity;
                    setSelectedProductPayload(mappedPayload);
                    setModalOpen(true);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setFetchingProduct(false);
        }
    };

    const handleReelsClick = useCallback(async (productId: number | string, businessName?: string, e?: any, businessSlug?: string, productSlug?: string) => {
        handleProductClick(productId, businessName, e, businessSlug, false, productSlug);
    }, [handleProductClick]);

    useEffect(() => {
        const handleRouteChange = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const productId = urlParams.get("product_id");
            const isReels = urlParams.get("reels") === "true";

            if (productId) {
                const isSocial = productId.startsWith('post-');

                if (isReels) {
                    const pid = isSocial ? productId : Number(productId);
                    if (!reelsModalOpen) {
                        setSelectedProductId(pid as any);
                        setReelsModalOpen(true);
                    }
                } else {
                    if (isSocial) {
                        if (!selectedSocialPost && !fetchingProduct) {
                            handleProductClick(productId, undefined, undefined, undefined, true);
                        }
                    } else {
                        const pid = Number(productId);
                        if (!modalOpen && !fetchingProduct && selectedProductPayload?.productId !== pid) {
                            handleProductClick(pid, undefined, undefined, undefined, false);
                        }
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
        window.addEventListener('popstate', handleRouteChange);
        handleRouteChange();
        return () => window.removeEventListener('popstate', handleRouteChange);
    }, [modalOpen, fetchingProduct, selectedProductPayload]);

    const handleLikeClick = async (e: React.MouseEvent, productId: number | string, baseCount: number) => {
        e.stopPropagation();
        if (!user || !token) {
            toast.error("Please login to like products");
            return;
        }

        const isSocial = typeof productId === 'string' && productId.startsWith('post-');
        const cacheKey = productId as any;

        const current = likeData[cacheKey] || { liked: false, count: baseCount };
        const newLiked = !current.liked;
        const newCount = newLiked ? current.count + 1 : Math.max(0, current.count - 1);
        setLikeData(prev => ({ ...prev, [cacheKey]: { liked: newLiked, count: newCount } }));

        try {
            if (isSocial) {
                const realId = String(productId).replace('post-', '');
                const res = await toggleSocialPostLike(realId, token);
                if (res) {
                    setLikeData(prev => ({
                        ...prev,
                        [cacheKey]: {
                            liked: res.liked !== undefined ? !!res.liked : newLiked,
                            count: Number(res.likes_count ?? res.likeCount ?? newCount)
                        }
                    }));
                }
            } else {
                const res = await toggleProductLike(Number(productId), token);
                setLikeData(prev => ({ ...prev, [cacheKey]: { liked: res.data.liked, count: res.data.likes_count } }));
                if (res.data.liked) {
                    logUserActivity({ product_id: Number(productId), action_type: 'like' }, token);
                }
            }
        } catch (err) {
            setLikeData(prev => ({ ...prev, [cacheKey]: current }));
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <div className="h-14 bg-white border-b border-slate-100 flex items-center px-4 justify-between sticky top-0 z-50">
                    <div className="w-8 h-8 rounded-full shimmer-bg" />
                    <div className="w-24 h-4 shimmer-bg rounded-md" />
                    <div className="w-8 h-8 rounded-full shimmer-bg" />
                </div>
                <div className=" space-y-6">
                    {[1, 2].map((i) => (
                        <div key={i} className="bg-white border border-slate-100 rounded overflow-hidden space-y-px">
                            <div className="p-4 border-b border-slate-50 flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full shimmer-bg" />
                                <div className="w-6 h-6 rounded-full shimmer-bg" />
                                <div className="w-32 h-3 shimmer-bg rounded" />
                            </div>
                            {[1, 2].map((j) => (
                                <div key={j} className="p-4 flex gap-4">
                                    <div className="w-5 h-5 rounded-full shimmer-bg mt-8" />
                                    <div className="w-24 h-24 rounded-xl shimmer-bg flex-shrink-0" />
                                    <div className="flex-1 space-y-3">
                                        <div className="w-3/4 h-3 shimmer-bg rounded" />
                                        <div className="w-1/2 h-2 shimmer-bg rounded opacity-50" />
                                        <div className="flex justify-between items-end pt-4">
                                            <div className="w-20 h-4 shimmer-bg rounded" />
                                            <div className="w-24 h-8 rounded-full shimmer-bg" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className=" bg-slate-50 flex flex-col items-center">
                <div className="w-full flex flex-col items-center p-6 py-20">
                    <div className="w-32 h-32 rounded-full flex items-center justify-center">
                        <img src="/assets/images/cart.png" alt="" />
                    </div>
                    <p className="text-slate-500 text-center max-w-xs">
                        Your cart is empty, Add items now!
                    </p>
                </div>
                <div className="px-4 mb-2">
                    <h2 className="text-lg font-bold text-slate-900 mb-1 font-primary">You might also like</h2>
                </div>

                <div className=" ">
                    <MarketClient
                        params={marketParams}
                        hideTabs={true}
                        initialCategory={relatedCategory}
                        softCategory={true}
                        relatedVendorIds={cartVendorIds}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-32 lg:pt-0">
            <header
                className={`sticky transition-all duration-500 bg-white/95 backdrop-blur-md  px-4 py-3 flex items-center justify-between ${isScrolled ? 'top-0 z-[2500] ' : 'top-[64px] z-[1100]'}`}
            >
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            if (window.history.length > 2) {
                                router.back();
                            } else {
                                router.push('/discover');
                            }
                        }}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors -ml-2"
                    >
                        <ChevronLeftIcon className="w-6 h-6 text-slate-800 stroke-[2.5]" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-900">Cart ({items.length})</h1>
                </div>
            </header>
            <main className=" py-4 space-y-2">
                {groupedItems.map((group) => (
                    <div className="px-2" key={group.business_id}>
                        <section className="bg-white overflow-hidden mb-4 ">
                            <div className="px-6 mt-2 bg-slate-50/50 flex items-center justify-between py-1">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => toggleShopSelection(group.business_id, group.items.map(i => i.cart_id))}
                                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${group.items.every(item => selectedCartIds.includes(item.cart_id)) ? "bg-rose-500 border-rose-500 shadow-rose-200" : "bg-white border-slate-300"}`}
                                    >
                                        {group.items.every(item => selectedCartIds.includes(item.cart_id)) && (
                                            <CheckIcon className="w-2.5 h-2.5 text-white stroke-[3]" />
                                        )}
                                    </button>
                                    <div
                                        onClick={() => {
                                            const slug = group.items[0]?.business_slug || group.business_id;
                                            router.push(`/shop/${slug}`);
                                        }}
                                        className="flex items-center gap-2 cursor-pointer hover:opacity-75 transition-opacity"
                                    >
                                        <Image
                                            src={formatUrl(group.business_logo) || formatUrl(group.profile_pic || "") || "/assets/images/favio.png"}
                                            alt={group.business_name}
                                            className="rounded-full object-cover border border-slate-200"
                                            width={20}
                                            height={20}
                                            unoptimized
                                        />
                                        <span className="text-[12px] font-bold text-slate-800">{group.business_name}</span>
                                        {vendorBadges[group.business_id]?.verified_badge && (
                                            <VerifiedBadge label={vendorBadges[group.business_id].badge_label} size="xs" />
                                        )}
                                        <ChevronRightIcon className="w-3 h-3 text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            {group.estimation && !group.estimation.is_available && (
                                <div className="mx-6 my-2 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                                    <p className="text-[11px] text-rose-600 font-bold leading-relaxed whitespace-pre-wrap">
                                        ⚠️ {group.estimation.message}
                                    </p>
                                    <p className="text-[10px] text-rose-500 mt-1 italic">
                                        Please remove items from this vendor to proceed with checkout.
                                    </p>
                                </div>
                            )}
                            <div className="divide-y divide-slate-50">
                                {group.items.map((item, idx) => (
                                    <div key={`${item.cart_id}-${idx}`} className="px-5 py-3 flex items-center gap-3 relative">
                                        <button
                                            onClick={() => toggleItemSelection(item.cart_id)}
                                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${selectedCartIds.includes(item.cart_id) ? "bg-rose-500 border-rose-500 shadow-md shadow-rose-200" : "bg-white border-slate-200"}`}
                                        >
                                            {selectedCartIds.includes(item.cart_id) && (
                                                <CheckIcon className="w-2.5 h-2.5 text-white stroke-[3] animate-in zoom-in duration-200" />
                                            )}
                                        </button>
                                        <div onClick={(e) => handleProductClick(item.product_id, item.business_name, e, item.business_slug)} style={{ transform: "translateZ(0)" }} className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-50 relative group cursor-pointer">
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-[10px] font-black text-slate-300 opacity-40 select-none">stoqle</span>
                                            </div>
                                            <Image src={formatUrl(item.product_image)} alt={item.product_title} fill sizes="96px" className="object-cover transition-transform duration-500 group-hover:scale-110 relative z-[1]" />
                                            {item.total_quantity !== undefined && item.total_quantity > 0 && item.total_quantity <= 4 && (
                                                <div className="absolute inset-x-0 bottom-0 h-9 z-[2] pointer-events-none flex items-end justify-center pb-1.5">
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent rounded-b-[11px]" />
                                                    <div className="absolute inset-0 backdrop-blur-[2px] rounded-b-[11px] mask-gradient-to-t" style={{ WebkitMaskImage: 'linear-gradient(to top, black 30%, transparent 100%)', maskImage: 'linear-gradient(to top, black 30%, transparent 100%)' }} />
                                                    <span className="text-[9px] font-bold text-white tracking-wider relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">Only {item.total_quantity} left</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                            <div>
                                                <div className="flex items-start justify-between gap-2">
                                                    <h3 onClick={(e) => handleProductClick(item.product_id, item.business_name, e, item.business_slug)} className="text-sm text-slate-900 line-clamp-2 leading-snug flex-1 cursor-pointer hover:text-rose-600 transition-colors">
                                                        {item.product_title}
                                                    </h3>
                                                    <div className="flex-shrink-0">
                                                        {editingCartId === item.cart_id ? (
                                                            <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-full border border-slate-100 shadow-sm animate-in fade-in zoom-in duration-200">
                                                                <button onClick={() => { if (item.quantity > 1) handleUpdateQuantity(item.cart_id, item.quantity - 1); }} disabled={updatingIds.includes(item.cart_id)} className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm active:scale-90 transition-all disabled:opacity-30 disabled:grayscale">
                                                                    <MinusIcon className="w-3 h-3 text-slate-700 stroke-[3]" />
                                                                </button>
                                                                <span className="text-xs font-bold text-slate-800 min-w-[1.5rem] text-center">{item.quantity}</span>
                                                                <button onClick={() => { if (item.quantity >= (item.total_quantity ?? Infinity)) { toast.error(`Only ${item.total_quantity} items(s)`); return; } handleUpdateQuantity(item.cart_id, item.quantity + 1); }} disabled={updatingIds.includes(item.cart_id) || item.quantity >= (item.total_quantity ?? Infinity)} className="w-7 h-7 rounded-full bg-white flex items-center justify-center active:scale-90 transition-all disabled:opacity-30 disabled:grayscale">
                                                                    <PlusIcon className="w-3 h-3 text-slate-700 stroke-[3]" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => setEditingCartId(item.cart_id)} className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 hover:bg-slate-100 transition-colors   active:scale-95">
                                                                x{item.quantity}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {item.variant_label && <div className="text-[10px] font-bold text-slate-400  tracking-wider mb-2">{item.variant_label}</div>}
                                                <div className="flex flex-wrap gap-1">
                                                    {item.return_shipping_subsidy === 1 && <span className="text-[9px] font-bold text-slate-600 bg-slate-50 px-1 border border-slate-100 rounded-sm">Return shipping subsidy</span>}
                                                    {item.seven_day_no_reason === 1 && <span className="text-[9px] font-bold text-slate-600 bg-slate-50 px-1 border border-slate-100 rounded-sm">7-day no reason returns</span>}
                                                    {item.rapid_refund === 1 && <span className="text-[9px] font-bold text-slate-600 bg-slate-50 px-1 border border-slate-100 rounded-sm">Rapid Refund</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-base font-bold text-rose-600">₦{((item.price ?? 0) * (item.quantity || 1)).toLocaleString()}</span>
                                                    {(item.base_price ?? 0) > (item.price ?? 0) && <span className="text-xs text-slate-400 line-through">₦{(item.base_price ?? 0).toLocaleString()}</span>}
                                                </div>
                                                <button onClick={() => handleRemoveItem(item.cart_id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                ))}
                {outOfStockItems.length > 0 && (
                    <div className="mt-8 px-2">
                        <h2 className="text-[11px] font-bold text-slate-500  px-2 mb-2 ">Following item(s) unavailable</h2>
                        <section className="bg-white rounded-xl overflow-hidden border border-slate-100">
                            {outOfStockItems.map((item, idx) => (
                                <div key={`${item.cart_id}-${idx}`} className="px-8 py-4 flex gap-4 relative bg-white border-b border-slate-50 last:border-0">
                                    <div onClick={(e) => handleProductClick(item.product_id, item.business_name, e, item.business_slug)} className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100 relative cursor-pointer grayscale opacity-80">
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-[10px] font-black text-slate-300 opacity-40 select-none">stoqle</span>
                                        </div>
                                        <Image
                                            src={formatUrl(item.product_image)}
                                            alt={item.product_title}
                                            fill
                                            sizes="80px"
                                            className="object-cover relative z-[1]"
                                        />
                                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-1 text-center">
                                            <span className="text-[10px] text-white font-bold  tracking-tighter">Unavailable</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                                        <div>
                                            <h3 onClick={(e) => handleProductClick(item.product_id, item.business_name, e, item.business_slug)} className="text-xs font-bold text-slate-400 line-clamp-1 cursor-pointer hover:text-rose-500 transition-colors">{item.product_title}</h3>
                                            {item.variant_label && <p className="text-[10px] text-slate-400 font-medium  tracking-tight mt-0.5">{item.variant_label}</p>}
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-[10px] text-slate-400 font-bold  tracking-wider">Sold Out</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => { const query = encodeURIComponent(item.product_title); router.push(`/market/feed?search=${query}`); }} className="text-[9px] font-bold text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-full border border-rose-200 transition-all  ">Find similar</button>
                                                <button onClick={() => handleRemoveItem(item.cart_id)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </section>
                    </div>
                )}
                <div className="mt-6">
                    <div className="px-2 mb-2">
                        <h2 className="text-lg font-bold text-slate-900 mb-1 font-primary">You might also like</h2>
                    </div>

                    {/* INJECT EXACT MARKET CONTENT: Zero-compromise marketplace experience inside the cart */}
                    <div className="lg:px-2">
                        <MarketClient
                            params={marketParams}
                            hideTabs={true}
                            initialCategory={relatedCategory}
                            softCategory={true}
                            relatedVendorIds={cartVendorIds}
                        />
                    </div>
                </div>
            </main>
            {modalOpen && selectedProductPayload && (
                <ProductPreviewModal
                    open={modalOpen}
                    payload={selectedProductPayload}
                    origin={clickPos}
                    onClose={() => { setModalOpen(false); setSelectedProductPayload(null); updateUrl(null); }}
                    onCartClick={() => { setModalOpen(false); setSelectedProductPayload(null); updateUrl(null); fetchCart(); }}
                    onProductClick={handleProductClick}
                    onReelsClick={handleReelsClick}
                />
            )}
            <ReelsModal
                open={reelsModalOpen}
                initialProductId={selectedProductId}
                origin={clickPos}
                onClose={() => {
                    setReelsModalOpen(false);
                    setSelectedProductId(null);
                    updateUrl(selectedProductPayload?.productId || null);
                }}
                onActiveProductChange={(pid, bizName) => {
                    setSelectedProductId(pid);
                    updateUrl(pid, true, true);
                }}
            />
            {selectedSocialPost && (
                <PostModal
                    open={!!selectedSocialPost}
                    post={selectedSocialPost}
                    onClose={() => setSelectedSocialPost(null)}
                    onToggleLike={() => fetchRecommendations()}
                    userToken={token}
                    origin={clickPos}
                    isProductLinkedOnly={true}
                />
            )}
            <div
                className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-50 py-2 pb-[calc(0.25rem+env(safe-area-inset-bottom))]"
            >
                <div className="max-w-7xl mx-auto grid grid-cols-3 items-center px-4">
                    {/* Left: Select All */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleToggleSelectAll}
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${isAllSelected
                                ? "bg-rose-500 border-rose-500 shadow-sm"
                                : "bg-white border-slate-200"
                                }`}
                        >
                            {isAllSelected && (
                                <CheckIcon className="w-3.5 h-3.5 text-white stroke-[4]" />
                            )}
                        </button>
                        <span className="text-[12px] ">Select all</span>
                    </div>

                    {/* Middle: Total Price */}
                    <div className="flex flex-col items-center justify-center min-w-0">
                        <span className="text-[9px]  flex-1 tracking-tighter">Total Price</span>
                        <span className="text-sm text-rose-500 tracking-tight leading-none">₦{totalPrice.toLocaleString()}</span>
                    </div>

                    {/* Right: Checkout */}
                    <div className="flex justify-end">
                        <button
                            onClick={() => {
                                if (selectedCartIds.length === 0) {
                                    toast.error("Please select items to checkout");
                                    return;
                                }

                                // Check range for selected items
                                const unreachableSelected = groupedItems.find(g =>
                                    g.estimation && !g.estimation.is_available &&
                                    g.items.some(i => selectedCartIds.includes(i.cart_id))
                                );

                                if (unreachableSelected) {
                                    const unreachableItems = unreachableSelected.items
                                        .filter(i => selectedCartIds.includes(i.cart_id))
                                        .map(i => i.product_title)
                                        .join(", ");
                                    toast.error(`Vendor cannot deliver to you. Please remove or deselect: ${unreachableItems}`);
                                    return;
                                }

                                // Store IDs in sessionStorage to avoid raw IDs in URL
                                sessionStorage.setItem("stoqle_checkout_ids", JSON.stringify(selectedCartIds));
                                router.push(`/checkout`);
                            }}
                            className="w-fit px-6 bg-gradient-to-r from-rose-600 to-rose-600 text-white font-bold py-2 rounded-full shadow-lg shadow-rose-100 hover:shadow-rose-200 transition-all active:scale-[0.98]  items-center justify-center gap-2 text-xs"
                        >
                            Checkout({selectedCartIds.length})
                        </button>
                    </div>
                </div>
            </div>
            <PhoneVerificationModal
                key="phone-verification-modal-cart"
                isOpen={phoneModalOpen}
                onClose={() => setPhoneModalOpen(false)}
                onSuccess={() => {
                    setPhoneModalOpen(false);
                    if (selectedCartIds.length > 0) {
                        sessionStorage.setItem("stoqle_checkout_ids", JSON.stringify(selectedCartIds));
                        router.push(`/checkout`);
                    }
                }}
            />
        </div>
    );
}
