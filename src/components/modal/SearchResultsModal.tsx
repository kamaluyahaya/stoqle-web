"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { getNextZIndex } from "@/src/lib/utils/z-index";
import {
  ChevronLeftIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  MapPinIcon,
  UserGroupIcon,
  ShoppingBagIcon,
  CheckBadgeIcon,
  StarIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ShoppingCartIcon
} from "@heroicons/react/24/outline";
import { FaHeart, FaRegHeart, FaComment } from "react-icons/fa";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { fetchUnifiedSearch } from "@/src/lib/api/searchApi";
import { useAuth } from "@/src/context/authContext";
import PostModal from "./postModal";
import LoginModal from "./auth/loginModal";
import { fetchSocialPostById, fetchSecurePostUrl } from "@/src/lib/api/social";
import { Post, User } from "@/src/lib/types";
import ReelsModal from "@/src/components/product/addProduct/modal/reelsModal";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import { fetchProductById, toggleProductLike, logUserActivity } from "@/src/lib/api/productApi";
import type { PreviewPayload } from "@/src/types/product";
import { API_BASE_URL } from "@/src/lib/config";
import { fetchCartApi } from "@/src/lib/api/cartApi";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import { computeDiscountedPrice } from "@/src/lib/utils/product/price";
import { formatDuration } from "@/src/lib/utils/product/duration";

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

