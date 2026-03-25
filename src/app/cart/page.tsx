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
import { ShoppingCartIcon as ShoppingCartIconSolid } from "@heroicons/react/24/solid";
import { fetchMarketFeed, fetchProductById, toggleProductLike, logUserActivity, fetchPersonalizedFeed } from "@/src/lib/api/productApi";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import ReelsModal from "@/src/components/product/addProduct/modal/reelsModal";
import PhoneVerificationModal from "@/src/components/modal/phoneVerificationModal";
import type { PreviewPayload, ProductSku } from "@/src/types/product";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "@/src/lib/config";
import { toast } from "sonner";
import { fetchUserAddresses, UserAddress } from "@/src/lib/api/addressApi";

const slugify = (str: string) =>
    String(str || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
import { estimateDelivery, EstimationResult } from "@/src/lib/deliveryEstimation";

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
    sales_discounts?: any[];
    business_latitude: number;
    business_longitude: number;
    shipping_policies: any[];
}

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
                    const bizSlug = slugify(p.business_name || "store");
                    router.push(`/market/${bizSlug}?product_id=${p.product_id}&reels=true`);
                } else {
                    handleProductClick(p.product_id, false, e);
                }
            }}
            className="group flex flex-col rounded-[1.05rem] bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden"
            style={{
                willChange: "transform, opacity",
                contentVisibility: "auto",
                containIntrinsicSize: "auto 400px"
            }}
        >
            <div className="relative w-full overflow-hidden bg-slate-100">
                <motion.div
                    initial={entryVariants.initial}
                    animate={entryVariants.animate}
                    transition={entryVariants.transition}
                    className="w-full h-full"
                >
                    {p.product_video && isVideoCover ? (
                        <video
                            src={formatUrl(p.product_video!)}
                            poster={formatUrl(p.first_image)}
                            muted
                            loop
                            playsInline
                            preload="auto"
                            className="w-full min-h-[180px] sm:min-h-[200px] max-h-[300px] sm:max-h-[350px] object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                    ) : (
                        <div className="relative w-full h-auto">
                            <style jsx global>{`
                            @keyframes fadeIn {
                                from { opacity: 0; }
                                to { opacity: 1; }
                            }
                        `}</style>
                            <img
                                src={formatUrl(p.first_image)}
                                alt={p.title}
                                className="w-full min-h-[180px] sm:min-h-[200px] max-h-[300px] sm:max-h-[350px] object-cover transition-all duration-700 group-hover:scale-110"
                                loading="lazy"
                                onLoad={(e) => {
                                    (e.target as any).style.animation = "fadeIn 0.6s ease-in-out forwards";
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
                        <span className="text-[10px] font-bold  text-slate-400 ">Opening...</span>
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
                        <h3 className="text-sm text-slate-800 line-clamp-2 leading-snug mb-2.5 mt-2" title={p.title}>
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
                                <span className="text-[10px] font-bold text-rose-500 border-red-500 border px-1  truncate">
                                    {p.promo_title} {p.promo_discount}% OFF
                                </span>
                            ) : p.sale_type ? (
                                <span className="text-[10px] font-bold text-rose-500 border-red-500 border  truncate">
                                    {p.sale_type} {p.sale_discount}% Off
                                </span>
                            ) : (p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) <= 4) ? (
                                <span className="text-[10px] font-bold text-rose-500   truncate">
                                    Only {Number(p.total_quantity)} Left
                                </span>
                            ) : p.return_shipping_subsidy === 1 ? (
                                <span className="text-[10px] font-bold text-green-700   truncate">
                                    Return Shipping Subsidy
                                </span>
                            ) : p.market_name ? (
                                <span className="text-[10px] font-bold text-rose-500   truncate">
                                    {p.market_name}
                                </span>
                            ) : null}
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-semibold">
                                <span className="text-slate-900 text-base font-bold">₦{Number(p.price || 0).toLocaleString()}</span>
                            </div>
                            <div
                                className="flex items-center gap-1 cursor-pointer relative"
                                onClick={(e) => {
                                    e.stopPropagation();
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
                                </div>
                                <span className="text-xs font-semibold text-slate-600 ml-0.5">{likeCount}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </article >
    );
}, (prev, next) => {
    return prev.p.product_id === next.p.product_id &&
        prev.isLiked === next.isLiked &&
        prev.likeCount === next.likeCount &&
        prev.fetchingProduct === next.fetchingProduct &&
        prev.isVideoCover === next.isVideoCover;
});
ProductCard.displayName = "ProductCard";

