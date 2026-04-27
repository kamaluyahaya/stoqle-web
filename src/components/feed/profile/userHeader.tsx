// userHeader.tsx
"use client";

import React, { useEffect, useMemo, useLayoutEffect, useState, useRef, useCallback } from "react";
import PostModal from "../../modal/postModal"; // adjust path if needed
import { useAuth } from "@/src/context/authContext";
import { useRouter, notFound } from "next/navigation";
import Header from "./header";
import ShimmerGrid from "../../shimmer";
import ImageViewer from "../../modal/imageViewer";
import { FaHeart, FaRegHeart, FaImages } from "react-icons/fa";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { fetchBusinessProducts, fetchProductById, toggleProductLike } from "@/src/lib/api/productApi";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import type { Post, User } from "@/src/lib/types";
import type { PreviewPayload, ProductSku } from "@/src/types/product";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import { formatDuration } from "@/src/lib/utils/product/duration";
import { API_BASE_URL } from "@/src/lib/config";
import { useCache } from "@/src/context/cacheContext";
import { io } from "socket.io-client";
import SocialModal from "../../modal/socialModal";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { toggleSocialPostLike } from "@/src/lib/api/social";
import { toast } from "sonner";


type ApiPost = any;

type Props = { 
  postCount?: number; 
  userId?: string | number; 
  identifierType?: 'slug' | 'stoqle_id' | 'user_id';
  initialPostId?: string;
};
const STICKY_BUFFER = 10; // px — prevents shaking

const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i;
const isVideoUrl = (u?: string) => !!u && VIDEO_EXT_RE.test(u);
const isImageUrl = (u?: string) => !!u && IMAGE_EXT_RE.test(u);

// local images in public folder
const NO_IMAGE_PLACEHOLDER = "/assets/images/favio.png"; // fallback post image
const DEFAULT_AVATAR = "/assets/images/favio.png";       // fallback avatar

const slugify = (str: string) =>
  String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const mapApiPost = (p: any): Post => {
  if (!p) return { id: 0, user: { id: 0, name: '', avatar: DEFAULT_AVATAR }, liked: false, likeCount: 0 } as Post;
  const apiId = p?.social_post_id ?? Math.floor(Math.random() * 1e6);
  let src: string | undefined = undefined;
  let thumbnail: string | undefined = undefined;
  const images = Array.isArray(p?.images) ? p.images : [];

  if (p?.cover_type === "video") {
    const videoFile = images.find((i: any) => isVideoUrl(i?.image_url));
    const coverFile = images.find((i: any) => !!i?.is_cover);
    src = videoFile?.image_url;
    thumbnail = coverFile?.image_url;
    if (!src) src = coverFile?.image_url;
  } else if (images.length > 0) {
    const cover = images.find((i: any) => !!i?.is_cover) ?? images[0];
    src = cover?.image_url;
  }

  if (!src && p?.cover_type !== "note") {
    src = NO_IMAGE_PLACEHOLDER;
  }

  const isVideo = p?.cover_type === "video" || isVideoUrl(src);
  const isImage = !isVideo && isImageUrl(src);
  const caption = p?.text ?? p?.subtitle ?? "";
  const note_caption = p?.subtitle ?? "";

  const allMedia = images.length > 0
    ? images.map((i: any) => ({ url: i?.image_url, id: i?.social_post_image_id || i?.post_image_id || i?.id }))
    : src ? [{ url: src, id: p?.cover_id || p?.id }] : [];

  return {
    id: apiId,
    apiId,
    src,
    isVideo,
    isImage,
    caption,
    note_caption,
    user: {
      id: p?.user_id ?? p?.user?.user_id ?? p?.user?.id ?? 0,
      name: p?.author_name ?? p?.user?.name ?? p?.user?.full_name ?? "",
      avatar: p?.logo || p?.business_logo || p?.author_pic || p?.user?.profile_pic || p?.user?.logo || DEFAULT_AVATAR,
      author_handle: p?.author_handle ?? p?.user?.username ?? p?.author_username,
      is_trusted: Number(
        p?.author_is_trusted ??
        p?.user?.is_trusted ??
        p?.user?.is_verified_partner ??
        p?.user?.is_partner ??
        p?.user?.policy?.market_affiliation?.trusted_partner ??
        p?.is_verified_partner ??
        p?.is_partner ??
        0
      ) === 1 ||
        !!p?.author_is_verified ||
        !!p?.user?.is_verified_partner ||
        !!p?.user?.is_partner ||
        !!p?.is_verified_partner ||
        !!p?.is_partner ||
        !!p?.author_is_trusted,
    },
    liked: Boolean(p?.liked_by_me),
    likeCount: p?.likes_count ?? 0,
    coverType: p?.cover_type,
    noteConfig: p?.config,
    rawCreatedAt: p?.created_at,
    thumbnail,
    isPinned: Boolean(p?.is_pinned),
    author_handle: p?.author_handle ?? p?.user?.username ?? p?.author_username,
    status: p?.status,
    is_product_linked: Boolean(p?.is_product_linked),
    linked_product: p?.linked_product,
    original_audio_url: p?.original_audio_url,
    original_video_url: p?.original_video_url,
    post_public_id: p?.post_public_id,
    allMedia,
  };
};

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
  openPostWithUrl,
  toggleLike,
  getNoteStyles,
  setFullImageUrl
}: any) => {
  const [showBurst, setShowBurst] = useState(false);

  return (
    <motion.article
      layout
      layoutId={`post-${post.id}`}
      transition={{ layout: { duration: 0.4, type: "spring", stiffness: 300, damping: 30 } }}
      onClick={() => openPostWithUrl(post)}
      className="group flex flex-col sm:rounded-xl rounded-md bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden"
    >
      <div className="relative w-full bg-slate-200 overflow-hidden post-media">

        {post.isPinned && (
          <div className="absolute top-3 left-3 z-20 flex items-center px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-md">
            <span className="text-[10px] font-bold">Pinned</span>
          </div>
        )}

        {post.isVideo && (
          <div className="absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/50">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white ml-0.5">
              <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" />
            </svg>
          </div>
        )}

        {!post.isVideo && post.allMedia && post.allMedia.length > 1 && (
          <div className="absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/50">
            <FaImages className="text-white text-[10px]" />
          </div>
        )}

        {post.status === 'processing' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin mb-2" />
            <span className="text-[10px] font-bold text-white px-2 text-center drop-shadow-md">
              Processing your video...
            </span>
          </div>
        )}

        {post.coverType === "note" && !post.src ? (
          <div
            className="w-full  h-[250px] sm:h-[300px]  flex items-center justify-center p-6 relative overflow-hidden"
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
        ) : (
          <img
            src={post.thumbnail || post.src || NO_IMAGE_PLACEHOLDER}
            alt={post.caption}
            className="w-full h-auto sm:min-h-[200px] min-h-[180px] max-h-[250px] sm:max-h-[350px] object-cover transition-transform duration-700 group-hover:scale-110"
          />
        )}
      </div>

      <div className="p-3">
        <p className="text-sm text-slate-800 line-clamp-2 leading-snug font-semibold mb-3">
          {post.coverType === "note" && !post.src ? post.note_caption : post.caption}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="h-5 w-5 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer active:scale-90 transition-transform"
              onClick={(e) => { e.stopPropagation(); setFullImageUrl(post.user.avatar); }}
            >
              <img src={post.user.avatar} className="w-full h-full object-cover" alt={post.user.name} />
            </div>
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <span className="truncate text-[11px] font-semibold text-slate-400 capitalize">
                {post.user.name}
              </span>
              {post.user.is_trusted && (
                <CheckBadgeIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              )}
            </div>
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
    </motion.article>
  );
}, (prev, next) => {
  return prev.post.id === next.post.id &&
    prev.post.liked === next.post.liked &&
    prev.post.likeCount === next.post.likeCount &&
    prev.post.isPinned === next.post.isPinned;
});
PostCard.displayName = "PostCard";

