"use client";
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import PostModal from "../../components/modal/postModal";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import LoginModal from "@/src/components/modal/auth/loginModal";
import ShimmerGrid from "@/src/components/shimmer";
import type { Post } from "@/src/lib/types";
import { fetchDiscoverFeed, fetchSocialPosts, fetchSocialPostById, prefetchMediaConservative, logSocialActivity, fetchSecurePostUrl } from "@/src/lib/api/social";
import { DISCOVERY_CACHE } from "@/src/lib/cache";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { FaHeart, FaRegHeart, FaChevronRight, FaCompass, FaUsers, FaHistory } from "react-icons/fa";
import { io } from "socket.io-client";
import { API_BASE_URL } from "@/src/lib/config";
import { toggleSocialPostLike, mapApiPost } from "@/src/lib/api/social";
import { isOffline, safeFetch, ApiError } from "@/src/lib/api/handler";
import { toast } from "sonner";
import { ArrowUp, RotateCcw } from "lucide-react";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { VerifiedBadge } from "@/src/components/common/VerifiedBadge";
import StoqleLoader from "@/src/components/common/StoqleLoader";
import CachedImage from "@/src/components/common/CachedImage";
const NO_IMAGE_PLACEHOLDER = "/assets/images/favio.png"; // fallback post image
const DEFAULT_AVATAR = "/assets/images/favio.png";

type Props = { postCount?: number };

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
  router
}: any) => {
  const [showBurst, setShowBurst] = useState(false);

  // Animation variants
  const entryVariants = post.isRestored ? {
    initial: { opacity: 1, scale: 1, y: 0 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { duration: 0 }
  } : {
    initial: { opacity: 0, scale: 0.95, y: 15 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: {
      duration: 0.9,
      delay: Math.min((post.originalIndex || 0) * 0.1, 1.2),
      ease: [0.21, 1.11, 0.81, 0.99] as any
    }
  };

  return (
    <article
      onClick={() => openPostWithUrl(post)}
      className="group flex flex-col rounded-[0.5rem] bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden"
    >
      <div className="relative w-full overflow-hidden post-media min-h-[180px] max-h-[300px] sm:min-h-[200px] sm:max-h-[350px]">
        {post.isVideo && (
          <div className="absolute top-3 right-3 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-black/50">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white ml-0.5">
              <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" />
            </svg>
          </div>
        )}

        <motion.div
          initial={entryVariants.initial}
          animate={entryVariants.animate}
          transition={entryVariants.transition}
          className="w-full h-full relative z-[1]"
        >
          {post.coverType === "note" && !post.src ? (
            <div
              className="w-full h-[300px] sm:h-[330px] flex items-center justify-center p-6 relative overflow-hidden"

              style={getNoteStyles(post.noteConfig)}
            >
              <style jsx>{`
                @keyframes fadeIn {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }
              `}</style>
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
            <div className="w-full">
              <CachedImage
                src={post.thumbnail || (!post.isVideo ? post.src : "") || NO_IMAGE_PLACEHOLDER}
                alt={post.caption || "Post thumbnail"}
                className="w-full h-auto min-h-[180px] max-h-[300px] sm:min-h-[200px] sm:max-h-[350px] object-cover block transition-transform duration-700 group-hover:scale-105 relative z-[1]"
              />
            </div>
          )}
        </motion.div>


      </div>

      <div className="p-1">
        <p className="text-sm text-slate-800 line-clamp-2 leading-snug font-semibold mb-3">
          {post.coverType === "note" && !post.src ? post.note_caption : post.caption}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="h-5 w-5 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer active:scale-90 transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                router.push(post.author_handle ? `/${post.author_handle}` : `/user/profile/${post.user.id}`);
              }}
            >
              <Image src={post.user.avatar} width={20} height={20} className="object-cover" alt={post.user.name} />
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span
                className="truncate text-[11px] font-semibold text-slate-400 cursor-pointer hover:text-slate-900 transition-colors capitalize"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(post.author_handle ? `/${post.author_handle}` : `/user/profile/${post.user.id}`);
                }}
              >
                {post.user.name}
              </span>
              {!!post.user.verified_badge || !!post.user.is_partner ? (
                <VerifiedBadge size="xs" label="Trusted Partner" />
              ) : !!post.user.is_trusted ? (
                <CheckBadgeIcon className="w-3.5 h-3.5 text-blue-500 fill-blue-500 shrink-0" />
              ) : null}
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
    </article>
  );
}, (prev, next) => {
  return prev.post.id === next.post.id && prev.post.liked === next.post.liked && prev.post.likeCount === next.post.likeCount;
});

