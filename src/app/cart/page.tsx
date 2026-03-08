"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { fetchCartApi, updateCartQuantityApi, removeFromCartApi } from "@/src/lib/api/cartApi";
import {
    TrashIcon,
    MinusIcon,
    PlusIcon,
    ShoppingBagIcon,
    ArrowLeftIcon,
    ChevronRightIcon,
    ShoppingCartIcon,
    CheckIcon
} from "@heroicons/react/24/outline";
import { ShoppingCartIcon as ShoppingCartIconSolid } from "@heroicons/react/24/solid";
import { fetchMarketFeed, fetchProductById, toggleProductLike } from "@/src/lib/api/productApi";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import type { PreviewPayload, ProductSku } from "@/src/types/product";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { API_BASE_URL } from "@/src/lib/config";
import { toast } from "sonner";

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
    promotions?: any[];
    sales_discounts?: any[];
}

export default function CartPage() {
    const router = useRouter();
    const { user, token } = useAuth();
    const [items, setItems] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingIds, setUpdatingIds] = useState<number[]>([]);

    // Recommendations State
    const [recommendedProducts, setRecommendedProducts] = useState<any[]>([]);
    const [loadingRecs, setLoadingRecs] = useState(false);
    const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [fetchingProduct, setFetchingProduct] = useState(false);
    const [likeData, setLikeData] = useState<Record<number, { liked: boolean, count: number }>>({});
    const [editingCartId, setEditingCartId] = useState<number | null>(null);
    const [selectedCartIds, setSelectedCartIds] = useState<number[]>([]);

    const fetchCart = async () => {
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            const res = await fetchCartApi(token);
            if (res.status === 'success') {
                const fetchedItems: CartItem[] = res.data?.items || [];
                setItems(fetchedItems);
                // By default all are unchecked
                setSelectedCartIds([]);
            }
        } catch (err) {
            console.error("Fetch cart error", err);
            toast.error("Failed to load cart");
        } finally {
            setLoading(false);
        }
    };

    const fetchRecommendations = async () => {
        setLoadingRecs(true);
        try {
            const res = await fetchMarketFeed(6, 0); // Get top 6
            setRecommendedProducts(res?.data?.products || []);
        } catch (err) {
            console.error("Fetch recs error", err);
        } finally {
            setLoadingRecs(false);
        }
    };

    useEffect(() => {
        fetchRecommendations();
        // If user is clearly not logged in, redirect
        const timer = setTimeout(() => {
            if (!user) {
                // toast.error("Please login to view your cart");
                // router.push("/discover");
            }
        }, 2000);

        if (user && token) {
            fetchCart();
            clearTimeout(timer);
        }

        return () => clearTimeout(timer);
    }, [user, token]);

    const handleUpdateQuantity = async (cartId: number, newQty: number) => {
        if (newQty < 1) return;
        setUpdatingIds(prev => [...prev, cartId]);
        try {
            const res = await updateCartQuantityApi(cartId, newQty, token!);
            if (res.status) {
                setItems(prev => prev.map(item =>
                    item.cart_id === cartId ? { ...item, quantity: newQty } : item
                ));
            }
        } catch (err) {
            toast.error("Failed to update quantity");
        } finally {
            setUpdatingIds(prev => prev.filter(id => id !== cartId));
        }
    };

    const handleRemoveItem = async (cartId: number) => {
        if (!confirm("Remove this item from cart?")) return;
        try {
            const res = await removeFromCartApi(cartId, token!);
            if (res.status) {
                setItems(prev => prev.filter(item => item.cart_id !== cartId));
                toast.success("Item removed");
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
            // Deselect all for this shop
            setSelectedCartIds(prev => prev.filter(id => !itemIds.includes(id)));
        } else {
            // Select all for this shop (avoid duplicates)
            setSelectedCartIds(prev => Array.from(new Set([...prev, ...itemIds])));
        }
    };

    const groupedItems = useMemo(() => {
        const groupList: { business_id: number, business_name: string, business_logo: string, items: CartItem[] }[] = [];
        if (!items || !Array.isArray(items)) return groupList;

        const available = items.filter(item => (item.total_quantity ?? 0) > 0);

        available.forEach(item => {
            let group = groupList.find(g => g.business_id === item.business_id);
            if (!group) {
                group = {
                    business_id: item.business_id,
                    business_name: item.business_name,
                    business_logo: item.business_logo,
                    items: []
                };
                groupList.push(group);
            }
            group.items.push(item);
        });
        return groupList;
    }, [items]);

    const outOfStockItems = useMemo(() => {
        if (!items || !Array.isArray(items)) return [];
        return items.filter(item => (item.total_quantity ?? 0) === 0);
    }, [items]);

    const totalPrice = useMemo(() => {
        if (!items || !Array.isArray(items)) return 0;
        return items
            .filter(item => (item.total_quantity ?? 0) > 0 && selectedCartIds.includes(item.cart_id))
            .reduce((acc, item) => acc + (item.price * item.quantity), 0);
    }, [items, selectedCartIds]);

    const formatUrl = (url: string) => {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    };

    const handleProductClick = async (productId: number) => {
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
                        try { vIds = typeof s.variant_option_ids === 'string' ? JSON.parse(s.variant_option_ids) : s.variant_option_ids; } catch (e) { }
                        const inventoryMatch = (dbProduct.inventory || []).find((inv: any) => inv.sku_id === s.sku_id);
                        return {
                            id: String(s.sku_id),
                            sku: s.sku_code || "",
                            name: "Combination",
                            price: s.price,
                            quantity: inventoryMatch ? inventoryMatch.quantity : 0,
                            enabled: s.status === 'active',
                            variantOptionIds: (vIds || []).map(String)
                        } as ProductSku;
                    })
                };
                const baseInv = (dbProduct.inventory || []).find((inv: any) => !inv.sku_id && !inv.variant_option_id);
                if (baseInv) mappedPayload.quantity = baseInv.quantity;
                setSelectedProductPayload(mappedPayload);
                setModalOpen(true);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setFetchingProduct(false);
        }
    };

    const handleLikeClick = async (e: React.MouseEvent, productId: number, baseCount: number) => {
        e.stopPropagation();
        if (!user || !token) {
            toast.error("Please login to like products");
            return;
        }
        const current = likeData[productId] || { liked: false, count: baseCount };
        const newLiked = !current.liked;
        const newCount = newLiked ? current.count + 1 : Math.max(0, current.count - 1);
        setLikeData(prev => ({ ...prev, [productId]: { liked: newLiked, count: newCount } }));
        try {
            const res = await toggleProductLike(productId, token);
            setLikeData(prev => ({ ...prev, [productId]: { liked: res.data.liked, count: res.data.likes_count } }));
        } catch (err) {
            setLikeData(prev => ({ ...prev, [productId]: current }));
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                {/* Header Shimmer */}
                <div className="h-14 bg-white border-b border-slate-100 flex items-center px-4 justify-between sticky top-0 z-50">
                    <div className="w-8 h-8 rounded-full shimmer-bg" />
                    <div className="w-24 h-4 shimmer-bg rounded-md" />
                    <div className="w-8 h-8 rounded-full shimmer-bg" />
                </div>

                <div className="p-4 space-y-6">
                    {/* Shop Group Shimmer */}
                    {[1, 2].map((i) => (
                        <div key={i} className="bg-white border border-slate-100 rounded-lg overflow-hidden space-y-px">
                            {/* Vendor Header */}
                            <div className="p-4 border-b border-slate-50 flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full shimmer-bg" />
                                <div className="w-6 h-6 rounded-full shimmer-bg" />
                                <div className="w-32 h-3 shimmer-bg rounded" />
                            </div>
                            {/* Items */}
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

                {/* Bottom Bar Shimmer */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-6 flex items-center justify-between gap-6 z-50">
                    <div className="space-y-2">
                        <div className="w-20 h-2 shimmer-bg rounded opacity-50" />
                        <div className="w-32 h-6 shimmer-bg rounded" />
                    </div>
                    <div className="flex-1 h-14 rounded-2xl shimmer-bg" />
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center">
                <div className="w-full flex flex-col items-center p-6 py-20">
                    <div className="w-32 h-32 rounded-full flex items-center justify-center">
                        <ShoppingCartIcon className="w-16 h-16 text-slate-300" />
                    </div>
                    <p className="text-slate-500 text-center max-w-xs">
                        Your cart is empty, Add items now!
                    </p>
                </div>

                {/* Recommendations */}
                <div className="w-full ">
                    <h2 className="text-lg font-black text-slate-900 mb-2 px-2">You might also like</h2>
                    <div className="post-grid p-2 sm:p-4 ">
                        {loadingRecs ? (
                            [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                <div key={i} className="mb-4 break-inside-avoid">
                                    <div className="w-full aspect-[3/4] rounded-2xl shimmer-bg mb-2" />
                                    <div className="w-3/4 h-3 shimmer-bg rounded mb-1" />
                                    <div className="w-1/2 h-4 shimmer-bg rounded" />
                                </div>
                            ))
                        ) : recommendedProducts.flatMap((p) => {
                            const isPromoActive = p.promo_title && p.promo_discount && (!p.promo_end || new Date(p.promo_end) >= new Date());

                            const renderCard = (isVideoCover: boolean) => (
                                <ProductCard
                                    key={`${p.product_id}${isVideoCover ? '-vid' : ''}`}
                                    p={p}
                                    isVideoCover={isVideoCover}
                                    isPromoActive={isPromoActive}
                                    onClick={() => {
                                        if (isVideoCover) {
                                            router.push(`/shopping-reels?product_id=${p.product_id}`);
                                        } else {
                                            handleProductClick(p.product_id);
                                        }
                                    }}
                                    onLike={(e: React.MouseEvent) => handleLikeClick(e, p.product_id, p.likes_count || 0)}
                                    liked={likeData[p.product_id]?.liked}
                                    likeCount={likeData[p.product_id]?.count ?? (p.likes_count || 0)}
                                    formatUrl={formatUrl}
                                    fetchingProduct={!isVideoCover && fetchingProduct && selectedProductPayload?.productId === p.product_id}
                                />
                            );

                            if (p.product_video) {
                                return [renderCard(false), renderCard(true)];
                            }
                            return [renderCard(false)];
                        })}
                    </div>
                </div>

                {modalOpen && selectedProductPayload && (
                    <ProductPreviewModal
                        open={modalOpen}
                        payload={selectedProductPayload}
                        onClose={() => { setModalOpen(false); setSelectedProductPayload(null); }}
                        onProductClick={handleProductClick}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeftIcon className="w-5 h-5 text-slate-700" />
                    </button>
                    <h1 className="text-xl font-black text-slate-900">Cart ({items.length})</h1>
                </div>
            </header>

            <main className=" px-4 py-4 space-y-2">
                {groupedItems.map((group, idx) => (
                    <div key={group.business_id}>
                        <section className="bg-white  border border-slate-100 overflow-hidden mb-4">
                            {/* Shop Header */}
                            <div className="px-6 mt-2 bg-slate-50/50 flex items-center justify-between py-1">
                                <div className="flex items-center gap-3">
                                    {/* Shop Select All */}
                                    <button
                                        onClick={() => toggleShopSelection(group.business_id, group.items.map(i => i.cart_id))}
                                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${group.items.every(item => selectedCartIds.includes(item.cart_id))
                                            ? "bg-rose-500 border-rose-500 shadow-sm shadow-rose-200"
                                            : "bg-white border-slate-300"
                                            }`}
                                    >
                                        {group.items.every(item => selectedCartIds.includes(item.cart_id)) && (
                                            <CheckIcon className="w-2.5 h-2.5 text-white stroke-[3]" />
                                        )}
                                    </button>
                                    <div
                                        onClick={() => router.push(`/shop/${group.business_id}`)}
                                        className="flex items-center gap-2 cursor-pointer hover:opacity-75 transition-opacity"
                                    >
                                        <img
                                            src={formatUrl(group.business_logo) || "/assets/images/favio.png"}
                                            alt={group.business_name}
                                            className="w-5 h-5 rounded-full object-cover border border-slate-200"
                                        />
                                        <span className="text-[12px] font-bold text-slate-800">{group.business_name}</span>
                                        <ChevronRightIcon className="w-3 h-3 text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Items */}
                            <div className="divide-y divide-slate-50">
                                {group.items.map((item) => (
                                    <div key={item.cart_id} className="px-5 py-3 flex items-center gap-3 relative">
                                        {/* Selection Radio */}
                                        <button
                                            onClick={() => toggleItemSelection(item.cart_id)}
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${selectedCartIds.includes(item.cart_id)
                                                ? "bg-rose-500 border-rose-500 shadow-md shadow-rose-200"
                                                : "bg-white border-slate-200"
                                                }`}
                                        >
                                            {selectedCartIds.includes(item.cart_id) && (
                                                <CheckIcon className="w-3.5 h-3.5 text-white stroke-[4] animate-in zoom-in duration-200" />
                                            )}
                                        </button>

                                        {/* Product Image */}
                                        <div
                                            onClick={() => handleProductClick(item.product_id)}
                                            className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-50 relative group cursor-pointer"
                                        >
                                            <img
                                                src={formatUrl(item.product_image)}
                                                alt={item.product_title}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            />
                                            {/* Dark Shadow & Low Stock Indicator */}
                                            {item.total_quantity !== undefined && item.total_quantity > 0 && item.total_quantity <= 4 && (
                                                <>
                                                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                                                    <div className="absolute bottom-1.5 left-0 right-0 py-0.5 flex items-center justify-center z-10">
                                                        <span className="text-[10px] font-black text-white tracking-wider drop-shadow-sm">
                                                            Only {item.total_quantity} items(s)
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                            <div>
                                                <div className="flex items-start justify-between gap-4 ">
                                                    <h3
                                                        onClick={() => handleProductClick(item.product_id)}
                                                        className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug flex-1 cursor-pointer hover:text-red-600 transition-colors"
                                                    >
                                                        {item.product_title}
                                                    </h3>

                                                    {/* Quantity Selector */}
                                                    <div className="flex-shrink-0">
                                                        {editingCartId === item.cart_id ? (
                                                            <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-full border border-slate-100 shadow-sm animate-in fade-in zoom-in duration-200">
                                                                <button
                                                                    onClick={() => {
                                                                        if (item.quantity > 1) {
                                                                            handleUpdateQuantity(item.cart_id, item.quantity - 1);
                                                                        }
                                                                    }}
                                                                    disabled={updatingIds.includes(item.cart_id)}
                                                                    className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm active:scale-90 transition-all disabled:opacity-30 disabled:grayscale"
                                                                >
                                                                    <MinusIcon className="w-3 h-3 text-slate-700 stroke-[3]" />
                                                                </button>
                                                                <span className="text-xs font-black text-slate-800 min-w-[1.5rem] text-center">{item.quantity}</span>
                                                                <button
                                                                    onClick={() => {
                                                                        if (item.quantity >= (item.total_quantity ?? Infinity)) {
                                                                            toast.error(`Only ${item.total_quantity} items(s)`);
                                                                            return;
                                                                        }
                                                                        handleUpdateQuantity(item.cart_id, item.quantity + 1);
                                                                    }}
                                                                    disabled={updatingIds.includes(item.cart_id) || item.quantity >= (item.total_quantity ?? Infinity)}
                                                                    className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm active:scale-90 transition-all disabled:opacity-30 disabled:grayscale"
                                                                >
                                                                    <PlusIcon className="w-3 h-3 text-slate-700 stroke-[3]" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setEditingCartId(item.cart_id)}
                                                                className="text-[11px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 hover:bg-slate-100 transition-colors uppercase tracking-widest active:scale-95"
                                                            >
                                                                x{item.quantity}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Variant Info */}
                                                {item.variant_label && (
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                        {item.variant_label}
                                                    </div>
                                                )}
                                                {/* Trust Badges & Promos (Between variant and price) */}
                                                <div className="flex flex-wrap gap-1">
                                                    {item.return_shipping_subsidy === 1 && (
                                                        <span className="text-[9px] font-bold text-slate-600 bg-slate-50 px-1 border border-slate-100 rounded-sm">
                                                            Return shipping subsidy
                                                        </span>
                                                    )}
                                                    {item.seven_day_no_reason === 1 && (
                                                        <span className="text-[9px] font-bold text-slate-600 bg-slate-50 px-1 border border-slate-100 rounded-sm">
                                                            7-day no reason returns
                                                        </span>
                                                    )}
                                                    {item.rapid_refund === 1 && (
                                                        <span className="text-[9px] font-bold text-slate-600 bg-slate-50 px-1 border border-slate-100 rounded-sm">
                                                            Rapid Refund
                                                        </span>
                                                    )}

                                                    {(() => {
                                                        const activePromos = (item.promotions || []).filter(p => {
                                                            const now = new Date();
                                                            const start = p.start_date ? new Date(p.start_date) : null;
                                                            const end = p.end_date ? new Date(p.end_date) : null;
                                                            return (!start || now >= start) && (!end || now <= end);
                                                        });

                                                        if (activePromos.length > 0) {
                                                            const p = activePromos[0];
                                                            return (
                                                                <span className="text-[12px] text-rose-600">
                                                                    {p.title} {p.discount_percent}% OFF
                                                                </span>
                                                            );
                                                        }

                                                        if ((item.sales_discounts || []).length > 0) {
                                                            const d = item.sales_discounts![0];
                                                            return (
                                                                <span className="text-[12px] text-rose-600 ">
                                                                    {d.discount_type} {d.discount_percent}% OFF
                                                                </span>
                                                            );
                                                        }

                                                        return null;
                                                    })()}
                                                </div>
                                            </div>

                                            {/* Bottom Actions: Prices and Remove */}
                                            <div className="flex items-center justify-between ">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-base font-black text-red-600">₦{(item.price ?? 0).toLocaleString()}</span>
                                                    {(item.base_price ?? 0) > (item.price ?? 0) && (
                                                        <span className="text-xs text-slate-400 line-through">₦{(item.base_price ?? 0).toLocaleString()}</span>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() => handleRemoveItem(item.cart_id)}
                                                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                >
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

                {/* Out of Stock Section */}
                {outOfStockItems.length > 0 && (
                    <div className="mt-8 ">
                        <h2 className="text-[11px] font-black text-slate-500  tracking-widest px-2 mb-2">Following item(s) unavailable</h2>
                        <section className="bg-white ">
                            {outOfStockItems.map((item) => (
                                <div key={item.cart_id} className="px-8 py-3 flex gap-4 relative bg-white">
                                    <div
                                        onClick={() => handleProductClick(item.product_id)}
                                        className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100 relative cursor-pointer"
                                    >
                                        <img
                                            src={formatUrl(item.product_image)}
                                            alt={item.product_title}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-1 text-center">
                                            <span className="text-[12px] text-white tracking-tighter leading-tight">Unavailable</span>

                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                                        <div>
                                            <h3
                                                onClick={() => handleProductClick(item.product_id)}
                                                className="text-xs font-bold text-slate-500 line-clamp-1 cursor-pointer hover:text-red-500 transition-colors"
                                            >
                                                {item.product_title}
                                            </h3>
                                            {item.variant_label && (
                                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight mt-0.5">
                                                    {item.variant_label}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex flex-col">
                                                <div className="absolute bottom-4 rounded text-[12px] text-slate-500 tracking-widest whitespace-nowrap">
                                                    Item unavailable
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        const query = encodeURIComponent(item.product_title);
                                                        router.push(`/market/feed?search=${query}`);
                                                    }}
                                                    className="text-[9px] font-bold text-rose-500 hover:bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 transition-all uppercase tracking-widest active:scale-95"
                                                >
                                                    Find similar
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveItem(item.cart_id)}
                                                    className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                                                >
                                                    <TrashIcon className="w-4 h-4 shadow-sm" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Unavailable Badge */}
                                    <div className="absolute top-3 right-8 px-2 py-0.5 bg-slate-200 text-slate-400 text-[8px] font-black rounded uppercase tracking-tighter">
                                        SOLD OUT
                                    </div>
                                </div>
                            ))}
                        </section>
                    </div>
                )}

                {/* Recommendations */}
                <div className="mt-5 pb-20">
                    <h2 className="text-sm font-black text-slate-900 mb-1 px-2">You might also like</h2>
                    <div className="post-grid sm:p-4 ">
                        {loadingRecs ? (
                            [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                <div key={i} className="mb-4 break-inside-avoid">
                                    <div className="w-full aspect-[3/4] rounded-2xl shimmer-bg mb-2" />
                                    <div className="w-3/4 h-3 shimmer-bg rounded mb-1" />
                                    <div className="w-1/2 h-4 shimmer-bg rounded" />
                                </div>
                            ))
                        ) : recommendedProducts.flatMap((p) => {
                            const isPromoActive = p.promo_title && p.promo_discount && (!p.promo_end || new Date(p.promo_end) >= new Date());

                            const renderCard = (isVideoCover: boolean) => (
                                <ProductCard
                                    key={`${p.product_id}${isVideoCover ? '-vid' : ''}`}
                                    p={p}
                                    isVideoCover={isVideoCover}
                                    isPromoActive={isPromoActive}
                                    onClick={() => {
                                        if (isVideoCover) {
                                            router.push(`/shopping-reels?product_id=${p.product_id}`);
                                        } else {
                                            handleProductClick(p.product_id);
                                        }
                                    }}
                                    onLike={(e: React.MouseEvent) => handleLikeClick(e, p.product_id, p.likes_count || 0)}
                                    liked={likeData[p.product_id]?.liked}
                                    likeCount={likeData[p.product_id]?.count ?? (p.likes_count || 0)}
                                    formatUrl={formatUrl}
                                    fetchingProduct={!isVideoCover && fetchingProduct && selectedProductPayload?.productId === p.product_id}
                                />
                            );

                            if (p.product_video) {
                                return [renderCard(false), renderCard(true)];
                            }
                            return [renderCard(false)];
                        })}
                    </div>
                </div>
            </main>

            {modalOpen && selectedProductPayload && (
                <ProductPreviewModal
                    open={modalOpen}
                    payload={selectedProductPayload}
                    onClose={() => { setModalOpen(false); setSelectedProductPayload(null); }}
                    onProductClick={handleProductClick}
                />
            )}

            {/* Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 p-6 ">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Amount</span>
                        <span className="text-2xl font-black text-slate-900 tracking-tight">₦{totalPrice.toLocaleString()}</span>
                    </div>

                    <button
                        onClick={() => toast.info("Checkout functionality is being integrated...")}
                        className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-red-200 hover:shadow-red-300 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-base"
                    >
                        <ShoppingCartIconSolid className="w-5 h-5 shadow-sm" />
                        Checkout ({selectedCartIds.length})
                    </button>
                </div>
            </div>
        </div>
    );
}

function ProductCard({ p, onClick, onLike, liked, likeCount, formatUrl, fetchingProduct, isVideoCover, isPromoActive }: any) {
    return (
        <article
            onClick={onClick}
            className="group flex flex-col rounded-[1.05rem] bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden hover:shadow-md"
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

                {!isVideoCover && fetchingProduct && (
                    <div className="absolute inset-0 bg-white/30 z-20 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
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
                            <div className="flex items-center gap-1.5 min-w-0">
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
                            <div className="flex items-center gap-1 cursor-pointer" onClick={onLike}>
                                {liked ? <FaHeart className="text-red-500 text-sm" /> : <FaRegHeart className="text-slate-400 text-sm" />}
                                <span className="text-xs font-semibold text-slate-600">{likeCount}</span>
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
                                            <svg className="w-3 h-3 text-emerald-700" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug mb-2.5 mt-2" title={p.title}>
                            {p.trusted_partner === 1 && (
                                <span className="inline-flex items-center gap-1 shrink-0 mr-1.5 align-text-bottom">
                                    <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm shadow-sm tracking-wider">
                                        Partner
                                    </span>
                                </span>
                            )}
                            <span className="align-middle">{p.title || "Untitled Product"}</span>
                        </h3>

                        <div className="flex items-center min-h-[16px]">
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
                                <span className="text-[10px] font-bold text-green-700 tracking-widest truncate">
                                    Return Shipping Subsidy
                                </span>
                            ) : p.market_name ? (
                                <span className="text-[10px] font-bold text-rose-500 tracking-widest truncate">
                                    {p.market_name}
                                </span>
                            ) : null}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-semibold mt-1">
                            <span className="text-slate-900 text-base font-black">₦{Number(p.price || 0).toLocaleString()}</span>
                        </div>
                    </>
                )}
            </div>
        </article>
    );
}
