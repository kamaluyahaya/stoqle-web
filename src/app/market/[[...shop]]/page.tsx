"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import LoginModal from "@/src/components/modal/auth/loginModal";
import ShimmerGrid from "@/src/components/shimmer";
import { fetchMarketFeed, fetchProductById, toggleProductLike, logUserActivity } from "@/src/lib/api/productApi";
import { fetchLinkedProductPosts } from "@/src/lib/api/social";
import PostModal from "@/src/components/modal/postModal";
import { FaHeart, FaRegHeart, FaPlay, FaImage } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import ReelsModal from "@/src/components/product/addProduct/modal/reelsModal";
import type { PreviewPayload, ProductSku, ProductFeedItem } from "@/src/types/product";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import { fetchBusinessCategories, fetchTrendingProducts, fetchPersonalizedFeed } from "@/src/lib/api/productApi";
import { API_BASE_URL } from "@/src/lib/config";
import { MARKET_CACHE } from "@/src/lib/cache";
import { fetchActionableSummary } from "@/src/lib/api/orderApi";
import { ArrowUp, ShoppingCart } from "lucide-react";

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
    isLiked,
    likeCount,
    fetchingProduct,
    router,
    isRestored = false,
    isPartnerTab = false
}: any) => {
    const [showBurst, setShowBurst] = useState(false);

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
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="rounded-[0.8rem] bg-white border border-emerald-50 p-4 shadow-sm shadow-emerald-100/40 flex flex-col justify-between h-full group relative overflow-hidden"
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
                    <a
                        href="/partners"
                        className="text-[10px] font-bold text-emerald-600   flex items-center justify-between group/link"
                    >
                        Learn what makes a partner
                        <span className="text-sm group-hover/link:translate-x-1 transition-transform ml-1">→</span>
                    </a>
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
        return (
            <motion.article
                initial={entryVariants.initial}
                animate={entryVariants.animate}
                transition={entryVariants.transition}
                onClick={(e) => handleProductClick(p.product_id, p.business_name, e, p.business_slug, true)}
                className="group flex flex-col rounded-[0.5rem] bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden relative"
            >
                <div className="relative w-full aspect-[4/5] overflow-hidden bg-slate-100">
                    <img 
                        src={formatUrl(p.first_image)} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        loading="lazy"
                        alt={p.title}
                    />
                    <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md text-white text-[9px] font-black px-2 py-1 rounded-full z-10 tracking-widest shadow-sm border border-white/10 flex items-center gap-1.5">
                        {p.isVideo ? (
                            <>
                                <FaPlay size={7} className="text-white fill-current" />
                                <span>VIDEO</span>
                            </>
                        ) : (
                            <>
                                <FaImage size={7} className="text-white fill-current" />
                                <span>POST</span>
                            </>
                        )}
                    </div>

                    {/* Gradient Overlay for Author */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                </div>
                <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
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
                    <h3 className="text-sm text-slate-800 line-clamp-2 leading-tight font-medium mb-1" title={p.title}>{p.title}</h3>
                    <div className="flex items-center justify-between mt-auto">
                        <div className="text-sm font-black text-slate-900">₦{Number(p.price || 0).toLocaleString()}</div>
                        <div className="flex items-center gap-1 opacity-40">
                             <FaHeart size={10} />
                             <span className="text-[10px] font-bold">{p.likes_count || 0}</span>
                        </div>
                    </div>
                </div>
            </motion.article>
        );
    }

    return (
        <article
            key={`${p.product_id}${isVideoCover ? '-vid' : ''}`}
            onClick={(e) => {
                if (isVideoCover) {
                    handleReelsClick(p.product_id, p.business_name, e, p.business_slug);
                } else {
                    handleProductClick(p.product_id, p.business_name, e, p.business_slug);
                }
            }}
            className={`group flex flex-col rounded-[0.5rem] bg-white cursor-pointer transition-all border overflow-hidden ${isPartnerTab ? "border-emerald-100 shadow-sm shadow-emerald-50/50" : "border-slate-100"}`}
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
                            <div className="flex flex-col pr-1">
                                <span className="text-slate-900 text-sm font-bold tracking-tight">₦{Number(p.price || 0).toLocaleString()}</span>
                                {activeDiscount > 0 && (
                                    <span className="text-[9px] text-slate-400 line-through font-medium leading-none">
                                        ₦{Math.round(Number(p.price) / (1 - activeDiscount / 100)).toLocaleString()}
                                    </span>
                                )}
                            </div>
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

                                    {/* Pulse effect */}
                                    {isLiked && (
                                        <motion.div
                                            initial={{ scale: 1, opacity: 1 }}
                                            animate={{ scale: [1, 1.8, 1], opacity: [1, 0.4, 0] }}
                                            transition={{ duration: 0.6 }}
                                            className="absolute text-red-500 pointer-events-none"
                                        >
                                            <FaHeart size={14} />
                                        </motion.div>
                                    )}
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
                                            <svg className="w-3 h-3 text-emerald-700" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <h3 className="text-sm text-slate-800 line-clamp-2 leading-snug mb-1" title={p.title}>
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
                                <span className="text-[10px] font-medium text-rose-500 border-red-500 border-[0.5px] px-1  truncate">
                                    {p.promo_title} {p.promo_discount}% Off
                                </span>
                            ) : p.sale_type ? (
                                <span className="text-[10px]  text-rose-500 border-red-500 border-[0.5] px-1  truncate">
                                    {p.sale_type} {p.sale_discount}% Off
                                </span>
                            ) : (p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) <= 4) ? (
                                <span className="text-[10px] font-bold text-rose-500   truncate">
                                    Only {Number(p.total_quantity)} left
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

                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                            <span className="text-slate-900 text-base">₦{Number(p.price || 0).toLocaleString()}</span>
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

const MasonryGrid = ({ items, likeData, fetchingProductId, handleProductClick, handleReelsClick, handleLikeClick, formatUrl, router, isRestored, isPartnerTab }: any) => {
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
                            const ld = likeData[p.product_id] || { liked: !!p.isLiked, count: p.likes_count || 0 };
                            return (
                                <ProductCard
                                    key={`${p.product_id}-${p.originalIndex}`}
                                    index={p.originalIndex}
                                    isVideoCover={!!p.product_video}
                                    p={p}
                                    formatUrl={formatUrl}
                                    handleProductClick={(id: number | string, b: string, e: any, s: string, isSocial: boolean) => handleProductClick(id, b, e, s, isSocial)}
                                    handleReelsClick={(id: number, b: string, e: any, s: string) => handleReelsClick(id, b, e, s)}
                                    handleLikeClick={handleLikeClick}
                                    isLiked={ld.liked}
                                    likeCount={ld.count}
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



export default function MarketPage({ params, postCount = 100 }: Props) {
    const routeParams = React.use(params);
    const [activeCategory, setActiveCategory] = useState<string>(MARKET_CACHE.category);
    const [products, setProducts] = useState<any[]>(MARKET_CACHE.products);
    const [loading, setLoading] = useState<boolean>(MARKET_CACHE.products.length === 0);
    const [isRestoring, setIsRestoring] = useState<boolean>(MARKET_CACHE.products.length > 0);
    const [error, setError] = useState<string | null>(null);
    const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

    const [selectedSocialPost, setSelectedSocialPost] = useState<any | null>(null);
    const [socialPostModalOpen, setSocialPostModalOpen] = useState(false);    const [modalOpen, setModalOpen] = useState(false);
    const [reelsModalOpen, setReelsModalOpen] = useState(false);
    const [fetchingProductId, setFetchingProductId] = useState<number | null>(null);
    const [clickPos, setClickPos] = useState({ x: 0, y: 0 });

    // --- Pagination State ---
    const [page, setPage] = useState(MARKET_CACHE.page);
    const [hasMore, setHasMore] = useState(MARKET_CACHE.hasMore);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loaderRef = useRef<HTMLDivElement>(null);
    const tabsRef = useRef<HTMLDivElement>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [showManualLoading, setShowManualLoading] = useState(false);
    const LIMIT = 10;

    const router = useRouter();
    const searchParams = useSearchParams();
    const auth = useAuth();
    const { user, token, isHydrated } = auth;
    const [showLoginModal, setShowLoginModal] = useState(false);

    // --- Actionable Orders State ---
    const [actionableData, setActionableData] = useState<{ vendorPendingCount: number, customerDeliveredCount: number } | null>(null);
    const [fetchedCategories, setFetchedCategories] = useState<string[]>(MARKET_CACHE.categories);
    const [isScrolled, setIsScrolled] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 10) {
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
        // 1. Try Memory Cache
        if (MARKET_CACHE.categories.length > 0) {
            setFetchedCategories(MARKET_CACHE.categories);
            return;
        }

        // 2. Try LocalStorage Cache (Persists across refreshes)
        const cached = localStorage.getItem("stoqle_business_categories");
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const filtered = (parsed || []).filter((c: any) => c !== "Trending");
                if (filtered.length > 0) {
                    setFetchedCategories(filtered);
                    MARKET_CACHE.categories = filtered;
                }
            } catch (err) {
                console.error("Failed to parse cached categories", err);
            }
        }

        // 3. Fetch from Database
        fetchBusinessCategories()
            .then(res => {
                if (res?.status === "success" || res?.success || res?.ok) {
                    const data = res.data || res;
                    const cats = data.map((c: any) => c.name);
                    const finalCats = ["For you", "PARTNERS", ...cats];

                    setFetchedCategories(finalCats);
                    MARKET_CACHE.categories = finalCats;
                    localStorage.setItem("stoqle_business_categories", JSON.stringify(finalCats));
                }
            })
            .catch(console.error);
    }, []);

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
                logUserActivity({ product_id: productId, action_type: 'like' }, token!);
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

    // We could fetch actual categories or just have common ones
    const CATEGORIES = useMemo(
        () => fetchedCategories.length > 0 ? fetchedCategories : ["For you", "PARTNERS"],
        [fetchedCategories]
    );


    const fetchPage = async (pageNum: number) => {
        if (!hasMore || isLoadingMore) return;

        setIsLoadingMore(true);
        if (pageNum === 0) setLoading(true);

        try {
            let nextProducts: ProductFeedItem[] = [];
            let nextPosts: any[] = [];

            if (activeCategory === "PARTNERS") {
                const res = await fetchPersonalizedFeed(LIMIT, pageNum * LIMIT, token, null, true);
                nextProducts = res?.data || [];
            } else {
                const bizCat = activeCategory === "For you" ? null : activeCategory;
                const res = await fetchPersonalizedFeed(LIMIT, pageNum * LIMIT, token, bizCat);
                nextProducts = res?.data || [];
                
                // Fetch social posts with linked products
                if (activeCategory === "For you" || activeCategory === "PARTNERS") {
                    try {
                        const posts = await fetchLinkedProductPosts({ limit: 5, offset: pageNum * 5, token: token! });
                        nextPosts = posts;
                    } catch (e) {
                        console.error("Failed to fetch linked social posts", e);
                    }
                }
            }

            // If this was an authenticated fetch, mark the cache as personalized
            if (pageNum === 0) {
                MARKET_CACHE.personalized = !!token;
            }

            // Update likeData based on all fetched products
            const nextLikeData: Record<number, { liked: boolean, count: number }> = {};
            nextProducts.forEach((p) => {
                nextLikeData[p.product_id] = { liked: !!p.isLiked, count: p.likes_count || 0 };
            });
            setLikeData(prev => ({ ...prev, ...nextLikeData }));

            setProducts(prev => {
                const mappedProducts = nextProducts.map((p: any, i: number) => {
                    const media = p.media || [];
                    const imgs = media.filter((m: any) => m.type === "image");
                    const coverRef = p.first_image || p.image_url;

                    // Robust cover detection: check is_cover flag OR matching URL
                    const foundCover = imgs.find((m: any) =>
                        m.is_cover === 1 || (coverRef && m.url && m.url.includes(coverRef))
                    ) || imgs[0];

                    return {
                        ...p,
                        originalIndex: (pageNum === 0 ? 0 : prev.length) + i,
                        // Priority: Explicit cover -> product first_image -> first media image -> empty
                        first_image: foundCover?.url || coverRef || (media[0]?.type === 'image' ? media[0].url : "") || "",
                        product_video: p.product_video || media.find((m: any) => m.type === 'video')?.url || "",
                    };
                });

                const mappedSocialPosts = nextPosts.map((p: any, i: number) => ({
                    ...p,
                    product_id: `post-${p.id}`,
                    is_social_post: true,
                    title: p.caption || p.linked_product?.title || "Social Post",
                    first_image: p.thumbnail || p.src, // Use cover image if available
                    price: p.linked_product?.price || 0,
                    business_name: p.user.name,
                    logo: p.user.avatar,
                    originalIndex: (pageNum === 0 ? 0 : prev.length) + mappedProducts.length + i,
                }));

                // Interleave social posts instead of appending
                let combined: any[] = [];
                const socialStep = Math.max(3, Math.ceil(mappedProducts.length / (mappedSocialPosts.length || 1)));
                let socialIdx = 0;

                mappedProducts.forEach((prod, i) => {
                    combined.push(prod);
                    if (i > 0 && i % socialStep === 0 && socialIdx < mappedSocialPosts.length) {
                        combined.push(mappedSocialPosts[socialIdx++]);
                    }
                });
                // Add remaining social posts if any
                while (socialIdx < mappedSocialPosts.length) {
                    combined.push(mappedSocialPosts[socialIdx++]);
                }

                const existingIds = new Set(prev.map(p => p.product_id));
                const unique = combined.filter((p) => !existingIds.has(p.product_id));
                const finalProducts = pageNum === 0 ? combined : [...prev, ...unique];

                // Update cache
                MARKET_CACHE.products = finalProducts;
                MARKET_CACHE.page = pageNum + 1;
                MARKET_CACHE.hasMore = nextProducts.length >= LIMIT;
                MARKET_CACHE.likeData = { ...likeData, ...nextLikeData };

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

        // If we have cached products for the right category...
        if (MARKET_CACHE.products.length > 0 && MARKET_CACHE.category === activeCategory) {
            // ...but we just got a token and the cache isn't personalized, we MUST re-fetch
            const needsPersonalization = token && !MARKET_CACHE.personalized && activeCategory !== "Trending";

            if (!needsPersonalization) {
                setLoading(false);
                return;
            }
        }

        // Only clear if category actually changed and it's not the restored state
        if (MARKET_CACHE.category !== activeCategory) {
            MARKET_CACHE.products = [];
            MARKET_CACHE.page = 0;
            MARKET_CACHE.hasMore = true;
            MARKET_CACHE.category = activeCategory;
        }

        setPage(0);
        setHasMore(true);
        setProducts([]);
        fetchPage(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHydrated, token, activeCategory, refreshKey]);

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

    const formatUrl = React.useCallback((url: string) => {
        if (!url) return "https://via.placeholder.com/800x600?text=No+Image";
        let formatted = url;
        if (!url.startsWith("http")) {
            formatted = url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
        }
        return encodeURI(formatted);
    }, []);

    const updateUrl = (productId: number | string | null, businessName?: string, isReels: boolean = false, businessSlug?: string, isSocialPost: boolean = false) => {
        const params = new URLSearchParams(window.location.search);

        if (productId) {
            params.set("product_id", String(productId));
            if (isReels) {
                params.set("reels", "true");
            } else {
                params.delete("reels");
            }
            const slug = businessSlug || (businessName ? slugify(businessName) : (routeParams?.shop?.[0] || "product"));
            const search = params.toString();
            const newUrl = `/market/${slug}${search ? `?${search}` : ""}`;

            if (newUrl !== window.location.pathname + window.location.search) {
                window.history.pushState(window.history.state, "", newUrl);
            }
        } else {
            params.delete("product_id");
            params.delete("reels");
            const search = params.toString();
            // If we are deep in a shop path, let's keep it or go back to /market
            const newUrl = `/market${search ? `?${search}` : ""}`;

            if (newUrl !== window.location.pathname + window.location.search) {
                window.history.pushState(window.history.state, "", newUrl);
            }
        }
    };

    const handleProductClick = React.useCallback(async (productId: number | string, businessName?: string, e?: React.MouseEvent, businessSlug?: string, isSocialPost: boolean = false) => {
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
                setSelectedSocialPost(post);
                setSocialPostModalOpen(true);
            }
            return;
        }

        const pid = typeof productId === 'string' ? Number(productId.replace('post-', '')) : productId;

        updateUrl(pid, businessName, false, businessSlug);
        try {
            setFetchingProductId(pid);
            const res = await fetchProductById(pid, token);
            if (res?.data?.product) {
                const dbProduct = res.data.product;
                const mappedPayload = mapProductToPreviewPayload(dbProduct, formatUrl);

                // If top-level quantity exists in inventory fallback
                const baseInv = (dbProduct.inventory || []).find((inv: any) => !inv.sku_id && !inv.variant_option_id);
                if (baseInv && mappedPayload) mappedPayload.quantity = baseInv.quantity;

                setSelectedProductPayload(mappedPayload);
                setModalOpen(true);
                logUserActivity({ product_id: pid, action_type: 'view', category: dbProduct.category }, token);

                // If on initial load we didn't have the business name, update URL now
                if (dbProduct.business_name || dbProduct.business_slug) {
                    updateUrl(pid, dbProduct.business_name, false, dbProduct.business_slug);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setFetchingProductId(null);
        }
    }, [fetchingProductId, formatUrl, updateUrl, token, products]);

    const handleReelsClick = React.useCallback(async (productId: number, businessName?: string, e?: React.MouseEvent, businessSlug?: string) => {
        handleProductClick(productId, businessName, e, businessSlug);
    }, [handleProductClick]);

    // Handle deep linking from URL and Browser Back/Forward buttons
    useEffect(() => {
        const handleRouteChange = () => {
            const params = new URLSearchParams(window.location.search);
            const productId = params.get("product_id");

            if (productId) {
                const pid = Number(productId);
                const isReels = params.get("reels") === "true";

                if (isReels) {
                    if (!reelsModalOpen) {
                        setSelectedProductId(pid);
                        setReelsModalOpen(true);
                    }
                } else {
                    if (!modalOpen && !fetchingProductId && selectedProductPayload?.productId !== pid) {
                        handleProductClick(pid);
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

        // Listen for browser back/forward
        window.addEventListener('popstate', handleRouteChange);

        // Initial check
        handleRouteChange();

        return () => window.removeEventListener('popstate', handleRouteChange);
    }, [modalOpen, fetchingProductId, selectedProductPayload, handleProductClick]);

    return (
        <>
            <section className={`min-h-screen transition-colors duration-500 pb-10 ${activeCategory === "PARTNERS" ? "bg-[#f0fdf4]" : "bg-slate-50"}`}>
                <div className={`sticky transition-all duration-300 ${isScrolled ? "top-0 z-[1100] translate-y-0" : "top-16 z-20"} ${activeCategory === "PARTNERS" ? "bg-[#f0fdf4]" : "bg-white"}`}>
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
                                            ? "text-red-500 font-bold monospace italic"
                                            : "hover:bg-slate-200 text-slate-600"
                                    }`}
                            >
                                {item === "PARTNERS" && activeCategory === "PARTNERS" && (
                                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white text-red-500 text-[7px] font-bold border-[0.5px] border-red-500 px-1.5 rounded-full z-10  tracking-tighter shadow-sm py-0.5">Verified</span>
                                )}
                                {item}
                            </button>
                        ))}
                    </div>

                    {/* Actionable Orders Marquee - hide when scrolled to reduce height */}
                    {!isScrolled && actionableData && (actionableData.vendorPendingCount > 0 || actionableData.customerDeliveredCount > 0) && (
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
                                            <span className="text-[10px] font-bold text-orange-700  tracking-wider flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                                ⚠️ You have ({actionableData.vendorPendingCount}) new {actionableData.vendorPendingCount === 1 ? 'order' : 'orders'} waiting to be shipped! Please process them as soon as possible to maintain your vendor rating. Click here to view and ship orders.
                                            </span>
                                            <span className="text-[10px] font-bold text-orange-700  tracking-wider flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                                ⚠️ You have ({actionableData.vendorPendingCount}) new {actionableData.vendorPendingCount === 1 ? 'order' : 'orders'} waiting to be shipped! Please process them as soon as possible to maintain your vendor rating. Click here to view and ship orders.
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-[10px] font-bold text-blue-700 tracking-wider flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                📦 You have ({actionableData.customerDeliveredCount}) {actionableData.customerDeliveredCount === 1 ? 'order' : 'orders'} delivered! Please click here to confirm receipt and release payment.
                                            </span>
                                            <span className="text-[10px] font-bold text-blue-700  tracking-wider flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                📦 You have ({actionableData.customerDeliveredCount}) {actionableData.customerDeliveredCount === 1 ? 'order' : 'orders'} delivered! Please click here to confirm receipt and release payment.
                                            </span>
                                            <span className="text-[10px] font-bold text-blue-700  tracking-wider flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                📦 You have ({actionableData.customerDeliveredCount}) {actionableData.customerDeliveredCount === 1 ? 'order' : 'orders'} delivered! Please click here to confirm receipt and release payment.
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}
                </div>

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
                        <p className="mb-3 font-bold">{error}</p>
                        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition">
                            Retry
                        </button>
                    </div>
                ) : (
                    <div className="p-2 sm:p-4 ">
                        <MasonryGrid
                            items={filteredProducts}
                            likeData={likeData}
                            fetchingProductId={fetchingProductId}
                            handleProductClick={handleProductClick}
                            handleReelsClick={handleReelsClick}
                            handleLikeClick={handleLikeClick}
                            formatUrl={formatUrl}
                            router={router}
                            isRestored={isRestoring}
                            isPartnerTab={activeCategory === "PARTNERS"}
                        />
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
                            onClose={() => {
                                setModalOpen(false);
                                setSelectedProductPayload(null);
                                updateUrl(null);
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
                        }}
                        onToggleLike={() => {}}
                        userToken={token}
                        isProductLinkedOnly={true}
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