const MasonryGrid = ({ items, openPostWithUrl, toggleLike, user, setShowLoginModal, router, getNoteStyles, isRestored }: any) => {
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
            {colItems.map((p: any, idx: number) => (
              <PostCard
                key={p.post_id || p.id}
                post={p}
                index={p.originalIndex ?? idx}
                openPostWithUrl={openPostWithUrl}
                toggleLike={toggleLike}
                user={user}
                setShowLoginModal={setShowLoginModal}
                router={router}
                getNoteStyles={getNoteStyles}
                isRestored={isRestored}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default function DiscoverPage() {
  return <DiscoverFeed postCount={100} />;
}

function DiscoverFeed({ postCount = 100 }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>(DISCOVERY_CACHE.category);

  const [posts, setPosts] = useState<Post[]>(() =>
    DISCOVERY_CACHE.posts.length > 0
      ? DISCOVERY_CACHE.posts.map(p => ({ ...p, isRestored: true }))
      : []
  );
  const [sections, setSections] = useState<{ trending: Post[], following: Post[], similar: Post[] }>({
    trending: [],
    following: [],
    similar: []
  });
  const [loading, setLoading] = useState<boolean>(DISCOVERY_CACHE.posts.length === 0);
  const [batchLoading, setBatchLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isOpeningPost, setIsOpeningPost] = useState<boolean>(false);
  const [modalOrigin, setModalOrigin] = useState<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState<number>(DISCOVERY_CACHE.posts.length > 0 ? DISCOVERY_CACHE.offset : 0);
  const [hasMore, setHasMore] = useState<boolean>(DISCOVERY_CACHE.posts.length > 0 ? DISCOVERY_CACHE.hasMore : true);
  const router = useRouter();
  const { user, token, ensureLoggedIn, isHydrated } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRestoring, setIsRestoring] = useState<boolean>(() => DISCOVERY_CACHE.posts.length > 0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  useEffect(() => {
    // Handle restoration
    if (isRestoring && posts.length > 0) {
      const timer = setTimeout(() => {
        window.scrollTo({ top: DISCOVERY_CACHE.scrollPos, behavior: "instant" });
        setShowScrollTop(DISCOVERY_CACHE.scrollPos > 400);
        setTimeout(() => setIsRestoring(false), 150);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isRestoring, posts.length]);

  // Initial Mount: Reset to top ONLY if we are not restoring from a cache
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.scrollRestoration = 'manual';
    }

    if (!isRestoring) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, []); // Run once on mount

  useEffect(() => {
    const handleScroll = () => {
      // Guard: Only update discovery cache if we are actually on the discovery/home route
      if (window.location.pathname !== "/discover" && window.location.pathname !== "/") return;
      if (posts.length === 0 || loading) return;

      setShowScrollTop(window.scrollY > 400);
      DISCOVERY_CACHE.scrollPos = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [posts.length, loading]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleManualRefresh = () => {
    scrollToTop();
    // Use a small timeout to clear cache so it doesn't flicker while scrolling
    setTimeout(() => {
      DISCOVERY_CACHE.posts = [];
      DISCOVERY_CACHE.offset = 0;
      DISCOVERY_CACHE.category = ""; // force fresh load
      setIsRestoring(false);
      setRefreshKey(prev => prev + 1);
    }, 400);
    // toast.info("Refreshing feed...", { icon: <RotateCcw className="w-4 h-4 animate-spin" />, duration: 2000 });
  };

  useEffect(() => {
    const handleRefresh = (e: any) => {
      // If no path specified or it's discover, refresh
      if (!e.detail?.path || e.detail.path === "/discover") {
        handleManualRefresh();
      }
    };
    window.addEventListener("post-created", () => setRefreshKey(prev => prev + 1));
    window.addEventListener("nav-refresh", handleRefresh);
    return () => {
      window.removeEventListener("post-created", () => setRefreshKey(prev => prev + 1));
      window.removeEventListener("nav-refresh", handleRefresh);
    };
  }, []);

  // --- Touch pull-to-refresh listener ---
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleTouchStart = (e: TouchEvent) => {
      if (selectedPost || showLoginModal) return;
      const containerScrollTop = window.scrollY || document.documentElement.scrollTop;
      if (containerScrollTop <= 2) {
        touchStartY.current = e.touches[0].pageY;
        isPulling.current = true;
      } else {
        isPulling.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current) return;
      const currentY = e.touches[0].pageY;
      const diff = currentY - touchStartY.current;

      if (diff > 0) {
        const distance = Math.min(diff * 0.45, 90);
        setPullDistance(distance);
        if (distance > 10) {
          if (e.cancelable) e.preventDefault();
        }
      }
    };

    const handleTouchEnd = () => {
      if (!isPulling.current) return;
      isPulling.current = false;

      if (pullDistance > 60) {
        setIsRefreshing(true);
        handleManualRefresh();
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 1500);
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullDistance, activeCategory, selectedPost, showLoginModal]);

  const BATCH_SIZE = 20;

  const pushedRef = useRef(false);

  const CATEGORIES = useMemo(
    () => [
      "Recommend",
      "Outfit",
      "Gourmet food",
      "Makeup",
      "Film and television",
      "Workplace",
      "Emotion",
      "Home",
      "Game",
      "Travel",
      "Fitness",
    ],
    []
  );

  useEffect(() => {
    if (!isHydrated) return; // Algorithm: Wait for hydration

    const CACHE_TTL = 1000 * 60 * 5; // 5 mins

    // Algorithm: Cache & Personalization Check
    if (DISCOVERY_CACHE.posts.length > 0 && DISCOVERY_CACHE.category === activeCategory) {
      const isFresh = Date.now() - DISCOVERY_CACHE.lastFetchedAt < CACHE_TTL;
      const needsPersonalization = token && !DISCOVERY_CACHE.personalized && activeCategory === "Recommend";
      if (!needsPersonalization && isFresh) {
        setLoading(false);
        setPosts(DISCOVERY_CACHE.posts.map(p => ({ ...p, isRestored: true })));
        setOffset(DISCOVERY_CACHE.offset);
        setHasMore(DISCOVERY_CACHE.hasMore);
        return;
      }
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadInitial() {
      setLoading(true);
      setIsRestoring(false);
      setError(null);
      setOffset(0);
      setHasMore(true);

      try {
        if (activeCategory === "Recommend") {
          const { forYou, trending, following, similar } = await fetchDiscoverFeed({
            signal: controller.signal,
            limit: BATCH_SIZE,
            offset: 0,
            token
          });

          if (!cancelled) {
            const mapped = forYou.map((p: any, i: number) => ({ ...p, originalIndex: i }));
            setPosts(mapped);
            setSections({ trending, following, similar });
            setOffset(mapped.length);
            setHasMore(mapped.length >= BATCH_SIZE);

            // Update cache
            DISCOVERY_CACHE.posts = mapped;
            DISCOVERY_CACHE.offset = mapped.length;
            DISCOVERY_CACHE.hasMore = mapped.length >= BATCH_SIZE;
            DISCOVERY_CACHE.category = activeCategory;
            DISCOVERY_CACHE.personalized = !!token;
            DISCOVERY_CACHE.lastFetchedAt = Date.now();

            // Prefetch
            const allMedia = [...mapped, ...trending].slice(0, 10).map(p => p.src).filter(Boolean) as string[];
            prefetchMediaConservative(allMedia).catch(() => { });
          }
        } else {
          const mapped = await fetchSocialPosts({
            signal: controller.signal,
            limit: BATCH_SIZE,
            offset: 0,
            category: activeCategory,
            token
          });

          if (!cancelled) {
            const processed = mapped.map((p, i) => ({ ...p, originalIndex: i }));
            setPosts(processed);
            setSections({ trending: [], following: [], similar: [] });
            setOffset(processed.length);
            setHasMore(processed.length >= BATCH_SIZE);

            // Update cache
            DISCOVERY_CACHE.posts = processed;
            DISCOVERY_CACHE.offset = processed.length;
            DISCOVERY_CACHE.hasMore = processed.length >= BATCH_SIZE;
            DISCOVERY_CACHE.category = activeCategory;
            DISCOVERY_CACHE.personalized = !!token;
            DISCOVERY_CACHE.lastFetchedAt = Date.now();

            prefetchMediaConservative(processed.slice(0, 8).map(p => p.src).filter(Boolean) as string[]).catch(() => { });
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setError(err?.message ?? "Failed to load posts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitial();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeCategory, token, isHydrated, refreshKey]);

  // Real-time synchronization
  useEffect(() => {
    const socket = io(API_BASE_URL, {
      query: { userId: user?.user_id || user?.id },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on("connect", () => {
      console.log("Discovery Socket connected", user?.user_id || user?.id);
    });

    socket.on("post_updated", (updatedPost) => {
      // Guard: socket may emit a null or incomplete payload
      if (!updatedPost || updatedPost.social_post_id == null) return;
      console.log("Post updated socket event received:", updatedPost.social_post_id);
      setPosts((prev) =>
        prev.map((p) => {
          if (String(p.id) === String(updatedPost.social_post_id)) {
            return { ...p, ...mapApiPost(updatedPost) };
          }
          return p;
        })
      );
    });

    socket.on("post:like", (data) => {
      const { postId, likes_count, liked_by, unliked_by } = data;
      setPosts((prev) =>
        prev.map((p) => {
          if (String(p.id) === String(postId)) {
            // Only update current user's liked status if they are the one who triggered it
            const currentUserId = user?.user_id || user?.id;
            const updated: Post = { ...p, likeCount: likes_count };
            if (liked_by && String(liked_by) === String(currentUserId)) {
              updated.liked = true;
            } else if (unliked_by && String(unliked_by) === String(currentUserId)) {
              updated.liked = false;
            }
            return updated;
          }
          return p;
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const loadMore = async () => {
    if (batchLoading || !hasMore) return;
    setBatchLoading(true);
    try {
      const nextBatch = await fetchSocialPosts({
        limit: BATCH_SIZE,
        offset: offset,
        category: activeCategory === "Recommend" ? undefined : activeCategory,
        token
      });

      if (nextBatch.length > 0) {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNewBatch = nextBatch.filter(p => !existingIds.has(p.id));
          const processedNew = uniqueNewBatch.map((p, i) => ({ ...p, originalIndex: prev.length + i }));
          const newPosts = [...prev, ...processedNew];
          DISCOVERY_CACHE.posts = newPosts;
          return newPosts;
        });
        setOffset(prev => prev + nextBatch.length);
        setHasMore(nextBatch.length >= BATCH_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to fetch more posts:", err);
    } finally {
      setBatchLoading(false);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && !batchLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [hasMore, loading, batchLoading, offset, activeCategory]);
  useEffect(() => {
    const tryOpenFromUrl = async () => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      const searchParam = url.searchParams.get("post");

      // Also check path pattern: /username/postId
      const pathParts = url.pathname.split('/').filter(Boolean);
      let postIdFromPath = null;
      if (pathParts.length === 2 && /^\d{11,}$/.test(pathParts[1])) {
        postIdFromPath = pathParts[1];
      }

      const param = searchParam || postIdFromPath;
      if (!param) return;

      const found = posts.find((p) => String(p.id) === String(param) || String((p as any).post_public_id) === String(param));
      if (found) {
        setSelectedPost(found);
        pushedRef.current = false;
        return;
      }

      try {
        const { fetchSocialPostById } = require("@/src/lib/api/social");
        const single = await fetchSocialPostById(param, { token });
        setSelectedPost(single);
        pushedRef.current = false;
      } catch (err) {
        console.error("Failed to load post from URL", err);
      }
    };

    tryOpenFromUrl();
  }, [posts, token]);

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
        const found = posts.find((p) => Number(p.id) === postId);
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

              const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
              const headers: any = {};
              if (token) headers.Authorization = `Bearer ${token}`;

              const json = await safeFetch<any>(fetchUrl.toString(), { headers });
              setSelectedPost(mapApiPost(json?.data?.post ?? json?.data ?? json));
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
  }, [posts]);


  const openPostWithUrl = async (post: Post, e?: React.MouseEvent) => {
    if (e) setModalOrigin({ x: e.clientX, y: e.clientY });
    setIsOpeningPost(true);

    // Log view activity
    logSocialActivity({
      social_post_id: Number(post.id),
      action_type: "view",
      category: post.category
    }, token || undefined);

    let xsecToken = "";
    let xsecSource = "discovery_feed";
    try {
      const secData = await fetchSecurePostUrl(post.id, "discovery_feed", token);
      if (secData && secData.xsec_token) {
        xsecToken = secData.xsec_token;
        xsecSource = secData.xsec_source;
      }
    } catch (err) {
      console.warn("Could not fetch secure token", err);
    }

    const username = post.user.username || post.author_handle || "user";
    const publicId = (post as any).post_public_id || post.id;
    const newPath = `/${username}/${publicId}`;

    const url = new URL(window.location.href);
    if (xsecToken) url.searchParams.set("xsec_token", xsecToken);
    url.searchParams.set("xsec_source", xsecSource);
    url.pathname = newPath;

    window.history.pushState({ postId: post.id, modal: true }, "", url.toString());
    pushedRef.current = true;

    setSelectedPost(post);
    setIsOpeningPost(false);
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
      let changed = false;

      // 1. Check path-based postId (e.g. /username/3000...)
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2 && /^\d{11,}$/.test(pathParts[pathParts.length - 1])) {
        url.pathname = "/discover";
        changed = true;
      }

      // 2. Check search param
      if (url.searchParams.has("post")) {
        url.searchParams.delete("post");
        changed = true;
      }

      if (changed || url.pathname !== "/discover") {
        window.history.replaceState({}, "", "/discover");
      }
    }
    pushedRef.current = false;
  }, []);

  const toggleLike = async (postId: string | number, skipApi = false) => {
    const ok = await ensureLoggedIn();
    if (!ok || !token) {
      setShowLoginModal(true);
      return;
    }

    // Phase 1: Local Optimistic Update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, liked: !p.liked, likeCount: p.liked ? Math.max(0, p.likeCount - 1) : p.likeCount + 1 } : p
      )
    );

    if (skipApi) return; // Modal already handled the database persistence

    try {
      await toggleSocialPostLike(postId, token);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update like status");
      // Rollback on failure
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, liked: !p.liked, likeCount: p.liked ? p.likeCount + 1 : Math.max(0, p.likeCount - 1) } : p
        )
      );
    }
  };



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

  return (
    <>
      {/* Dynamic Pull-to-Refresh Indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          style={{ 
            top: showScrollTop ? "0px" : "64px",
            height: `${isRefreshing ? 60 : pullDistance}px`,
            opacity: isRefreshing ? 1 : Math.min(pullDistance / 40, 1),
          }}
          className="fixed left-0 right-0 z-[2600] flex items-center justify-center pointer-events-none transition-all duration-150"
        >
          <div 
            style={{
              transform: `translateY(${isRefreshing ? 12 : Math.max(0, pullDistance - 40)}px)`,
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 shadow-md border border-slate-100 backdrop-blur-sm transition-transform duration-75"
          >
            <div 
              style={{ 
                transform: isRefreshing ? undefined : `rotate(${pullDistance * 4.5}deg)`,
                transition: isRefreshing ? "none" : "transform 75ms linear"
              }}
              className="flex items-center justify-center shrink-0"
            >
              <StoqleLoader size={14} />
            </div>
            <span className="text-[10px] font-bold text-slate-600">
              {isRefreshing ? "Refreshing..." : pullDistance > 60 ? "Release to refresh" : "Pull to refresh"}
            </span>
          </div>
        </div>
      )}
      <section className="min-h-screen transition-colors duration-500 bg-slate-50 pb-20">
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-100">
          <div className="flex px-4 py-4 gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                onClick={() => setActiveCategory(item)}
                className={`whitespace-nowrap rounded px-5 py-2 text-xs font-bold transition-all duration-300 ${activeCategory === item ? "bg-slate-900 text-white shadow-lg scale-105" : "text-slate-500 bg-slate-50 hover:bg-slate-100"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="flex justify-center items-center py-6 bg-slate-50 overflow-hidden"
            >
              <StoqleLoader size={30} />
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="p-2"><ShimmerGrid count={10} /></div>
        ) : error ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="w-32 h-32 rounded-full flex items-center justify-center">
              <Image src="/assets/images/message-icon.png" width={128} height={128} alt="Error icon" />
            </div>
            <p className="text-slate-400 text-sm mb-6">{error}, Please pull down to refresh</p>
            <button onClick={() => window.location.reload()} className=" rounded-2xl  text-sm text-bold transition">
              Try Again
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {activeCategory === "Recommend" && (
              <>
              </>
            )}

            <div className="p-1 ">
              <MasonryGrid
                items={posts}
                openPostWithUrl={openPostWithUrl}
                toggleLike={toggleLike}
                user={user}
                setShowLoginModal={setShowLoginModal}
                router={router}
                getNoteStyles={getNoteStyles}
                isRestored={isRestoring}
              />
            </div>
          </div>
        )}

        {posts.length > 0 && hasMore && (
          <div ref={observerTarget} className="flex justify-center p-12">
            <StoqleLoader />
          </div>
        )}

        <AnimatePresence>
          {selectedPost && (
            <PostModal open={!!selectedPost} post={selectedPost} onClose={closeModal} onToggleLike={(id) => toggleLike(id, true)} origin={modalOrigin} />
          )}
        </AnimatePresence>
      </section>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-3">
        {/* Scroll to Top (Now on top) */}
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

        {/* Refresh Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleManualRefresh}
          className="w-12 h-12 bg-white text-slate-900 rounded-full shadow-2xl flex items-center justify-center border border-slate-100 hover:bg-slate-50 transition-colors"
          title="Refresh Recommended"
        >
          <RotateCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </motion.button>
      </div>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Instant Loader Overlay for Post Modal */}
      <AnimatePresence>
        {isOpeningPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999999] flex items-center justify-center bg-transparent pointer-events-none"
          >
            <StoqleLoader size={30} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}