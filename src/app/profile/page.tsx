// profile/page.tsx
"use client";

import React, { useEffect, useMemo, useLayoutEffect, useState, useRef } from "react";
import PostModal from "../../components/modal/postModal";
import SocialModal from "../../components/modal/socialModal";
import { useAuth } from "@/src/context/authContext";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "../../components/feed/profile/header";
import CreateNoteModal from "../../components/notes/createNoteModal";
import ShimmerGrid from "@/src/components/shimmer";
import { fetchBusinessProducts, fetchProductById, toggleProductLike } from "@/src/lib/api/productApi";
import { toggleSocialPostLike } from "@/src/lib/api/social";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import type { PreviewPayload, ProductSku } from "@/src/types/product";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import { API_BASE_URL } from "@/src/lib/config";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { PROFILE_CACHE } from "@/src/lib/cache";


type ApiPost = any;

type User = { name: string; avatar: string; id?: number | string; };

type Post = {
  id: number;
  src?: string;
  isVideo?: boolean;
  isImage?: boolean;
  caption?: string;
  note_caption?: string;
  text?: string;
  subtitle?: string;
  user: User;
  liked: boolean;
  likeCount: number;
  coverType?: string;
  noteConfig?: any;
  rawCreatedAt?: string;
  apiId?: number;
  allMedia?: string[];
  location?: string | null;
};

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
  const apiId = p.social_post_id ?? Math.floor(Math.random() * 1e6);
  let src: string | undefined = undefined;

  if (Array.isArray(p.images) && p.images.length > 0) {
    const cover = p.images.find((i: any) => i.is_cover === 1) ?? p.images[0];
    src = cover?.image_url;
  }

  const allMedia = Array.isArray(p.images) && p.images.length > 0
    ? p.images.map((i: any) => i.image_url)
    : src ? [src] : [];

  const isVideo = isVideoUrl(src);
  const isImage = isImageUrl(src);
  const caption = p.text ?? p.subtitle ?? "";
  const note_caption = p.subtitle ?? "";

  return {
    id: apiId,
    apiId,
    src,
    isVideo,
    isImage,
    caption,
    note_caption,
    user: {
      id: p.user_id ?? p.user?.user_id ?? p.user?.id,
      name: p.author_name ?? "---",
      avatar: p.author_pic ?? DEFAULT_AVATAR, // use local fallback
    },
    liked: Boolean(p.liked_by_me),
    likeCount: p.likes_count ?? 0,
    coverType: p.cover_type,
    noteConfig: p.config,
    rawCreatedAt: p.created_at,
    allMedia,
    location: p.location,
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
  index = 0,
  openPostWithUrl,
  toggleLike,
  getNoteStyles,
  isRestored = false
}: any) => {
  const [showBurst, setShowBurst] = useState(false);

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
      onClick={() => openPostWithUrl(post)}
      className="group flex flex-col rounded-[0.5rem] bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden"
      style={{
        willChange: "transform, opacity",
        contentVisibility: "auto",
        containIntrinsicSize: "auto 400px"
      }}
    >
      <div className="relative w-full bg-slate-100 overflow-hidden post-media min-h-[180px] sm:min-h-[200px] max-h-[250px] sm:max-h-[350px]">
        <motion.div
          initial={entryVariants.initial}
          animate={entryVariants.animate}
          transition={entryVariants.transition}
          className="w-full h-full"
        >
          {post.isVideo && (
            <div className="absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/50">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white ml-0.5">
                <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" />
              </svg>
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
          ) : post.isVideo ? (
            <video
              src={post.src}
              className="w-full h-auto min-h-[250px] max-h-[300px] object-cover transition-transform duration-700 group-hover:scale-105"
              muted
              loop
              playsInline
            />
          ) : (
            <div className="relative w-full aspect-[4/5] bg-slate-50 overflow-hidden">
              <style jsx global>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
            `}</style>
              <img
                src={post.src || NO_IMAGE_PLACEHOLDER}
                alt={post.caption}
                className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                onLoad={(e) => {
                  (e.target as HTMLImageElement).style.animation = "fadeIn 0.6s ease-in-out forwards";
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
            <span className="text-[10px] font-bold  text-slate-400 ">Opening...</span>
          </div>
        </div>
      </div>

      <div className="p-3">
        <p className="text-sm text-slate-800 line-clamp-2 leading-snug font-semibold mb-3">
          {post.coverType === "note" && !post.src ? post.note_caption : post.caption}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="h-5 w-5 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
              <img src={post.user.avatar} className="w-full h-full object-cover" alt={post.user.name} />
            </div>
            <span className="truncate text-[11px] font-semibold text-slate-400 max-w-[120px] capitalize">
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
                  className={`absolute inset-0 flex items-center justify-center ${post.liked ? 'text-red-500' : 'text-slate-400'}`}
                >
                  {post.liked ? <FaHeart className="text-sm" /> : <FaRegHeart className="text-sm" />}
                </motion.div>
              </AnimatePresence>

              {post.liked && (
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
  isRestored = false
}: any) => {
  const [showBurst, setShowBurst] = useState(false);
  const isPromoActive = !!(p.promo_title && p.promo_discount && (!p.promo_end || new Date(p.promo_end) >= new Date()));

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
      key={p.product_id}
      onClick={(e) => handleProductClick(p.product_id, p.business_name, e)}
      className="group flex flex-col rounded-[0.5rem] bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden"
      style={{
        willChange: "transform, opacity",
        contentVisibility: "auto",
        containIntrinsicSize: "auto 400px"
      }}
    >
      <div className="relative w-full bg-slate-100 overflow-hidden post-media min-h-[180px] sm:min-h-[200px] max-h-[220px] sm:max-h-[320px]">
        <motion.div
          initial={entryVariants.initial}
          animate={entryVariants.animate}
          transition={entryVariants.transition}
          className="w-full h-full"
        >
          {p.product_video ? (
            <video
              src={formatUrl(p.product_video)}
              poster={formatUrl(p.first_image)}
              muted
              loop
              playsInline
              className="w-full h-auto min-h-[250px] max-h-[300px] object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="relative w-full aspect-[4/5] bg-slate-50 overflow-hidden">
              <style jsx global>{`
                            @keyframes fadeIn {
                                from { opacity: 0; }
                                to { opacity: 1; }
                            }
                        `}</style>
              <img
                src={formatUrl(p.first_image)}
                alt={p.title}
                className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
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

        {/* Placeholder frame indicator */}
        <div className="absolute inset-0 -z-10 flex items-center justify-center bg-slate-50/50">
          <div className="flex flex-col items-center gap-2 opacity-20">
            <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
            <span className="text-[10px] font-bold  text-slate-400 ">Opening...</span>
          </div>
        </div>
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
                  className={`absolute inset-0 flex items-center justify-center ${isLiked ? 'text-red-500' : 'text-slate-400'}`}
                >
                  {isLiked ? <FaHeart className="text-xs" /> : <FaRegHeart className="text-xs" />}
                </motion.div>
              </AnimatePresence>
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
            <span className="text-[10px] font-semibold text-slate-600 ml-0.5">{likeCount}</span>
          </div>
        </div>
        <h3 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug" title={p.title}>
          {p.title}
        </h3>
        <div className="mt-2 min-h-[14px]">
          {isPromoActive ? (
            <span className="text-[9px] font-bold text-rose-500 border-red-500 border px-1  tracking-tighter">
              {p.promo_discount}% OFF
            </span>
          ) : p.sale_type ? (
            <span className="text-[9px] font-bold text-rose-500 border-red-500 border px-1  tracking-tighter">
              {p.sale_discount}% Off
            </span>
          ) : (p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) <= 4) ? (
            <span className="text-[9px] font-bold text-rose-500  tracking-tighter">
              Only {Number(p.total_quantity)} Left
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}, (prev, next) => {
  return prev.p.product_id === next.p.product_id &&
    prev.isLiked === next.isLiked &&
    prev.likeCount === next.likeCount &&
    prev.fetchingProduct === next.fetchingProduct;
});
ProductCard.displayName = "ProductCard";

const MasonryGrid = ({ items, type, openPostWithUrl, toggleLike, getNoteStyles, formatUrl, handleProductClick, handleLikeClick, likeData, fetchingProductId, isRestored }: any) => {
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
      data[index % columns].push({ ...item, originalIndex: index });
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
            {colItems.map((item: any) => {
              const isPost = type === 'post' || type === 'note' || (type === 'liked' && !item.isProduct);
              if (isPost) {
                return (
                  <PostCard
                    key={item.id}
                    post={item}
                    index={item.originalIndex}
                    openPostWithUrl={openPostWithUrl}
                    toggleLike={toggleLike}
                    getNoteStyles={getNoteStyles}
                    isRestored={isRestored}
                  />
                );
              } else {
                const ld = likeData[item.product_id] || { liked: !!item.isLiked, count: item.likes_count || 0 };
                return (
                  <ProductCard
                    key={item.product_id}
                    p={item}
                    index={item.originalIndex}
                    formatUrl={formatUrl}
                    handleProductClick={handleProductClick}
                    handleLikeClick={handleLikeClick}
                    isLiked={ld.liked}
                    likeCount={ld.count}
                    fetchingProduct={fetchingProductId === item.product_id}
                    isRestored={isRestored}
                  />
                );
              }
            })}
          </div>
        );
      })}
    </div>
  );
};

export default function ProfileHeader({ postCount = 12 }: Props) {
  const [profileApi, setProfileApi] = useState<any | null>(PROFILE_CACHE.profileApi);
  const [profileLoading, setProfileLoading] = useState(PROFILE_CACHE.profileApi === null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [mediaPosts, setMediaPosts] = useState<Post[]>(PROFILE_CACHE.mediaPosts);
  const [notePosts, setNotePosts] = useState<Post[]>(PROFILE_CACHE.notePosts);
  const [postsLoading, setPostsLoading] = useState(PROFILE_CACHE.mediaPosts.length === 0 && PROFILE_CACHE.notePosts.length === 0);
  const [isRestoring, setIsRestoring] = useState<boolean>(PROFILE_CACHE.mediaPosts.length > 0 || PROFILE_CACHE.notePosts.length > 0);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [createNoteOpen, setCreateNoteOpen] = useState(false);

  // Products state
  const [vendorProducts, setVendorProducts] = useState<any[]>(PROFILE_CACHE.vendorProducts);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [fetchingProduct, setFetchingProduct] = useState(false);
  const [productLikeData, setProductLikeData] = useState<Record<number, { liked: boolean, count: number }>>(PROFILE_CACHE.productLikeData);
  const [fetchingProductId, setFetchingProductId] = useState<number | null>(null);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [activeSocialTab, setActiveSocialTab] = useState<"friends" | "followers" | "following" | "recommend" | "liked">("followers");

  const [likedItems, setLikedItems] = useState<any[]>([]);
  const [likedLoading, setLikedLoading] = useState(false);

  const formatUrl = (url: string) => {
    if (!url) return NO_IMAGE_PLACEHOLDER;
    if (url.startsWith("http")) return url;
    return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
  };

  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tabs state & animation
  const [activeTabIndex, setActiveTabIndex] = useState(PROFILE_CACHE.activeTabIndex);
  const tabs = useMemo(() => {
    const base = ["Posts", "Notes"];
    if (profileApi?.is_business_owner) base.push("Products");
    base.push("Liked");
    return base;
  }, [profileApi?.is_business_owner]);

  useEffect(() => {
    const tabName = searchParams.get("tab");
    if (tabName) {
      const idx = tabs.indexOf(tabName);
      if (idx !== -1) setActiveTabIndex(idx);
    }
  }, [searchParams, tabs]);

  useEffect(() => {
    PROFILE_CACHE.activeTabIndex = activeTabIndex;
  }, [activeTabIndex]);

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
      setProfileLoading(true);
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
        };
        setProfileApi(normalized);
        PROFILE_CACHE.profileApi = normalized;
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
      setLikedLoading(true);
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
      setProductsLoading(true);
      try {
        const res = await fetchBusinessProducts(businessId, 100);
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
      setPostsLoading(true);
      setPostsError(null);
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || "";
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const resp = await fetch(`${base.replace(/\/$/, "")}/api/social/me`, {
          signal: controller.signal,
          headers,
        });

        if (!resp.ok) {
          throw new Error(`Posts API returned ${resp.status}`);
        }

        const json = await resp.json();
        const apiPosts: any[] = json?.data?.posts ?? json?.data ?? json?.posts ?? [];
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

        setMediaPosts(media.slice(0, postCount));
        setNotePosts(notes.slice(0, postCount));
        PROFILE_CACHE.mediaPosts = media.slice(0, postCount);
        PROFILE_CACHE.notePosts = notes.slice(0, postCount);
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
  }, [postCount]);

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
          user: { name: "---", avatar: DEFAULT_AVATAR },
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
                user: { name: "---", avatar: DEFAULT_AVATAR },
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

  const handleProductClick = async (productId: number, businessName?: string, e?: React.MouseEvent) => {
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
    return user?.full_name ?? user?.name ?? "---";
  }, [profileApi]);

  const tabsWrapperRef = useRef<HTMLDivElement | null>(null);
  const tabsInnerRef = useRef<HTMLDivElement | null>(null);
  const [navbarHeight, setNavbarHeight] = useState(0);

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
      className="bg-white p-3 flex justify-center sticky z-50 border-b border-slate-100" 
      style={{ top: `${navbarHeight}px` }}
    >
      <div ref={tabsInnerRef} className="flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setActiveTabIndex(i)}
            className={`px-3 py-2 text-sm font-bold transition whitespace-nowrap rounded-lg ${i === activeTabIndex ? "bg-slate-100 text-black" : "text-slate-400 hover:bg-slate-100"}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );

  const TabPanes = (
    <div className="relative overflow-hidden w-full" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="flex transition-transform duration-450 ease-in-out" style={{ width: `${tabs.length * 100}%`, transform: `translateX(-${activeTabIndex * (100 / tabs.length)}%)` }}>

        {/* Posts pane */}
        <div style={{ width: `${100 / tabs.length}%` }}>
          {postsLoading ? (
            <ShimmerGrid count={10} />
          ) : mediaPosts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
              <img src="/assets/images/post.png" alt="No posts" className="w-40 h-40 object-contain mb-4 opacity-80" />
              <p className="text-sm font-medium">No image or video posts found.</p>

            </div>
          ) : (
            <div className="p-2 sm:p-4 post-grid-container">
              <MasonryGrid
                items={mediaPosts}
                type="post"
                openPostWithUrl={openPostWithUrl}
                toggleLike={toggleLike}
                getNoteStyles={getNoteStyles}
                isRestored={isRestoring}
              />
            </div>
          )}
        </div>

        {/* Notes pane */}
        <div style={{ width: `${100 / tabs.length}%` }}>
          <div className="flex justify-end p-4 pr-6">

          </div>
          {postsLoading ? (
            <ShimmerGrid count={10} />
          ) : notePosts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
              <img src="/assets/images/post.png" alt="No notes" className="w-40 h-40 object-contain mb-4 opacity-80" />
              <p className="text-sm font-medium">No note found. Create your first one!</p>
              <button
                onClick={() => setCreateNoteOpen(true)}
                className="px-4 py-2 bg-red-500 text-white text-sm  rounded-full shadow-lg hover:bg-slate-800 transition active:scale-95 flex items-center gap-2"
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
                items={notePosts}
                type="note"
                openPostWithUrl={openPostWithUrl}
                toggleLike={toggleLike}
                getNoteStyles={getNoteStyles}
                isRestored={isRestoring}
              />
            </div>
          )}
        </div>

        {/* Products pane */}
        {profileApi?.is_business_owner && (
          <div style={{ width: `${100 / tabs.length}%` }}>
            {productsLoading ? (
              <ShimmerGrid count={10} />
            ) : vendorProducts.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
                <img src="/assets/images/post.png" alt="No products" className="w-40 h-40 object-contain mb-4 opacity-80" />
                <p className="text-sm font-medium">No Products found.</p>


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
                  isRestored={isRestoring}
                />
              </div>
            )}
          </div>
        )}

        {/* Liked Items pane */}
        <div style={{ width: `${100 / tabs.length}%` }}>
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
                isRestored={isRestoring}
                formatUrl={formatUrl}
                handleProductClick={handleProductClick}
                handleLikeClick={handleProductLike}
                likeData={productLikeData}
                fetchingProductId={fetchingProductId}
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
      {TabPanes}

      {selectedPost && <PostModal post={selectedPost} onClose={closeModal} onToggleLike={toggleLike} />}

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
          setNotePosts((prev) => [mapped, ...prev]);
          setCreateNoteOpen(false);
        }}
      />

      {profileApi?.user && (
        <SocialModal
          isOpen={socialModalOpen}
          onClose={() => setSocialModalOpen(false)}
          userId={profileApi.user.user_id || profileApi.user.id}
          initialTab={activeSocialTab === "liked" ? "followers" : activeSocialTab as any}
        />
      )}
    </div>
  );
}