const PostCard = React.memo(({
  post,
  index = 0,
  openPostWithUrl,
  toggleLike,
  user,
  setShowLoginModal,
  router,
  getNoteStyles,
  isRestorose = false
}: any) => {
  const [showBurst, setShowBurst] = useState(false);

  // Animation variants
  const entryVariants = {
    initial: isRestorose ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.95, y: 15 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: isRestorose ? { duration: 0 } : {
      duration: 0.9,
      delay: Math.min(index * 0.1, 1.2),
      ease: [0.21, 1.11, 0.81, 0.99] as any
    }
  };

  return (
    <article
      onClick={(e) => openPostWithUrl(post, e)}
      className="group flex flex-col rounded-[0.5rem] bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden"
      style={{
        willChange: "transform, opacity",
        contentVisibility: "auto",
        containIntrinsicSize: "auto 400px"
      }}
    >
      <div className="relative w-full aspect-[4/5] bg-slate-100 overflow-hidden post-media">
        <motion.div
          initial={entryVariants.initial}
          animate={entryVariants.animate}
          className="absolute inset-0 w-full h-full"
        >
          {post.isVideo && (
            <div className="absolute top-3 right-3 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-black/50">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white ml-0.5">
                <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" />
              </svg>
            </div>
          )}

          {post.coverType === "note" && !post.src ? (
            <div
              className="w-full h-full flex items-center justify-center p-6 relative overflow-hidden"
              style={getNoteStyles(post.noteConfig)}
            >
              {(() => {
                const cfg = typeof post.noteConfig === "string" ? JSON.parse(post.noteConfig) : post.noteConfig;
                if (cfg?.emojis?.length > 0) {
                  return (
                    <div className="absolute inset-0 flex items-center justify-around opacity-30 pointer-events-none" style={{ filter: cfg.emojiBlur ? "blur(4px)" : "none" }}>
                      {cfg.emojis.slice(0, 3).map((emoji: string, idx: number) => (
                        <span key={idx} className="text-4xl transform rotate-12">
                          {emoji}
                        </span>
                      ))}
                    </div>
                  );
                }
                return null;
              })()}
              <div className="text-center relative z-10">
                <p className="line-clamp-4 px-2" style={{ color: "inherit", fontSize: "inherit", fontWeight: "inherit" }}>
                  {post.noteConfig?.text ?? post.caption ?? "Note"}
                </p>
              </div>
            </div>
          ) : post.isVideo ? (
            <img
              src={post.thumbnail || post.src}
              alt={post.caption || "Video thumbnail"}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              onError={(e) => { (e.target as any).src = 'https://via.placeholder.com/800x1200?text=Video+Thumbnail' }}
            />
          ) : (
            <div className="absolute inset-0 w-full h-full">
              <style jsx global>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
            `}</style>
              <Image
                src={post.src ? encodeURI(post.src) : "https://via.placeholder.com/800x600?text=No+Image"}
                alt={post.caption || "Post image"}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                className="object-cover transition-all duration-700 group-hover:scale-110"
                onLoadingComplete={(img) => {
                  img.style.animation = "fadeIn 0.6s ease-in-out forwards";
                }}
                style={{ opacity: 0 }}
              />
            </div>
          )}
        </motion.div>

        {/* Placeholder frame indicator */}
        <div className="absolute inset-0 -z-10 flex items-center justify-center bg-slate-50/50">
          <div className="flex flex-col items-center gap-2 opacity-20">
            <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
            <span className="text-[10px] font-bold tracking-widest text-slate-400 ">Opening...</span>
          </div>
        </div>
      </div>

      <div className="p-3">
        <p className="text-sm text-slate-800 line-clamp-2 leading-snug font-semibold mb-3">
          {post.coverType === "note" && !post.src ? post.note_caption : post.caption}
        </p>

        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              if (!user) { setShowLoginModal(true); return; }
              const handle = post.author_handle || post.user.username;
              router.push(handle ? `/${handle}` : `/user/profile/${post.user.id}`);
            }}
          >
            <div className="h-5 w-5 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
              <Image src={encodeURI(post.user.avatar)} fill sizes="20px" className="object-cover" alt={post.user.name} />
            </div>
            <span className="truncate text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors max-w-[120px] capitalize">
              {post.user.name}
            </span>
          </div>

          <div
            className="flex items-center gap-1 cursor-pointer relative"
            onClick={(e) => {
              e.stopPropagation();
              if (!post.liked) {
                setShowBurst(true);
                setTimeout(() => setShowBurst(false), 800);
              }
              toggleLike(post.id);
            }}
          >
            {showBurst && <LikeBurst />}
            <div className="relative w-4 h-4 flex items-center justify-center">
              <AnimatePresence>
                <motion.div
                  key={post.liked ? "liked" : "unliked"}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  className={`absolute inset-0 flex items-center justify-center ${post.liked ? 'text-rose-500' : 'text-slate-400'}`}
                >
                  {post.liked ? <FaHeart className="text-sm" /> : <FaRegHeart className="text-sm" />}
                </motion.div>
              </AnimatePresence>
              {post.liked && (
                <motion.div
                  initial={{ scale: 1, opacity: 1 }}
                  animate={{ scale: [1, 1.8, 1], opacity: [1, 0.4, 0] }}
                  transition={{ duration: 0.6 }}
                  className="absolute text-rose-500 pointer-events-none"
                >
                  <FaHeart size={14} />
                </motion.div>
              )}
            </div>
            <span className={`text-xs font-bold ${post.liked ? "text-rose-500" : "text-slate-400"}`}>{post.likeCount}</span>
          </div>
        </div>
      </div>
    </article>
  );
}, (prev, next) => {
  return prev.post.id === next.post.id && prev.post.liked === next.post.liked && prev.post.likeCount === next.post.likeCount;
});
PostCard.displayName = "PostCard";

const MasonryGrid = ({ items, openPostWithUrl, toggleLike, user, setShowLoginModal, router, getNoteStyles, isRestorose }: any) => {
  const [columns, setColumns] = useState(2);

  useEffect(() => {
    const updateColumns = () => {
      const w = window.innerWidth;
      if (w < 900) setColumns(2);
      else if (w < 1000) setColumns(3);
      else if (w < 1450) setColumns(4);
      else if (w < 1630) setColumns(5);
      else setColumns(6);
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
      {columnData.map((colItems: any[], colIdx: number) => {
        const visibilityClass = "flex-1 flex flex-col gap-2 sm:gap-6 min-w-0";

        return (
          <div key={colIdx} className={visibilityClass}>
            {colItems.map((post: any, itemIdx: number) => (
              <PostCard
                key={post.id}
                post={post}
                index={post.originalIndex ?? itemIdx}
                openPostWithUrl={openPostWithUrl}
                toggleLike={toggleLike}
                user={user}
                setShowLoginModal={setShowLoginModal}
                router={router}
                getNoteStyles={getNoteStyles}
                isRestorose={isRestorose}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

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
  onClose,
  isRestorose = false,
  isPartnerTab = false
}: any) => {
  const [showBurst, setShowBurst] = useState(false);

  const promoInfo = useMemo(() => {
    // 1. Promotions (Occasional) - Match previewModal.tsx logic
    const promotions = p.promotions_data || [];
    const activePromo = Array.isArray(promotions)
      ? promotions.find((pr: any) => {
        const start = pr.start_date || pr.start;
        const end = pr.end_date || pr.end;
        const isStarted = !start || new Date(start) <= new Date();
        const isEnded = end && new Date(end) < new Date();
        return isStarted && !isEnded && (pr.discount_percent || pr.discount) > 0;
      })
      : null;

    if (activePromo) {
      return {
        title: activePromo.title || activePromo.name || activePromo.occasion || "Promotion",
        discount: activePromo.discount_percent || activePromo.discount
      };
    }

    // 2. Sales Discount - Match previewModal.tsx logic
    const sale = p.sale_discount_data;
    if (sale && (sale.discount_percent || sale.discount_percentage || sale.discount) > 0) {
      return {
        title: sale.title || sale.name || sale.discount_type || sale.type || "Sale",
        discount: sale.discount_percent || sale.discount_percentage || sale.discount
      };
    }

    // 3. Legacy flat fields (fallback)
    if (p.promo_title && p.promo_discount && (!p.promo_end || new Date(p.promo_end) >= new Date())) {
      return { title: p.promo_title, discount: p.promo_discount };
    }

    return null;
  }, [p.promo_title, p.promo_discount, p.promo_end, p.promotions_data, p.sale_discount_data]);

  const isPromoActive = !!promoInfo;
  const discountedPrice = computeDiscountedPrice(p.price, promoInfo?.discount);

  const entryVariants = {
    initial: isRestorose ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.95, y: 15 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: isRestorose ? { duration: 0 } : {
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
          handleReelsClick(p.product_id, p.business_name, e);
        } else {
          handleProductClick(p.product_id, p.business_name, e);
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
              className="w-full min-h-[180px] sm:min-h-[200px] max-h-[300px] sm:max-h-[350px] object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="relative w-full h-auto">
              <img
                src={formatUrl(p.first_image)}
                alt={p.title || "Product"}
                className="w-full min-h-[180px] sm:min-h-[200px] max-h-[300px] sm:max-h-[350px] object-cover transition-opacity duration-700 opacity-0 group-hover:scale-110 transform transition-transform"
                loading="lazy"
                onLoad={(e) => {
                  (e.target as any).classList.remove('opacity-0');
                  (e.target as any).classList.add('opacity-100');
                }}
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

        <div className="absolute inset-0 -z-10 flex items-center justify-center bg-slate-50/50">
          <div className="flex flex-col items-center gap-2 opacity-20">
            <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
            <span className="text-[10px] font-bold tracking-widest text-slate-400 ">Opening...</span>
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-center justify-between pt-1 border-slate-50">
          <div
            className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              const bizIdentifier = p.business_slug;
              if (bizIdentifier) {
                router.push(`/shop/${bizIdentifier}`);
              }
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
                  <svg className="w-3 h-3 text-emerald-700" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
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

        {((p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) > 0 && Number(p.total_quantity) <= 4) ||
          promoInfo ||
          (p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) === 0) ||
          p.return_shipping_subsidy === 1 ||
          p.seven_day_no_reason_return === 1 ||
          p.market_name) && (
            <div className="flex items-center min-h-[16px]">
              {(p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) > 0 && Number(p.total_quantity) <= 4) ? (
                <span className="text-[10px] font-bold text-rose-500 tracking-widest truncate">
                  Only {Number(p.total_quantity)} left
                </span>
              ) : promoInfo ? (
                <span className="text-[10px] font-medium text-rose-500 border-rose-500 border-[0.5px] px-1 truncate">
                  {promoInfo.title} {promoInfo.discount}% Off
                </span>
              ) : (p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) === 0) ? (
                <span className="text-[10px] font-bold text-slate-400 tracking-widest truncate">
                  Out of Stock
                </span>
              ) : p.seven_day_no_reason_return === 1 ? (
                <span className="text-[10px] font-bold text-emerald-600 tracking-widest truncate">
                  7 Days No Reason Return
                </span>
              ) : p.return_shipping_subsidy === 1 ? (
                <span className="text-[10px] font-bold text-green-700 tracking-widest truncate">
                  Return Shipping Subsidy
                </span>
              ) : p.market_name ? (
                <span className="text-[10px] font-bold text-slate-400 tracking-widest truncate ">
                  {p.market_name}
                </span>
              ) : null}
            </div>
          )}

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {isPromoActive && discountedPrice !== null ? (
              <div className="flex flex-col">
                <span className="text-rose-500 text-base font-black">₦{Number(discountedPrice).toLocaleString()}</span>
                <span className="text-slate-400 text-[10px] line-through decoration-rose-500/50">₦{Number(p.price || 0).toLocaleString()}</span>
              </div>
            ) : (
              <span className="text-slate-900 text-base font-black">₦{Number(p.price || 0).toLocaleString()}</span>
            )}
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
              <AnimatePresence mode="wait">
                <motion.div
                  key={isLiked ? "liked" : "unliked"}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  className={`absolute inset-0 flex items-center justify-center ${isLiked ? 'text-rose-500' : 'text-slate-400'}`}
                >
                  {isLiked ? <FaHeart className="text-sm" /> : <FaRegHeart className="text-sm" />}
                </motion.div>
              </AnimatePresence>
            </div>
            <span className="text-xs font-semibold text-slate-600 ml-0.5">{likeCount}</span>
          </div>
        </div>
      </div>
    </article>
  );
}, (prevProps, nextProps) => {
  return prevProps.p.id === nextProps.p.id &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.likeCount === nextProps.likeCount &&
    prevProps.fetchingProduct === nextProps.fetchingProduct;
});
ProductCard.displayName = "ProductCard";

const ProductMasonryGrid = ({ items, likeData, fetchingProductId, handleProductClick, handleReelsClick, handleLikeClick, formatUrl, router, onClose, isRestorose }: any) => {
  const [columns, setColumns] = useState(2);

  useEffect(() => {
    const updateColumns = () => {
      const w = window.innerWidth;
      if (w < 700) setColumns(2);
      else if (w < 1210) setColumns(3);
      else if (w < 1430) setColumns(4);
      else if (w < 1630) setColumns(5);
      else setColumns(6);
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
      {columnData.map((colItems: any[], colIdx: number) => {
        const visibilityClass = "flex-1 flex flex-col gap-2 sm:gap-6 min-w-0";
        return (
          <div key={colIdx} className={visibilityClass}>
            {colItems.map((p: any) => {
              const ld = likeData[p.product_id] || { liked: !!p.isLiked, count: p.likes_count || 0 };
              return (
                <ProductCard
                  key={`${p.product_id}-${p.index}`}
                  index={p.index}
                  p={p}
                  isVideoCover={!!p.product_video}
                  formatUrl={formatUrl}
                  handleProductClick={handleProductClick}
                  handleReelsClick={handleReelsClick}
                  handleLikeClick={handleLikeClick}
                  isLiked={ld.liked}
                  likeCount={ld.count}
                  fetchingProduct={fetchingProductId === p.product_id}
                  router={router}
                  onClose={onClose}
                  isRestorose={isRestorose}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
};


const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;

interface SearchResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchClick?: () => void;
  initialQuery: string;
  initialTab?: TabType;
  isPage?: boolean;
}

type TabType = "all" | "users" | "products" | "posts" | "location";
type ProductSubTab = "featurose" | "shop" | "best-seller" | "price-low" | "price-high";

export default function SearchResultsModal({ isOpen, onClose, onSearchClick, initialQuery, initialTab, isPage = false }: SearchResultsModalProps) {
  const { token, user } = useAuth();
  const pathname = usePathname();
  const [originPath, setOriginPath] = useState<string | null>(null);
  const [modalZIndex, setModalZIndex] = useState(() => getNextZIndex());
  useEffect(() => {
    if (isOpen) {
      setModalZIndex(getNextZIndex());
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (!originPath) setOriginPath(pathname);
    } else {
      setOriginPath(null);
    }
  }, [isOpen, pathname, originPath]);

  const isNavigationTarget = pathname !== originPath && (pathname?.startsWith('/shop') || pathname?.startsWith('/cart'));
  const shouldHideModal = isOpen && originPath !== null && isNavigationTarget;

  const [productLikeData, setProductLikeData] = useState<Record<number, { liked: boolean, count: number }>>({});
  const [fetchingProductId, setFetchingProductId] = useState<number | string | null>(null);
  const [reelsModalOpen, setReelsModalOpen] = useState(false);
  const [productPreviewOpen, setProductPreviewOpen] = useState(false);
  const [cartCount, setCartCount] = useState<number>(0);

  const fetchCartCount = useCallback(async () => {
    if (!token) {
      setCartCount(0);
      return;
    }
    try {
      const res = await fetchCartApi(token);
      if (res?.data?.cart_items) {
        setCartCount(res.data.cart_items.length);
      }
    } catch (err) {
      console.error("fetchCartCount error", err);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      fetchCartCount();
    }
  }, [isOpen, fetchCartCount]);

  useEffect(() => {
    const handleCartUpdate = () => fetchCartCount();
    window.addEventListener("cart-updated", handleCartUpdate);
    return () => window.removeEventListener("cart-updated", handleCartUpdate);
  }, [fetchCartCount]);

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
    if (isPage) return;
    if (!isOpen || shouldHideModal) return;

    const wasAlreadyLocked = document.body.classList.contains("overflow-hidden") ||
      window.getComputedStyle(document.body).overflow === "hidden";

    if (!wasAlreadyLocked) {
      document.body.classList.add("overflow-hidden");
    }

    return () => {
      if (!wasAlreadyLocked) {
        document.body.classList.remove("overflow-hidden");
      }
    };
  }, [isOpen, shouldHideModal, isPage]);

  const formatFullUrl = useCallback((url: string | undefined): string => {
    if (!url) return "";
    if (url.startsWith('http')) {
      return url.replace('http://10.233.107.181:4000', API_BASE_URL);
    }
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${API_BASE_URL}${cleanUrl}`;
  }, []);

  const formatProductUrl = useCallback((url: string) => {
    if (!url) return "https://via.placeholder.com/800x600?text=No+Image";
    let final = url;
    if (!url.startsWith('http')) {
      final = url.startsWith('/public') ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    } else if (final.includes('10.233.107.181:4000')) {
      final = final.replace('http://10.233.107.181:4000', API_BASE_URL);
    }
    return encodeURI(final);
  }, []);

  const mapUnifiedSearchProductToProduct = (p: any, index: number): any => ({
    ...p,
    product_id: p.id || p.product_id,
    title: p.name || p.title,
    first_image: p.image || p.thumbnail || p.first_image,
    product_video: p.product_video,
    business_name: p.business_name || p.shop_name || p.vendor_name || p.business_owner_name,
    business_logo: p.business_logo || p.logo || p.vendor_logo || p.shop_logo,
    business_slug: p.business_slug || p.slug || p.shop_slug,
    logo: p.business_logo || p.logo || p.vendor_logo || p.shop_logo,
    profile_pic: p.profile_pic || p.avatar || p.user_image || p.author_image,
    total_quantity: p.total_quantity ?? p.quantity ?? p.stock ?? 0,
    isLiked: p.is_liked === 1 || p.is_liked === true,
    likes_count: p.likes_count || 0,
    promotions_data: p.promotions_data ? (typeof p.promotions_data === 'string' ? JSON.parse(p.promotions_data) : p.promotions_data) : null,
    sale_discount_data: p.sale_discount_data ? (typeof p.sale_discount_data === 'string' ? JSON.parse(p.sale_discount_data) : p.sale_discount_data) : null,
    index
  });

  const handleProductClick = useCallback(async (productId: number | string, businessName?: string, e?: any, businessSlug?: string, isSocialPost?: boolean, productSlug?: string) => {
    if (e) e.stopPropagation();
    if (fetchingProductId) return;

    // Favor productSlug (identifier) if provided
    const isNumeric = typeof productId === 'number' || (typeof productId === 'string' && /^\d+$/.test(productId));
    const pid = isNumeric ? Number(productId) : null;
    const identifier = productSlug || (isNumeric ? pid : productId);

    if (!identifier) return;

    try {
      setFetchingProductId(identifier);
      const res = await fetchProductById(identifier, token || undefined);
      if (res?.data?.product) {
        const dbProduct = res.data.product;
        const mappedPayload = mapProductToPreviewPayload(dbProduct, formatProductUrl);

        // If fetchProductById didn't return business details, we can try to fill from the search result if they exist
        if (!mappedPayload.businessLogo && dbProduct.business_logo) mappedPayload.businessLogo = dbProduct.business_logo;
        if (!mappedPayload.vendorAvatar && (dbProduct.profile_pic || dbProduct.logo)) mappedPayload.vendorAvatar = dbProduct.profile_pic || dbProduct.logo;

        setSelectedProductData(mappedPayload);
        setProductPreviewOpen(true);
      }
    } catch (err) {
      console.error("fetchProductById error", err);
    } finally {
      setFetchingProductId(null);
    }
  }, [token, fetchingProductId, formatProductUrl]);

  const handleReelsClick = useCallback((productId: number | string, businessName?: string, e?: any, businessSlug?: string, isSocialPost?: boolean, productSlug?: string) => {
    handleProductClick(productId, businessName, e, businessSlug, isSocialPost, productSlug);
  }, [handleProductClick]);

  const handleProductLike = async (e: React.MouseEvent, productId: number, baseCount: number) => {
    e.stopPropagation();
    if (!token) {
      setShowLoginModal(true);
      return;
    }

    const current = productLikeData[productId] || { liked: false, count: baseCount };
    const newLiked = !current.liked;
    const newCount = newLiked ? current.count + 1 : Math.max(0, current.count - 1);

    setProductLikeData(prev => ({ ...prev, [productId]: { liked: newLiked, count: newCount } }));

    try {
      const { toggleProductLike } = await import("@/src/lib/api/productApi");
      const res = await toggleProductLike(productId, token);
      if (res?.success) {
        setProductLikeData(prev => ({
          ...prev,
          [productId]: { liked: !!res.data.liked, count: res.data.likes_count }
        }));
      }
    } catch (err) {
      setProductLikeData(prev => ({ ...prev, [productId]: current }));
    }
  };
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [productSubTab, setProductSubTab] = useState<ProductSubTab>("featurose");

  // SWR Caching Logic
  const { data: swrData, error: swrError, isLoading: swrLoading, isValidating, mutate } = useSWR(
    isOpen && query.trim().length > 0 ? ["/api/search", query.trim(), activeTab, productSubTab, token] : null,
    ([_, q, t, s, tok]) => fetchUnifiedSearch(q, 20, tok, t, s),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute cache
      shouldRetryOnError: false,
      keepPreviousData: true, // Crucial for instant UI on back navigation
    }
  );

  const results = swrData?.data || null;
  const isLoading = swrLoading && !results; // Only show shimmer if we have literally nothing
  const isUpdating = isValidating && !!results; // Background update taking place

  const [selectedProductData, setSelectedProductData] = useState<PreviewPayload | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const router = useRouter();
  const pushedRef = useRef(false);

  // Log User Activity (Search)
  useEffect(() => {
    // If we want to log search, we might need a different API or update logUserActivity
    // For now, logging search as a generic view or just skipping if unsupported
    if (isOpen && query.trim().length > 2 && token && (activeTab === 'products' || activeTab === 'all')) {
      // logUserActivity({ action_type: 'view', category: activeTab }, token);
    }
  }, [isOpen, query, activeTab, token]);

  const mapUnifiedSearchPostToPost = (p: any): any => {
    const isVideo = p.cover_type === 'video' || (p.image && VIDEO_EXT_RE.test(p.image)) || !!p.final_video_url || !!p.original_video_url;
    const finalVideoUrl = formatFullUrl(p.final_video_url || p.original_video_url);

    // Media URL mapping
    const finalSrc = isVideo ? (finalVideoUrl || formatFullUrl(p.image)) : formatFullUrl(p.image);

    // Author image URL mapping
    const avatarUrl = formatFullUrl(p.logo || p.business_logo || p.vendor_logo || p.shop_logo || p.author_image || p.profile_pic || p.avatar || p.author_pic);

    return {
      id: p.id,
      apiId: p.id,
      src: finalSrc,
      thumbnail: formatFullUrl(p.image),
      final_video_url: finalVideoUrl,
      isVideo,
      caption: p.text || p.subtitle || "",
      note_caption: p.subtitle || "",
      user: {
        id: p.author_id,
        name: p.author_name,
        username: p.author_handle,
        avatar: avatarUrl || `https://ui-avatars.com/api/?name=${p.author_name}`,
      },
      author_handle: p.author_handle,
      liked: Boolean(p.liked_by_me),
      likeCount: p.like_count || 0,
      coverType: p.cover_type,
      noteConfig: p.config,
      rawCreatedAt: p.created_at,
      location: p.location,
      is_product_linked: Boolean(p.is_product_linked),
      linked_product: p.linked_product,
    };
  };

  const openPostWithUrl = async (post: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPost(post);
    try {
      const urlData = await fetchSecurePostUrl(post.id, "search_feed", token);
      if (urlData) {
        if (urlData.url) {
          window.history.pushState({ modal: true }, "", urlData.url);
          // Only update properties that don't break playback (like tokens if needed)
          // But don't overwrite src with a page URL!
          setSelectedPost((prev: any) => prev ? {
            ...prev,
            xsecToken: urlData.xsec_token,
            xsecSource: urlData.xsec_source
          } : null);
        } else {
          const url = new URL(window.location.href);
          url.searchParams.set("post", String(post.id));
          window.history.pushState({ modal: true }, "", url.toString());
        }
      }
      pushedRef.current = true;
    } catch (err) {
      console.warn("fetchSecurePostUrl failed", err);
      pushedRef.current = false;
    }
  };

  const closeModal = () => {
    setSelectedPost(null);
    try {
      const url = new URL(window.location.href);
      const hadParam = url.searchParams.has("post");
      if (!hadParam) return;
      if (pushedRef.current && window.history.state && window.history.state.modal) {
        window.history.back();
        pushedRef.current = false;
        return;
      }
      url.searchParams.delete("post");
      window.history.replaceState({}, "", url.toString());
      pushedRef.current = false;
    } catch (err) {
      console.warn("Failed to clean URL after modal close", err);
    }
  };

  const toggleLike = (postId: string | number) => {
    mutate((prev: any) => {
      if (!prev || !prev.data || !prev.data.posts) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          posts: prev.data.posts.map((p: any) => {
            if (p.id === postId) {
              return {
                ...p,
                like_count: (p.like_count || 0) + 1,
                liked_by_me: true
              };
            }
            return p;
          })
        }
      };
    }, false);
  };

  // Sync local state to URL/Props changes
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setActiveTab(initialTab || "all");
    }
  }, [isOpen, initialTab, initialQuery]);

  useEffect(() => {
    const onPop = (ev: PopStateEvent) => {
      try {
        const url = new URL(window.location.href);
        const param = url.searchParams.get("post");
        if (param) {
          const postId = Number(param);
          if (isNaN(postId)) return;
          if (selectedPost && Number(selectedPost.id) === postId) return;
          if (results?.posts) {
            const found = results.posts.find((p: any) => Number(p.id) === postId);
            if (found) {
              setSelectedPost(mapUnifiedSearchPostToPost(found));
              return;
            }
          }
          fetchSocialPostById(postId).then(p => setSelectedPost(p)).catch(() => { });
        } else {
          setSelectedPost(null);
        }
      } catch { }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [results, selectedPost]);

  const renderProductItem = (p: any) => (
    <div key={p.id} className="flex gap-4 p-4 bg-white border-b border-slate-50 active:bg-slate-50 transition-colors">
      <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden border border-slate-100 flex-shrink-0">
        {p.image ? (
          <img
            src={formatFullUrl(p.image)}
            alt={p.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ShoppingBagIcon className="w-8 h-8" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h4 className="text-[14px] font-bold text-slate-900 truncate">{p.name}</h4>
        <p className="text-[12px] text-slate-500 line-clamp-1 mt-0.5">{p.description}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[14px] font-black text-rose-600">₦{p.price?.toLocaleString()}</span>
          {p.sold_count > 0 && (
            <span className="text-[10px] font-bold text-slate-400">{p.sold_count} sold</span>
          )}
        </div>
      </div>
    </div>
  );

  const renderShopItem = (s: any) => (
    <div key={s.id} className="p-4 bg-white border-b border-slate-50">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => {
            if (s.business_slug) router.push(`/shop/${s.business_slug}`);
          }}
        >
          <div className="w-12 h-12 rounded-full border border-slate-100 overflow-hidden flex-shrink-0">
            <img
              src={formatFullUrl(s.business_logo || s.logo || s.image || s.profile_pic)}
              alt={s.name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as any).src = 'https://ui-avatars.com/api/?name=' + s.name }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h4 className="text-[14px] font-bold text-slate-900 truncate">{s.name}</h4>
              {!!s.is_partner && <CheckBadgeIcon className="w-4 h-4 text-emerald-500" />}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {Number(s.items_sold || 0).toLocaleString()} items sold • {Number(s.followers || 0).toLocaleString()} followers
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (s.business_slug) router.push(`/shop/${s.business_slug}`);
          }}
          className="px-4 py-1 bg-white text-rose-500 border-[0.5px] text-[11px] font-black rounded-full tracking-tighter shadow-sm hover:bg-rose-700 transition-colors"
        >
          Shop
        </button>
      </div>

      {/* Row of matching products (Responsive: 3 mobile, 4 md, 5 lg) */}
      {s.related_products && s.related_products.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mt-2">
          {s.related_products.slice(0, 5).map((p: any, idx: number) => (
            <div
              key={p.product_id}
              onClick={(e) => handleProductClick(p.product_id, s.name, e)}
              className={`relative aspect-square rounded-lg overflow-hidden border border-slate-100 bg-slate-50 group cursor-pointer ${idx === 3 ? "hidden md:block" : idx === 4 ? "hidden lg:block" : "block"
                }`}
            >
              <img
                src={formatFullUrl(p.image)}
                alt={p.title}
                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                onError={(e) => { (e.target as any).src = '/assets/images/placeholder.png' }}
              />
              <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
              <div className="absolute bottom-1.5 left-0 right-0 py-0.5 flex items-center justify-center z-10">
                <span className="text-[10px] font-black text-white tracking-wider drop-shadow-sm">
                  ₦{Number(p.price || 0).toLocaleString()}
                </span>
                {(p.total_quantity === 0 || p.quantity === 0 || p.stock === 0) && (
                  <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm text-white text-[8px] font-black px-1 rounded-sm  tracking-tighter">
                    Out
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const getNoteStyles = (config: any) => {
    if (!config) return { background: "#f1f5f9" as string };
    let cfg = config;
    if (typeof config === "string") {
      try {
        cfg = JSON.parse(config);
      } catch (e) {
        return { background: "#f1f5f9" as string };
      }
    }
    const { template, startColor, endColor, lineSpacing = 25 } = cfg;
    const baseBg = endColor ? `linear-gradient(135deg, ${startColor}, ${endColor})` : startColor;
    let patternCSS = "";
    let bgSize = "auto";
    if (template === "grid") {
      patternCSS = `linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)`;
      bgSize = `${lineSpacing}px ${lineSpacing}px`;
    } else if (template === "diagonal") {
      patternCSS = `repeating-linear-gradient(45deg, transparent, transparent ${lineSpacing}px, rgba(255,255,255,0.2) ${lineSpacing}px, rgba(255,255,255,0.2) ${lineSpacing * 2}px)`;
    } else if (template === "stripes") {
      patternCSS = `repeating-linear-gradient(0deg, transparent, transparent ${lineSpacing}px, rgba(0,0,0,0.03) ${lineSpacing}px, rgba(0,0,0,0.03) ${lineSpacing + 1}px)`;
    } else if (template === "dots") {
      patternCSS = `radial-gradient(rgba(0,0,0,0.1) 1.5px, transparent 0)`;
      bgSize = `${lineSpacing}px ${lineSpacing}px`;
    }
    return {
      backgroundColor: startColor,
      backgroundImage: patternCSS ? `${patternCSS}, ${baseBg}` : baseBg,
      backgroundSize: bgSize,
      color: cfg.textStyle?.color ?? "#111827",
      fontSize: `${(cfg.textStyle?.fontSize ?? 28) * 0.45}px`,
      fontWeight: cfg.textStyle?.fontWeight ?? "800",
    } as React.CSSProperties;
  };



  const renderTabContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Fetching best results...</p>
        </div>
      );
    }

    if (!results) {
      return (
        <div className="flex flex-col items-center justify-center h-80 px-10 text-center text-slate-400">
          <img src="/assets/images/search-icon.png" alt="" className="w-16 h-16 mb-4 opacity-20 grayscale" />
          <p className="text-[13px]">No results found. Try a different keyword</p>
        </div>
      );
    }

    switch (activeTab) {
      case "all":
        return (
          <div className="divide-y divide-slate-50">
            {results.products?.length > 0 && (
              <section className="bg-white">
                <div className="px-5 py-3 bg-slate-50/50 flex items-center justify-between">
                  <h6 className="text-[10px] font-black  tracking-widest text-slate-600">Products</h6>
                  <button onClick={() => setActiveTab('products')} className="text-[10px] font-bold text-rose-600">See All</button>
                </div>
                <div className="p-3">
                  <ProductMasonryGrid
                    items={results.products.slice(0, 6).map((p: any, i: number) => mapUnifiedSearchProductToProduct(p, i))}
                    likeData={productLikeData}
                    fetchingProductId={fetchingProductId}
                    handleProductClick={handleProductClick}
                    handleReelsClick={handleReelsClick}
                    handleLikeClick={handleProductLike}
                    formatUrl={formatProductUrl}
                    router={router}
                    onClose={onClose}
                    isRestorose={false}
                  />
                </div>
              </section>
            )}
            {results.shops?.length > 0 && (
              <section className="bg-white border-t-8 border-slate-50">
                <div className="px-5 py-3 bg-slate-50/50 flex items-center justify-between">
                  <h6 className="text-[10px] font-black  tracking-widest text-slate-600">Shops & Businesses</h6>
                  <button onClick={() => {
                    setActiveTab('products');
                    setProductSubTab('shop');
                  }} className="text-[10px] font-bold text-rose-600">See All</button>
                </div>
                {results.shops.slice(0, 3).map(renderShopItem)}
              </section>
            )}
            {results.users?.length > 0 && (
              <section className="bg-white border-t-8 border-slate-50">
                <div className="px-5 py-3 bg-slate-50/50 flex items-center justify-between">
                  <h6 className="text-[10px] font-black  tracking-widest text-slate-600">People</h6>
                  <button onClick={() => setActiveTab('users')} className="text-[10px] font-bold text-rose-600">See All</button>
                </div>
                <div className="divide-y divide-slate-50">
                  {results.users.slice(0, 3).map((u: any) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 p-4 min-w-0 cursor-pointer active:bg-slate-50 transition-colors"
                      onClick={() => {
                        const profilePath = (user?.id === u.id || user?.user_id === u.id)
                          ? "/profile"
                          : (u.username ? `/${u.username}` : `/user/profile/${u.id}`);
                        router.push(profilePath);
                      }}
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                        <img src={u.image ? formatFullUrl(u.image) : 'https://ui-avatars.com/api/?name=' + u.name} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-slate-900 truncate">{u.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">@{u.username || 'user'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {results.posts?.length > 0 && (
              <section className="bg-white border-t-8 border-slate-50">
                <div className="px-5 py-3 bg-slate-50/50 flex items-center justify-between">
                  <h6 className="text-[10px] font-black  tracking-widest text-slate-600">Social Feed</h6>
                  <button onClick={() => setActiveTab('posts')} className="text-[10px] font-bold text-rose-600">See All</button>
                </div>
                <div className="p-3 bg-slate-50/20">
                  <MasonryGrid
                    items={results.posts.slice(0, 6).map(mapUnifiedSearchPostToPost)}
                    openPostWithUrl={openPostWithUrl}
                    toggleLike={toggleLike}
                    user={user}
                    setShowLoginModal={setShowLoginModal}
                    router={router}
                    getNoteStyles={getNoteStyles}
                    isRestorose={false}
                  />
                </div>
              </section>
            )}
            {results.total === 0 && (
              <div className="flex flex-col items-center justify-center h-80 px-10 text-center">
                <div className="w-24 h-24 mb-6 flex items-center justify-center">
                  <img
                    src="/assets/images/search-icon.png"
                    alt="No matches"
                    className="w-full h-full object-contain opacity-50 grayscale-[0.3]"
                  />
                </div>
                <img src="/assets/images/search-icon.png" alt="" className="w-16 h-16 mb-4 opacity-20 grayscale" />
                <p className="text-[13px] text-slate-500 mt-1">Try refining your search for "{query}"</p>
              </div>
            )}
          </div>
        );

      case "users":
        return (
          <div className="divide-y divide-slate-50 bg-white min-h-full">
            {results.users?.length > 0 ? results.users.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between p-4 bg-white active:bg-slate-50 transition-colors gap-3">
                <div
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => {
                    const profilePath = (user?.id === u.id || user?.user_id === u.id)
                      ? "/profile"
                      : (u.username ? `/${u.username}` : `/user/profile/${u.id}`);
                    router.push(profilePath);
                  }}
                >
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-50 flex-shrink-0">
                    <img src={u.image ? formatFullUrl(u.image) : 'https://ui-avatars.com/api/?name=' + u.name} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-slate-900 truncate">{u.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">@{u.username || 'user'}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const profilePath = (user?.id === u.id || user?.user_id === u.id)
                      ? "/profile"
                      : (u.username ? `/${u.username}` : `/user/profile/${u.id}`);
                    router.push(profilePath);
                  }}
                  className="px-5 py-1.5 border border-slate-200 rounded-full text-[11px] font-bold text-slate-600"
                >
                  View
                </button>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <img src="/assets/images/search-icon.png" alt="" className="w-16 h-16 mb-4 opacity-20 grayscale" />
                <p className="text-[13px]">No results found. Try a different keyword</p>
              </div>
            )}
          </div>
        );

      case "posts":
        const mappedPosts = (results.posts || []).map(mapUnifiedSearchPostToPost);
        return (
          <div className="bg-slate-50/20 min-h-full p-2 sm:p-4 md:p-8">
            {mappedPosts.length > 0 ? (
              <MasonryGrid
                items={mappedPosts}
                openPostWithUrl={openPostWithUrl}
                toggleLike={toggleLike}
                user={user}
                setShowLoginModal={setShowLoginModal}
                router={router}
                getNoteStyles={getNoteStyles}
                isRestorose={false}
              />
            ) : (
              <div className="col-span-full py-20 text-center text-slate-400">
                <img src="/assets/images/search-icon.png" alt="" className="w-16 h-16 mb-4 opacity-20 grayscale" />
                <p className="text-[13px]">No results found. Try a different keyword</p>
              </div>
            )}
          </div>
        );

      case "products":
        return (
          <div className="flex flex-col h-full bg-white">
            <div className="flex items-center gap-6 px-5 h-11  border-slate-50 overflow-x-auto no-scrollbar sticky top-0 bg-white z-10 ">
              {[
                { id: "featurose", label: "Featurose" },
                { id: "shop", label: "Shops" },
                { id: "best-seller", label: "Best Seller" },
                { id: "price-low", label: "Price Low" },
                { id: "price-high", label: "Price High" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setProductSubTab(tab.id as ProductSubTab)}
                  className={`text-[12px] font-bold whitespace-nowrap transition-colors relative h-full ${productSubTab === tab.id ? "text-rose-600" : "text-slate-400"
                    }`}
                >
                  {tab.label}
                  {productSubTab === tab.id && (
                    <motion.div layoutId="prodSubUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-600" />
                  )}
                </button>
              ))}
            </div>
            <div className="p-3 min-h-[300px]">
              {productSubTab === "shop"
                ? (results.shops?.length > 0 ? results.shops.map(renderShopItem) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <img src="/assets/images/search-icon.png" alt="" className="w-16 h-16 mb-4 opacity-20 grayscale" />
                    <p className="text-[13px]">No results found. Try a different keyword</p>
                  </div>
                ))
                : (results.products?.length > 0 ? (
                  <ProductMasonryGrid
                    items={results.products.map((p: any, i: number) => mapUnifiedSearchProductToProduct(p, i))}
                    likeData={productLikeData}
                    fetchingProductId={fetchingProductId}
                    handleProductClick={handleProductClick}
                    handleReelsClick={handleReelsClick}
                    handleLikeClick={handleProductLike}
                    formatUrl={formatProductUrl}
                    router={router}
                    isRestorose={false}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <img src="/assets/images/search-icon.png" alt="" className="w-16 h-16 mb-4 opacity-20 grayscale" />
                    <p className="text-[13px]">No results found. Try a different keyword</p>
                  </div>
                ))}
            </div>
          </div>
        );

      case "location":
        return (
          <div className="divide-y divide-slate-50 bg-white min-h-full">
            {results.locations?.map((loc: any, idx: number) => (
              <div key={idx} className="flex items-center gap-4 p-4 active:bg-slate-50">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                  <MapPinIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-slate-900">{loc.name}</p>
                  <p className="text-[11px] text-slate-400">{loc.details || 'Location match'}</p>
                </div>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="search-modal-content"
          initial={isPage ? { opacity: 1 } : { opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={isPage ? { opacity: 1 } : { opacity: 0, scale: 1.05 }}
          className="fixed inset-0 bg-white backdrop-blur-2xl flex flex-col"
          style={{ display: shouldHideModal ? "none" : "flex", zIndex: modalZIndex }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="h-14 flex items-center px-2 gap-2 border-slate-50 bg-white sticky top-0 z-30">
            <button onClick={onClose} className="p-2 rounded-full active:bg-slate-50">
              <ChevronLeftIcon className="w-6 h-6 text-slate-900 stroke-[2.5]" />
            </button>
            <div
              className="flex-1 bg-slate-100 h-10 rounded-full flex items-center px-4 gap-2 border border-slate-200 cursor-text"
              onClick={onSearchClick}
            >
              <MagnifyingGlassIcon className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={query}
                readOnly
                placeholder="Search more results..."
                className="bg-transparent border-none outline-none text-[13px] w-full text-slate-900 font-medium cursor-text"
              />
              {query && (
                <button onClick={(e) => { e.stopPropagation(); setQuery(""); }}>
                  <XMarkIcon className="w-4 h-4 text-slate-300" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-5 h-12 bg-white border-slate-100 sticky top-14 z-20">
            {[
              { id: "all", label: "All" },
              { id: "users", label: "Users" },
              { id: "products", label: "Products" },
              { id: "posts", label: "Posts" },
              { id: "location", label: "Location" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`text-[13px] font-bold transition-all relative h-full flex items-center ${activeTab === tab.id ? 'text-slate-700' : 'text-slate-400'
                  }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div layoutId="mainTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto bg-slate-50/30">
            {renderTabContent()}
          </div>

          <AnimatePresence>
            {selectedPost && (
              <PostModal
                open={!!selectedPost}
                post={selectedPost}
                onClose={closeModal}
                onToggleLike={toggleLike}
              />
            )}
          </AnimatePresence>

          <LoginModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
          />

          <ReelsModal
            open={reelsModalOpen}
            onClose={() => setReelsModalOpen(false)}
            initialProductId={selectedProductId}
          />

          {selectedProductData && (
            <ProductPreviewModal
              open={productPreviewOpen}
              onClose={() => setProductPreviewOpen(false)}
              payload={selectedProductData}
              onProductClick={handleProductClick}
            />
          )}
        </motion.div>
      )}

      {/* Floating Cart Button */}
      {isOpen && (
        <button
          key="floating-cart-button"
          onClick={() => {
            // onClose(); // optionally close search modal before navigating
            router.push("/cart");
          }}
          className="fixed bottom-24 right-6 bg-rose-600 text-white p-3 rounded-full shadow-2xl hover:bg-rose-700 transition-all active:scale-90 flex items-center justify-center border-4 border-white group"
          style={{ zIndex: modalZIndex + 1 }}
        >
          <ShoppingCartIcon className="w-6 h-6" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-white text-rose-600 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-md border-[1.5px] border-rose-600 group-hover:scale-110 transition-transform">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </button>
      )}
    </AnimatePresence>
  );
}
