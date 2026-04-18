"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import ShimmerGrid from "@/src/components/shimmer";
import { fetchProductById, toggleProductLike, logUserActivity } from "@/src/lib/api/productApi";
import { fetchLinkedProductPosts, fetchSmartReels, toggleSocialPostLike } from "@/src/lib/api/social";
// import PostModal from "@/src/components/modal/postModal";
import { FaHeart, FaRegHeart, FaPlay, FaImage } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { PreviewPayload, ProductSku, ProductFeedItem } from "@/src/types/product";

// Dynamically import heavy modals to prevent them from blocking the initial page hydration
const ProductPreviewModal = dynamic(() => import("@/src/components/product/addProduct/modal/previewModal"), { ssr: false });
const ReelsModal = dynamic(() => import("@/src/components/product/addProduct/modal/reelsModal"), { ssr: false });
const PostModal = dynamic(() => import("@/src/components/modal/postModal"), { ssr: false });
const LoginModal = dynamic(() => import("@/src/components/modal/auth/loginModal"), { ssr: false });
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import { fetchBusinessCategories, fetchTrendingProducts, fetchPersonalizedFeed } from "@/src/lib/api/productApi";
import { API_BASE_URL } from "@/src/lib/config";
import { formatUrl } from "@/src/lib/utils/media";
import { MARKET_CACHE } from "@/src/lib/cache";
import { fetchActionableSummary } from "@/src/lib/api/orderApi";
import { ArrowUp, ShoppingCart } from "lucide-react";
import { idbGet, idbSet } from "@/src/lib/utils/idb";
import { VerifiedBadge, PartnerPill } from "@/src/components/common/VerifiedBadge";

