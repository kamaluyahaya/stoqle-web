// profile/page.tsx
"use client";

import React, { useEffect, useMemo, useLayoutEffect, useState, useRef } from "react";
import PostModal from "../../components/modal/postModal";
import SocialModal from "../../components/modal/socialModal";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { useAuth } from "@/src/context/authContext";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "../../components/feed/profile/header";
import CreateNoteModal from "../../components/notes/createNoteModal";
import EditPostModal from "../../components/modal/editPostModal";
import ShimmerGrid from "@/src/components/shimmer";
import { fetchBusinessProducts, fetchProductById, toggleProductLike } from "@/src/lib/api/productApi";
import { toggleSocialPostLike } from "@/src/lib/api/social";
import type { Post, User } from "@/src/lib/types";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import type { PreviewPayload, ProductSku } from "@/src/types/product";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import { API_BASE_URL } from "@/src/lib/config";
import { FaHeart, FaRegHeart, FaEllipsisV, FaEdit, FaTrash, FaShareAlt, FaThumbtack } from "react-icons/fa";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { PROFILE_CACHE } from "@/src/lib/cache";
import { io } from "socket.io-client";
import { copyToClipboard } from "@/src/lib/utils/utils";
import Link from "next/link";


type ApiPost = any;

type Props = { postCount?: number };


const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i;
const isVideoUrl = (u?: string) => !!u && VIDEO_EXT_RE.test(u);
const isImageUrl = (u?: string) => !!u && IMAGE_EXT_RE.test(u);

// Use local images in public folder
const NO_IMAGE_PLACEHOLDER = "/assets/images/favio.png"; // fallback post image
const DEFAULT_AVATAR = "/assets/images/favio.png";       // fallback avatar
const DEFAULT_BG = "/assets/images/background.png";      // fallback background


// keep mapping but mark isImage too
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

  const allMedia = images.length > 0
    ? images.map((i: any) => ({ url: i?.image_url, id: i?.social_post_image_id || i?.post_image_id || i?.id }))
    : src ? [{ url: src, id: p?.cover_id }] : [];

  const isVideo = p?.cover_type === "video" || isVideoUrl(src);
  const isImage = !isVideo && isImageUrl(src);
  const caption = p?.text ?? p?.subtitle ?? "";
  const note_caption = p?.subtitle ?? "";

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
      avatar: p?.author_pic ?? p?.user?.profile_pic ?? DEFAULT_AVATAR,
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
    allMedia,
    location: p?.location,
    thumbnail,
    isPinned: Boolean(p?.is_pinned),
    pinnedAt: p?.pinned_at,
    status: p?.status,
    is_product_linked: Boolean(p?.is_product_linked),
    linked_product: p?.linked_product,
    original_audio_url: p?.original_audio_url,
    original_video_url: p?.original_video_url,
  };
};

function getRelativeTime(dateString: string | Date | undefined) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";

  const m = Math.floor(diffInSeconds / 60);
  if (m < 60) return `${m}${m === 1 ? "min" : "mins"} ago`;

  const h = Math.floor(m / 60);
  if (h < 24) return `${h}${h === 1 ? "hr" : "hrs"} ago`;

  const d = Math.floor(h / 24);
  if (d < 7) return `${d}${d === 1 ? "day" : "days"} ago`;

  const w = Math.floor(d / 7);
  if (d < 30) return `${w}${w === 1 ? " week" : " weeks"} ago`;

  const mo = Math.floor(d / 30);
  if (d < 365) return `${mo}${mo === 1 ? " month" : " months"} ago`;

  const y = Math.floor(d / 365);
  return `${y}${y === 1 ? " year" : " years"} ago`;
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
const PostCard = React.memo(({
  post,
  openPostWithUrl,
  toggleLike,
  getNoteStyles,
  setFullImageUrl,
  onEdit,
  onPin,
  onShare,
  onDelete,
  layoutId
}: any) => {
  const [showBurst, setShowBurst] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <motion.article
      layout
      layoutId={layoutId || `post-${post.id}`}
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

        {/* {!post.isVideo && post.allMedia && post.allMedia.length > 1 && (
          <div className="absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/50">
            <FaImages className="text-white text-[10px]" />
          </div>
        )} */}

        {post.status === 'processing' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[3px]">
            <div className="w-9 h-9 rounded-full border-[3px] border-white/20 border-t-white animate-spin mb-2" />
            <span className="text-[11px] font-bold text-white px-3 text-center drop-shadow-md leading-tight">
              {post.isVideo ? "Processing your video..." : "Processing..."}
            </span>
          </div>
        )}

        {post.coverType === "note" && !post.src ? (
          <div
            className="w-full h-[250px] sm:h-[300px] flex items-center justify-center p-6 relative overflow-hidden"
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
          <div className="relative w-full overflow-hidden bg-slate-100">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-black text-slate-300 opacity-40 select-none">stoqle</span>
            </div>
            <img
              src={post.thumbnail || post.src || NO_IMAGE_PLACEHOLDER}
              alt={post.caption}
              className="w-full h-auto min-h-[180px] sm:min-h-[200px] max-h-[250px] sm:max-h-[320px] object-cover transition-transform duration-700 group-hover:scale-110 relative z-[1]"
            />
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="text-sm text-slate-700 line-clamp-2 leading-snug mb-3">
          {post.coverType === "note" && !post.src ? post.note_caption : post.caption}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-[11px] text-slate-400 capitalize">
              {getRelativeTime(post.rawCreatedAt)}
            </span>
          </div>

          <div className="flex items-center gap-3">
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

            <div className="relative" ref={menuRef}>
              <button
                className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
              >
                <FaEllipsisV className="text-sm" />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 bottom-full mb-2 w-32 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-50 overflow-hidden"
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit?.(post); }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <FaEdit className="text-slate-400" /> Edit post
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onPin?.(post); }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <FaThumbtack className={post.isPinned ? "text-rose-500" : "text-slate-400"} />
                      {post.isPinned ? "Unpin" : "Pin post"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onShare?.(post); }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <FaShareAlt className="text-slate-400" /> Share
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete?.(post); }}
                      className="w-full px-4 py-2 text-left text-xs text-rose-500 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-50"
                    >
                      <FaTrash className="text-rose-400" /> Delete
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}, (prev, next) => {
  return prev.post.id === next.post.id &&
    prev.post.liked === next.post.liked &&
    prev.post.likeCount === next.post.likeCount &&
    prev.post.isPinned === next.post.isPinned &&
    prev.post.caption === next.post.caption &&
    prev.post.src === next.post.src &&
    prev.post.thumbnail === next.post.thumbnail &&
    prev.post.status === next.post.status &&
    prev.post.note_caption === next.post.note_caption;
});
PostCard.displayName = "PostCard";