const MasonryGrid = ({ items, likeData, fetchingProductId, handleProductClick, handleLikeClick, formatUrl, router }: any) => {
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
                        {colItems.map((p: any, idx: number) => {
                            const ld = likeData[p.product_id] || { liked: !!p.isLiked, count: p.likes_count || 0 };
                            return (
                                <ProductCard
                                    key={`${p.product_id}-${idx}-${p.originalIndex}`}
                                    index={p.originalIndex}
                                    p={p}
                                    isVideoCover={!!p.product_video}
                                    formatUrl={formatUrl}
                                    handleProductClick={handleProductClick}
                                    handleLikeClick={handleLikeClick}
                                    isLiked={ld.liked}
                                    likeCount={ld.count}
                                    fetchingProduct={fetchingProductId === p.product_id}
                                    router={router}
                                />
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
};

export default function CartPage() {
    const router = useRouter();
    const { user, token, isHydrated } = useAuth();
    const [items, setItems] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingIds, setUpdatingIds] = useState<number[]>([]);

    // Recommendations State
    const [recommendedProducts, setRecommendedProducts] = useState<any[]>([]);
    const [loadingRecs, setLoadingRecs] = useState(false);
    const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [reelsModalOpen, setReelsModalOpen] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
    const [fetchingProduct, setFetchingProduct] = useState(false);
    const [phoneModalOpen, setPhoneModalOpen] = useState(false);
    const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
    const [likeData, setLikeData] = useState<Record<number, { liked: boolean, count: number }>>({});
    const [editingCartId, setEditingCartId] = useState<number | null>(null);
    const [selectedCartIds, setSelectedCartIds] = useState<number[]>([]);
    const [address, setAddress] = useState<UserAddress | null>(null);

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
        setLoadingRecs(true);
        try {
            const res = await fetchPersonalizedFeed(20, 0, token);
            const products = res?.data || [];
            setRecommendedProducts(products.map((p: any, i: number) => {
                const media = p.media || [];
                const imgs = media.filter((m: any) => m.type === "image");
                const coverRef = p.first_image || p.image_url;

                // Robust cover detection: check is_cover flag OR matching URL
                const foundCover = imgs.find((m: any) =>
                    m.is_cover === 1 || (coverRef && m.url && m.url.includes(coverRef))
                ) || imgs[0];

                return {
                    ...p,
                    originalIndex: i,
                    first_image: foundCover?.url || coverRef || (media[0]?.type === 'image' ? media[0].url : "") || "",
                    product_video: p.product_video || media.find((m: any) => m.type === 'video')?.url || "",
                };
            }));
        } catch (err) {
            console.error("Fetch recs error", err);
        } finally {
            setLoadingRecs(false);
        }
    };

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

        window.addEventListener("cart-updated", handleCartUpdate);

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
                    business_logo: item.business_logo,
                    items: [],
                    estimation: est
                };
                groupList.push(group);
            }
            group.items.push(item);
        });
        return groupList;
    }, [items, address]);

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

    const updateUrl = useCallback((productId: number | null, replace: boolean = false, isReels: boolean = false) => {
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

    const handleReelsClick = useCallback(async (productId: number, businessName?: string, e?: React.MouseEvent) => {
        if (e) setClickPos({ x: e.clientX, y: e.clientY });
        else setClickPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

        setSelectedProductId(productId);
        setReelsModalOpen(true);
        updateUrl(productId, false, true);
    }, [updateUrl]);

    const handleProductClick = async (productId: number, arg2?: string | boolean | React.MouseEvent, e?: React.MouseEvent) => {
        if (fetchingProduct) return;

        let actualEvent: React.MouseEvent | undefined;
        let replaceUrl = false;

        if (typeof arg2 === 'boolean') {
            replaceUrl = arg2;
            actualEvent = e;
        } else if (arg2 && typeof arg2 === 'object' && 'clientX' in arg2) {
            actualEvent = arg2 as React.MouseEvent;
        }

        if (actualEvent) {
            setClickPos({ x: actualEvent.clientX, y: actualEvent.clientY });
        } else {
            setClickPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        }

        updateUrl(productId, replaceUrl);
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
            console.error(err);
        } finally {
            setFetchingProduct(false);
        }
    };

    useEffect(() => {
        const handleRouteChange = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const productId = urlParams.get("product_id");
            const isReels = urlParams.get("reels") === "true";

            if (productId) {
                const pid = Number(productId);
                if (isReels) {
                    if (!reelsModalOpen) {
                        setSelectedProductId(pid);
                        setReelsModalOpen(true);
                    }
                } else {
                    if (!modalOpen && !fetchingProduct && selectedProductPayload?.productId !== pid) {
                        handleProductClick(pid, true);
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
            if (res.data.liked) {
                logUserActivity({ product_id: productId, action_type: 'like' }, token);
            }
        } catch (err) {
            setLikeData(prev => ({ ...prev, [productId]: current }));
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
                <div className="p-4 space-y-6">
                    {[1, 2].map((i) => (
                        <div key={i} className="bg-white border border-slate-100 rounded-lg overflow-hidden space-y-px">
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
            <div className="min-h-screen bg-slate-50 flex flex-col items-center">
                <div className="w-full flex flex-col items-center p-6 py-20">
                    <div className="w-32 h-32 rounded-full flex items-center justify-center">
                        <img src="/assets/images/cart.png" alt="" />
                    </div>
                    <p className="text-slate-500 text-center max-w-xs">
                        Your cart is empty, Add items now!
                    </p>
                </div>
                <div className="w-full px-2 sm:px-4">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">You might also like</h2>
                    {loadingRecs ? (
                        <ShimmerGrid count={10} />
                    ) : (
                        <MasonryGrid
                            items={recommendedProducts}
                            likeData={likeData}
                            fetchingProductId={selectedProductPayload?.productId}
                            handleProductClick={handleProductClick}
                            handleLikeClick={handleLikeClick}
                            formatUrl={formatUrl}
                            router={router}
                        />
                    )}
                </div>
                {modalOpen && selectedProductPayload && (
                    <ProductPreviewModal
                        open={modalOpen}
                        payload={selectedProductPayload}
                        origin={clickPos}
                        onClose={() => { setModalOpen(false); setSelectedProductPayload(null); updateUrl(null); fetchCart(); }}
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
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            <header className="sticky top-0 z-[1100] bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between">
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
            <main className="px-4 py-4 space-y-2">
                {groupedItems.map((group) => (
                    <div key={group.business_id}>
                        <section className="bg-white border border-slate-100 overflow-hidden mb-4 rounded-xl">
                            <div className="px-6 mt-2 bg-slate-50/50 flex items-center justify-between py-1">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => toggleShopSelection(group.business_id, group.items.map(i => i.cart_id))}
                                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${group.items.every(item => selectedCartIds.includes(item.cart_id)) ? "bg-rose-500 border-rose-500 shadow-sm shadow-rose-200" : "bg-white border-slate-300"}`}
                                    >
                                        {group.items.every(item => selectedCartIds.includes(item.cart_id)) && (
                                            <CheckIcon className="w-2.5 h-2.5 text-white stroke-[3]" />
                                        )}
                                    </button>
                                    <div
                                        onClick={() => router.push(`/shop/${group.business_id}`)}
                                        className="flex items-center gap-2 cursor-pointer hover:opacity-75 transition-opacity"
                                    >
                                        <Image src={formatUrl(group.business_logo) || "/assets/images/favio.png"} alt={group.business_name} className="rounded-full object-cover border border-slate-200" width={20} height={20} />
                                        <span className="text-[12px] font-bold text-slate-800">{group.business_name}</span>
                                        <ChevronRightIcon className="w-3 h-3 text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            {group.estimation && !group.estimation.is_available && (
                                <div className="mx-6 my-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                                    <p className="text-[11px] text-red-600 font-bold leading-relaxed whitespace-pre-wrap">
                                        ⚠️ {group.estimation.message}
                                    </p>
                                    <p className="text-[10px] text-red-500 mt-1 italic">
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
                                        <div onClick={(e) => handleProductClick(item.product_id, false, e)} className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-50 relative group cursor-pointer">
                                            <Image src={formatUrl(item.product_image)} alt={item.product_title} fill sizes="96px" className="object-cover transition-transform duration-500 group-hover:scale-110" />
                                            {item.total_quantity !== undefined && item.total_quantity > 0 && item.total_quantity <= 4 && (
                                                <>
                                                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                                                    <div className="absolute bottom-1.5 left-0 right-0 py-0.5 flex items-center justify-center z-10">
                                                        <span className="text-[10px] font-bold text-white tracking-wider drop-shadow-sm">Only {item.total_quantity} items(s)</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                            <div>
                                                <div className="flex items-start justify-between gap-4">
                                                    <h3 onClick={(e) => handleProductClick(item.product_id, false, e)} className="text-sm text-slate-900 line-clamp-2 leading-snug flex-1 cursor-pointer hover:text-red-600 transition-colors">
                                                        {item.product_title}
                                                    </h3>
                                                    <div className="flex-shrink-0">
                                                        {editingCartId === item.cart_id ? (
                                                            <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-full border border-slate-100 shadow-sm animate-in fade-in zoom-in duration-200">
                                                                <button onClick={() => { if (item.quantity > 1) handleUpdateQuantity(item.cart_id, item.quantity - 1); }} disabled={updatingIds.includes(item.cart_id)} className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm active:scale-90 transition-all disabled:opacity-30 disabled:grayscale">
                                                                    <MinusIcon className="w-3 h-3 text-slate-700 stroke-[3]" />
                                                                </button>
                                                                <span className="text-xs font-bold text-slate-800 min-w-[1.5rem] text-center">{item.quantity}</span>
                                                                <button onClick={() => { if (item.quantity >= (item.total_quantity ?? Infinity)) { toast.error(`Only ${item.total_quantity} items(s)`); return; } handleUpdateQuantity(item.cart_id, item.quantity + 1); }} disabled={updatingIds.includes(item.cart_id) || item.quantity >= (item.total_quantity ?? Infinity)} className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm active:scale-90 transition-all disabled:opacity-30 disabled:grayscale">
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
                                                    <span className="text-base font-bold text-red-600">₦{((item.price ?? 0) * (item.quantity || 1)).toLocaleString()}</span>
                                                    {(item.base_price ?? 0) > (item.price ?? 0) && <span className="text-xs text-slate-400 line-through">₦{(item.base_price ?? 0).toLocaleString()}</span>}
                                                </div>
                                                <button onClick={() => handleRemoveItem(item.cart_id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
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
                    <div className="mt-8 ">
                        <h2 className="text-[11px] font-bold text-slate-500  px-2 mb-2 ">Following item(s) unavailable</h2>
                        <section className="bg-white rounded-xl overflow-hidden border border-slate-100">
                            {outOfStockItems.map((item, idx) => (
                                <div key={`${item.cart_id}-${idx}`} className="px-8 py-4 flex gap-4 relative bg-white border-b border-slate-50 last:border-0">
                                    <div onClick={(e) => handleProductClick(item.product_id, false, e)} className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100 relative cursor-pointer grayscale opacity-80">
                                        <Image
                                            src={formatUrl(item.product_image)}
                                            alt={item.product_title}
                                            fill
                                            sizes="80px"
                                            className="object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-1 text-center">
                                            <span className="text-[10px] text-white font-bold  tracking-tighter">Unavailable</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                                        <div>
                                            <h3 onClick={(e) => handleProductClick(item.product_id, false, e)} className="text-xs font-bold text-slate-400 line-clamp-1 cursor-pointer hover:text-red-500 transition-colors">{item.product_title}</h3>
                                            {item.variant_label && <p className="text-[10px] text-slate-400 font-medium  tracking-tight mt-0.5">{item.variant_label}</p>}
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-[10px] text-slate-400 font-bold  tracking-wider">Sold Out</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => { const query = encodeURIComponent(item.product_title); router.push(`/market/feed?search=${query}`); }} className="text-[9px] font-bold text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-full border border-rose-200 transition-all  ">Find similar</button>
                                                <button onClick={() => handleRemoveItem(item.cart_id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </section>
                    </div>
                )}
                <div className="mt-12 px-2 sm:px-4">
                    <h2 className="text-lg font-bold text-slate-900 mb-6 font-primary">You might also like</h2>
                    {loadingRecs ? (
                        <ShimmerGrid count={10} />
                    ) : (
                        <MasonryGrid
                            items={recommendedProducts}
                            likeData={likeData}
                            fetchingProductId={selectedProductPayload?.productId}
                            handleProductClick={handleProductClick}
                            handleLikeClick={handleLikeClick}
                            formatUrl={formatUrl}
                            router={router}
                        />
                    )}
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
                        <span className="text-sm text-red-500 tracking-tight leading-none">₦{totalPrice.toLocaleString()}</span>
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
                            className="w-fit px-6 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold py-2 rounded-xl shadow-lg shadow-red-100 hover:shadow-red-200 transition-all active:scale-[0.98]  items-center justify-center gap-2 text-xs"
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
