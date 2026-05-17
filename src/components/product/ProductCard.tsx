"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { FaHeart, FaRegHeart, FaPlay } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/src/context/authContext";
import { logUserActivity } from "@/src/lib/api/productApi";
import { VerifiedBadge, PartnerPill } from "@/src/components/common/VerifiedBadge";
import { LikeBurst } from "./LikeBurst";
import CachedImage from "@/src/components/common/CachedImage";

const slugify = (str: string) =>
    String(str || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

const LIMIT = 10;

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
    const { token } = useAuth();

    useEffect(() => {
        if (!p.product_id || p.isIntro || viewedRef.current) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !viewedRef.current) {
                viewedRef.current = true;
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
                className="rounded-[0.5rem] bg-transparent border border-emerald-50 p-4 shadow-sm shadow-emerald-100/40 flex flex-col justify-between h-full group relative overflow-hidden"
            >
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
        transition: (isRestored ? { duration: 0 } : {
            duration: 0.4,
            delay: isRestored ? 0 : Math.min((index % LIMIT) * 0.05, 0.4),
            ease: "easeOut"
        }) as any
    };

    if (p.is_social_post) {
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
                    const pSlug = p.slug || p.product_slug;
                    const bizSlug = p.business_slug || (p.business_name ? slugify(p.business_name) : 'shop');
                    if (pSlug) router.prefetch(`/market/${bizSlug}/${pSlug}`);
                    if (p.business_slug) router.prefetch(`/shop/${p.business_slug}`);
                    handlePrefetch && handlePrefetch(p.product_id, pSlug);
                }}
                className="group flex flex-col rounded-[0.5rem] bg-white cursor-pointer transition-colors border border-slate-100 overflow-hidden relative"
            >
                <div className="relative w-full overflow-hidden bg-slate-100">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl font-black text-slate-300 opacity-40 select-none">stoqle</span>
                    </div>
                    <CachedImage
                        src={formatUrl(p.first_image)}
                        className="w-full h-auto min-h-[180px] max-h-[300px] sm:min-h-[200px] sm:max-h-[350px] object-cover block transition-transform duration-700 group-hover:scale-105 relative z-[1]"
                        alt={p.title}
                    />
                    {p.isVideo && (
                        <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md text-white text-[9px] font-black px-1.5 py-1.5 rounded-full z-10 flex items-center">
                            <FaPlay size={7} className="text-white fill-current" />
                        </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                </div>

                <div className="p-2">
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
                                <AnimatePresence mode="wait">
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
                const pSlug = p.slug || p.product_slug;
                const bizSlug = p.business_slug || (p.business_name ? slugify(p.business_name) : 'shop');
                if (pSlug) router.prefetch(`/market/${bizSlug}/${pSlug}`);
                if (p.business_slug) router.prefetch(`/shop/${p.business_slug}`);
                handlePrefetch && handlePrefetch(p.product_id, pSlug);
            }}
            className={`group flex flex-col rounded-[0.5rem] bg-white cursor-pointer transition-colors border overflow-hidden ${isPartnerTab ? "border-emerald-100 shadow-sm shadow-emerald-50/50" : "border-slate-100"}`}
        >
            <div className="relative w-full overflow-hidden bg-slate-100">
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-black text-slate-300 opacity-40 select-none">stoqle</span>
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
                            className="w-full h-auto min-h-[180px] max-h-[300px] sm:min-h-[200px] sm:max-h-[350px] object-cover block transition-transform duration-700 group-hover:scale-105 relative z-[1]"
                        />
                    ) : (
                        <div className="w-full">
                            <CachedImage
                                src={formatUrl(p.first_image)}
                                alt={p.title}
                                className="w-full h-auto min-h-[180px] max-h-[300px] sm:min-h-[200px] sm:max-h-[350px] object-cover block transition-transform duration-700 group-hover:scale-105 relative z-[1]"
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
                                    <span className={`text-[10px] font-bold ${Number(p.total_quantity) <= 0 ? 'text-rose-500' : 'text-rose-500'} truncate`}>
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
                                    <span className={`text-[10px] font-bold ${Number(p.total_quantity) <= 0 ? 'text-rose-500' : 'text-rose-500'} truncate`}>
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
    return prevProps.p.product_id === nextProps.p.product_id &&
        prevProps.isLiked === nextProps.isLiked &&
        prevProps.likeCount === nextProps.likeCount &&
        prevProps.fetchingProduct === nextProps.fetchingProduct;
});

ProductCard.displayName = "ProductCard";

export default ProductCard;