const ProductCard = React.memo(({
  p,
  index = 0,
  formatUrl,
  handleProductClick,
  handleLikeClick,
  isLiked,
  likeCount,
  fetchingProduct,
  isProductOwner = false,
  isRestored = false,
  onPin,
  onShare,
  layoutId
}: any) => {
  const [showBurst, setShowBurst] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const now = new Date();
  const effectivePromo = useMemo(() => {
    // 1. If product uses its OWN policy (use_store_default_promotions === 0), do NOT fallback to defaults
    if (p.use_store_default_promotions === 0) {
      // Check for product-specific PPS promos
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

      // Check for product-specific PPS sale override
      if (p.sale_discount_data && p.sale_discount_data.discount > 0) {
        const sType = p.sale_discount_data.type;
        const sTitle = (sType && sType !== 'percent' && sType !== 'amount') ? sType : "Sale";
        return { title: sTitle, discount: Number(p.sale_discount_data.discount) };
      }

      // STRICT: if they have custom policy, even if inactive, we don't fallback to business defaults
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

  const isPromoActive = !!effectivePromo;

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
    <motion.article
      layout
      layoutId={layoutId || `product-${p.product_id}`}
      transition={{ layout: { duration: 0.4, type: "spring", stiffness: 300, damping: 30 } }}
      key={p.product_id}
      onClick={(e) => handleProductClick(p.product_id, p.business_name, e)}
      className="group flex flex-col sm:rounded-xl rounded-md bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden"
    >
      <div className="relative w-full bg-slate-100 overflow-hidden post-media">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-black text-slate-300 opacity-40 select-none">stoqle</span>
        </div>
        {p.isPinned && (
          <div className="absolute top-3 left-3 z-20 flex items-center px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-md">
            <span className="text-[10px] font-bold">Pinned</span>
          </div>
        )}
        <motion.div
          initial={entryVariants.initial}
          animate={entryVariants.animate}
          transition={entryVariants.transition}
          className="w-full h-full relative z-[1]"
        >
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
            <div className="relative w-full h-full bg-slate-50 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-black text-slate-300 opacity-40 select-none">stoqle</span>
              </div>
              {/* Placeholder frame indicator */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 rounded-full border-2 border-slate-300 border-t-transparent animate-spin opacity-20" />
                </div>
              </div>
              <style jsx global>{`
                            @keyframes fadeIn {
                                from { opacity: 0; }
                                to { opacity: 1; }
                            }
                        `}</style>
              <img
                src={formatUrl(p.first_image)}
                alt={p.title}
                className="w-full h-auto min-h-[180px] sm:min-h-[200px] max-h-[250px] sm:max-h-[320px] object-cover transition-transform duration-700 group-hover:scale-110 relative z-[1]"
                onLoad={(e) => {
                  (e.target as HTMLImageElement).style.animation = "fadeIn 0.6s ease-in-out forwards";
                }}
                style={{ opacity: 0 }}
              />
            </div>
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
        </motion.div>


      </div>

      <div className="p-3">
        <div className="flex items-center justify-between pt-1 mb-1">
          <span className="text-slate-900 text-sm font-bold">₦{Number(p.price || 0).toLocaleString()}</span>
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
        <h3 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug" title={p.title}>
          {p.title}
        </h3>
        <div className="mt-2 min-h-[14px] flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {effectivePromo ? (
              <span className="text-[9px] text-rose-500 border-rose-500 border-[0.2px] px-1.5 py-0.5 ">
                {effectivePromo.title ? `${effectivePromo.title}: ` : "Sale: "}{effectivePromo.discount}% OFF
              </span>
            ) : (p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) <= 4) ? (
              <span className="text-[9px] text-rose-500 ">
                Only {Number(p.total_quantity)} Left
              </span>
            ) : p.return_shipping_subsidy ? (
              <span className="text-[9px] text-emerald-600 border-emerald-500 border-[0.2px] px-1.5 py-0.5 ">
                Return shipping subsidy
              </span>
            ) : null}

          </div>

          <div className="relative" ref={menuRef}>
            <button
              className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
            >
              <FaEllipsisV className="text-[10px]" />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 bottom-full mb-2 w-32 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-50 overflow-hidden"
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onPin?.(p); }}
                    className="w-full px-4 py-2 text-left text-[11px] text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FaThumbtack className={p.isPinned ? "text-rose-500" : "text-slate-400"} />
                    {p.isPinned ? "Unpin" : "Pin product"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onShare?.(p); }}
                    className="w-full px-4 py-2 text-left text-[11px] text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FaShareAlt className="text-slate-400" /> Share
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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

const MasonryGrid = ({
  items,
  type,
  openPostWithUrl,
  toggleLike,
  getNoteStyles,
  formatUrl,
  handleProductClick,
  handleLikeClick,
  likeData,
  fetchingProductId,
  isRestored,
  onDelete,
  onShare,
  onPin,
  onEdit
}: any) => {
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


  const columnData = useMemo(() => {
    const data = Array.from({ length: columns }, () => [] as any[]);
    items.forEach((item: any, index: number) => {
      data[index % columns].push({ ...item, originalIndex: index });
    });
    return data;
  }, [items, columns]);

  return (
    <LayoutGroup>

      <div className="flex gap-2 sm:gap-6 items-start w-full max-w-full overflow-hidden mb-20">
        {columnData.map((colItems, colIdx) => {
          let visibilityClass = "flex-1 flex flex-col gap-2 sm:gap-6 min-w-0";
          if (colIdx === 2) visibilityClass += " hidden [@media(min-width:700px)]:flex";
          if (colIdx === 3) visibilityClass += " hidden [@media(min-width:1210px)]:flex";
          if (colIdx === 4) visibilityClass += " hidden [@media(min-width:1430px)]:flex";

          return (
            <div key={colIdx} className={visibilityClass}>
              {colItems.map((item: any) => {
                const isPost = type === 'post' || type === 'note' || type === 'linked' || (type === 'liked' && !item.isProduct);
                if (isPost) {
                  return (
                    <PostCard
                      key={`${item.id}-${type}`}
                      layoutId={`${type}-post-${item.id}`}
                      post={item}
                      index={item.originalIndex}
                      openPostWithUrl={openPostWithUrl}
                      toggleLike={toggleLike}
                      getNoteStyles={getNoteStyles}
                      isRestored={isRestored}
                      onDelete={onDelete}
                      onShare={onShare}
                      onPin={onPin}
                      onEdit={onEdit}
                    />
                  );
                } else {
                  const ld = (likeData && item.product_id) ? likeData[item.product_id] || { liked: !!item.isLiked, count: item.likes_count || 0 } : { liked: !!item.isLiked, count: item.likes_count || 0 };
                  return (
                    <ProductCard
                      key={`${item.product_id}-${type}`}
                      layoutId={`${type}-product-${item.product_id}`}
                      p={item}
                      index={item.originalIndex}
                      formatUrl={formatUrl}
                      handleProductClick={handleProductClick}
                      handleLikeClick={handleLikeClick}
                      isLiked={ld.liked}
                      likeCount={ld.count}
                      fetchingProduct={fetchingProductId === item.product_id}
                      isRestored={isRestored}
                      onPin={onPin}
                      onShare={onShare}
                    />
                  );
                }
              })}
            </div>
          );
        })}
      </div>
    </LayoutGroup>
  );
};

