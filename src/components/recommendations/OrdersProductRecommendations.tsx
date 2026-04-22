"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { fetchPersonalizedFeed } from "@/src/lib/api/productApi";
import { fetchSmartReels, toggleSocialPostLike } from "@/src/lib/api/social";
import { useAuth } from "@/src/context/authContext";
import { formatUrl, isVideoUrl } from "@/src/lib/utils/media";
import { FaPlay, FaHeart, FaRegHeart } from "react-icons/fa";
import { VerifiedBadge } from "@/src/components/common/VerifiedBadge";
import { motion, AnimatePresence } from "framer-motion";

// ── Per-tab random offset seeds (ensure each tab gets different products) ────
const TAB_OFFSETS: Record<string, number> = {
    "All": 0,
    "Awaiting Payment": 6,
    "Processing": 12,
    "To Receive / Use": 18,
    "Reviews": 24,
    "Support": 30,
};

const slugify = (str: string) =>
    String(str || "").toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

// ── Like Burst Animation ───────────────────────────────────────────────────
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

// ── Product card (supports both products and social posts) ──────────────────
const OrderProductCard = React.memo(({ 
    p, 
    onProductClick,
    postLikeData,
    handlePostLikeClick 
}: { 
    p: any; 
    onProductClick: any;
    postLikeData?: Record<string, { liked: boolean, count: number }>;
    handlePostLikeClick?: (e: React.MouseEvent, postId: string, initialLiked: boolean, initialCount: number) => void;
}) => {
    const [showBurst, setShowBurst] = useState(false);
    const router = useRouter();

    const isPromoActive = useMemo(() =>
        !!(p.promo_title && p.promo_discount && (!p.promo_end || new Date(p.promo_end) >= new Date())),
        [p.promo_title, p.promo_discount, p.promo_end]
    );

    const isSaleActive = useMemo(() =>
        !!(!isPromoActive && p.sale_discount && Number(p.sale_discount) > 0),
        [isPromoActive, p.sale_discount]
    );

    if (p.is_social_post) {
        const rawPostId = String(p.product_id).replace('post-', '');
        const postLd = postLikeData?.[rawPostId] ?? { liked: !!p.isLiked, count: p.likes_count || 0 };

        return (
            <article
                onClick={(e) => {
                    const bSlug = p.business_slug || (p.business_name ? slugify(p.business_name) : null);
                    const pSlug = p.slug || p.product_slug;
                    if (onProductClick) {
                        // Pass isSocial=true for social posts, and include full data object
                        onProductClick(p.product_id, bSlug, pSlug, e, true, p);
                    }
                }}
                className="group flex flex-col rounded-[0.5rem] bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden relative"
                style={{ willChange: "transform, opacity", contentVisibility: "auto", containIntrinsicSize: "auto 400px" }}
            >
                <div className="relative w-full overflow-hidden bg-slate-100">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl font-black text-slate-300 opacity-40 select-none">stoqle</span>
                    </div>
                    <img
                        src={formatUrl(p.first_image)}
                        className="w-full min-h-[180px] sm:min-h-[200px] max-h-[250px] sm:max-h-[320px] object-cover transition-all duration-700 group-hover:scale-110 relative z-[1]"
                        loading="lazy"
                        alt={p.title}
                        style={{ opacity: 0 }}
                        onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = "1"; (e.target as HTMLImageElement).style.transition = "opacity 0.5s"; }}
                    />
                    {p.isVideo && (
                        <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md text-white text-[9px] font-black px-1.5 py-1.5 rounded-full z-10 flex items-center">
                            <FaPlay size={7} className="text-white fill-current" />
                        </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent pointer-events-none z-[2]" />
                </div>

                <div className="p-2">
                    {/* Tagged Product Highlight */}
                    <div className="flex items-center gap-2 bg-slate-100 rounded-md mb-2 hover:bg-slate-200 transition-colors">
                        <div className="w-8 h-8 relative rounded shrink-0 overflow-hidden bg-white">
                            <Image
                                src={p.linked_image ? formatUrl(p.linked_image) : (p.logo ? formatUrl(p.logo) : "/assets/images/favio.png")}
                                alt="linked product"
                                fill
                                sizes="32px"
                                className="object-cover"
                            />
                        </div>
                        <div className="pr-1 min-w-0">
                            <span className="text-slate-900 text-[11px] font-medium tracking-tight truncate">
                                ₦{Number(p.price || 0).toLocaleString()}
                            </span>
                        </div>
                        <div className="ml-auto pr-1">
                            {p.sold_count > 0 ? (
                                <span className="text-[9px] text-slate-400 leading-none">{p.sold_count.toLocaleString()}+ sold</span>
                            ) : p.followers_count > 1 ? (
                                <span className="text-[9px] text-slate-400 leading-none">{p.followers_count}+ followers</span>
                            ) : null}
                        </div>
                    </div>

                    <h3 className="text-sm text-slate-800 line-clamp-2 leading-tight font-medium mb-1" title={p.title}>
                        {p.title}
                    </h3>

                    {/* Author + Like row */}
                    <div className="flex items-center justify-between mt-auto gap-2">
                        <div 
                            className="flex items-center gap-2 min-w-0 cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                const slug = p.business_slug || (p.business_name ? slugify(p.business_name) : null);
                                if (slug) router.push(`/shop/${slug}`);
                            }}
                        >
                            <div className="h-4 w-4 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
                                <Image
                                    src={p.logo ? formatUrl(p.logo) : "/assets/images/favio.png"}
                                    fill
                                    sizes="16px"
                                    className="object-cover"
                                    alt="avatar"
                                />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 truncate">{p.business_name}</span>
                        </div>

                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!postLd.liked) {
                                    setShowBurst(true);
                                    setTimeout(() => setShowBurst(false), 800);
                                }
                                handlePostLikeClick && handlePostLikeClick(e, rawPostId, postLd.liked, postLd.count);
                            }}
                            className="flex items-center gap-1 cursor-pointer shrink-0 relative"
                            role="button"
                        >
                            {showBurst && <div className="absolute inset-0 pointer-events-none -translate-y-4"><LikeBurst /></div>}
                            <div className="relative w-4 h-4 flex items-center justify-center">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={postLd.liked ? "liked" : "unliked"}
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.5, opacity: 0 }}
                                        className={`${postLd.liked ? 'text-rose-500' : 'text-slate-400'}`}
                                    >
                                        {postLd.liked ? <FaHeart size={12} /> : <FaRegHeart size={12} />}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                            <span className={`text-[10px] transition-colors duration-200 ${postLd.liked ? 'text-rose-500' : 'text-slate-400'}`}>
                                {postLd.count > 0 ? postLd.count : 'Like'}
                            </span>
                        </div>
                    </div>
                </div>
            </article>
        );
    }

    // Standard Product Rendering (Simplified from previous version but maintaining consistency)
    return (
        <article
            onClick={() => {
                const bSlug = p.business_slug || (p.business_name ? slugify(p.business_name) : null);
                const pSlug = p.slug || p.product_slug;
                if (onProductClick) {
                    onProductClick(p.product_id, bSlug, pSlug, null, false, p);
                }
            }}
            className="group flex flex-col rounded-[0.5rem] bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden relative"
            style={{ willChange: "transform, opacity", contentVisibility: "auto", containIntrinsicSize: "auto 400px" }}
        >
            <div className="relative w-full overflow-hidden bg-slate-100">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-4xl font-black text-slate-300 opacity-40 select-none">stoqle</span>
                </div>

                {p.product_video ? (
                    <video
                        src={formatUrl(p.product_video)}
                        poster={formatUrl(p.first_image)}
                        muted loop playsInline preload="none"
                        className="w-full min-h-[180px] sm:min-h-[200px] max-h-[250px] sm:max-h-[320px] object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                ) : (
                    <img
                        src={formatUrl(p.first_image)}
                        alt={p.title}
                        className="w-full min-h-[180px] sm:min-h-[200px] max-h-[250px] sm:max-h-[320px] object-cover transition-all duration-700 group-hover:scale-110 relative z-[1]"
                        loading="lazy"
                        style={{ opacity: 0 }}
                        onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = "1"; (e.target as HTMLImageElement).style.transition = "opacity 0.5s"; }}
                    />
                )}

                {p.product_video && (
                    <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md text-white text-[9px] font-black px-1.5 py-1.5 rounded-full z-10 flex items-center">
                        <FaPlay size={7} className="text-white fill-current" />
                    </div>
                )}
            </div>

            <div className="p-3">
                <div className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity mb-1"
                    onClick={(e) => {
                        e.stopPropagation();
                        const slug = p.business_slug || (p.business_name ? slugify(p.business_name) : null);
                        if (slug) router.push(`/shop/${slug}`);
                    }}>
                    <div className="h-5 w-5 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
                        <Image src={p.logo ? formatUrl(p.logo) : (p.profile_pic ? formatUrl(p.profile_pic) : "/assets/images/favio.png")} fill sizes="20px" className="object-cover" alt="Vendor" />
                    </div>
                    <div className="flex items-center gap-1 min-w-0">
                        <span className="truncate text-[11px] text-orange-600 hover:text-slate-900 transition-colors">{p.business_name || "Unknown Store"}</span>
                        {p.trusted_partner === 1 && <VerifiedBadge label={p.market_name || "Trusted Partner"} size="xs" />}
                    </div>
                </div>

                <h3 className="text-sm text-slate-800 line-clamp-2 leading-snug mb-1" title={p.title}>{p.title || "Untitled Product"}</h3>

                {(isPromoActive || isSaleActive || (p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) <= 4) || p.return_shipping_subsidy === 1 || Number(p.followers_count) > 1) && (
                    <div className="flex items-center min-h-[16px] mb-1">
                        {isPromoActive ? <span className="text-[10px] font-medium text-rose-500 border-rose-500 border-[0.5px] px-1 truncate">{p.promo_title} {p.promo_discount}% Off</span> :
                         isSaleActive ? <span className="text-[10px] text-rose-500 border-rose-500 border-[0.5px] px-1 truncate">{p.sale_type || "SALE"} {p.sale_discount}% Off</span> :
                         (p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) <= 4) ? <span className="text-[10px] font-bold text-rose-500 truncate">{Number(p.total_quantity) <= 0 ? "Out of stock" : `Only ${Number(p.total_quantity)} left`}</span> :
                         p.return_shipping_subsidy === 1 ? <span className="text-[10px] font-bold text-green-700 truncate">Return Shipping Subsidy</span> :
                         Number(p.followers_count) > 1 ? <span className="text-[10px] text-slate-500 px-1 rounded-sm truncate">{p.followers_count}+ store followers</span> : null}
                    </div>
                )}

                <div className="flex items-center justify-between mt-1">
                    <span className="text-slate-900 text-base font-semibold">₦{Number(p.price || 0).toLocaleString()}</span>
                    {Number(p.sold_count) > 0 && <span className="text-[10px] text-slate-400 font-medium">{p.sold_count.toLocaleString()}+ sold</span>}
                </div>
            </div>
        </article>
    );
});
OrderProductCard.displayName = "OrderProductCard";