const ProductCard = React.memo(({
  p,
  formatUrl,
  handleProductClick,
  handleLikeClick,
  isLiked,
  likeCount,
  fetchingProduct,
  profileApi
}: any) => {
  const [showBurst, setShowBurst] = useState(false);
  const now = new Date();
  const effectivePromo = React.useMemo(() => {
    // 1. If product uses its OWN policy (use_store_default_promotions === 0), do NOT fallback to defaults
    if (p.use_store_default_promotions === 0) {
      if (Array.isArray(p.promotions_data)) {
        const active = p.promotions_data.find((promo: any) => {
          const start = promo.start ? new Date(promo.start) : (promo.start_date ? new Date(promo.start_date) : null);
          const end = promo.end ? new Date(promo.end) : (promo.end_date ? new Date(promo.end_date) : null);
          const isActive = promo.isActive !== false;
          const discountVal = Number(promo.discount || promo.discount_percent || 0);
          return isActive && discountVal > 0 && (!start || now >= start) && (!end || now <= end);
        });
        if (active) return { title: active.title, discount: Number(active.discount || active.discount_percent) };
      }

      if (p.sale_discount_data && p.sale_discount_data.discount > 0) {
        const sType = p.sale_discount_data.type;
        const sTitle = (sType && sType !== 'percent' && sType !== 'amount') ? sType : "Sale";
        return { title: sTitle, discount: Number(p.sale_discount_data.discount) };
      }

      return null;
    }

    // 2. Otherwise, use Store Default / Joined fields
    if (p.promo_discount && (!p.promo_end || new Date(p.promo_end) >= now)) {
      return { title: p.promo_title, discount: p.promo_discount };
    }

    // 3. Default sale type join
    if (p.sale_discount > 0) {
      const sType = p.sale_type;
      const sTitle = (sType && sType !== 'percent' && sType !== 'amount') ? sType : "Sale";
      return { title: sTitle, discount: p.sale_discount };
    }

    return null;
  }, [p]);

  const shippingDuration = React.useMemo(() => {
    const shippingAvg = (p.shipping_policies || profileApi?.policy?.shipping || profileApi?.policy?.shipping_duration || []).find((s: any) => s.kind === "avg" || s.type === "avg");
    return shippingAvg ? formatDuration(shippingAvg.value, shippingAvg.unit) : null;
  }, [p.shipping_policies, profileApi?.policy?.shipping, profileApi?.policy?.shipping_duration]);

  const isPromoActive = !!effectivePromo;

  return (
    <motion.article
      layout
      layoutId={`product-${p.product_id}`}
      transition={{ layout: { duration: 0.4, type: "spring", stiffness: 300, damping: 30 } }}
      key={p.product_id}
      onClick={(e) => handleProductClick(p.product_id, p.business_name, e)}
      className="group flex flex-col rounded-lg bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden"
    >
      <div className="relative w-full bg-slate-50 overflow-hidden post-media">

        {p.isPinned && (
          <div className="absolute top-3 left-3 z-20 flex items-center px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-md">
            <span className="text-[10px] font-bold">Pinned</span>
          </div>
        )}
        {p.product_video ? (
          <video
            src={formatUrl(p.product_video)}
            poster={formatUrl(p.first_image)}
            muted
            loop
            playsInline
            className="w-full h-auto min-h-[180px] sm:min-h-[200px] max-h-[220px] sm:max-h-[320px] object-cover transition-transform duration-700 group-hover:scale-105 relative z-[1]"
          />
        ) : (
          <img
            src={formatUrl(p.first_image)}
            alt={p.title}
            className="w-full h-auto min-h-[180px] sm:min-h-[200px] max-h-[250px] sm:max-h-[320px] object-cover transition-transform duration-700 group-hover:scale-110 relative z-[1]"
          />
        )}
        {p.product_video && (
          <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-md rounded-full z-10 p-1">
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.14v14l11-7-11-7z" />
            </svg>
          </div>
        )}
        {fetchingProduct && (
          <div className="absolute inset-0 bg-white/30 z-20 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Placeholder frame indicator */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-slate-300 border-t-transparent animate-spin opacity-20" />
          </div>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between pt-1 mb-1">
          <div className="flex items-center gap-1.5 h-4">
            {isPromoActive ? (
              <>
                <span className="text-slate-900 text-sm font-bold">₦{Math.round(Number(p.price || 0) * (1 - (effectivePromo.discount || 0) / 100)).toLocaleString()}</span>
                <span className="text-[10px] text-rose-500 line-through">₦{Number(p.price || 0).toLocaleString()}</span>
              </>
            ) : (
              <span className="text-slate-900 text-sm font-bold">₦{Number(p.price || 0).toLocaleString()}</span>
            )}
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
                  className={`absolute inset-0 flex items-center justify-center ${isLiked ? 'text-rose-500' : 'text-slate-400'}`}
                >
                  {isLiked ? <FaHeart className="text-xs" /> : <FaRegHeart className="text-xs" />}
                </motion.div>
              </AnimatePresence>
              {isLiked && (
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
            <span className="text-[10px] font-semibold text-slate-600 ml-0.5">{likeCount}</span>
          </div>
        </div>
        <h3 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug" title={p.title}>{p.title}</h3>
        <div className="mt-2 min-h-[14px]">
          {effectivePromo ? (
            <span className="text-[9px] text-rose-500 border-rose-500 border-[0.2px] px-1.5 py-0.5 ">
              {effectivePromo.title ? `${effectivePromo.title}: ` : "Sale: "}{effectivePromo.discount}% off
            </span>
          ) : (p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) <= 4) ? (
            <span className="text-[9px] text-rose-500 font-bold uppercase tracking-tight">
              Only {Number(p.total_quantity)} Left
            </span>
          ) : p.seven_day_no_reason ? (
            <span className="text-[9px] text-blue-600 border-blue-500 border-[0.2px] px-1.5 py-0.5 ">
              7-day Return
            </span>
          ) : (p.return_shipping_subsidy || profileApi?.policy?.returns?.return_shipping_subsidy === 1) ? (
            <span className="text-[9px] text-emerald-600 border-emerald-500 border-[0.2px] px-1.5 py-0.5 ">
              Return shipping subsidy
            </span>
          ) : shippingDuration ? (
            <span className="text-[9px] text-orange-600 border-orange-500 border-[0.2px] px-1.5 py-0.5 ">
              Ships in {shippingDuration}
            </span>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}, (prev, next) => {
  return prev.p.product_id === next.p.product_id &&
    prev.isLiked === next.isLiked &&
    prev.likeCount === next.likeCount &&
    prev.fetchingProduct === next.fetchingProduct;
});
ProductCard.displayName = "ProductCard";

const MasonryGrid = ({ items, type, openPostWithUrl, toggleLike, getNoteStyles, setFullImageUrl, formatUrl, handleProductClick, handleLikeClick, likeData, fetchingProductId, profileApi }: any) => {
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

  const columnData = Array.from({ length: columns }, () => [] as any[]);
  items.forEach((item: any, index: number) => {
    columnData[index % columns].push(item);
  });

  return (
    <LayoutGroup>
      <div className="flex gap-2 sm:gap-4 items-start w-full max-w-full overflow-hidden mb-30">
        {columnData.map((colItems, colIdx) => (
          <div key={colIdx} className="flex-1 flex flex-col gap-2 sm:gap-6 min-w-0">
            {colItems.map((item: any, index: number) => {
              const isPost = type === 'post' || type === 'note' || (type === 'liked' && !item.isProduct);
              if (isPost) {
                return (
                  <PostCard
                    key={item.id || index}
                    post={item}
                    openPostWithUrl={openPostWithUrl}
                    toggleLike={toggleLike}
                    getNoteStyles={getNoteStyles}
                    setFullImageUrl={setFullImageUrl}
                  />
                );
              } else {
                const ld = likeData[item.product_id] || { liked: !!item.isLiked, count: item.likes_count || 0 };
                return (
                  <ProductCard
                    key={item.product_id}
                    p={item}
                    formatUrl={formatUrl}
                    handleProductClick={handleProductClick}
                    handleLikeClick={handleLikeClick}
                    isLiked={ld.liked}
                    likeCount={ld.count}
                    fetchingProduct={fetchingProductId === item.product_id}
                    profileApi={profileApi}
                  />
                );
              }
            })}
          </div>
        ))}
      </div>
    </LayoutGroup>
  );
};

export default function UserHeader({ postCount = 12, userId, identifierType, initialPostId }: Props) {
  const [isNotFound, setIsNotFound] = useState(false);
  if (isNotFound) {
    notFound();
  }
  const [profileApi, setProfileApi] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [mediaPosts, setMediaPosts] = useState<Post[]>([]);
  const [notePosts, setNotePosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Products state
  const [vendorProducts, setVendorProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [fetchingProduct, setFetchingProduct] = useState(false);
  const [productLikeData, setProductLikeData] = useState<Record<number, { liked: boolean, count: number }>>({});
  const [fetchingProductId, setFetchingProductId] = useState<number | null>(null);

  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [activeSocialTab, setActiveSocialTab] = useState<"friends" | "followers" | "following" | "recommend" | "liked">("followers");
  const [navbarHeight, setNavbarHeight] = useState(0);
  const tabsWrapperRef = useRef<HTMLDivElement>(null);
  const tabsInnerRef = useRef<HTMLDivElement>(null);
  const [showFollowSuggestion, setShowFollowSuggestion] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const suggestionTriggered = useRef(false);
  const scrollTracker = useRef(0);
  const [isMiniHeaderVisible, setIsMiniHeaderVisible] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    const fc = Number(profileApi?.stats?.followers ?? profileApi?.stats?.followers_count ?? 0);
    setFollowersCount(fc);

    if (profileApi) {
      setIsFollowing(Boolean(profileApi.is_followed_by_me ?? profileApi.is_followed ?? false));
      setIsBlocked(Boolean(profileApi.is_blocked_by_me ?? profileApi.is_blocked ?? false));
    }
  }, [profileApi]);

  const [likedItems, setLikedItems] = useState<any[]>([]);
  const [likedLoading, setLikedLoading] = useState(false);

  const formatUrl = (url: string) => {
    if (!url) return NO_IMAGE_PLACEHOLDER;
    if (url.startsWith("http")) return url;
    return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
  };

  const auth = useAuth();
  const token = auth?.token ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // 🚀 Lazy-load tracker: records which tabs have already had their data fetched.
  // Data is fetched exactly once per tab visit. Cleared on explicit refresh.
  const fetchedTabs = useRef<Set<string>>(new Set());

  // Clear the lazy-load guard when the user explicitly refreshes
  useEffect(() => {
    if (refreshKey > 0) fetchedTabs.current.clear();
  }, [refreshKey]);

  const viewUserId = userId ? String(userId) : "me";
  const currentUserId = auth?.user?.user_id ? String(auth.user.user_id) : null;
  const isOwner = viewUserId === "me" || (currentUserId && viewUserId === currentUserId);

  useEffect(() => {
    // Only reset scroll if we are already scrolled past the content area
    const timer = setTimeout(() => {
      if (tabsWrapperRef.current) {
        const contentTop = tabsWrapperRef.current.offsetTop - (navbarHeight || 56);

        // If current scroll is further down than the tabs top, snap back to tabs top
        // This avoids jumping when user is still at the top of the profile
        if (window.scrollY > contentTop) {
          window.scrollTo({
            top: contentTop,
            behavior: "instant" as any
          });
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeTabIndex, navbarHeight]);

  // On mount, check sessionStorage for a pending post (just submitted by this user)
  // and prepend it optimistically so the loader shows immediately.
  useEffect(() => {
    if (!isOwner) return;
    try {
      const raw = sessionStorage.getItem('pending_post');
      if (!raw) return;
      sessionStorage.removeItem('pending_post');
      const apiPost = JSON.parse(raw);
      const mapped = mapApiPost(apiPost);
      // Only inject if it's not already in the list (race condition guard)
      setMediaPosts(prev => {
        if (prev.some(p => String(p.id) === String(mapped.id))) return prev;
        return [mapped, ...prev];
      });
      if (mapped.coverType === 'note') {
        setNotePosts(prev => {
          if (prev.some(p => String(p.id) === String(mapped.id))) return prev;
          return [mapped, ...prev];
        });
      }
    } catch (_) { }
    // Only run once after mount - we deliberately exclude refreshKey etc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  // Listen for post-created event from other tabs / same page navigations
  useEffect(() => {
    const handlePostCreated = (e: Event) => {
      const customEvt = e as CustomEvent;
      const apiPost = customEvt.detail;
      if (!apiPost || !isOwner) {
        // Fallback: trigger a full re-fetch
        setRefreshKey(prev => prev + 1);
        return;
      }
      const mapped = mapApiPost(apiPost);
      setMediaPosts(prev => {
        if (prev.some(p => String(p.id) === String(mapped.id))) return prev;
        return [mapped, ...prev];
      });
    };
    window.addEventListener("post-created", handlePostCreated);
    return () => window.removeEventListener("post-created", handlePostCreated);
  }, [isOwner]);

  // Handle real-time post updates via socket
  const socketUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const userId = auth?.user?.user_id || auth?.user?.id;
    if (!userId) return;
    const userIdStr = String(userId);

    // Avoid reconnecting on every render if userId hasn't changed
    if (socketUserIdRef.current === userIdStr) return;
    socketUserIdRef.current = userIdStr;

    const socket = io(API_BASE_URL, {
      query: { userId: userIdStr },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log(`[UserHeader] Socket connected for user ${userIdStr}`);
    });

    socket.on("post_updated", (updatedPost: any) => {
      console.log("[UserHeader] post_updated received:", updatedPost?.social_post_id, 'status:', updatedPost?.status);
      if (!updatedPost?.social_post_id) return;

      const updated = mapApiPost(updatedPost);
      const updateFn = (prev: Post[]) => prev.map(p =>
        String(p.id) === String(updatedPost.social_post_id)
          ? { ...p, ...updated }
          : p
      );

      setMediaPosts(updateFn);
      setNotePosts(updateFn);
      setLikedItems((prev: any[]) => prev.map(p =>
        String(p.id) === String(updatedPost.social_post_id)
          ? { ...p, ...updated }
          : p
      ));

      // Update the active modal if it's viewing this post
      setSelectedPost(prev => {
        if (prev && String(prev.id) === String(updatedPost.social_post_id)) {
          return { ...prev, ...updated };
        }
        return prev;
      });
    });

    socket.on('profile_update', (updatedProfile: any) => {
      const profileId = profileApi?.user?.user_id || profileApi?.user?.id || profileApi?.user_id || viewUserId;
      const updatedId = updatedProfile?.user?.user_id || updatedProfile?.user?.id || updatedProfile?.user_id;

      if (String(updatedId) === String(profileId)) {
        setProfileApi(updatedProfile);
      }
    });

    return () => {
      socket.disconnect();
      socketUserIdRef.current = null;
    };
  }, [auth?.user?.user_id, auth?.user?.id]);

  // Handle deep-linked post opening
  useEffect(() => {
    if (initialPostId && !selectedPost) {
      const loadDeepLinkPost = async () => {
        try {
          const { fetchSocialPostById } = require("@/src/lib/api/social");
          const post = await fetchSocialPostById(initialPostId, { token });
          if (post) {
            setSelectedPost(post);
            pushedRef.current = false; // Initial load, don't back on close
          }
        } catch (err) {
          console.error("Failed to load deep-link post", err);
        }
      };
      loadDeepLinkPost();
    }
  }, [initialPostId, token]);

  const handleFollowUpdate = (targetUserId: string | number, following: boolean) => {
    const profileId = profileApi?.user?.user_id || profileApi?.user?.id || profileApi?.user_id;
    // If we're on SOMEONE ELSE'S profile and we just followed/unfollowed them
    if (!isOwner && (String(targetUserId) === String(profileId) || String(targetUserId) === viewUserId)) {
      setFollowersCount(prev => following ? prev + 1 : Math.max(0, prev - 1));
      setIsFollowing(following);
    }

    // If we're on OUR OWN profile, our "following" count changes
    if (isOwner) {
      setProfileApi((prev: any) => {
        if (!prev) return prev;
        const currentFollowing = Number(prev.stats?.following ?? 0);
        return {
          ...prev,
          stats: {
            ...prev.stats,
            following: following ? currentFollowing + 1 : Math.max(0, currentFollowing - 1)
          }
        };
      });
    }
  };

  // Scroll listener for Follow Suggestion & MiniHeader
  useEffect(() => {
    const handleScroll = () => {
      // Suggestion logic - only for businesses and once profile is loaded
      if (!isOwner && profileApi && profileApi.business && !isFollowing && !suggestionTriggered.current) {
        if (window.scrollY > 400 && !suggestionTriggered.current) {
          suggestionTriggered.current = true;
          setShowFollowSuggestion(true);
          setTimeout(() => setShowFollowSuggestion(false), 6000);
        }
      }

      // MiniHeader logic (Mobile logic sync)
      setIsMiniHeaderVisible(window.scrollY > 0);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isOwner, isFollowing, profileApi]);

  const tabs = useMemo(() => {
    const base = ["Notes", "Posts"];
    // Show Products tab for any business profile regardless of viewer's ownership
    if (profileApi?.is_business_owner && profileApi?.business?.business_id) {
      base.push("Products");
    }
    if (isOwner) base.push("Liked");
    return base;
  }, [profileApi?.is_business_owner, profileApi?.business?.business_id, isOwner]);

  const pushedRef = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const { getCachedProfile, setCachedProfile, setCachedProfilePosts, getActiveTab, setActiveTab, getScrollPosition, setScrollPosition } = useCache();

  // Record scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (viewUserId) setScrollPosition(`profile_${viewUserId}`, window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [viewUserId]);

  // Save active tab
  useEffect(() => {
    if (viewUserId && tabs[activeTabIndex]) {
      setActiveTab(`profile_${viewUserId}_tab`, tabs[activeTabIndex]);
    }
  }, [activeTabIndex, tabs, viewUserId]);

  // Restore scroll position after loading
  useEffect(() => {
    if (!profileLoading && !postsLoading && viewUserId) {
      const pos = getScrollPosition(`profile_${viewUserId}`);
      if (pos > 0) {
        setTimeout(() => window.scrollTo(0, pos), 100);
      }
    }
  }, [profileLoading, postsLoading, viewUserId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadProfile() {
      if (!viewUserId) return;

      const cached = getCachedProfile(String(viewUserId));
      if (cached && cached.data) {
        setProfileApi(cached.data);
        setIsFollowing(cached.data.is_following);
        setIsBlocked(cached.data.is_blocked);
        setMediaPosts(cached.mediaPosts || []);
        setNotePosts(cached.notePosts || []);
        setProfileLoading(false);
        setPostsLoading(false);

        // Restore active tab
        const savedTab = getActiveTab(`profile_${viewUserId}_tab`);
        if (savedTab !== null) {
          const tabIndex = tabs.indexOf(savedTab as string);
          if (tabIndex !== -1) setActiveTabIndex(tabIndex);
        }
        return;
      }

      setProfileLoading(true);
      setProfileError(null);
      try {
        const base = process.env.NEXT_PUBLIC_API_URL;
        if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined in environment");

        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        let endpoint =
          viewUserId === "me"
            ? `${base.replace(/\/$/, "")}/api/auth/profile/me`
            : `${base.replace(/\/$/, "")}/api/auth/users/${encodeURIComponent(viewUserId)}`;

        if (viewUserId !== "me" && identifierType) {
          endpoint += `?identifier_type=${identifierType}`;
        }

        const res = await fetch(endpoint, { signal: controller.signal, headers });
        if (res.status === 404) {
          setIsNotFound(true);
          return;
        }
        if (!res.ok) throw new Error(`Profile API returned ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const d = json?.data ?? json;
        const normalized = {
          user: d?.user ?? null,
          staff_profiles: d?.staff_profiles ?? [],
          business: d?.business ?? null,
          stats: d?.stats ?? null,
          recent_followers: d?.recent_followers ?? [],
          is_business_owner: Boolean(d?.is_business_owner),
          is_following: Boolean(d?.is_following || d?.is_followed_by_me),
          is_follower: Boolean(d?.is_follower),
          latest_ip: d?.latest_ip ?? null,
          latest_location: d?.latest_location ?? null,
          is_verified_partner: Boolean(d?.is_verified_partner),
          is_blocked: Boolean(d?.is_blocked),
          hide_following: Boolean(d?.hide_following || d?.user?.hide_following),
          hide_followers: Boolean(d?.hide_followers || d?.user?.hide_followers),
          dm_preference: d?.dm_preference || d?.user?.dm_preference || "Default",
        };
        setProfileApi(normalized);
        setIsFollowing(normalized.is_following);
        setIsBlocked(normalized.is_blocked);

        // Cache the normalized profile
        setCachedProfile(String(viewUserId), normalized);

        // Background tracking for business profile visitors
        if (normalized.is_business_owner && normalized.business && viewUserId !== "me") {
          setTimeout(() => {
            try {
              let sessionId = localStorage.getItem('stoqle_guest_session');
              if (!sessionId) {
                sessionId = 'sg_' + Math.random().toString(36).substring(2, 15);
                localStorage.setItem('stoqle_guest_session', sessionId);
              }
              const visitorId = currentUserId;

              // Only call if it's someone else looking at the profile
              if (visitorId !== String(normalized.user?.user_id)) {
                fetch(`${base.replace(/\/$/, "")}/api/business/${normalized.business.business_id || normalized.business.id}/visit`, {
                  method: 'POST',
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ visitor_id: visitorId, session_id: sessionId })
                }).catch(() => { });
              }
            } catch (err) {
              // ignore tracking storage errors
            }
          }, 2000); // 2 second delay to prevent rapid bounce tracking
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Failed to fetch profile:", err);
        if (!cancelled) setProfileError(err.message ?? "Failed to load profile");
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [viewUserId, refreshKey]);

  // fetch liked items if owner selects "Liked" tab
  useEffect(() => {
    if (tabs[activeTabIndex] !== "Liked" || !isOwner) return;

    let cancelled = false;
    async function loadLikedItems() {
      setLikedLoading(true);
      try {
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        };

        const [postsRes, productsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/social/liked/me`, { headers }),
          fetch(`${API_BASE_URL}/api/products/liked/me`, { headers })
        ]);

        if (cancelled) return;

        const postsJson = await postsRes.json();
        const productsJson = await productsRes.json();

        const postsList = (postsJson?.data?.posts || postsJson?.posts || []).map((p: any) => ({ ...mapApiPost(p), liked_at: p.liked_at }));
        const productsList = (productsJson?.data?.products || productsJson?.products || []).map((p: any) => ({ ...p, isProduct: true }));

        const merged = [...postsList, ...productsList].sort((a, b) => {
          const dateA = new Date(a.liked_at || 0).getTime();
          const dateB = new Date(b.liked_at || 0).getTime();
          return dateB - dateA;
        });

        setLikedItems(merged);
      } catch (err) {
        console.error("Failed to load liked items:", err);
      } finally {
        if (!cancelled) setLikedLoading(false);
      }
    }
    loadLikedItems();
    return () => { cancelled = true; };
  }, [activeTabIndex, tabs, isOwner]);

  // 🛍️ Lazy-load vendor products — only when the "Products" tab is active
  useEffect(() => {
    // We fetch products if the user is a business owner, to show them in the store section of the header.
    const businessId = profileApi?.business?.business_id || profileApi?.business?.id;
    if (!businessId || !profileApi?.is_business_owner) return;

    const tabKey = `products_${viewUserId}`;
    // Only fetch once per session (guard by fetchedTabs)
    if (fetchedTabs.current.has(tabKey)) {
      setProductsLoading(false);
      return;
    }

    const loadVendorProducts = async () => {
      setProductsLoading(true);
      try {
        const identifier = profileApi?.business?.business_slug || businessId;
        const res = await fetchBusinessProducts(identifier, 100, undefined, undefined, token);
        let foundProducts = [];
        if (res?.data?.products && Array.isArray(res.data.products)) {
          foundProducts = res.data.products;
        } else if (res?.data && Array.isArray(res.data)) {
          foundProducts = res.data;
        } else if (Array.isArray(res)) {
          foundProducts = res;
        }

        const sortedProducts = foundProducts.map((pr: any) => ({
          ...pr,
          isPinned: !!pr.isPinned || !!pr.is_pinned
        })).sort((a: any, b: any) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.created_at || a.created_at || 0).getTime() - new Date(a.created_at || b.created_at || 0).getTime();
        });
        setVendorProducts(sortedProducts);

        fetchedTabs.current.add(tabKey);
      } catch (err) {
        console.error("Failed to load products", err);
        fetchedTabs.current.add(tabKey);
      } finally {
        setProductsLoading(false);
      }
    };
    loadVendorProducts();
  }, [profileApi?.business?.business_id, profileApi?.is_business_owner, viewUserId]);

  const handleFollow = async () => {
    if (!token) {
      auth.openLogin();
      return;
    }
    setIsFollowing(true);
    setFollowersCount(prev => prev + 1);
    setShowFollowSuggestion(false);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/follow/${viewUserId}/follow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!resp.ok) throw new Error("Follow failed");
    } catch (err) {
      setIsFollowing(false);
      console.error(err);
    }
  };

  // 📬 Lazy-load posts — only when the Notes or Posts tab is currently active.
  // Data is fetched at most once per session (guarded by fetchedTabs ref).
  // A manual refresh (refreshKey bump) clears the guard and re-fetches.
  useEffect(() => {
    const activeTabName = tabs[activeTabIndex];
    const isPostsTab = activeTabName === "Notes" || activeTabName === "Posts";
    if (!isPostsTab) return;

    const tabKey = `posts_${viewUserId}`;
    const cached = getCachedProfile(String(viewUserId));
    if (cached && (cached.mediaPosts?.length > 0 || cached.notePosts?.length > 0)) {
      setMediaPosts(cached.mediaPosts);
      setNotePosts(cached.notePosts);
      setPostsLoading(false);
    } else {
      setPostsLoading(true);
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadPosts() {
      const cached = getCachedProfile(String(viewUserId));
      if (!cached || (!cached.mediaPosts?.length && !cached.notePosts?.length)) {
        setPostsLoading(true);
      } else {
        setPostsLoading(false);
      }
      setPostsError(null);
      try {
        const base = process.env.NEXT_PUBLIC_API_URL;
        if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined in environment");
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const endpoint =
          viewUserId === "me"
            ? `${base.replace(/\/$/, "")}/api/social/me`
            : `${base.replace(/\/$/, "")}/api/social/user/${encodeURIComponent(viewUserId)}`;

        const resp = await fetch(endpoint, { signal: controller.signal, headers });
        if (resp.status === 404) {
          setIsNotFound(true);
          return;
        }
        if (!resp.ok) throw new Error(`Posts API returned ${resp.status}`);
        const json = await resp.json();

        const apiPosts: any[] =
          json?.data?.posts && Array.isArray(json.data.posts) ? json.data.posts :
            (Array.isArray(json?.data) ? json.data :
              (Array.isArray(json?.posts) ? json.posts :
                (Array.isArray(json?.data?.posts) ? json.data.posts : [])));

        if (cancelled) return;
        const mapped = apiPosts.map((p) => mapApiPost(p));

        // Sort: pinned items first, then by date
        const sorted = mapped.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.rawCreatedAt || 0).getTime() - new Date(a.rawCreatedAt || 0).getTime();
        });

        const media: Post[] = [];
        const notes: Post[] = [];

        for (const m of sorted) {
          if (m.coverType === "note") {
            notes.push(m);
            continue;
          }
          if (m.isVideo || m.isImage) {
            media.push(m);
            continue;
          }
          notes.push(m);
        }

        setMediaPosts(media.slice(0, postCount));
        setNotePosts(notes.slice(0, postCount));

        // Cache the posts
        setCachedProfilePosts(String(viewUserId), media, notes);

        // Mark as successfully fetched!
        fetchedTabs.current.add(tabKey);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Failed to load posts:", err);
        if (!cancelled) {
          setPostsError(err.message ?? "Failed to load posts");
          fetchedTabs.current.add(tabKey); // Mark fetched even on error so we don't infinitely retry
        }
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    }

    loadPosts();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // Re-run when: tab changes, user changes, or explicit refresh
  }, [activeTabIndex, tabs, viewUserId, postCount, refreshKey]);

  useEffect(() => {
    const tryOpenFromUrl = async () => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      const param = url.searchParams.get("post");
      if (!param) return;
      const postId = Number(param);
      if (isNaN(postId)) return;

      const all = [...mediaPosts, ...notePosts];
      const found = all.find((p) => Number(p.id) === postId);
      if (found) {
        setSelectedPost(found);
        pushedRef.current = false;
        return;
      }

      try {
        const base = process.env.NEXT_PUBLIC_API_URL;
        if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined in environment");

        const fetchUrl = new URL(`${base.replace(/\/$/, "")}/api/social/${postId}`);
        const xsecToken = url.searchParams.get("xsec_token");
        const xsecSource = url.searchParams.get("xsec_source");
        if (xsecToken) fetchUrl.searchParams.set("xsec_token", xsecToken);
        if (xsecSource) fetchUrl.searchParams.set("xsec_source", xsecSource);

        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(fetchUrl.toString(), { headers });
        if (!res.ok) throw new Error("Post not found");
        const json = await res.json();
        const single = mapApiPost(json?.data?.post ?? json?.data ?? json);
        setSelectedPost(single);
        pushedRef.current = false;
      } catch (err) {
        setSelectedPost({
          id: postId,
          caption: "Post unavailable",
          user: { name: "", avatar: DEFAULT_AVATAR },
          liked: false,
          likeCount: 0,
        } as Post);
        pushedRef.current = false;
      }
    };

    tryOpenFromUrl();
  }, [mediaPosts, notePosts]);

  useEffect(() => {
    const onPop = (ev: PopStateEvent) => {
      const url = new URL(window.location.href);
      const param = url.searchParams.get("post");
      if (param) {
        const postId = Number(param);
        if (isNaN(postId)) {
          setSelectedPost(null);
          return;
        }
        const all = [...mediaPosts, ...notePosts];
        const found = all.find((p) => Number(p.id) === postId);
        if (found) {
          setSelectedPost(found);
          pushedRef.current = false;
        } else {
          (async () => {
            try {
              const base = process.env.NEXT_PUBLIC_API_URL;
              if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined in environment");

              const fetchUrl = new URL(`${base.replace(/\/$/, "")}/api/social/${postId}`);
              const xsecToken = url.searchParams.get("xsec_token");
              const xsecSource = url.searchParams.get("xsec_source");
              if (xsecToken) fetchUrl.searchParams.set("xsec_token", xsecToken);
              if (xsecSource) fetchUrl.searchParams.set("xsec_source", xsecSource);

              const headers: HeadersInit = { "Content-Type": "application/json" };
              if (token) headers.Authorization = `Bearer ${token}`;

              const res = await fetch(fetchUrl.toString(), { headers });
              if (!res.ok) throw new Error("Post not found");
              const json = await res.json();
              setSelectedPost(mapApiPost(json?.data?.post ?? json?.data ?? json));
            } catch {
              setSelectedPost({
                id: postId,
                caption: "Post unavailable",
                user: { name: "", avatar: DEFAULT_AVATAR },
                liked: false,
                likeCount: 0,
              } as Post);
            }
          })();
        }
      } else {
        setSelectedPost(null);
      }
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [mediaPosts, notePosts]);

  const openPostWithUrl = async (post: Post) => {
    setSelectedPost(post);
    try {
      const { fetchSecurePostUrl } = require("@/src/lib/api/social");
      const urlData = await fetchSecurePostUrl(post.id, "profile_feed", token);

      let xsecToken = "";
      let xsecSource = "profile_feed";
      if (urlData && urlData.xsec_token) {
        xsecToken = urlData.xsec_token;
        xsecSource = urlData.xsec_source || "profile_feed";
      }

      const username = post.author_handle || post.user.username || slugify(post.user.name);
      const publicId = (post as any).post_public_id || post.id;
      const newPath = `/${username}/${publicId}`;

      const url = new URL(window.location.href);
      if (xsecToken) url.searchParams.set("xsec_token", xsecToken);
      url.searchParams.set("xsec_source", xsecSource);
      url.pathname = newPath;

      window.history.pushState({ postId: post.id, modal: true }, "", url.toString());
      pushedRef.current = true;
    } catch (err) {
      console.warn("Failed to update URL", err);
      const username = post.author_handle || post.user.username || slugify(post.user.name);
      const publicId = (post as any).post_public_id || post.id;
      const newPath = `/${username}/${publicId}`;

      const url = new URL(window.location.href);
      url.pathname = newPath;
      url.searchParams.set("xsec_source", "profile_feed");
      window.history.pushState({ postId: post.id, modal: true }, "", url.toString());
      pushedRef.current = true;
    }
  };

  const closeModal = useCallback(() => {
    setSelectedPost(null);

    if (pushedRef.current && typeof window !== 'undefined' && window.history.state?.modal) {
      window.history.back();
      pushedRef.current = false;
      return;
    }

    // Failsafe: Aggressive URL cleanup
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const username = profileApi?.user?.username || profileApi?.username || userId;
      let changed = false;

      // 1. Check path-based postId (e.g. /username/3000...)
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2 && /^\d{11,}$/.test(pathParts[pathParts.length - 1])) {
        pathParts.pop();
        url.pathname = `/${pathParts.join('/')}`;
        changed = true;
      }

      // 2. Check search param
      if (url.searchParams.has("post")) {
        url.searchParams.delete("post");
        changed = true;
      }

      if (changed && username) {
        window.history.replaceState({}, "", `/${username}`);
      } else if (changed) {
        window.history.replaceState({}, "", url.toString());
      }
    }
    pushedRef.current = false;
  }, [profileApi, userId]);

  const toggleLike = async (postId: string | number) => {
    if (!token) {
      auth.openLogin();
      return;
    }

    const targetPost = [...mediaPosts, ...notePosts].find(p => p.id === postId);
    if (!targetPost) return;

    const wasLiked = targetPost.liked;
    const newLiked = !wasLiked;
    const diff = newLiked ? 1 : -1;

    const updatePost = (p: Post) =>
      p.id === postId ? { ...p, liked: newLiked, likeCount: Math.max(0, (p.likeCount || 0) + diff) } : p;

    setMediaPosts((prev) => prev.map(updatePost));
    setNotePosts((prev) => prev.map(updatePost));

    try {
      await toggleSocialPostLike(postId, token);
    } catch (err) {
      console.error("Like error", err);
      toast.error("Failed to update like");
      // Revert optimism
      const revertPost = (p: Post) =>
        p.id === postId ? { ...p, liked: wasLiked, likeCount: targetPost.likeCount } : p;
      setMediaPosts((prev) => prev.map(revertPost));
      setNotePosts((prev) => prev.map(revertPost));
    }
  };

  const handleProductLike = async (e: React.MouseEvent, productId: number, baseCount: number) => {
    e.stopPropagation();
    if (!token) {
      auth.openLogin();
      return;
    }

    const current = productLikeData[productId] || { liked: false, count: baseCount };
    const newLiked = !current.liked;
    const newCount = newLiked ? current.count + 1 : Math.max(0, current.count - 1);

    setProductLikeData(prev => ({
      ...prev,
      [productId]: { liked: newLiked, count: newCount }
    }));

    try {
      const res = await toggleProductLike(productId, token);
      setProductLikeData(prev => ({
        ...prev,
        [productId]: { liked: res.data.liked, count: res.data.likes_count }
      }));
    } catch (err) {
      console.error("Like error", err);
      setProductLikeData(prev => ({ ...prev, [productId]: current }));
    }
  };

  const handleProductClick = async (
    productId: string | number,
    businessName?: string,
    e?: any,
    businessSlug?: string,
    isSocialPost?: boolean,
    productSlug?: string
  ) => {
    const id = Number(productId);
    if (!id || fetchingProductId === id) return;

    try {
      setFetchingProductId(id);
      const res = await fetchProductById(id, token);
      if (res?.data?.product) {
        const dbProduct = res.data.product;
        const mappedPayload = mapProductToPreviewPayload(dbProduct, formatUrl);
        const baseInv = (dbProduct.inventory || []).find((inv: any) => !inv.sku_id && !inv.variant_option_id);
        if (baseInv) mappedPayload.quantity = baseInv.quantity;
        setSelectedProductPayload(mappedPayload);
        setProductModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingProductId(null);
    }
  };

  const goToTab = (index: number) => {
    if (index < 0 || index >= tabs.length) return;
    setActiveTabIndex(index);
  };
  const nextTab = () => goToTab(Math.min(tabs.length - 1, activeTabIndex + 1));
  const prevTab = () => goToTab(Math.max(0, activeTabIndex - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextTab();
      if (e.key === "ArrowLeft") prevTab();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTabIndex, tabs.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const onTouchEnd = () => {
    if (touchStartX.current == null || touchEndX.current == null) return;
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 40;
    if (diff > threshold) {
      nextTab();
    } else if (diff < -threshold) {
      prevTab();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const displayName = useMemo(() => {
    const business = profileApi?.business;
    const user = profileApi?.user;
    if (profileApi?.is_business_owner && business?.business_name) return business.business_name;
    return user?.full_name ?? user?.name ?? "";
  }, [profileApi]);

  useLayoutEffect(() => {
    const updateNavbarHeight = () => {
      const navbar = document.querySelector("header, [role='banner'], .main-navbar") as HTMLElement | null;
      if (navbar) {
        setNavbarHeight(navbar.offsetHeight);
        document.documentElement.style.setProperty('--navbar-height', `${navbar.offsetHeight}px`);
      }
    };
    updateNavbarHeight();
    window.addEventListener("resize", updateNavbarHeight);
    window.addEventListener("scroll", updateNavbarHeight, { passive: true });
    return () => {
      window.removeEventListener("resize", updateNavbarHeight);
      window.removeEventListener("scroll", updateNavbarHeight);
    };
  }, []);

  const getNoteStyles = (config: any) => {
    if (!config) return { background: "#f1f5f9" };
    let cfg = config;
    if (typeof config === "string") {
      try { cfg = JSON.parse(config); } catch (e) { return { background: "#f1f5f9" }; }
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
      fontSize: `${(cfg.textStyle?.fontSize ?? 28) * 0.6}px`,
      fontWeight: cfg.textStyle?.fontWeight ?? "800",
    };
  };

  const TabsBar = (
    <div
      ref={tabsWrapperRef}
      className={`lg:bg-white bg-slate-100 rounded px-4  flex justify-start sticky z-50 border-b border-slate-200`}
      style={{ top: isMiniHeaderVisible ? "56px" : `${navbarHeight}px` }}
    >
      <div ref={tabsInnerRef} className="flex gap-8  overflow-hidden scrollbar-hide py-1">
        {profileLoading ? (
          <>
            <div className="h-4 w-12 bg-slate-100 animate-pulse rounded my-2" />
            <div className="h-4 w-12 bg-slate-100 animate-pulse rounded my-2" />
            <div className="h-4 w-12 bg-slate-100 animate-pulse rounded my-2" />
            <div className="h-4 w-12 bg-slate-100 animate-pulse rounded my-2" />
          </>
        ) : (
          tabs.map((t, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTabIndex(i);
              }}
              className={`relative py-2 text-sm font-bold transition whitespace-nowrap ${i === activeTabIndex ? "text-slate-900" : "text-slate-400 hover:text-slate-600"}`}
            >
              {t}
              {i === activeTabIndex && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );

  const TabPanes = (
    <div className="relative overflow-hidden w-full" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="flex transition-transform duration-450 ease-in-out items-start" style={{ width: `${tabs.length * 100}%`, transform: `translateX(-${activeTabIndex * (100 / tabs.length)}%)` }}>

        {/* Notes pane */}
        <div style={{ width: `${100 / tabs.length}%`, height: tabs[activeTabIndex] === "Notes" ? "auto" : "0", overflow: "hidden" }}>
          {postsLoading ? (
            <ShimmerGrid count={10} />
          ) : notePosts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
              <img src="/assets/images/post.png" alt="No notes"
                className="lg:w-30 lg:h-40 w-20 h-20 object-contain mb-4 opacity-80" />
              <p className="text-sm font-medium">No note found.</p>
            </div>
          ) : (
            <div className="p-2 sm:p-4 post-grid-container">
              <MasonryGrid
                items={notePosts}
                type="note"
                openPostWithUrl={openPostWithUrl}
                toggleLike={toggleLike}
                getNoteStyles={getNoteStyles}
                setFullImageUrl={setFullImageUrl}
              />
            </div>
          )}
        </div>

        {/* Posts pane */}
        <div style={{ width: `${100 / tabs.length}%`, height: tabs[activeTabIndex] === "Posts" ? "auto" : "0", overflow: "hidden" }}>
          {postsLoading ? (
            <ShimmerGrid count={10} />
          ) : mediaPosts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
              <img src="/assets/images/post.png" alt="No posts" className="lg:w-30 lg:h-40 w-20 h-20 object-contain mb-4 opacity-80" />
              <p className="text-sm font-medium">No posts found.</p>
              {isOwner && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent("showReleaseModal", { detail: { autoClick: 'album' } }));
                  }}
                  className="mt-4 px-4 py-2 bg-rose-500 text-white text-sm rounded-full shadow-lg hover:bg-slate-800 transition active:scale-95 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  Post now
                </button>
              )}
            </div>
          ) : (
            <div className="p-2 sm:p-4 post-grid-container">
              <MasonryGrid
                items={mediaPosts}
                type="post"
                openPostWithUrl={openPostWithUrl}
                toggleLike={toggleLike}
                getNoteStyles={getNoteStyles}
                setFullImageUrl={setFullImageUrl}
                profileApi={profileApi}
              />
            </div>
          )}
        </div>

        {/* Products pane — visible for any business profile */}
        {profileApi?.is_business_owner && profileApi?.business?.business_id && (
          <div style={{ width: `${100 / tabs.length}%`, height: tabs[activeTabIndex] === "Products" ? "auto" : "0", overflow: "hidden" }}>
            {productsLoading ? (
              <ShimmerGrid count={10} />
            ) : vendorProducts.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
                <img src="/assets/images/post.png" alt="No products" className="lg:w-30 lg:h-40 w-20 h-20 object-contain mb-4 opacity-80" />
                <p className="text-sm font-medium">Vendor has no product yet!.</p>
              </div>
            ) : (
              <div className="p-2 sm:p-4 post-grid-container">
                <MasonryGrid
                  items={vendorProducts}
                  type="product"
                  formatUrl={formatUrl}
                  handleProductClick={handleProductClick}
                  handleLikeClick={handleProductLike}
                  likeData={productLikeData}
                  fetchingProductId={fetchingProductId}
                  profileApi={profileApi}
                />
              </div>
            )}
          </div>
        )}

        {/* Liked Items pane */}
        {isOwner && tabs.includes("Liked") && (
          <div style={{ width: `${100 / tabs.length}%`, height: tabs[activeTabIndex] === "Liked" ? "auto" : "0", overflow: "hidden" }}>
            {likedLoading ? (
              <ShimmerGrid count={10} />
            ) : likedItems.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
                <img src="/assets/images/post.png" alt="No liked items" className="w-40 h-40 object-contain mb-4 opacity-80" />
                <p className="text-sm font-medium">You haven't liked anything yet.</p>
              </div>
            ) : (
              <div className="p-2 sm:p-4 post-grid-container pb-12">
                <MasonryGrid
                  items={likedItems}
                  type="liked"
                  openPostWithUrl={openPostWithUrl}
                  toggleLike={toggleLike}
                  getNoteStyles={getNoteStyles}
                  setFullImageUrl={setFullImageUrl}
                  formatUrl={formatUrl}
                  handleProductClick={handleProductClick}
                  handleLikeClick={handleProductLike}
                  likeData={productLikeData}
                  fetchingProductId={fetchingProductId}
                  profileApi={profileApi}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="">
      <Header
        profileApi={profileApi}
        displayName={displayName}
        isFollowing={isFollowing}
        isBlocked={isBlocked}
        followersCount={followersCount}
        products={vendorProducts}
        onVisitShop={() => {
          const business = profileApi?.business;
          if (business) {
            const slug = business.business_slug || (business.business_name ? slugify(business.business_name) : null);
            if (slug) router.push(`/shop/${slug}`);
          }
        }}
        onFollowToggle={(val) => {
          setIsFollowing(val);
          setFollowersCount(prev => val ? prev + 1 : Math.max(0, prev - 1));
        }}
        onSocialClick={async (tab) => {
          const loggedIn = await auth.ensureLoggedIn();
          if (!loggedIn) return;

          if (tab === "liked") {
            const idx = tabs.indexOf("Liked");
            if (idx !== -1) setActiveTabIndex(idx);
            return;
          }
          setActiveSocialTab(tab);
          setSocialModalOpen(true);
        }}
      />

      {TabsBar}
      {TabPanes}

      <AnimatePresence>
        {selectedPost && (
          <PostModal
            open={!!selectedPost}
            post={selectedPost}
            onClose={closeModal}
            onToggleLike={toggleLike}
            targetUserId={profileApi?.user?.user_id || profileApi?.user?.id || (viewUserId === "me" ? auth?.user?.user_id : viewUserId)}
          />
        )}
      </AnimatePresence>

      {productModalOpen && selectedProductPayload && (
        <ProductPreviewModal
          open={productModalOpen}
          payload={selectedProductPayload}
          onClose={() => {
            setProductModalOpen(false);
            setSelectedProductPayload(null);
          }}
          onProductClick={handleProductClick}
        />
      )}
      {fullImageUrl && <ImageViewer src={fullImageUrl} onClose={() => setFullImageUrl(null)} />}

      {socialModalOpen && (
        <SocialModal
          isOpen={socialModalOpen}
          onClose={() => setSocialModalOpen(false)}
          userId={viewUserId}
          userName={displayName}
          initialTab={activeSocialTab === "liked" ? "followers" : activeSocialTab as any}
          onFollowUpdate={handleFollowUpdate}
        />
      )}

      {/* Follow Suggestion Popup */}
      <AnimatePresence>
        {showFollowSuggestion && !isFollowing && (
          <motion.div
            initial={{ y: 100, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 100, opacity: 0, x: "-50%" }}
            className="fixed bottom-6 left-1/2 bg-white rounded-[0.5rem] p-3 flex items-center gap-3 w-[calc(100%-2rem)] max-w-[400px] shadow-2xl"
          >
            {/* Left: Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-100 shrink-0">
                <img
                  src={
                    profileApi?.business?.business_logo ??
                    profileApi?.business?.logo ??
                    profileApi?.user?.profile_pic ??
                    profileApi?.user?.avatar ??
                    DEFAULT_AVATAR
                  }
                  className="w-full h-full object-cover"
                  alt={displayName}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-900 truncate">{displayName}</p>
                <p className="text-[12px] text-slate-500 truncate">How about following me?</p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFollow();
                }}
                className="bg-rose-500 text-white px-5 py-2 rounded-full text-xs  active:scale-95 transition shadow-sm whitespace-nowrap"
              >
                Follow
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