type Props = {
    params: Promise<{ shop?: string[] }>;
    postCount?: number;
    /** Pre-resolved category data from the RSC server layer (plain data, not a Promise). */
    initialCategories?: any[] | null;
    hideTabs?: boolean;
    initialCategory?: string;
    softCategory?: boolean;
    relatedVendorIds?: number[];
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
    handlePostLikeClick,
    handlePrefetch,
    isLiked,
    likeCount,
    postLikeData,
    fetchingProduct,
    router,
    isRestored = false,
    isPartnerTab = false
}: any) => {
    const [showBurst, setShowBurst] = useState(false);
    const cardRef = useRef<HTMLElement>(null);
    const viewedRef = useRef(false);
    const { token } = useAuth(); // Access token for background logging

    useEffect(() => {
        if (!p.product_id || p.isIntro || viewedRef.current) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !viewedRef.current) {
                viewedRef.current = true;
                // Log view activity in background for personalization
                const actualId = p.is_social_post
                    ? String(p.product_id).replace('post-', '')
                    : p.product_id;

                if (actualId && !isNaN(Number(actualId))) {
                    logUserActivity({
                        product_id: Number(actualId),
                        action_type: 'view',
                        category: p.category,
                        business_id: p.business_id
                    }, token || undefined).catch(() => { });
                }
                observer.unobserve(entries[0].target);
            }
        }, { threshold: 0.1 });

        if (cardRef.current) {
            observer.observe(cardRef.current);
        }

        return () => observer.disconnect();
    }, [p.product_id, p.is_social_post, p.category, token, p.isIntro]);

    const isPromoActive = useMemo(() => {
        return !!(p.promo_title && p.promo_discount && (!p.promo_end || new Date(p.promo_end) >= new Date()));
    }, [p.promo_title, p.promo_discount, p.promo_end]);

    const isSaleActive = useMemo(() => {
        return !!(!isPromoActive && p.sale_discount && Number(p.sale_discount) > 0);
    }, [isPromoActive, p.sale_discount]);

    const activeDiscount = isPromoActive ? p.promo_discount : isSaleActive ? p.sale_discount : 0;
    const discountLabel = isPromoActive ? p.promo_title : isSaleActive ? (p.sale_type || "SALE") : "";

    if (p.isIntro) {
        return (
            <motion.article
                ref={cardRef as any}
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="rounded-[0.5rem] bg-white border border-emerald-50 p-4 shadow-sm shadow-emerald-100/40 flex flex-col justify-between h-full group relative overflow-hidden"
            >
                {/* Micro-animation background hint */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/50 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Certified Program</span>
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 leading-none mb-1 italic tracking-tighter">
                        Stoqle<span className="text-emerald-600">Partners</span>
                    </h2>

                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-6 max-w-[200px]">
                        Elite businesses handpicked for reliability and exceptional service.
                    </p>

                    <div className="space-y-3.5 mb-6">
                        {[
                            { title: "Premium express delivery", sub: "Priority nationwide shipping" },
                            { title: "Verified store status", sub: "Vetted for quality by Stoqle" },
                            { title: "Exclusive shop deals", sub: "Save up to 25% on purchases" }
                        ].map((offer, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 + (idx * 0.1) }}
                                className="flex items-start gap-3"
                            >
                                <div className="w-4.5 h-4.5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-800 leading-none">{offer.title}</p>
                                    <p className="text-[9px] text-slate-400 mt-1 font-medium">{offer.sub}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="relative z-10 pt-4 border-t border-slate-50 mt-auto">
                    <Link
                        href="/partners"
                        prefetch={true}
                        className="text-[10px] font-bold text-emerald-600   flex items-center justify-between group/link"
                    >
                        Learn what makes a partner
                        <span className="text-sm group-hover/link:translate-x-1 transition-transform ml-1">→</span>
                    </Link>
                </div>
            </motion.article>
        );
    }

    const entryVariants = {
        initial: isRestored ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.95, y: 15 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: isRestored ? { duration: 0 } : {
            duration: 0.9,
            delay: Math.min(index * 0.1, 1.2),
            ease: [0.21, 1.11, 0.81, 0.99] as any
        }
    };

    if (p.is_social_post) {
        // Extract real post id from product_id ("post-123" → 123)
        const rawPostId = String(p.product_id).replace('post-', '');
        const postLd = postLikeData?.[rawPostId] ?? { liked: !!p.isLiked, count: p.likes_count || 0 };

        return (
            <motion.article
                ref={cardRef as any}
                initial={entryVariants.initial}
                animate={entryVariants.animate}
                transition={entryVariants.transition}
                onClick={(e) => handleProductClick(p.product_id, p.business_name, e, p.business_slug, true, p.slug || p.product_slug)}
                onPointerEnter={() => {
                    // Elite predictive prefetching
                    const pSlug = p.slug || p.product_slug;
                    if (pSlug) router.prefetch(`/product/${pSlug}`);
                    if (p.business_slug) router.prefetch(`/shop/${p.business_slug}`);
                    handlePrefetch && handlePrefetch(p.product_id, pSlug);
                }}
                className="group flex flex-col rounded-[0.5rem] bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden relative"
            >
                <div className="relative w-full overflow-hidden bg-slate-100">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl font-black text-slate-300 opacity-40 select-none">stoqle</span>
                    </div>
                    {/* Placeholder frame indicator */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 rounded-full border-2 border-slate-300 border-t-transparent animate-spin opacity-20" />
                        </div>
                    </div>

                    <img
                        src={formatUrl(p.first_image)}
                        className="w-full min-h-[180px] sm:min-h-[200px] max-h-[250px] sm:max-h-[320px] object-cover transition-all duration-700 group-hover:scale-110 relative z-[1]"
                        loading="lazy"
                        alt={p.title}
                    />
                    {/* Video badge */}
                    {p.isVideo && (
                        <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md text-white text-[9px] font-black px-1.5 py-1.5 rounded-full z-10 flex items-center">
                            <FaPlay size={7} className="text-white fill-current" />
                        </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                </div>

                <div className="p-2">
                    {/* Author row */}

                    {/* Tagged Product Highlight (Image, Price, Sold) */}
                    <div className="flex items-center gap-2 bg-slate-100 rounded-md mb-2 hover:bg-slate-100 transition-colors">
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
                            <span className="text-slate-900 text-[11px] font-medium tracking-tight truncate">₦{Number(p.price || 0).toLocaleString()}</span>

                        </div>
                        <div className="ml-auto pr-1">
                            {p.sold_count > 0 ? (
                                <span className="text-[9px] text-slate-400  leading-none">{p.sold_count.toLocaleString()}+ sold by shop</span>
                            ) : p.followers_count > 1 ? (
                                <span className="text-[9px] text-slate-400 leading-none">{p.followers_count}+ store followers</span>
                            ) : null}
                        </div>
                    </div>

                    <h3 className="text-sm text-slate-800 line-clamp-2 leading-tight font-medium mb-1" title={p.title}>{p.title}</h3>

                    {/* Name + Like row */}
                    <div className="flex items-center justify-between mt-auto gap-2">

                        <div className="flex items-center gap-2 min-w-0">
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

                        {/* Like button — with spring & pulse animation */}
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
                            aria-label="Like post"
                        >
                            {showBurst && <div className="absolute inset-0 pointer-events-none -translate-y-4"><LikeBurst /></div>}
                            <div className="relative w-4 h-4 flex items-center justify-center">
                                <AnimatePresence>
                                    <motion.div
                                        key={postLd.liked ? "liked" : "unliked"}
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.5, opacity: 0 }}
                                        transition={{ type: "spring", stiffness: 450, damping: 15 }}
                                        className={`absolute flex items-center justify-center ${postLd.liked ? 'text-rose-500' : 'text-slate-400'}`}
                                    >
                                        {postLd.liked ? <FaHeart size={12} /> : <FaRegHeart size={12} />}
                                    </motion.div>
                                </AnimatePresence>

                                {postLd.liked && (
                                    <motion.div
                                        initial={{ scale: 1, opacity: 1 }}
                                        animate={{ scale: [1, 1.8, 1], opacity: [1, 0.4, 0] }}
                                        transition={{ duration: 0.6 }}
                                        className="absolute text-rose-500 pointer-events-none"
                                    >
                                        <FaHeart size={16} />
                                    </motion.div>
                                )}
                            </div>

                            <span className={`text-[10px]  transition-colors duration-200 ${postLd.liked ? 'text-rose-500' : 'text-slate-400'}`}>
                                {postLd.count > 0 ? postLd.count : 'Like'}
                            </span>
                        </div>
                    </div>
                </div>
            </motion.article>
        );
    }

    return (
        <article
            ref={cardRef as any}
            key={`${p.product_id}${isVideoCover ? '-vid' : ''}`}
            onClick={(e) => {
                if (isVideoCover) {
                    handleReelsClick(p.product_id, p.business_name, e, p.business_slug, p.slug || p.product_slug);
                } else {
                    handleProductClick(p.product_id, p.business_name, e, p.business_slug, false, p.slug || p.product_slug);
                }
            }}
            onPointerEnter={() => {
                // Elite predictive prefetching
                const pSlug = p.slug || p.product_slug;
                if (pSlug) router.prefetch(`/product/${pSlug}`);
                if (p.business_slug) router.prefetch(`/shop/${p.business_slug}`);
                handlePrefetch && handlePrefetch(p.product_id, pSlug);
            }}
            className={`group flex flex-col rounded-[0.5rem] bg-white cursor-pointer transition-all border overflow-hidden ${isPartnerTab ? "border-emerald-100 shadow-sm shadow-emerald-50/50" : "border-slate-100"}`}
            style={{
                willChange: "transform, opacity",
                contentVisibility: "auto",
                containIntrinsicSize: "auto 400px"
            }}
        >
            <div className="relative w-full overflow-hidden bg-slate-100">
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-black text-slate-300 opacity-40 select-none">stoqle</span>
                </div>
                {/* Placeholder frame indicator */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 rounded-full border-2 border-slate-300 border-t-transparent animate-spin opacity-20" />
                    </div>
                </div>
                <motion.div
                    initial={entryVariants.initial}
                    animate={entryVariants.animate}
                    transition={entryVariants.transition}
                    className="w-full h-full relative z-[1]"
                >
                    {p.product_video && isVideoCover ? (
                        <video
                            src={formatUrl(p.product_video!)}
                            poster={formatUrl(p.first_image)}
                            muted
                            loop
                            playsInline
                            preload="auto"
                            className="w-full min-h-[180px] sm:min-h-[200px] max-h-[250px] sm:max-h-[320px] object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                    ) : (
                        <div className="relative w-full h-auto">
                            <img
                                src={formatUrl(p.first_image)}
                                alt={p.title}
                                className="w-full min-h-[180px] sm:min-h-[200px] max-h-[250px] sm:max-h-[320px] object-cover transition-all duration-700 group-hover:scale-110"
                                loading="lazy"
                                onLoad={(e) => {
                                    (e.target as any).style.animation = "fadeIn 0.6s ease-in-out forwards";
                                }}
                                style={{ opacity: 0 }}
                            />
                        </div>
                    )}


                    {!isVideoCover && fetchingProduct && (
                        <div className="absolute inset-0 bg-white/30 z-20 flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}


                </motion.div>


            </div>

            <div className="p-3">
                {isVideoCover ? (
                    <>
                        <h3 className="text-sm text-slate-800 line-clamp-2 leading-snug mb-1" title={p.title}>
                            {p.trusted_partner === 1 && (
                                <span className="inline-flex items-center gap-1 shrink-0 mr-1.5 align-text-bottom">
                                    <PartnerPill />
                                </span>
                            )}
                            <span className="align-middle ">{p.title || "Untitled Product"}</span>
                        </h3>

                        {(isPromoActive || p.sale_type || (p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) <= 4) || p.return_shipping_subsidy === 1 || p.market_name || (p.followers_count > 1)) && (
                            <div className=" flex items-center min-h-[16px]">
                                {isPromoActive ? (
                                    <span className="text-[10px] font-medium text-rose-500 border-rose-500 border-[0.5px] px-1  truncate">
                                        {p.promo_title} {p.promo_discount}% Off
                                    </span>
                                ) : p.sale_type ? (
                                    <span className="text-[10px]  text-rose-500 border-rose-500 border-[0.5] px-1  truncate">
                                        {p.sale_type} {p.sale_discount}% Off
                                    </span>
                                ) : (p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) <= 4) ? (
                                    <span className={`text-[10px] font-bold ${Number(p.total_quantity) <= 0 ? 'text-rose-600' : 'text-rose-500'} truncate`}>
                                        {Number(p.total_quantity) <= 0 ? 'Out of stock' : `Only ${Number(p.total_quantity)} left`}
                                    </span>
                                ) : p.return_shipping_subsidy === 1 ? (
                                    <span className="text-[10px] font-bold text-green-700   truncate">
                                        Return Shipping Subsidy
                                    </span>
                                ) : p.market_name ? (
                                    <span className="text-[10px] font-bold text-rose-500   truncate">
                                        {p.market_name}
                                    </span>
                                ) : p.followers_count > 1 ? (
                                    <span className="text-[10px] text-slate-500  px-1 rounded-sm truncate">
                                        {p.followers_count}+ store followers
                                    </span>
                                ) : null}
                            </div>
                        )}

                        <div className="flex items-center justify-between mt-1">
                            <span className="text-slate-900 text-base font-semibold">₦{Number(p.price || 0).toLocaleString()}</span>
                            {p.sold_count > 0 && (
                                <span className="text-[10px] text-slate-400 font-medium">{p.sold_count.toLocaleString()}+ sold by shop</span>
                            )}
                        </div>


                        <div className="flex items-center justify-between">

                            <div
                                className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const slug = p.business_slug || (p.business_name ? slugify(p.business_name) : null);
                                    if (slug) router.push(`/shop/${slug}`);
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
                                <span className="truncate text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors max-w-[150px]">
                                    {p.business_name || "Unknown Store"}
                                </span>
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
                                    const slug = p.business_slug || (p.business_name ? slugify(p.business_name) : null);
                                    if (slug) router.push(`/shop/${slug}`);
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
                                            <VerifiedBadge label={p.market_name || "Trusted Partner"} size="xs" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <h3 className="text-sm text-slate-800 line-clamp-2 leading-snug mb-1" title={p.title}>
                            {p.trusted_partner === 1 && (
                                <span className="inline-flex items-center gap-1 shrink-0 mr-1.5 align-text-bottom">
                                    <PartnerPill />
                                </span>
                            )}
                            <span className="align-middle ">{p.title || "Untitled Product"}</span>
                        </h3>

                        {(isPromoActive || p.sale_type || (p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) <= 4) || p.return_shipping_subsidy === 1 || p.market_name || (p.followers_count > 1)) && (
                            <div className=" flex items-center min-h-[16px]">
                                {isPromoActive ? (
                                    <span className="text-[10px] font-medium text-rose-500 border-rose-500 border-[0.5px] px-1  truncate">
                                        {p.promo_title} {p.promo_discount}% Off
                                    </span>
                                ) : p.sale_type ? (
                                    <span className="text-[10px]  text-rose-500 border-rose-500 border-[0.5] px-1  truncate">
                                        {p.sale_type} {p.sale_discount}% Off
                                    </span>
                                ) : (p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) <= 4) ? (
                                    <span className={`text-[10px] font-bold ${Number(p.total_quantity) <= 0 ? 'text-rose-600' : 'text-rose-500'} truncate`}>
                                        {Number(p.total_quantity) <= 0 ? 'Out of stock' : `Only ${Number(p.total_quantity)} left`}
                                    </span>
                                ) : p.return_shipping_subsidy === 1 ? (
                                    <span className="text-[10px] font-bold text-green-700   truncate">
                                        Return Shipping Subsidy
                                    </span>
                                ) : p.market_name ? (
                                    <span className="text-[10px] font-bold text-rose-500   truncate">
                                        {p.market_name}
                                    </span>
                                ) : p.followers_count > 1 ? (
                                    <span className="text-[10px] text-slate-500  px-1 rounded-sm truncate">
                                        {p.followers_count}+ store followers
                                    </span>
                                ) : null}
                            </div>
                        )}

                        <div className="flex items-center justify-between mt-1">
                            <span className="text-slate-900 text-base font-semibold">₦{Number(p.price || 0).toLocaleString()}</span>
                            {p.sold_count > 0 && (
                                <span className="text-[10px] text-slate-400 font-medium">{p.sold_count.toLocaleString()}+ sold by shop</span>
                            )}
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

const MasonryGrid = ({ items, likeData, postLikeData, fetchingProductId, handleProductClick, handleReelsClick, handleLikeClick, handlePostLikeClick, handlePrefetch, formatUrl, router, isRestored, isPartnerTab }: any) => {
    const [columns, setColumns] = useState(5);

    useEffect(() => {
        const updateColumns = () => {
            const w = window.innerWidth;
            if (w < 700) setColumns(2);
            else if (w < 1350) setColumns(3);
            else if (w < 1650) setColumns(4);
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
                            // Social posts use postLikeData; products use likeData
                            const rawPostId = p.is_social_post ? String(p.product_id).replace('post-', '') : null;
                            const ld = p.is_social_post
                                ? (postLikeData?.[rawPostId!] ?? { liked: !!p.isLiked, count: p.likes_count || 0 })
                                : (likeData[p.product_id] || { liked: !!p.isLiked, count: p.likes_count || 0 });
                            return (
                                <ProductCard
                                    key={`${p.product_id}-${p.originalIndex}`}
                                    index={p.originalIndex}
                                    isVideoCover={!!p.product_video}
                                    p={p}
                                    formatUrl={formatUrl}
                                    handleProductClick={(id: number | string, b: string, e: any, s: string, isSocial: boolean, ps?: string) => handleProductClick(id, b, e, s, isSocial, ps)}
                                    handleReelsClick={(id: number | string, b: string, e: any, s: string, ps?: string) => handleReelsClick(id, b, e, s, ps)}
                                    handleLikeClick={handleLikeClick}
                                    handlePostLikeClick={handlePostLikeClick}
                                    handlePrefetch={handlePrefetch}
                                    isLiked={ld.liked}
                                    likeCount={ld.count}
                                    postLikeData={postLikeData}
                                    fetchingProduct={fetchingProductId === p.product_id}
                                    router={router}
                                    isRestored={isRestored}
                                    isPartnerTab={isPartnerTab}
                                />
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
};



// ─── BLINK-EYE INSTANT CACHE ENGINE ───
// Pre-load from persistence before React even starts parsing the component.
if (typeof window !== "undefined") {
    const catCache = localStorage.getItem("stoqle_business_categories");
    if (catCache && MARKET_CACHE.categories.length === 0) {
        try { MARKET_CACHE.categories = JSON.parse(catCache); } catch (e) { }
    }

    // Legacy Cleanup
    localStorage.removeItem("stoqle_market_cache_products");

    MARKET_CACHE.lastFetchedAt = Number(localStorage.getItem("stoqle_market_cache_time") || 0);
}

export default function MarketClient({ params: paramsPromise, initialCategories, hideTabs, initialCategory, softCategory, relatedVendorIds }: Props) {
    const routeParams = React.use(paramsPromise);
    const [activeCategory, setActiveCategory] = useState<string>(initialCategory || MARKET_CACHE.category);
    const [products, setProducts] = useState<any[]>(initialCategory && initialCategory !== MARKET_CACHE.category ? [] : MARKET_CACHE.products);
    const [loading, setLoading] = useState<boolean>(initialCategory && initialCategory !== MARKET_CACHE.category ? true : MARKET_CACHE.products.length === 0);
    const [isRestoring, setIsRestoring] = useState<boolean>(MARKET_CACHE.products.length > 0);
    const [error, setError] = useState<string | null>(null);
    const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

    const [selectedSocialPost, setSelectedSocialPost] = useState<any | null>(null);
    const [socialPostModalOpen, setSocialPostModalOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [reelsModalOpen, setReelsModalOpen] = useState(false);
    const [fetchingProductId, setFetchingProductId] = useState<number | string | null>(null);
    const [clickPos, setClickPos] = useState({ x: 0, y: 0 });

    // --- Pagination State ---
    const [page, setPage] = useState(MARKET_CACHE.page);
    const [hasMore, setHasMore] = useState(MARKET_CACHE.hasMore);
    const [socialCursor, setSocialCursor] = useState<string | null>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loaderRef = useRef<HTMLDivElement>(null);
    const tabsRef = useRef<HTMLDivElement>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [showManualLoading, setShowManualLoading] = useState(false);
    const LIMIT = 10;

    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const auth = useAuth();
    const { user, token, isHydrated } = auth;
    const [showLoginModal, setShowLoginModal] = useState(false);

    // --- Actionable Orders State ---
    const [actionableData, setActionableData] = useState<{ vendorPendingCount: number, customerDeliveredCount: number, customerOutForDeliveryCount: number } | null>(null);
    const [fetchedCategories, setFetchedCategories] = useState<string[]>(MARKET_CACHE.categories);
    const [isScrolled, setIsScrolled] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const LIMIT_SOCIAL = 5;

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 50) {
                setIsScrolled(true);
            } else {
                setIsScrolled(false);
            }
            setShowScrollTop(window.scrollY > 400);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // --- IDB Initialization & Cross-Tab Sync ---
    useEffect(() => {
        // 1. Initial IDB Hydration
        if (products.length === 0) {
            idbGet<any[]>("stoqle_market_cache_products").then((data) => {
                if (data && data.length > 0 && activeCategory === MARKET_CACHE.category) {
                    MARKET_CACHE.products = data;
                    setProducts(data);
                    setIsRestoring(true);
                    setLoading(false);
                }
            }).catch(console.error);
        }

        // 2. Cross-Tab Sync Worker
        const handleStorage = (e: StorageEvent) => {
            if (e.key === "stoqle_market_cache_time") {
                // Another tab updated the cache! Let's pull the latest IDB data silently.
                idbGet<any[]>("stoqle_market_cache_products").then((data) => {
                    if (data && data.length > 0) {
                        MARKET_CACHE.products = data;
                        setProducts(data);
                    }
                }).catch(console.error);
            }
        };
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [activeCategory]);


    const handleManualRefresh = () => {
        scrollToTop();
        setShowManualLoading(true);
        setTimeout(() => {
            MARKET_CACHE.products = [];
            MARKET_CACHE.page = 0;
            MARKET_CACHE.category = ""; // Force fresh load
            setRefreshKey(prev => prev + 1);
            setShowManualLoading(false);
        }, 600);
    };

    useEffect(() => {
        const handleNavRefresh = (e: any) => {
            if (!e.detail?.path || e.detail.path === "/market") {
                handleManualRefresh();
            }
        };
        window.addEventListener("nav-refresh", handleNavRefresh);
        return () => window.removeEventListener("nav-refresh", handleNavRefresh);
    }, []);

    useEffect(() => {
        // 1. Try Memory Cache (fastest — module-level, survives soft navigations)
        if (MARKET_CACHE.categories.length > 0) {
            setFetchedCategories(MARKET_CACHE.categories);
            return;
        }

        // 2. Try LocalStorage Cache (persists across hard refreshes)
        const cached = localStorage.getItem("stoqle_business_categories");
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const filtered = (parsed || []).filter((c: any) => c !== "Trending");
                if (filtered.length > 0) {
                    setFetchedCategories(filtered);
                    MARKET_CACHE.categories = filtered;
                    // Already have data — server data will still override below if better
                }
            } catch (err) {
                console.error("Failed to parse cached categories", err);
            }
        }

        // 3. Use server-resolved categories if provided (array of category objects),
        //    otherwise fall back to a direct client-side fetch.
        //
        //    NOTE: initialCategories is plain data (already awaited in the RSC layer).
        //    Never treat it as a Promise — Promises are not serializable across the
        //    RSC → Client boundary and arrive as undefined.
        if (Array.isArray(initialCategories) && initialCategories.length > 0) {
            applyCategories(initialCategories);
        } else {
            fetchBusinessCategories()
                .then(res => {
                    if (res?.status === "success" || res?.success || res?.ok) {
                        applyCategories(res.data || res);
                    }
                })
                .catch(console.error);
        }

        function applyCategories(data: any[]) {
            const cats = data.map((c: any) => (typeof c === "string" ? c : c.name)).filter(Boolean);
            const finalCats = ["For you", "PARTNERS", ...cats];
            setFetchedCategories(finalCats);
            MARKET_CACHE.categories = finalCats;
            localStorage.setItem("stoqle_business_categories", JSON.stringify(finalCats));
        }
    }, [initialCategories]);

    useEffect(() => {
        if (token) {
            fetchActionableSummary(token)
                .then(res => {
                    if (res?.success) {
                        setActionableData(res.data);
                    }
                })
                .catch(console.error);
        } else {
            setActionableData(null);
        }
    }, [token]);

    const [likeData, setLikeData] = useState<Record<number, { liked: boolean, count: number }>>(MARKET_CACHE.likeData);
    // const formatUrl = React.useCallback((url: string) => {
    //     if (!url) return "https://via.placeholder.com/800x600?text=No+Image";
    //     if (url.startsWith("http")) return url;
    //     return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    // }, []);

    const handleLikeClick = React.useCallback(async (e: React.MouseEvent, productId: number, baseCount: number) => {
        e.stopPropagation();

        const ok = await auth.ensureAccountVerified();
        if (!ok) return;

        const current = likeData[productId] || { liked: false, count: baseCount };
        const newLiked = !current.liked;
        const newCount = newLiked ? current.count + 1 : Math.max(0, current.count - 1);

        setLikeData(prev => ({
            ...prev,
            [productId]: { liked: newLiked, count: newCount }
        }));

        try {
            const res = await toggleProductLike(productId, token!);
            setLikeData(prev => ({
                ...prev,
                [productId]: { liked: res.data.liked, count: res.data.likes_count }
            }));
            if (res.data.liked) {
                const likedProduct = products.find((p: any) => p.product_id === productId);
                logUserActivity({ product_id: productId, action_type: 'like', business_id: likedProduct?.business_id, category: likedProduct?.category }, token!);
            }
        } catch (err) {
            console.error("Like error", err);
            // Revert on error
            setLikeData(prev => ({
                ...prev,
                [productId]: current
            }));
        }
    }, [user, token, likeData]);

    // ── Social post like state (keyed by raw post id string, e.g. "42") ──────
    const [postLikeData, setPostLikeData] = useState<Record<string, { liked: boolean, count: number }>>({});

    const handlePostLikeClick = React.useCallback(async (e: React.MouseEvent, postId: string, initialLiked: boolean, initialCount: number) => {
        e.stopPropagation();

        const ok = await auth.ensureAccountVerified();
        if (!ok) return;

        let finalLiked = !initialLiked;
        let finalCount = finalLiked ? initialCount + 1 : Math.max(0, initialCount - 1);

        // Functional update ensures we handle rapid clicks correctly
        setPostLikeData(prev => {
            const current = prev[postId] ?? { liked: initialLiked, count: initialCount };
            finalLiked = !current.liked;
            finalCount = finalLiked ? current.count + 1 : Math.max(0, current.count - 1);
            return { ...prev, [postId]: { liked: finalLiked, count: finalCount } };
        });

        try {
            const res = await toggleSocialPostLike(postId, token!);
            // Server feedback logic: if res is valid, use its count
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
            // Revert slightly based on common error patterns
            setPostLikeData(prev => ({ ...prev, [postId]: { liked: initialLiked, count: initialCount } }));
        }
    }, [auth, token]);

    // We could fetch actual categories or just have common ones
    const CATEGORIES = useMemo(
        () => fetchedCategories.length > 0 ? fetchedCategories : ["For you", "PARTNERS"],
        [fetchedCategories]
    );


    const fetchPage = async (pageNum: number) => {
        if (!hasMore || isLoadingMore) return;

        setIsLoadingMore(true);
        // Instant Optimization: Only show loading shimmer if we literally have zero products to show
        if (pageNum === 0 && products.length === 0) setLoading(true);

        try {
            let nextProducts: ProductFeedItem[] = [];
            let nextPosts: any[] = [];

            if (activeCategory === "PARTNERS") {
                const res = await fetchPersonalizedFeed(LIMIT, pageNum * LIMIT, token, null, true, softCategory, relatedVendorIds);
                nextProducts = res?.data || [];
            } else {
                const bizCat = activeCategory === "For you" ? null : activeCategory;
                const res = await fetchPersonalizedFeed(LIMIT, pageNum * LIMIT, token, bizCat, false, softCategory, relatedVendorIds);
                nextProducts = res?.data || [];

                // Fetch social posts with linked products using the dynamic Smart Reels engine
                if (activeCategory === "For you" || activeCategory === "PARTNERS" || softCategory) {
                    try {
                        const { posts, nextCursor } = await fetchSmartReels({
                            limit: LIMIT_SOCIAL,
                            cursor: pageNum === 0 ? null : socialCursor,
                            token: token || undefined,
                            is_product_linked: true,
                            softCategory
                        });
                        nextPosts = posts;
                        setSocialCursor(nextCursor);
                    } catch (err: any) {
                        console.error("Failed to fetch linked social posts", err);
                    }
                }
            }

            // If this was an authenticated fetch, mark the cache as personalized
            if (pageNum === 0) {
                MARKET_CACHE.personalized = !!token;
                MARKET_CACHE.lastFetchedAt = Date.now();
            }

            // Update likeData based on all fetched products
            const nextLikeData: Record<number, { liked: boolean, count: number }> = {};
            nextProducts.forEach((p: any) => {
                nextLikeData[p.product_id] = { liked: !!p.isLiked, count: p.likes_count || 0 };
            });
            setLikeData(prev => ({ ...prev, ...nextLikeData }));

            setProducts(prev => {
                const mappedProducts = nextProducts.map((p: any) => {
                    const media = p.media || [];
                    const imgs = media.filter((m: any) => m.type === "image");
                    const coverRef = p.first_image || p.image_url;

                    const foundCover = imgs.find((m: any) =>
                        m.is_cover === 1 || (coverRef && m.url && m.url.includes(coverRef))
                    ) || imgs[0];

                    return {
                        ...p,
                        // originalIndex is deferred — assigned after interleaving for correct animation order
                        first_image: foundCover?.url || coverRef || (media[0]?.type === 'image' ? media[0].url : "") || "",
                        product_video: p.product_video || media.find((m: any) => m.type === 'video')?.url || "",
                        followers_count: Number(p.followers_count || 0),
                    };
                });

                const mappedSocialPosts = nextPosts.map((p: any) => {
                    const lp = p.linked_product || {};
                    // Specifically target the product's image, not the post's media
                    const productThumbnail = lp.first_image || lp.image_url || (lp.media && lp.media.find((m: any) => m.type === "image")?.url);

                    return {
                        ...p,
                        product_id: `post-${p.id}`,
                        is_social_post: true,
                        title: p.caption || lp.title || "Social Post",
                        first_image: p.thumbnail || p.src,
                        price: lp.price || 0,
                        logo: p.user?.avatar || null,
                        isLiked: !!(p.liked_by_me || p.liked || p.liked_by_user),
                        likes_count: p.likes_count ?? p.likeCount ?? 0,
                        // Specific product tag metadata
                        linked_image: productThumbnail,
                        product_slug: lp.slug || lp.product_slug || (lp.title ? slugify(lp.title) : null),
                        business_slug: lp.business_slug || p.user?.business_slug || p.business_slug || null,
                        business_name: lp.business_name || p.user?.name || "Vendor",
                        sold_count: lp.total_sold || lp.sold_count || 0,
                        followers_count: Number(lp.followers_count || p.followers_count || 0),
                    };
                });

                // ── Split social posts: fresh vs already-viewed-linked-product ─────
                // Posts whose linked product the user has already interacted with
                // are NEVER inserted mid-feed. They go at the very end.
                const viewedProductIds = new Set(Object.keys(likeData).map(Number));
                const freshPosts: any[] = [];
                const stalePosts: any[] = [];

                mappedSocialPosts.forEach((post: any) => {
                    const linkedId = post.linked_product_id || post.linked_product?.product_id;
                    const alreadySeen = linkedId && (
                        viewedProductIds.has(Number(linkedId)) ||
                        post.interacted_by_user != null ||
                        (post.feed_score != null && post.feed_score < -10000)
                    );
                    if (alreadySeen && !softCategory) {
                        stalePosts.push(post);
                    } else {
                        freshPosts.push(post);
                    }
                });

                // ─── Insertion positions for FRESH posts only ──────────────────────
                const userSeed = user?.id
                    ? (Number(user.id) % 9973) ^ pageNum
                    : (Math.floor(Date.now() / 60_000) % 9973) ^ pageNum;

                const totalProducts = mappedProducts.length;
                const insertionPositions = new Set<number>();
                if (freshPosts.length > 0 && totalProducts > 0) {
                    const baseStep = Math.max(3, Math.floor(totalProducts / (freshPosts.length + 1)));
                    for (let k = 0; k < freshPosts.length; k++) {
                        const jitter = ((userSeed * (k + 7)) % baseStep) - Math.floor(baseStep / 2);
                        const pos = Math.min(totalProducts - 1, Math.max(1, (k + 1) * baseStep + jitter));
                        insertionPositions.add(pos);
                    }
                }

                // Interleave fresh posts at calculated positions
                const combined: any[] = [];
                let socialIdx = 0;
                mappedProducts.forEach((prod: any, i: number) => {
                    combined.push(prod);
                    if (insertionPositions.has(i + 1) && socialIdx < freshPosts.length) {
                        combined.push(freshPosts[socialIdx++]);
                    }
                });
                // Remaining fresh posts
                while (socialIdx < freshPosts.length) {
                    combined.push(freshPosts[socialIdx++]);
                }
                // Stale (viewed-linked-product) posts always at the bottom
                stalePosts.forEach((post: any) => combined.push(post));


                // ─── Assign originalIndex AFTER combining so animation is serial ──
                // Each item's delay is based on its true visual slot, not on whether
                // it's a product or a social post.
                const baseOffset = pageNum === 0 ? 0 : prev.length;
                combined.forEach((item, i) => {
                    item.originalIndex = baseOffset + i;
                });

                const existingIds = new Set(prev.map(p => p.product_id));
                const unique = combined.filter((p) => !existingIds.has(p.product_id));
                const finalProducts = pageNum === 0 ? combined : [...prev, ...unique];

                if (!hideTabs) {
                    MARKET_CACHE.products = finalProducts;
                    MARKET_CACHE.page = pageNum + 1;
                    MARKET_CACHE.hasMore = nextProducts.length >= LIMIT;
                    MARKET_CACHE.likeData = { ...likeData, ...nextLikeData };

                    // Persist for next session's "blink eye" load via IDB
                    if (typeof window !== "undefined" && pageNum === 0) {
                        idbSet("stoqle_market_cache_products", finalProducts).catch(console.error);
                        localStorage.setItem("stoqle_market_cache_time", Date.now().toString());
                    }
                }

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
        if (!isHydrated) return; // Wait for auth state to be resolved from storage

        const CACHE_TTL = 1000 * 60 * 5; // 5 mins

        // If we have cached products for the right category...
        if (MARKET_CACHE.products.length > 0 && MARKET_CACHE.category === activeCategory) {
            const isFresh = Date.now() - MARKET_CACHE.lastFetchedAt < CACHE_TTL;
            // ...but we just got a token and the cache isn't personalized, we MUST re-fetch
            const needsPersonalization = token && !MARKET_CACHE.personalized && activeCategory !== "Trending";

            if (!needsPersonalization && isFresh) {
                setProducts(MARKET_CACHE.products);
                setLoading(false);
                return;
            }
        }

        // Only clear if category actually changed and it's not the restored state
        if (!hideTabs && MARKET_CACHE.category !== activeCategory) {
            MARKET_CACHE.products = [];
            MARKET_CACHE.page = 0;
            MARKET_CACHE.hasMore = true;
            MARKET_CACHE.category = activeCategory;
        }

        setPage(0);
        setHasMore(true);
        // Optimization: Do NOT clear existing products if we're just refreshing/personalizing
        // This ensures the "blink eye" instant opening of the page.
        if (products.length === 0) setProducts([]);

        fetchPage(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHydrated, token, activeCategory, refreshKey]);

    // Sync active category if initialCategory prop changes (e.g. from cart updates)
    useEffect(() => {
        if (initialCategory && initialCategory !== activeCategory) {
            // If the category actually changed, we MUST clear products and re-fetch
            setActiveCategory(initialCategory);
            // We don't call fetchPage(0) here because the effect above will trigger on activeCategory change
        }
    }, [initialCategory, activeCategory]);

    // Center active tab automatically on change
    useEffect(() => {
        const container = tabsRef.current;
        if (!container) return;

        const activeTab = container.querySelector(`[data-active="true"]`) as HTMLElement;
        if (activeTab) {
            const containerWidth = container.offsetWidth;
            const targetWidth = activeTab.offsetWidth;
            const targetLeft = activeTab.offsetLeft;
            const scrollLeft = targetLeft - (containerWidth / 2) + (targetWidth / 2);
            container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
    }, [activeCategory]);

    // Dynamic Navbar / Header coloring for Partners
    useEffect(() => {
        // Find the main shell header
        const header = document.querySelector('header.fixed.top-0');
        if (!header) return;

        if (activeCategory === "PARTNERS") {
            header.classList.add('is-partners');
        } else {
            header.classList.remove('is-partners');
        }

        return () => {
            header.classList.remove('is-partners');
        };
    }, [activeCategory]);

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

    // Category sorting: Since we fetch by category server-side, we just return the products
    const filteredProducts = useMemo(() => {
        let list = products || [];
        if (activeCategory === "PARTNERS" && list.length > 0) {
            return [{ isIntro: true, product_id: 'intro' }, ...list];
        }
        return list;
    }, [products, activeCategory]);



    const updateUrl = (productId: number | string | null, businessName?: string, isReels: boolean = false, businessSlug?: string, isSocialPost: boolean = false, productSlug?: string, replace: boolean = false) => {
        const params = new URLSearchParams(window.location.search);
        const bizSlug = businessSlug || (businessName ? slugify(businessName) : (routeParams?.shop?.[0] || "product"));

        if (productId || productSlug) {
            if (isReels) {
                params.set("reels", "true");
            } else {
                params.delete("reels");
            }

            // Context-Aware Routing: Use current base path (market, cart, etc)
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            const currentBase = pathParts[0] || 'market';
            let newUrl = `/${currentBase}/${bizSlug}`;

            // Always prefer slug in the URL — never expose numeric product_id
            params.delete("product_id");
            if (productSlug) {
                newUrl += `/${productSlug}`;
            }

            const search = params.toString();
            newUrl += search ? `?${search}` : "";

            if (newUrl !== window.location.pathname + window.location.search) {
                if (replace) {
                    window.history.replaceState(window.history.state, "", newUrl);
                } else {
                    window.history.pushState(window.history.state, "", newUrl);
                }
            }
        } else {
            params.delete("product_id");
            params.delete("reels");
            const search = params.toString();
            // If we have a shop/biz slug from props or state, keep it.
            const currentBiz = routeParams?.shop?.[0];
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            const currentBase = pathParts[0] || 'market';
            const newUrl = currentBiz ? `/${currentBase}/${currentBiz}${search ? `?${search}` : ""}` : `/${currentBase}${search ? `?${search}` : ""}`;

            if (newUrl !== window.location.pathname + window.location.search) {
                if (replace) {
                    window.history.replaceState(window.history.state, "", newUrl);
                } else {
                    window.history.pushState(window.history.state, "", newUrl);
                }
            }
        }
    };

    // Global listener to close modals when navigating back via hardware button
    useEffect(() => {
        const parts = pathname.split("/").filter(Boolean);
        // Is this the base market or a shop page without a specific product/reel open?
        const isBaseNavigation = parts.length <= 2 && !searchParams.get("reels");

        if (isBaseNavigation) {
            setSocialPostModalOpen(false);
            setModalOpen(false);
            setReelsModalOpen(false);
            setSelectedSocialPost(null);
        }
    }, [pathname, searchParams]);

    /**
     * EAGER PREFETCH ENGINE
     * 
     * Dynamically imported components (next/dynamic) normally download only when triggered.
     * This creates a 'First-Click Delay' where the user's first tap feels laggy while the code downloads.
     * 
     * We solve this by prefetching all heavy modal chunks in the background once the page is idle.
     */
    useEffect(() => {
        const prefetchModals = () => {
            // Trigger background fetches of the actual JS bundles
            // These catch errors silently because we only care about filling the cache
            import("@/src/components/product/addProduct/modal/previewModal").catch(() => { });
            import("@/src/components/product/addProduct/modal/reelsModal").catch(() => { });
            import("@/src/components/modal/postModal").catch(() => { });
            import("@/src/components/modal/auth/loginModal").catch(() => { });
        };

        if (typeof window !== "undefined") {
            if ("requestIdleCallback" in window) {
                window.requestIdleCallback(() => prefetchModals());
            } else {
                setTimeout(prefetchModals, 2000);
            }
        }
    }, []);

    const handlePrefetch = React.useCallback(async (productId: number | string, productSlug?: string) => {
        const isNumericId = typeof productId === 'number' || (typeof productId === 'string' && /^\d+$/.test(productId));
        const pid = isNumericId ? Number(productId) : null;
        const identifier = productSlug || (isNumericId ? pid : productId);
        if (!identifier) return;

        // Trigger fetchBusinessCategories and fetchProductById in parallel for background warmth
        // This fills the browser's fetch cache and the server-side revalidation cache.
        fetchProductById(identifier, token).catch(() => { });
    }, [token]);

    const handleProductClick = React.useCallback(async (productId: number | string, businessName?: string, e?: React.MouseEvent, businessSlug?: string, isSocialPost: boolean = false, productSlug?: string) => {
        if (fetchingProductId) return;

        // Capture click position
        if (e) {
            setClickPos({ x: e.clientX, y: e.clientY });
        } else {
            setClickPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        }

        if (isSocialPost) {
            const post = products.find(p => p.product_id === productId);
            if (post) {
                // When watching reels/social posts from market, we want the product slug in the tab
                updateUrl(productId, post.business_name, true, post.business_slug, true, post.product_slug);
                setSelectedSocialPost(post);
                setSocialPostModalOpen(true);
            }
            return;
        }

        const isNumericId = typeof productId === 'number' || (typeof productId === 'string' && /^\d+$/.test(productId));
        const pid = isNumericId ? Number(productId) : null;
        const identifier = productSlug || (isNumericId ? pid : productId);

        if (!identifier || identifier === "undefined" || identifier === "null") {
            setFetchingProductId(null);
            return;
        }

        updateUrl(pid, businessName, false, businessSlug, false, productSlug);

        // --- OPTIMISTIC OPEN (High Speed Optimization) ---
        // We open the modal IMMEDIATELY using the basic product data we already have in the list.
        // This ensures the hardware-accelerated animation starts the moment the user taps.
        const optimisticProduct = products.find(p => p.product_id === (pid || productId));
        if (optimisticProduct) {
            const initialPayload = mapProductToPreviewPayload(optimisticProduct, formatUrl);
            setSelectedProductPayload(initialPayload);
            setModalOpen(true);
        }

        try {
            setFetchingProductId(identifier);
            const res = await fetchProductById(identifier, token);
            if (res?.data?.product) {
                const dbProduct = res.data.product;
                const mappedPayload = mapProductToPreviewPayload(dbProduct, formatUrl);

                // If top-level quantity exists in inventory fallback
                const baseInv = (dbProduct.inventory || []).find((inv: any) => !inv.sku_id && !inv.variant_option_id);
                if (baseInv && mappedPayload) mappedPayload.quantity = baseInv.quantity;

                // Update the state with full data (re-renders the already open modal)
                setSelectedProductPayload(mappedPayload);

                // Ensure modal is open if it wasn't already (e.g. product not found in local list)
                if (!modalOpen) setModalOpen(true);

                // Log view IMMEDIATELY
                logUserActivity({
                    product_id: dbProduct.product_id,
                    action_type: 'view',
                    category: dbProduct.category,
                    business_id: dbProduct.business_id
                }, token).catch(() => { });

                // Update URL with slug (clean URL)
                updateUrl(dbProduct.product_id, dbProduct.business_name, false, dbProduct.business_slug, false, dbProduct.slug || dbProduct.product_slug);
            }
        } catch (err: any) {
            console.error("Critical handleProductClick failed:", {
                message: err?.message || "Unknown error",
                status: err?.status,
                body: err?.body,
                identifier,
                rawError: err,
            });
        } finally {
            setFetchingProductId(null);
        }
    }, [fetchingProductId, formatUrl, updateUrl, token, products]);

    const handleReelsClick = React.useCallback(async (productId: number | string, businessName?: string, e?: React.MouseEvent, businessSlug?: string, productSlug?: string) => {
        handleProductClick(productId, businessName, e, businessSlug, false, productSlug);
    }, [handleProductClick]);

    // Handle deep linking from URL and Browser Back/Forward buttons
    useEffect(() => {
        const handleRouteChange = () => {
            const params = new URLSearchParams(window.location.search);
            const isReels = params.get("reels") === "true";
            const currentPath = window.location.pathname;
            const pathParts = currentPath.split('/').filter(Boolean);
            // URL shape: /{base}/{bizSlug}/{productSlug}
            const currentSlug = pathParts.length >= 3 ? pathParts[2] : (pathParts.length === 2 ? pathParts[1] : null);

            if (currentSlug) {
                const alreadyOpenProduct = modalOpen && selectedProductPayload?.slug === currentSlug;
                const alreadyOpenSocial = socialPostModalOpen && (selectedSocialPost?.product_slug === currentSlug || selectedSocialPost?.slug === currentSlug);

                if (isReels) {
                    if (alreadyOpenSocial) {
                        if (modalOpen) setModalOpen(false);
                        return;
                    }
                    if (!fetchingProductId) {
                        const post = products.find(p => p.is_social_post && p.product_slug === currentSlug);
                        if (post) {
                            setSelectedSocialPost(post);
                            setSocialPostModalOpen(true);
                        } else {
                            handleProductClick("", undefined, undefined, undefined, false, currentSlug);
                        }
                    }
                } else {
                    if (alreadyOpenProduct) {
                        if (socialPostModalOpen) setSocialPostModalOpen(false);
                        return;
                    }
                    if (!fetchingProductId) {
                        handleProductClick("", undefined, undefined, undefined, false, currentSlug);
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
                if (socialPostModalOpen) {
                    setSocialPostModalOpen(false);
                    setSelectedSocialPost(null);
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
            <section className={`min-h-screen transition-colors duration-500 pb-10 ${activeCategory === "PARTNERS" ? "bg-[#f0fdf4]" : "bg-slate-50"}`}>
                {!hideTabs && (
                    <div className={`sticky transition-all duration-500 ${isScrolled ? "top-0 z-[2500] " : "top-[64px] z-20"} ${activeCategory === "PARTNERS" ? "bg-[#f0fdf4]" : "bg-white"}`}>
                        <div ref={tabsRef} className="flex px-4 py-2.5 gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                            {CATEGORIES.map((item) => (
                                <button
                                    key={item}
                                    data-active={activeCategory === item}
                                    onClick={() => setActiveCategory(item)}
                                    className={`whitespace-nowrap relative rounded-full px-3 py-1.5 text-sm transition-all ${activeCategory === "PARTNERS"
                                        ? item === "PARTNERS"
                                            ? "text-emerald-600 font-bold italic tracking-tighter"
                                            : activeCategory === item
                                                ? "text-white bg-emerald-600 font-bold italic shadow-md shadow-emerald-100"
                                                : "hover:bg-emerald-100 text-emerald-700"
                                        : item === "PARTNERS"
                                            ? "text-emerald-600 font-bold italic tracking-tighter"
                                            : activeCategory === item
                                                ? "text-rose-500 font-bold monospace italic"
                                                : "hover:bg-slate-200 text-slate-600"
                                        }`}
                                >
                                    {item === "PARTNERS" && activeCategory === "PARTNERS" && (
                                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white text-rose-500 text-[7px] font-bold border-[0.5px] border-rose-500 px-1.5 rounded-full z-10  tracking-tighter shadow-sm py-0.5">Verified</span>
                                    )}
                                    {item}
                                </button>
                            ))}
                        </div>

                        {/* Actionable Orders Marquee - hide when scrolled to reduce height */}
                        {!isScrolled && actionableData && (actionableData.vendorPendingCount > 0 || actionableData.customerDeliveredCount > 0 || actionableData.customerOutForDeliveryCount > 0) && (
                            <div
                                className={`w-full py-1.5 overflow-hidden group cursor-pointer ${actionableData.vendorPendingCount > 0
                                    ? "bg-orange-50 border-orange-100"
                                    : "bg-blue-50 border-blue-100"
                                    }`}
                                onClick={() => {
                                    if (actionableData.vendorPendingCount > 0) {
                                        router.push("/profile/business/customer-order");
                                    } else {
                                        router.push("/profile/orders");
                                    }
                                }}
                            >
                                <div className="flex animate-marquee-market whitespace-nowrap">
                                    <div className="flex items-center gap-12 px-4">
                                        {actionableData.vendorPendingCount > 0 ? (
                                            <>
                                                <span className="text-[10px] font-bold text-orange-700  tracking-wider flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                                    ⚠️ You have ({actionableData.vendorPendingCount}) new {actionableData.vendorPendingCount === 1 ? 'order' : 'orders'} waiting to be shipped! Please process them as soon as possible to maintain your vendor rating. Click here to view and ship orders.
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                {actionableData.customerOutForDeliveryCount > 0 && (
                                                    <span className="text-[10px] font-bold text-blue-700 tracking-wider flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                        📦 You have ({actionableData.customerOutForDeliveryCount}) {actionableData.customerOutForDeliveryCount === 1 ? 'order' : 'orders'} out for delivery! Please share the delivery code with the vendor or rider if the product has delivered to you.
                                                    </span>
                                                )}
                                                {actionableData.customerDeliveredCount > 0 && (
                                                    <span className="text-[10px] font-bold text-blue-700 tracking-wider flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                        📦 You have ({actionableData.customerDeliveredCount}) {actionableData.customerDeliveredCount === 1 ? 'order' : 'orders'} delivered! Please click here to confirm receipt and release payment.
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-12 px-4">
                                        {actionableData.vendorPendingCount > 0 ? (
                                            <span className="text-[10px] font-bold text-orange-700 tracking-wider flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                                ⚠️ You have ({actionableData.vendorPendingCount}) new {actionableData.vendorPendingCount === 1 ? 'order' : 'orders'} waiting to be shipped! Please process them as soon as possible.
                                            </span>
                                        ) : (
                                            <>
                                                {actionableData.customerOutForDeliveryCount > 0 && (
                                                    <span className="text-[10px] font-bold text-blue-700 tracking-wider flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                        📦 You have ({actionableData.customerOutForDeliveryCount}) {actionableData.customerOutForDeliveryCount === 1 ? 'order' : 'orders'} out for delivery! Please share the delivery code with the vendor or rider if the product has delivered to you.
                                                    </span>
                                                )}
                                                {actionableData.customerDeliveredCount > 0 && (
                                                    <span className="text-[10px] font-bold text-blue-700 tracking-wider flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                        📦 You have ({actionableData.customerDeliveredCount}) {actionableData.customerDeliveredCount === 1 ? 'order' : 'orders'} delivered! Please click here to confirm receipt and release payment.
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <AnimatePresence>
                    {showManualLoading && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="flex justify-center items-center py-6 bg-slate-50 overflow-hidden"
                        >
                            <div className="flex items-center gap-2 px-6 py-3 rounded-full  border-slate-100">
                                <svg className="w-4 h-4 text-slate-900 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
                                </svg>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {loading ? (
                    <div className="p-2 sm:p-4"><ShimmerGrid count={10} /></div>
                ) : error ? (
                    <div className="py-12 flex flex-col items-center justify-center text-sm text-rose-500">
                        <div className="w-32 h-32 rounded-full flex items-center justify-center">
                            <img src="/assets/images/message-icon.png" alt="" />
                        </div>
                        <p className="mb-3 font-bold">{error}</p>
                        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition">
                            Retry
                        </button>
                    </div>
                ) : (
                    <div className="px-1">
                        {filteredProducts.length > 0 ? (
                            <MasonryGrid
                                items={filteredProducts}
                                likeData={likeData}
                                postLikeData={postLikeData}
                                fetchingProductId={fetchingProductId}
                                handleProductClick={handleProductClick}
                                handleReelsClick={handleReelsClick}
                                handleLikeClick={handleLikeClick}
                                handlePostLikeClick={handlePostLikeClick}
                                handlePrefetch={handlePrefetch}
                                formatUrl={formatUrl}
                                router={router}
                                isRestored={isRestoring}
                                isPartnerTab={activeCategory === "PARTNERS"}
                            />
                        ) : (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                <div className="w-20 h-20 opacity-20 mb-4">
                                    <ShoppingCart className="w-full h-full" />
                                </div>
                                <p className="text-sm font-medium">No results found in this category</p>
                                <button
                                    onClick={() => setActiveCategory("For you")}
                                    className="mt-4 text-xs font-bold text-rose-500 hover:underline"
                                >
                                    View all products
                                </button>
                            </div>
                        )}
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

            {/* Floating Action Buttons */}
            <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-3">
                {/* Scroll to Top */}
                <AnimatePresence>
                    {showScrollTop && (
                        <motion.button
                            initial={{ opacity: 0, y: 20, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.8 }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={scrollToTop}
                            className="w-12 h-12 bg-white text-slate-900 rounded-full shadow-2xl flex items-center justify-center border border-slate-100 hover:bg-slate-50 transition-colors"
                            title="Back to Top"
                        >
                            <ArrowUp className="w-5 h-5" />
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* Shopping Cart Button */}
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => router.push('/cart')}
                    className="w-12 h-12 bg-white text-slate-900 rounded-full shadow-2xl flex items-center justify-center border border-slate-100 hover:bg-slate-50 transition-colors"
                    title="View Cart"
                >
                    <ShoppingCart className="w-5 h-5" />
                </motion.button>
            </div>

            {/* Render ProductPreviewModal directly! Reusing your existing component but with real mapping. */}
            <AnimatePresence>
                {
                    modalOpen && selectedProductPayload && (
                        <ProductPreviewModal
                            key="market-product-preview-modal"
                            open={modalOpen}
                            payload={selectedProductPayload}
                            origin={clickPos}
                            isFetching={fetchingProductId !== null}
                            onClose={() => {
                                setModalOpen(false);
                                setSelectedProductPayload(null);
                                updateUrl(null, undefined, false, undefined, false, undefined, true);
                            }}
                            onProductClick={handleProductClick}
                            onReelsClick={handleReelsClick}
                        />
                    )
                }
            </AnimatePresence>

            <AnimatePresence>
                {socialPostModalOpen && selectedSocialPost && (
                    <PostModal
                        open={socialPostModalOpen}
                        post={selectedSocialPost}
                        onClose={() => {
                            setSocialPostModalOpen(false);
                            setSelectedSocialPost(null);
                            updateUrl(null, undefined, false, undefined, false, undefined, true);
                        }}
                        onToggleLike={() => { }}
                        userToken={token}
                        isProductLinkedOnly={true}
                        onActivePostChange={(p) => {
                            // Sync URL when swiping in mobile reels
                            // Handle both mapped grid items and raw background-fetched reels
                            const lp = p.linked_product || (p.is_social_post ? {} : p);
                            const prodSlug = p.product_slug || lp.slug || lp.product_slug || (lp.title ? slugify(lp.title) : null);
                            const bizSlug = p.business_slug || lp.business_slug || p.user?.business_slug;
                            const bizName = p.business_name || lp.business_name || p.user?.name;

                            // We use replace: true here so swipe history doesn't grow
                            updateUrl(p.product_id || `post-${p.id}`, bizName, true, bizSlug, true, prodSlug, true);
                        }}
                    />
                )}
            </AnimatePresence>

            <ReelsModal
                open={reelsModalOpen}
                initialProductId={selectedProductId}
                origin={clickPos}
                onClose={() => {
                    setReelsModalOpen(false);
                    setSelectedProductId(null);
                    // Instead of null, restore the preview ID if it exists
                    updateUrl(selectedProductPayload?.productId || null);
                }}
                onActiveProductChange={(pid, bizName, bizSlug) => {
                    setSelectedProductId(pid);
                    const params = new URLSearchParams(window.location.search);
                    params.set("reels", "true");
                    params.set("product_id", String(pid));
                    const search = params.toString();

                    let path = window.location.pathname;
                    const slug = bizSlug || (bizName ? slugify(bizName) : null);
                    if (slug) {
                        path = `/market/${slug}`;
                    }

                    const currentUrl = `${path}${search ? `?${search}` : ""}`;
                    window.history.replaceState(window.history.state, "", currentUrl);
                }}
            />

            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

            {/* --- WARMING INSTANCE (Zero-Delay Optimization) --- 
                We render a hidden instance of the modal once the page has products.
                This ensures React parses the component, initializes hooks, and prepares 
                the animation engine BEFORE the user ever clicks.
            */}
            {isHydrated && products.length > 0 && !modalOpen && (
                <div className="hidden pointer-events-none" aria-hidden="true">
                    <ProductPreviewModal
                        open={false}
                        payload={null}
                        onClose={() => { }}
                    />
                </div>
            )}

            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes marquee-market {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-33.33%); }
                }
                .animate-marquee-market {
                    display: flex;
                    animation: marquee-market 30s linear infinite;
                }
                .group:hover .animate-marquee-market {
                    animation-play-state: paused;
                }
                header.fixed.top-0.is-partners {
                    background-color: #f0fdf4 !important; /* light emerald matching bg */
                    color: #059669 !important;
                    box-shadow: 0 4px 12px rgba(5, 150, 105, 0.05) !important;
                    transition: background-color 0.4s ease, color 0.4s ease;
                }
                header.fixed.top-0.is-partners span, 
                header.fixed.top-0.is-partners a,
                header.fixed.top-0.is-partners p,
                header.fixed.top-0.is-partners svg,
                header.fixed.top-0.is-partners h1 {
                    color: #059669 !important;
                }
                header.fixed.top-0.is-partners input {
                    background-color: white !important;
                    color: #059669 !important;
                    border-color: #d1fae5 !important;
                }
                header.fixed.top-0.is-partners input::placeholder {
                    color: #6ee7b7 !important;
                }
            `}</style>
        </>
    );
}