// ── Masonry grid ────────────────────────────────────────────────────────────
const MasonryGrid = ({ 
    items, 
    onProductClick,
    postLikeData,
    handlePostLikeClick 
}: { 
    items: any[]; 
    onProductClick: any;
    postLikeData?: Record<string, { liked: boolean, count: number }>;
    handlePostLikeClick?: (e: React.MouseEvent, postId: string, initialLiked: boolean, initialCount: number) => void;
}) => {
    const [columns, setColumns] = useState(2);

    useEffect(() => {
        const update = () => {
            const w = window.innerWidth;
            if (w < 700) setColumns(2);
            else if (w < 1024) setColumns(3);
            else if (w < 1350) setColumns(4);
            else setColumns(5);
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    const columnData = useMemo(() => {
        const data: any[][] = Array.from({ length: columns }, () => []);
        items.forEach((item, i) => data[i % columns].push(item));
        return data;
    }, [items, columns]);

    return (
        <div className="flex gap-2 sm:gap-4 items-start w-full max-w-full overflow-hidden">
            {columnData.map((colItems, colIdx) => {
                let cls = "flex-1 flex flex-col gap-2 sm:gap-4 min-w-0";
                if (colIdx === 2) cls += " hidden [@media(min-width:700px)]:flex";
                if (colIdx === 3) cls += " hidden lg:flex";
                if (colIdx === 4) cls += " hidden [@media(min-width:1350px)]:flex";
                return (
                    <div key={colIdx} className={cls}>
                        {colItems.map((p: any, i: number) => (
                            <OrderProductCard 
                                key={`${p.is_social_post ? 'post-' : ''}${p.product_id}-${i}`} 
                                p={p} 
                                onProductClick={onProductClick}
                                postLikeData={postLikeData}
                                handlePostLikeClick={handlePostLikeClick}
                            />
                        ))}
                    </div>
                );
            })}
        </div>
    );
};

// ── Tab labels (Unchanged) ───────────────────────────────────────────────────
const TAB_LABELS: Record<string, string> = {
    "All": "You may also like",
    "Awaiting Payment": "While you decide — more top picks",
    "Processing": "Ready to ship — explore similar",
    "To Receive / Use": "Similar products you might enjoy",
    "Reviews": "Trending — based on purchases like yours",
    "Support": "Explore more products",
};

// ── Main component ──────────────────────────────────────────────────────────
interface OrdersProductRecommendationsProps {
    activeTab: string;
    onProductClick?: (productId: string | number, bSlug?: string, pSlug?: string, e?: any, isSocial?: boolean) => void;
}

export default function OrdersProductRecommendations({ activeTab, onProductClick }: OrdersProductRecommendationsProps) {
    const { token, user, ensureAccountVerified } = useAuth();

    const cacheRef = useRef<Record<string, any[]>>({});
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [postLikeData, setPostLikeData] = useState<Record<string, { liked: boolean, count: number }>>({});

    const handlePostLikeClick = useCallback(async (e: React.MouseEvent, postId: string, initialLiked: boolean, initialCount: number) => {
        e.stopPropagation();

        const ok = await ensureAccountVerified();
        if (!ok) return;

        let finalLiked = !initialLiked;
        let finalCount = finalLiked ? initialCount + 1 : Math.max(0, initialCount - 1);

        setPostLikeData(prev => {
            const current = prev[postId] ?? { liked: initialLiked, count: initialCount };
            finalLiked = !current.liked;
            finalCount = finalLiked ? current.count + 1 : Math.max(0, current.count - 1);
            return { ...prev, [postId]: { liked: finalLiked, count: finalCount } };
        });

        try {
            const res = await toggleSocialPostLike(postId, token!);
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
            setPostLikeData(prev => ({ ...prev, [postId]: { liked: initialLiked, count: initialCount } }));
        }
    }, [ensureAccountVerified, token]);

    const fetchForTab = useCallback(async (tab: string) => {
        if (cacheRef.current[tab] && cacheRef.current[tab].length > 0) {
            setProducts(cacheRef.current[tab]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const offset = TAB_OFFSETS[tab] ?? 0;
            const LIMIT_PRODUCTS = 24;
            const LIMIT_SOCIAL = 6;

            // Fetch both products and social posts
            const [prodRes, socialRes] = await Promise.all([
                fetchPersonalizedFeed(LIMIT_PRODUCTS, offset, token),
                fetchSmartReels({
                    limit: LIMIT_SOCIAL,
                    token: token || undefined,
                    is_product_linked: true
                }).catch(() => ({ posts: [] }))
            ]);

            const nextProducts = prodRes?.data || prodRes?.products || [];
            const nextPosts = (socialRes as any)?.posts || [];

            // Map products
            const mappedProducts = nextProducts.map((p: any) => {
                const media = p.media || [];
                const imgs = media.filter((m: any) => m.type === "image");
                const coverRef = p.first_image || p.image_url;
                const foundCover = imgs.find((m: any) => m.is_cover === 1 || (coverRef && m.url && m.url.includes(coverRef))) || imgs[0];

                return {
                    ...p,
                    first_image: foundCover?.url || coverRef || (media[0]?.type === 'image' ? media[0].url : "") || "",
                    product_video: p.product_video || media.find((m: any) => m.type === 'video')?.url || "",
                    followers_count: Number(p.followers_count || 0),
                };
            });

            // Map social posts (they are already mapped by mapApiPost, so we just need to add feed-specific fields)
            const mappedSocialPosts = nextPosts.map((p: any) => {
                const lp = p.linked_product || {};
                const productThumbnail = lp.first_image || lp.image_url || (lp.media && lp.media.find((m: any) => m.type === "image")?.url);

                return {
                    ...p, // Keep all mapped fields from mapApiPost
                    product_id: `post-${p.id}`,
                    is_social_post: true,
                    title: p.caption || lp.title || "Social Post",
                    // Use already formatted media if available
                    first_image: p.thumbnail || p.src || productThumbnail || "",
                    price: lp.price || 0,
                    logo: p.user?.avatar || null,
                    isLiked: !!(p.liked_by_me || p.liked || p.liked_by_user),
                    linked_image: productThumbnail,
                    product_slug: lp.slug || lp.product_slug || (lp.title ? slugify(lp.title) : null),
                    business_slug: lp.business_slug || p.user?.business_slug || p.business_slug || (p.business_name ? slugify(p.business_name) : (p.user?.name ? slugify(p.user.name) : null)),
                    business_name: lp.business_name || p.user?.name || "Vendor",
                    sold_count: lp.total_sold || lp.sold_count || 0,
                    followers_count: Number(lp.followers_count || p.followers_count || 0),
                };
            });

            // Simple Interleaving (Every 4th item is a post)
            const combined: any[] = [];
            let postIdx = 0;
            mappedProducts.forEach((prod: any, i: number) => {
                combined.push(prod);
                if ((i + 1) % 4 === 0 && postIdx < mappedSocialPosts.length) {
                    combined.push(mappedSocialPosts[postIdx++]);
                }
            });

            // Add remaining posts
            while (postIdx < mappedSocialPosts.length) {
                combined.push(mappedSocialPosts[postIdx++]);
            }

            // Shuffle slightly for variety
            const final = [...combined].sort(() => Math.random() - 0.5).slice(0, 20);

            cacheRef.current[tab] = final;
            setProducts(final);

            // Seed initial like data for posts
            const initialPostLikes: Record<string, { liked: boolean, count: number }> = {};
            mappedSocialPosts.forEach((p: any) => {
                const rid = String(p.product_id).replace('post-', '');
                initialPostLikes[rid] = { liked: !!p.isLiked, count: p.likes_count };
            });
            setPostLikeData(prev => ({ ...prev, ...initialPostLikes }));

        } catch (err) {
            console.error("OrdersProductRecommendations error", err);
            const fallback = Object.values(cacheRef.current).find(v => v.length > 0);
            setProducts(fallback || []);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchForTab(activeTab);
    }, [activeTab, fetchForTab]);

    if (loading) {
        return (
            <div className="mt-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-3 w-40 bg-slate-200 rounded-full animate-pulse" />
                    <div className="h-px flex-1 bg-slate-100" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white rounded-[0.5rem] border border-slate-100 overflow-hidden">
                            <div className="w-full h-44 bg-slate-100 animate-pulse" />
                            <div className="p-3 space-y-2">
                                <div className="h-2 w-20 bg-slate-100 rounded animate-pulse" />
                                <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
                                <div className="h-3 w-3/4 bg-slate-100 rounded animate-pulse" />
                                <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (products.length === 0) return null;

    return (
        <div className="mt-4">
            <MasonryGrid 
                items={products} 
                onProductClick={onProductClick} 
                postLikeData={postLikeData}
                handlePostLikeClick={handlePostLikeClick}
            />
        </div>
    );
}