export default function ProfileHeader({ postCount = 12 }: Props) {
  const [profileApi, setProfileApi] = useState<any | null>(PROFILE_CACHE.profileApi);
  const [profileLoading, setProfileLoading] = useState(PROFILE_CACHE.profileApi === null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [mediaPosts, setMediaPosts] = useState<Post[]>(PROFILE_CACHE.visibilityMap[PROFILE_CACHE.activeVisibility]?.media || PROFILE_CACHE.mediaPosts);
  const [notePosts, setNotePosts] = useState<Post[]>(PROFILE_CACHE.visibilityMap[PROFILE_CACHE.activeVisibility]?.notes || PROFILE_CACHE.notePosts);
  const [postsLoading, setPostsLoading] = useState(!PROFILE_CACHE.visibilityMap[PROFILE_CACHE.activeVisibility]);
  const [isRestoring, setIsRestoring] = useState<boolean>(!!PROFILE_CACHE.visibilityMap[PROFILE_CACHE.activeVisibility]);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [editPostOpen, setEditPostOpen] = useState(false);
  const [postToEdit, setPostToEdit] = useState<Post | null>(null);
  const [navbarHeight, setNavbarHeight] = useState(56);
  const [isMiniHeaderVisible, setIsMiniHeaderVisible] = useState(false);
  const tabsWrapperRef = useRef<HTMLDivElement>(null);
  const tabsInnerRef = useRef<HTMLDivElement>(null);

  // Products state
  const [vendorProducts, setVendorProducts] = useState<any[]>(PROFILE_CACHE.vendorProducts);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [fetchingProduct, setFetchingProduct] = useState(false);
  const [productLikeData, setProductLikeData] = useState<Record<number | string, { liked: boolean, count: number }>>(PROFILE_CACHE.productLikeData);
  const [fetchingProductId, setFetchingProductId] = useState<number | string | null>(null);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [activeSocialTab, setActiveSocialTab] = useState<"friends" | "followers" | "following" | "recommend" | "liked">("followers");

  const [likedItems, setLikedItems] = useState<any[]>(PROFILE_CACHE.likedItems || []);
  const [likedLoading, setLikedLoading] = useState(PROFILE_CACHE.likedItems?.length === 0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeVisibility, setActiveVisibility] = useState<"public" | "private" | "friends">(PROFILE_CACHE.activeVisibility);
  const [visibilityCounts, setVisibilityCounts] = useState(PROFILE_CACHE.visibilityCounts);

  // On mount: check sessionStorage for a pending post and inject it optimistically
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pending_post');
      if (!raw) return;
      sessionStorage.removeItem('pending_post');
      const apiPost = JSON.parse(raw);
      const mapped = mapApiPost(apiPost);
      setMediaPosts(prev => {
        if (prev.some(p => String(p.id) === String(mapped.id))) return prev;
        return [mapped, ...prev];
      });
      // Update cache too
      PROFILE_CACHE.mediaPosts = [mapped, ...PROFILE_CACHE.mediaPosts].filter(
        (p, i, arr) => arr.findIndex(x => String(x.id) === String(p.id)) === i
      );
    } catch (_) { }
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for post-created event, inject optimistically or trigger re-fetch
  useEffect(() => {
    const handlePostCreated = (e: Event) => {
      const customEvt = e as CustomEvent;
      const apiPost = customEvt.detail;
      if (!apiPost?.social_post_id) {
        setRefreshKey(prev => prev + 1);
        return;
      }
      const mapped = mapApiPost(apiPost);
      const isNote = mapped.coverType === "note";

      if (isNote) {
        setNotePosts(prev => {
          if (prev.some(p => String(p.id) === String(mapped.id))) return prev;
          return [mapped, ...prev];
        });
        PROFILE_CACHE.notePosts = [mapped, ...PROFILE_CACHE.notePosts].filter((p, i, arr) => arr.findIndex(x => String(x.id) === String(p.id)) === i);
        setVisibilityCounts(prev => ({
          ...prev,
          [activeVisibility]: { ...prev[activeVisibility], notes: prev[activeVisibility].notes + 1 }
        }));
      } else {
        setMediaPosts(prev => {
          if (prev.some(p => String(p.id) === String(mapped.id))) return prev;
          return [mapped, ...prev];
        });
        PROFILE_CACHE.mediaPosts = [mapped, ...PROFILE_CACHE.mediaPosts].filter((p, i, arr) => arr.findIndex(x => String(x.id) === String(p.id)) === i);
        setVisibilityCounts(prev => ({
          ...prev,
          [activeVisibility]: { ...prev[activeVisibility], posts: prev[activeVisibility].posts + 1 }
        }));
      }
    };
    window.addEventListener("post-created", handlePostCreated);
    return () => window.removeEventListener("post-created", handlePostCreated);
  }, []);

  // (socket effect moved below auth declaration)

  const sortedMediaPosts = useMemo(() => {
    return [...mediaPosts].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (a.isPinned && b.isPinned) {
        return new Date(b.pinnedAt || b.rawCreatedAt || 0).getTime() - new Date(a.pinnedAt || a.rawCreatedAt || 0).getTime();
      }
      return new Date(b.rawCreatedAt || 0).getTime() - new Date(a.rawCreatedAt || 0).getTime();
    });
  }, [mediaPosts]);

  const sortedNotePosts = useMemo(() => {
    return [...notePosts].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (a.isPinned && b.isPinned) {
        return new Date(b.pinnedAt || b.rawCreatedAt || 0).getTime() - new Date(a.pinnedAt || a.rawCreatedAt || 0).getTime();
      }
      return new Date(b.rawCreatedAt || 0).getTime() - new Date(a.rawCreatedAt || 0).getTime();
    });
  }, [notePosts]);

  // Derived: all posts (media + notes) that have a linked product
  const sortedLinkedPosts = useMemo(() => {
    const allPosts = [...mediaPosts, ...notePosts].filter(p => p.is_product_linked);
    return [...allPosts].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.rawCreatedAt || 0).getTime() - new Date(a.rawCreatedAt || 0).getTime();
    });
  }, [mediaPosts, notePosts]);

  const sortedLikedItems = useMemo(() => {
    return [...likedItems].sort((a, b) => {
      const pinA = !!a.isPinned;
      const pinB = !!b.isPinned;
      if (pinA && !pinB) return -1;
      if (!pinA && pinB) return 1;
      if (pinA && pinB) {
        return new Date(b.pinnedAt || b.rawCreatedAt || 0).getTime() - new Date(a.pinnedAt || a.rawCreatedAt || 0).getTime();
      }
      const dateA = new Date(a.liked_at || a.rawCreatedAt || 0).getTime();
      const dateB = new Date(b.liked_at || b.rawCreatedAt || 0).getTime();
      return dateB - dateA;
    });
  }, [likedItems]);

  const sortedVendorProducts = useMemo(() => {
    return [...vendorProducts].sort((a, b) => {
      const pinA = !!a.isPinned;
      const pinB = !!b.isPinned;
      if (pinA && !pinB) return -1;
      if (!pinA && pinB) return 1;
      if (pinA && pinB) {
        return new Date(b.pinnedAt || b.pinned_at || b.created_at || 0).getTime() - new Date(a.pinnedAt || a.pinned_at || a.created_at || 0).getTime();
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [vendorProducts]);

  const formatUrl = (url: string) => {
    if (!url) return NO_IMAGE_PLACEHOLDER;
    if (url.startsWith("http")) return url;
    return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
  };

  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Real-time socket: listen for post_updated events (e.g. processing -> ready)
  const socketUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const userId = auth?.user?.user_id || auth?.user?.id;
    if (!userId) return;
    const userIdStr = String(userId);
    if (socketUserIdRef.current === userIdStr) return;
    socketUserIdRef.current = userIdStr;

    const socket = io(API_BASE_URL, {
      query: { userId: userIdStr },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log(`[Profile] Socket connected for user ${userIdStr}`);
    });

    socket.on("post_created", (newPost: any) => {
      if (!newPost?.social_post_id) return;
      console.log("[Profile] post_created received:", newPost?.social_post_id);
      const mapped = mapApiPost(newPost);
      if (String(mapped.user.id) === userIdStr) {
        if (mapped.coverType === "note") {
          setNotePosts(prev => {
            if (prev.find(p => String(p.id) === String(mapped.id))) return prev;
            return [mapped, ...prev];
          });
        } else {
          setMediaPosts(prev => {
            if (prev.find(p => String(p.id) === String(mapped.id))) return prev;
            return [mapped, ...prev];
          });
        }
      }
    });

    socket.on("post_updated", (updatedPost: any) => {
      console.log("[Profile] post_updated received:", updatedPost?.social_post_id, 'status:', updatedPost?.status);
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

      // Also update cache
      PROFILE_CACHE.mediaPosts = PROFILE_CACHE.mediaPosts.map(p =>
        String(p.id) === String(updatedPost.social_post_id) ? { ...p, ...updated } : p
      );
    });

    socket.on('profile_update', (updatedProfile: any) => {
      const profileId = profileApi?.user?.user_id || profileApi?.user?.id || profileApi?.user_id;
      const updatedId = updatedProfile?.user?.user_id || updatedProfile?.user?.id || updatedProfile?.user_id;

      if (String(updatedId) === String(profileId)) {
        setProfileApi(updatedProfile);
        PROFILE_CACHE.profileApi = updatedProfile;
      }
    });

    return () => {
      socket.disconnect();
      socketUserIdRef.current = null;
    };
  }, [auth?.user?.user_id, auth?.user?.id]);

  const handleFollowUpdate = (targetUserId: string | number, following: boolean) => {
    // Since this is the "me" profile page, any follow action from the modal
    // (follow/unfollow someone else) affects the viewer's "following" count.
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
  };

  // Tabs state & animation
  const [activeTabIndex, setActiveTabIndex] = useState(PROFILE_CACHE.activeTabIndex);
  const tabs = useMemo(() => {
    const base = ["Posts", "Notes"];
    const bizStatus = String(profileApi?.business?.business_status || profileApi?.business_status || '').toLowerCase();
    if (profileApi?.is_business_owner && ['active', 'verified', 'approved', 'approved_verified', 'published'].includes(bizStatus)) {
      base.push("Products");
    }
    // Show "Linked Post" tab only when the user has at least one post with a linked product
    if (sortedLinkedPosts.length > 0) {
      base.push("Linked Post");
    }
    base.push("Liked");
    return base;
  }, [profileApi?.is_business_owner, profileApi?.business?.business_status, sortedLinkedPosts.length]);

  useEffect(() => {
    const tabName = searchParams.get("tab");
    if (tabName) {
      const idx = tabs.indexOf(tabName);
      if (idx !== -1) setActiveTabIndex(idx);
    }
  }, [searchParams, tabs]);

  useEffect(() => {
    PROFILE_CACHE.activeTabIndex = activeTabIndex;

    // Reset visibility to public when switching to non-post/note tabs if needed,
    // though keeping it persistent across Post/Note tabs might be better.
    // However, if we are on "Products" or "Liked", visibility sub-tabs shouldn't show.

    // Only reset scroll if we are already scrolled past the content area
    const timer = setTimeout(() => {
      if (tabsWrapperRef.current) {
        const contentTop = tabsWrapperRef.current.offsetTop - (navbarHeight || 56);

        // If current scroll is further down than the tabs top, snap back to tabs top
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

  useEffect(() => {
    // When visibility changes, we check if we have it in cache to avoid shimmer.
    PROFILE_CACHE.activeVisibility = activeVisibility;
    const cached = PROFILE_CACHE.visibilityMap[activeVisibility];

    if (cached) {
      // Synchronously restore from cache for instant UI response
      setMediaPosts(cached.media);
      setNotePosts(cached.notes);
      setPostsLoading(false);
    } else {
      // Only clear and show shimmer if we genuinely have no data
      setMediaPosts([]);
      setNotePosts([]);
      setPostsLoading(true);
    }

    // We only trigger a background refresh if we haven't fetched this tab very recently (e.g. last 30s)
    // or if we have no cache at all.
    const now = Date.now();
    const lastFetched = PROFILE_CACHE.lastVisibilityFetchAt?.[activeVisibility] || 0;
    if (!cached || (now - lastFetched > 30000)) {
      setRefreshKey(prev => prev + 1);
    }
  }, [activeVisibility]);

  const [isFollowing, setIsFollowing] = useState(false);

  // Scroll listener for MiniHeader & sticky logic sync
  useEffect(() => {
    const handleScroll = () => {
      setIsMiniHeaderVisible(window.scrollY > 0);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  // history push tracking for modal
  const pushedRef = useRef(false);

  // swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // fetch profile from auth endpoint
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function loadProfile() {
      if (PROFILE_CACHE.profileApi) {
        setProfileLoading(false);
      } else {
        setProfileLoading(true);
      }
      setProfileError(null);
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || "";
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${base.replace(/\/$/, "")}/api/auth/profile/me`, {
          signal: controller.signal,
          headers,
        });

        if (!res.ok) {
          throw new Error(`Profile API returned ${res.status}`);
        }

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
          latest_ip: d?.latest_ip ?? null,
          latest_location: d?.latest_location ?? null,
          is_verified_partner: Boolean(d?.is_verified_partner),
        };
        setProfileApi(normalized);
        PROFILE_CACHE.profileApi = normalized;
        PROFILE_CACHE.lastFetchedAt = Date.now();
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
  }, []);

  // fetch liked items
  useEffect(() => {
    if (tabs[activeTabIndex] !== "Liked") return;

    let cancelled = false;

    async function loadLikedItems() {
      if (PROFILE_CACHE.likedItems && PROFILE_CACHE.likedItems.length > 0) {
        setLikedLoading(false);
      } else {
        setLikedLoading(true);
      }
      try {
        const token = localStorage.getItem("token");
        const headers = {
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
        PROFILE_CACHE.likedItems = merged;
        PROFILE_CACHE.lastLikedFetchedAt = Date.now();
      } catch (err) {
        console.error("Failed to load liked items:", err);
      } finally {
        if (!cancelled) setLikedLoading(false);
      }
    }
    loadLikedItems();
    return () => { cancelled = true; };
  }, [activeTabIndex, tabs]);

  // fetch vendor products if owner
  useEffect(() => {
    const businessId = profileApi?.business?.business_id || profileApi?.business?.id;
    const isOwner = profileApi?.is_business_owner;

    if (!businessId || !isOwner) return;

    const loadVendorProducts = async () => {
      if (PROFILE_CACHE.vendorProducts && PROFILE_CACHE.vendorProducts.length > 0) {
        setProductsLoading(false);
      } else {
        setProductsLoading(true);
      }
      try {
        const identifier = profileApi?.business?.business_slug || businessId;
        const res = await fetchBusinessProducts(identifier, 100);
        let foundProducts = [];
        if (res?.data?.products && Array.isArray(res.data.products)) {
          foundProducts = res.data.products;
        } else if (res?.data && Array.isArray(res.data)) {
          foundProducts = res.data;
        } else if (Array.isArray(res)) {
          foundProducts = res;
        }
        const mapped = foundProducts.map((p: any) => ({
          ...p,
          isLiked: p.is_liked,
          likes_count: p.likes_count || 0,
        }));
        const nextLikeData: Record<number, { liked: boolean, count: number }> = {};
        mapped.forEach((p: any) => {
          nextLikeData[p.product_id] = { liked: p.isLiked, count: p.likes_count };
        });
        setVendorProducts(mapped);
        setProductLikeData(nextLikeData);
        PROFILE_CACHE.vendorProducts = mapped;
        PROFILE_CACHE.productLikeData = nextLikeData;
      } catch (err) {
        console.error("Failed to load products", err);
      } finally {
        setProductsLoading(false);
      }
    };
    loadVendorProducts();
  }, [profileApi]);

  // fetch posts from social endpoint
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function loadPosts() {
      const cached = PROFILE_CACHE.visibilityMap[activeVisibility];
      if (cached) {
        // Already restored from cache but ensure loading state is false for background fetch
        setPostsLoading(false);
        setIsRestoring(false);
      } else {
        setPostsLoading(true);
      }
      setPostsError(null);
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || "";
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const url = new URL(`${base.replace(/\/$/, "")}/api/social/me`);
        url.searchParams.set("privacy", activeVisibility);
        url.searchParams.set("limit", String(postCount));

        const resp = await fetch(url.toString(), {
          signal: controller.signal,
          headers,
        });

        if (!resp.ok) {
          throw new Error(`Posts API returned ${resp.status}`);
        }

        const json = await resp.json();
        const apiPosts: any[] = json?.data?.posts ?? json?.data ?? json?.posts ?? [];
        if (json?.data?.visibilityCounts || json?.visibilityCounts) {
          const counts = json?.data?.visibilityCounts || json?.visibilityCounts;
          setVisibilityCounts(prev => ({ ...prev, ...counts }));
          PROFILE_CACHE.visibilityCounts = { ...PROFILE_CACHE.visibilityCounts, ...counts };
        }

        if (cancelled) return;

        const mapped = apiPosts.map((p) => mapApiPost(p));
        const media: Post[] = [];
        const notes: Post[] = [];

        for (const m of mapped) {
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

        const finalMedia = media.slice(0, postCount);
        const finalNotes = notes.slice(0, postCount);

        setMediaPosts(finalMedia);
        setNotePosts(finalNotes);

        // Update cache
        PROFILE_CACHE.visibilityMap[activeVisibility] = { media: finalMedia, notes: finalNotes };
        if (!PROFILE_CACHE.lastVisibilityFetchAt) PROFILE_CACHE.lastVisibilityFetchAt = {};
        PROFILE_CACHE.lastVisibilityFetchAt[activeVisibility] = Date.now();

        if (activeVisibility === 'public') {
          PROFILE_CACHE.mediaPosts = finalMedia;
          PROFILE_CACHE.notePosts = finalNotes;
        }
        PROFILE_CACHE.lastFetchedAt = Date.now();
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Failed to load posts:", err);
        if (!cancelled) setPostsError(err.message ?? "Failed to load posts");
      } finally {
        if (!cancelled) setPostsLoading(false);
        setIsRestoring(false); // Done restoring after initial load
      }
    }

    loadPosts();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [postCount, refreshKey]);

  // try open from URL on mount
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
        const res = await fetch(`${base.replace(/\/$/, "")}/api/social/${postId}`);
        if (!res.ok) throw new Error("Post not found");
        const json = await res.json();
        const single = mapApiPost(json?.data ?? json);
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

  // handle popstate
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
          // fetch individual
          (async () => {
            try {
              const base = process.env.NEXT_PUBLIC_API_URL;
              if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined in environment");
              const res = await fetch(`${base.replace(/\/$/, "")}/api/social/${postId}`);
              if (!res.ok) throw new Error("Post not found");
              const json = await res.json();
              setSelectedPost(mapApiPost(json?.data ?? json));
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

  const openPostWithUrl = (post: Post) => {
    setSelectedPost(post);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("post", String(post.id));
      window.history.pushState({ postId: post.id, modal: true }, "", url.toString());
      pushedRef.current = true;
    } catch (err) {
      console.warn("Failed to update URL", err);
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

  const toggleLike = async (postId: string | number) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;

    let targetPost: Post | undefined;
    const all = [...mediaPosts, ...notePosts, ...likedItems];
    targetPost = all.find(p => p.id === postId && !p.isProduct);

    if (!targetPost) return;

    const wasLiked = targetPost.liked;
    const newLiked = !wasLiked;
    const diff = newLiked ? 1 : -1;

    // Optimistic UI updates
    const updatePost = (p: Post) =>
      p.id === postId ? { ...p, liked: newLiked, likeCount: Math.max(0, p.likeCount + diff) } : p;

    setMediaPosts(prev => prev.map(updatePost));
    setNotePosts(prev => prev.map(updatePost));
    setLikedItems(prev => prev.map(p => (p.id === postId && !p.isProduct) ? updatePost(p) : p));

    // Update global total likes count if it's the user's own post
    const currentUserId = profileApi?.user?.user_id || profileApi?.user?.id;
    if (String(targetPost.user.id) === String(currentUserId)) {
      setProfileApi((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          stats: {
            ...prev.stats,
            total_likes: Math.max(0, (Number(prev.stats?.total_likes) || 0) + diff)
          }
        };
      });
    }

    try {
      const res = await toggleSocialPostLike(postId, token);
      const finalUpdate = (p: Post) =>
        p.id === postId ? { ...p, liked: res.data.liked, likeCount: res.data.likes_count } : p;
      setMediaPosts(prev => prev.map(finalUpdate));
      setNotePosts(prev => prev.map(finalUpdate));
      setLikedItems(prev => prev.map(p => (p.id === postId && !p.isProduct) ? finalUpdate(p) : p));
    } catch (err) {
      console.error("Like error", err);
      // Revert optimism if failed
      const revertPost = (p: Post) =>
        p.id === postId ? { ...p, liked: wasLiked, likeCount: targetPost!.likeCount } : p;
      setMediaPosts(prev => prev.map(revertPost));
      setNotePosts(prev => prev.map(revertPost));
      setLikedItems(prev => prev.map(p => (p.id === postId && !p.isProduct) ? revertPost(p) : p));

      if (String(targetPost.user.id) === String(currentUserId)) {
        setProfileApi((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            stats: {
              ...prev.stats,
              total_likes: Math.max(0, (Number(prev.stats?.total_likes) || 0) - diff)
            }
          };
        });
      }
    }
  };

  const handleProductLike = async (e: React.MouseEvent, productId: number, baseCount: number) => {
    e.stopPropagation();
    const token = localStorage.getItem("token");
    if (!token) return;

    const current = productLikeData[productId] || { liked: false, count: baseCount };
    const newLiked = !current.liked;
    const diff = newLiked ? 1 : -1;
    const newCount = Math.max(0, current.count + diff);

    // Find the product in vendorProducts or likedItems to check ownership
    const targetProduct = [...vendorProducts, ...likedItems].find(p => p.product_id === productId && p.isProduct);

    setProductLikeData(prev => ({
      ...prev,
      [productId]: { liked: newLiked, count: newCount }
    }));

    // Update likedItems optimistically
    setLikedItems(prev => prev.map(p => (p.product_id === productId && p.isProduct) ? { ...p, isLiked: newLiked, likes_count: newCount } : p));

    // Update global total likes count if it's the user's own product
    const currentBusinessId = profileApi?.business?.business_id || profileApi?.business?.id;
    if (targetProduct && String(targetProduct.business_id) === String(currentBusinessId)) {
      setProfileApi((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          stats: {
            ...prev.stats,
            total_likes: Math.max(0, (Number(prev.stats?.total_likes) || 0) + diff)
          }
        };
      });
    }

    try {
      const res = await toggleProductLike(productId, token);
      setProductLikeData(prev => ({
        ...prev,
        [productId]: { liked: res.data.liked, count: res.data.likes_count }
      }));
      setLikedItems(prev => prev.map(p => (p.product_id === productId && p.isProduct) ? { ...p, isLiked: res.data.liked, likes_count: res.data.likes_count } : p));
    } catch (err) {
      console.error("Like error", err);
      setProductLikeData(prev => ({ ...prev, [productId]: current }));
      setLikedItems(prev => prev.map(p => (p.product_id === productId && p.isProduct) ? { ...p, isLiked: current.liked, likes_count: current.count } : p));

      if (targetProduct && String(targetProduct.business_id) === String(currentBusinessId)) {
        setProfileApi((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            stats: {
              ...prev.stats,
              total_likes: Math.max(0, (Number(prev.stats?.total_likes) || 0) - diff)
            }
          };
        });
      }
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
    if (fetchingProductId) return;
    if (e) setClickPos({ x: e.clientX, y: e.clientY });
    else setClickPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const token = localStorage.getItem("token") || "";

    try {
      setFetchingProductId(productId);
      const res = await fetchProductById(productId, token);
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
    PROFILE_CACHE.activeTabIndex = index; // Update cache
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

  const handleDeletePost = async (post: Post) => {
    const result = await Swal.fire({
      title: "Delete Post?",
      text: "This post will be removed from your feed.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, delete it",
      background: "#ffffff",
      color: "#0f172a",
      backdrop: `rgba(15, 23, 42, 0.4)`,
      customClass: {
        popup: 'rounded-2xl border border-slate-100',
        confirmButton: 'rounded-full px-6 py-2 font-bold',
        cancelButton: 'rounded-full px-6 py-2 font-bold'
      }
    });

    if (!result.isConfirmed) return;

    // 🚀 Instantly remove from UI (Optimistic UI)
    const backupMedia = [...mediaPosts];
    const backupNotes = [...notePosts];
    const backupLiked = [...likedItems];

    setMediaPosts(prev => prev.filter(p => p.id !== post.id));
    setNotePosts(prev => prev.filter(p => p.id !== post.id));
    setLikedItems(prev => prev.filter(p => p.id !== post.id));

    // Update counts
    const type = post.coverType === 'note' ? 'notes' : 'posts';
    const postPrivacy = (post as any).privacy || 'public';
    setVisibilityCounts(prev => {
      const p = (prev as any)[postPrivacy];
      if (!p) return prev;
      return {
        ...prev,
        [postPrivacy]: { ...p, [type]: Math.max(0, p[type] - 1) }
      };
    });

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/social/${post.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Post deleted");
    } catch (err) {
      console.error("Delete failed", err);
      // Revert if failed
      setMediaPosts(backupMedia);
      setNotePosts(backupNotes);
      setLikedItems(backupLiked);
      toast.error("Failed to delete post");
    }
  };

  const handleEditPost = (post: Post) => {
    setPostToEdit(post);
    setEditPostOpen(true);
  };

  const handlePinPost = async (post: Post) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/social/${post.id}/pin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const updated = json.data?.post || json.data || json;
        const nextPinned = Boolean(updated.is_pinned ?? updated.isPinned ?? false);
        const pinnedAt = updated.pinned_at || updated.pinnedAt || new Date().toISOString();

        const updateFn = (prev: Post[]) => prev.map(p => p.id === post.id ? { ...p, isPinned: nextPinned, pinnedAt } : p);
        setMediaPosts(updateFn);
        setNotePosts(updateFn);
        setLikedItems(prev => prev.map(p => (p.id === post.id || p.apiId === post.id) ? { ...p, isPinned: nextPinned, pinnedAt } : p));
        toast.success(nextPinned ? "Post pinned" : "Post unpinned");
      }
    } catch (err) {
      console.error("Pin failed", err);
    }
  };

  const handleSharePost = (post: Post) => {
    const postUrl = `${window.location.origin}/profile?post=${post.id}`;
    if (navigator.share) {
      navigator.share({
        title: "Check out this post on Stoqle",
        text: post.caption,
        url: postUrl
      }).catch(() => { });
    } else {
      copyToClipboard(postUrl);
      toast.success("Link copied to clipboard!");
    }
  };

  const handlePinProduct = async (product: any) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/products/${product.product_id}/pin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const updated = json.data?.product || json.data || json;
        const nextPinned = Boolean(updated.is_pinned ?? updated.isPinned ?? false);
        const pinnedAt = updated.pinned_at || updated.pinnedAt || new Date().toISOString();

        setVendorProducts(prev => prev.map(p => p.product_id === product.product_id ? { ...p, isPinned: nextPinned, pinnedAt } : p));
        setLikedItems(prev => prev.map(p => p.product_id === product.product_id ? { ...p, isPinned: nextPinned, pinnedAt } : p));
        toast.success(nextPinned ? "Product pinned" : "Product unpinned");
      } else {
        // Fallback for demo/if API doesn't exist yet
        const nextPinned = !product.isPinned;
        const pinnedAt = new Date().toISOString();
        setVendorProducts(prev => prev.map(p => p.product_id === product.product_id ? { ...p, isPinned: nextPinned, pinnedAt } : p));
        setLikedItems(prev => prev.map(p => p.product_id === product.product_id ? { ...p, isPinned: nextPinned, pinnedAt } : p));
        toast.success(nextPinned ? "Product pinned" : "Product unpinned");
      }
    } catch (err) {
      console.error("Pin failed", err);
      setVendorProducts(prev => prev.map(p => p.product_id === product.product_id ? { ...p, isPinned: !p.isPinned } : p));
      toast.success(!product.isPinned ? "Product pinned" : "Product unpinned");
    }
  };

  const handleShareProduct = (product: any) => {
    const productUrl = `${window.location.origin}/market/${product.business_name}?product=${product.product_id}`;
    if (navigator.share) {
      navigator.share({
        title: product.title,
        text: `Check out this product: ${product.title}`,
        url: productUrl
      }).catch(() => { });
    } else {
      copyToClipboard(productUrl);
      toast.success("Link copied to clipboard!");
    }
  };

  const onShare = (item: any) => {
    if (item.product_id) handleShareProduct(item);
    else handleSharePost(item);
  };
  const onPin = (item: any) => {
    if (item.product_id) handlePinProduct(item);
    else handlePinPost(item);
  };

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

  // Handle Scroll Persistence
  useEffect(() => {
    const handleScroll = () => {
      PROFILE_CACHE.scrollPos = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Restore Scroll Position
  useEffect(() => {
    if (isRestoring && (mediaPosts.length > 0 || notePosts.length > 0 || vendorProducts.length > 0)) {
      const timer = setTimeout(() => {
        window.scrollTo(0, PROFILE_CACHE.scrollPos);
        // We don't setIsRestoring(false) here because it's handled in the data fetch useEffect finally block
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mediaPosts, notePosts, vendorProducts, isRestoring]);

  const displayName = useMemo(() => {
    const business = profileApi?.business;
    const user = profileApi?.user;
    if (profileApi?.is_business_owner && business?.business_name) return business.business_name;
    return user?.full_name ?? user?.name ?? "";
  }, [profileApi]);


  const findNavbar = () =>
    document.querySelector("header, [role='banner'], .main-navbar") as HTMLElement | null;

  useLayoutEffect(() => {
    const updateNavbarHeight = () => {
      const navbar = findNavbar();
      if (navbar) {
        setNavbarHeight(navbar.offsetHeight);
        document.documentElement.style.setProperty('--navbar-height', `${navbar.offsetHeight}px`);
      }
    };

    updateNavbarHeight();
    window.addEventListener("resize", updateNavbarHeight);
    // Also update on scroll in case navbar has transition
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
      className={`lg:bg-white bg-slate-100 rounded px-4 flex justify-start sticky z-50 border-b border-slate-200`}
      style={{ top: isMiniHeaderVisible ? "56px" : `${navbarHeight}px` }}
    >
      <div ref={tabsInnerRef} className="flex gap-8 overflow-x-auto no-scrollbar">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setActiveTabIndex(i)}
            className={`relative py-2 text-sm font-bold transition-colors whitespace-nowrap ${i === activeTabIndex ? "text-slate-900" : "text-slate-400 hover:text-slate-500"}`}
          >
            {t}
            {i === activeTabIndex && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const SubTabsBar = (
    <div className="flex gap-6 px-4 border-b border-slate-200 lg:bg-white bg-slate-100 overflow-x-auto no-scrollbar">
      {[
        { id: 'public', label: 'Public' },
        { id: 'private', label: 'Private' },
        { id: 'friends', label: 'Share to friends' }
      ].map((tab) => {
        const currentTabType = tabs[activeTabIndex] === "Notes" ? "notes" : "posts";
        const count = (visibilityCounts as any)[tab.id]?.[currentTabType] ?? 0;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveVisibility(tab.id as any)}
            className={`flex-shrink-0 py-1 text-[11px] transition-all ${activeVisibility === tab.id
              ? "text-slate-800 font-bold scale-105"
              : "text-slate-400  hover:text-slate-600"
              }`}
          >
            {tab.label}
            <span className={`ml-1 opacity-60 font-medium`}>
              ({count})
            </span>
          </button>
        );
      })}
    </div>
  );

  const TabPanes = (
    <div className="relative overflow-hidden w-full" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="flex transition-transform duration-450 ease-in-out items-start" style={{ width: `${tabs.length * 100}%`, transform: `translateX(-${activeTabIndex * (100 / tabs.length)}%)` }}>

        {/* Posts pane */}
        <div style={{ width: `${100 / tabs.length}%`, height: tabs[activeTabIndex] === "Posts" ? "auto" : "0", overflow: "hidden" }}>
          {postsLoading ? (
            <ShimmerGrid count={10} />
          ) : mediaPosts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
              <img src="/assets/images/post.png" alt="No posts" className="lg:w-30 lg:h-30 w-25 h-25  object-contain mb-4 opacity-80" />
              <p className="text-sm font-medium">No image or video posts found.</p>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("showReleaseModal", { detail: { autoClick: 'album' } }));
                }}
                className="mt-4 px-4 py-2 bg-rose-500 text-white text-sm rounded-full shadow-lg hover:bg-slate-800 transition active:scale-95 flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                Post now
              </button>
            </div>
          ) : (
            <div className="p-2 sm:p-4 post-grid-container">
              <MasonryGrid
                items={sortedMediaPosts}
                type="post"
                openPostWithUrl={openPostWithUrl}
                toggleLike={toggleLike}
                getNoteStyles={getNoteStyles}
                isRestored={isRestoring}
                onDelete={handleDeletePost}
                onShare={onShare}
                onPin={onPin}
                onEdit={handleEditPost}
              />
            </div>
          )}
        </div>

        {/* Notes pane */}
        <div style={{ width: `${100 / tabs.length}%`, height: tabs[activeTabIndex] === "Notes" ? "auto" : "0", overflow: "hidden" }}>
          {/* Removed gap/padding to reduce space between sub-tabs and notes */}
          {postsLoading ? (
            <ShimmerGrid count={10} />
          ) : notePosts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
              <img src="/assets/images/post.png" alt="No notes" className="lg:w-30 lg:h-30 w-25 h-25 object-contain mb-4 opacity-80" />
              <p className="text-sm font-medium">No note found. Create your first one!</p>
              <button
                onClick={() => setCreateNoteOpen(true)}
                className="px-4 py-2 bg-rose-500 text-white text-sm  rounded-full shadow-lg hover:bg-slate-800 transition active:scale-95 flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                Create Note
              </button>
            </div>
          ) : (
            <div className="p-2 sm:p-4 post-grid-container">
              <MasonryGrid
                items={sortedNotePosts}
                type="note"
                openPostWithUrl={openPostWithUrl}
                toggleLike={toggleLike}
                getNoteStyles={getNoteStyles}
                isRestored={isRestoring}
                onDelete={handleDeletePost}
                onShare={onShare}
                onPin={onPin}
                onEdit={handleEditPost}
              />
            </div>
          )}
        </div>

        {/* Products pane */}
        {profileApi?.is_business_owner && ['active', 'verified', 'approved', 'approved_verified', 'published'].includes(String(profileApi?.business?.business_status || profileApi?.business_status || '').toLowerCase()) && (
          <div style={{ width: `${100 / tabs.length}%`, height: tabs[activeTabIndex] === "Products" ? "auto" : "0", overflow: "hidden" }}>
            {productsLoading ? (
              <ShimmerGrid count={10} />
            ) : vendorProducts.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
                <img src="/assets/images/post.png" alt="No products" className="lg:w-30 lg:h-30 w-25 h-25 object-contain mb-4 opacity-80" />
                <p className="text-sm font-medium">No Products found, add your first product.</p>
                <Link href="/profile/business/business-status">
                  <button

                    className="mt-4 px-4 py-2 bg-rose-500 text-white text-sm rounded-full shadow-lg hover:bg-slate-800 transition active:scale-95 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                    Add product
                  </button>
                </Link>

              </div>
            ) : (
              <div className="p-2 sm:p-4 post-grid-container">
                <MasonryGrid
                  items={sortedVendorProducts}
                  type="product"
                  formatUrl={formatUrl}
                  handleProductClick={handleProductClick}
                  handleLikeClick={handleProductLike}
                  likeData={productLikeData}
                  fetchingProductId={fetchingProductId}
                  isRestored={isRestoring}
                  onShare={onShare}
                  onPin={onPin}
                />
              </div>
            )}
          </div>
        )}

        {/* Linked Post pane */}
        {sortedLinkedPosts.length > 0 && (
          <div style={{ width: `${100 / tabs.length}%`, height: tabs[activeTabIndex] === "Linked Post" ? "auto" : "0", overflow: "hidden" }}>
            {postsLoading ? (
              <ShimmerGrid count={10} />
            ) : sortedLinkedPosts.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
                <img src="/assets/images/post.png" alt="No linked posts" className="w-40 h-40 object-contain mb-4 opacity-80" />
                <p className="text-sm font-medium">No posts with linked products yet.</p>
              </div>
            ) : (
              <div className="p-2 sm:p-4 post-grid-container">
                <div className="mb-4 px-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-3 py-1">
                    <svg className="w-3.5 h-3.5 text-rose-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1" />
                    </svg>
                    {sortedLinkedPosts.length} post{sortedLinkedPosts.length !== 1 ? 's' : ''} with linked products
                  </span>
                </div>
                <MasonryGrid
                  items={sortedLinkedPosts}
                  type="linked"
                  openPostWithUrl={openPostWithUrl}
                  toggleLike={toggleLike}
                  getNoteStyles={getNoteStyles}
                  isRestored={isRestoring}
                  onDelete={handleDeletePost}
                  onShare={onShare}
                  onPin={onPin}
                  onEdit={handleEditPost}
                />
              </div>
            )}
          </div>
        )}

        {/* Liked Items pane */}
        <div style={{ width: `${100 / tabs.length}%`, height: tabs[activeTabIndex] === "Liked" ? "auto" : "0", overflow: "hidden" }}>
          {likedLoading ? (
            <ShimmerGrid count={10} />
          ) : likedItems.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
              <img src="/assets/images/post.png" alt="No liked items" className="lg:w-30 lg:h-30 w-25 h-25 object-contain mb-4 opacity-80" />
              <p className="text-sm font-medium">You haven't liked anything yet.</p>
            </div>
          ) : (
            <div className="p-2 sm:p-4 post-grid-container pb-12">
              <MasonryGrid
                items={sortedLikedItems}
                type="liked"
                openPostWithUrl={openPostWithUrl}
                toggleLike={toggleLike}
                getNoteStyles={getNoteStyles}
                isRestored={isRestoring}
                formatUrl={formatUrl}
                handleProductClick={handleProductClick}
                handleLikeClick={handleProductLike}
                likeData={productLikeData}
                fetchingProductId={fetchingProductId}
                onDelete={handleDeletePost}
                onShare={onShare}
                onPin={onPin}
                onEdit={handleEditPost}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="">
      <Header
        profileApi={profileApi}
        displayName={displayName}
        products={vendorProducts}
        onVisitShop={() => {
          const business = profileApi?.business;
          if (business) {
            let slug = business.business_slug;
            if (!slug && business.business_name) {
              slug = business.business_name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
            }
            if (slug) router.push(`/shop/${slug}`);
          }
        }}
        onLogout={async () => {
          try {
            await auth.logout();
          } finally {
            window.location.replace("/discover");
          }
        }}
        onSocialClick={(tab) => {
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
      {(tabs[activeTabIndex] === "Posts" || tabs[activeTabIndex] === "Notes") && SubTabsBar}
      {TabPanes}

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

      {productModalOpen && selectedProductPayload && (
        <ProductPreviewModal
          open={productModalOpen}
          payload={selectedProductPayload}
          origin={clickPos}
          onClose={() => {
            setProductModalOpen(false);
            setSelectedProductPayload(null);
          }}
          onProductClick={handleProductClick}
        />
      )}

      <CreateNoteModal
        open={createNoteOpen}
        onClose={() => setCreateNoteOpen(false)}
        onCreated={(newPost) => {
          const mapped = mapApiPost(newPost);
          const isNote = mapped.coverType === "note";

          if (isNote) {
            setNotePosts((prev) => {
              if (prev.some(p => String(p.id) === String(mapped.id))) return prev;
              return [mapped, ...prev];
            });
            const noteIdx = tabs.indexOf("Notes");
            if (noteIdx !== -1) setActiveTabIndex(noteIdx);
          } else {
            setMediaPosts((prev) => {
              if (prev.some(p => String(p.id) === String(mapped.id))) return prev;
              return [mapped, ...prev];
            });
            const postIdx = tabs.indexOf("Posts");
            if (postIdx !== -1) setActiveTabIndex(postIdx);
          }
          setCreateNoteOpen(false);
          toast.success("Note posted successfully");
        }}
      />

      <EditPostModal
        open={editPostOpen}
        post={postToEdit}
        onClose={() => {
          setEditPostOpen(false);
          setPostToEdit(null);
        }}
        onUpdated={(updated) => {
          const updateLocal = (p: any) => {
            if (p.id !== updated.id && p.apiId !== updated.id) return p;
            return {
              ...p,
              ...updated,
              // sync all possible caption fields to ensure instant reflection
              text: updated.caption,
              subtitle: updated.subtitle,
              caption: updated.caption || updated.subtitle,
              note_caption: updated.subtitle || updated.caption,
              // For videos, keep the existing thumbnail unless updated explicitly
              thumbnail: p.isVideo ? p.thumbnail : (updated.src || p.thumbnail)
            };
          };
          setMediaPosts(prev => prev.map(updateLocal));
          setNotePosts(prev => prev.map(updateLocal));
          setLikedItems(prev => prev.map(updateLocal));
        }}
      />

      {profileApi?.user && (
        <SocialModal
          isOpen={socialModalOpen}
          onClose={() => setSocialModalOpen(false)}
          userId={profileApi.user.user_id || profileApi.user.id}
          initialTab={activeSocialTab === "liked" ? "followers" : activeSocialTab as any}
          onFollowUpdate={handleFollowUpdate}
        />
      )}
    </div>
  );
}