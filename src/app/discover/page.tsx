// src/components/discover/Discover.tsx
"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import PostModal from "../../components/modal/postModal";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import LoginModal from "@/src/components/modal/auth/loginModal";
import ShimmerGrid from "@/src/components/shimmer";
import type { Post } from "@/src/lib/types";
import { fetchSocialPosts, fetchSocialPostById, prefetchMediaConservative } from "@/src/lib/api/social";
import { DISCOVERY_CACHE } from "@/src/lib/cache";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { FaHeart, FaRegHeart } from "react-icons/fa";

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
  index = 0,
  openPostWithUrl,
  toggleLike,
  user,
  setShowLoginModal,
  router,
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
      className="group flex flex-col rounded-[1.05rem] bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden"
      style={{
        willChange: "transform, opacity",
        contentVisibility: "auto",
        containIntrinsicSize: "auto 400px"
      }}
    >
      <div className="relative w-full bg-slate-100 overflow-hidden post-media min-h-[200px]">
        <motion.div
          initial={entryVariants.initial}
          animate={entryVariants.animate}
          //  transition={entryVariants.transition}
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
              className="w-full h-[300px] flex items-center justify-center p-6 relative overflow-hidden"
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
              preload="metadata"
            />
          ) : (
            <div className="relative w-full aspect-[4/5] bg-slate-50 overflow-hidden">
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
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Opening...</span>
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
              router.push(`/user/profile/${post.user.id}`);
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

const MasonryGrid = ({ items, openPostWithUrl, toggleLike, user, setShowLoginModal, router, getNoteStyles, isRestored }: any) => {
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
                isRestored={isRestored}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};



export default function Discover({ postCount = 100 }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>(DISCOVERY_CACHE.category);
  const [posts, setPosts] = useState<Post[]>(DISCOVERY_CACHE.posts);
  const [loading, setLoading] = useState<boolean>(DISCOVERY_CACHE.posts.length === 0);
  const [isRestoring, setIsRestoring] = useState<boolean>(DISCOVERY_CACHE.posts.length > 0);
  const [batchLoading, setBatchLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const router = useRouter();
  const { user } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
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
    let cancelled = false;
    const controller = new AbortController();

    async function loadInitial() {
      // If we have cached posts for this category, don't show loading and don't re-fetch immediately
      if (DISCOVERY_CACHE.category === activeCategory && DISCOVERY_CACHE.posts.length > 0) {
        setLoading(false);
        // Optional: you could do a silent refresh here if needed
        return;
      }

      setLoading(true);
      setError(null);
      setOffset(0);
      setHasMore(true);
      try {
        const mapped = await fetchSocialPosts({
          signal: controller.signal,
          limit: BATCH_SIZE,
          offset: 0
        });

        if (!cancelled) {
          const processed = mapped.map((p, i) => ({ ...p, originalIndex: i }));
          setPosts(processed);
          setOffset(mapped.length);
          if (mapped.length < BATCH_SIZE) setHasMore(false);

          // Update cache
          DISCOVERY_CACHE.posts = processed;
          DISCOVERY_CACHE.offset = mapped.length;
          DISCOVERY_CACHE.hasMore = mapped.length >= BATCH_SIZE;
          DISCOVERY_CACHE.category = activeCategory;
          DISCOVERY_CACHE.lastFetchedAt = Date.now();
        }

        const mediaUrls = mapped.slice(0, 8).map((p) => p.src).filter(Boolean) as string[];
        prefetchMediaConservative(mediaUrls, { maxMb: 20 }).catch(() => { });
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Failed to fetch social posts:", err);
        if (!cancelled) setError(err?.message ?? "Failed to load posts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitial();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeCategory]);

  // Handle Scroll Persistence
  useEffect(() => {
    const handleScroll = () => {
      DISCOVERY_CACHE.scrollPos = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Restore Scroll Position
  useEffect(() => {
    if (isRestoring && posts.length > 0) {
      // Small timeout to ensure DOM is ready and Masonry has calculated columns
      const timer = setTimeout(() => {
        window.scrollTo(0, DISCOVERY_CACHE.scrollPos);
        setIsRestoring(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [posts, isRestoring]);

  const loadMore = async () => {
    if (batchLoading || !hasMore) return;
    setBatchLoading(true);
    try {
      const nextBatch = await fetchSocialPosts({
        limit: BATCH_SIZE,
        offset: offset
      });

      if (nextBatch.length > 0) {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNewBatch = nextBatch.filter(p => !existingIds.has(p.id));
          const processedNew = uniqueNewBatch.map((p, i) => ({
            ...p,
            originalIndex: prev.length + i
          }));
          const newPosts = [...prev, ...processedNew];

          // Update partial cache
          DISCOVERY_CACHE.posts = newPosts;
          DISCOVERY_CACHE.offset = prev.length + nextBatch.length;

          return newPosts;
        });
        setOffset(prev => prev + nextBatch.length);
        if (nextBatch.length < BATCH_SIZE) {
          setHasMore(false);
          DISCOVERY_CACHE.hasMore = false;
        }
      } else {
        setHasMore(false);
        DISCOVERY_CACHE.hasMore = false;
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

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, batchLoading, offset, activeCategory]);

  useEffect(() => {
    const tryOpenFromUrl = async () => {
      try {
        const url = new URL(window.location.href);
        const param = url.searchParams.get("post");
        if (!param) return;
        const postId = Number(param);
        if (isNaN(postId)) return;

        const found = posts.find((p) => Number(p.id) === postId);
        if (found) {
          setSelectedPost(found);
          pushedRef.current = false;
          return;
        }

        try {
          const single = await fetchSocialPostById(postId);
          setSelectedPost(single);
          pushedRef.current = false;
        } catch {
          setSelectedPost({
            id: postId,
            caption: "Post unavailable",
            user: { id: 0, name: "Unknown", avatar: `https://i.pravatar.cc/100?u=post-${postId}` },
            liked: false,
            likeCount: 0,
          } as Post);
          pushedRef.current = false;
        }
      } catch { }
    };

    tryOpenFromUrl();
  }, [posts]);

  useEffect(() => {
    const onPop = (ev: PopStateEvent) => {
      try {
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
            return;
          }
          (async () => {
            try {
              const single = await fetchSocialPostById(postId);
              setSelectedPost(single);
            } catch {
              setSelectedPost({
                id: postId,
                caption: "Post unavailable",
                user: { id: 0, name: "Unknown", avatar: `https://i.pravatar.cc/100?u=post-${postId}` },
                liked: false,
                likeCount: 0,
              } as Post);
            }
          })();
        } else {
          setSelectedPost(null);
        }
      } catch {
        setSelectedPost(null);
      }
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [posts]);

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

  const toggleLike = (postId: string | number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
            ...p,
            liked: !p.liked,
            likeCount: p.liked ? Math.max(0, p.likeCount - 1) : p.likeCount + 1,
          }
          : p
      )
    );
  };

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
      fontSize: `${(cfg.textStyle?.fontSize ?? 28) * 0.6}px`,
      fontWeight: cfg.textStyle?.fontWeight ?? "800",
    } as React.CSSProperties;
  };

  // Manual lazy loading removed in favor of next/image

  return (
    <>
      <section className="min-h-screen bg-slate-50 pb-10">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="flex px-4 py-3 gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                onClick={() => setActiveCategory(item)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all ${activeCategory === item ? "bg-slate-900 text-white shadow-md" : "text-slate-600 bg-slate-100 hover:bg-slate-200"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="p-2 sm:p-4 post-grid-container">
          {loading ? (
            <ShimmerGrid count={5} />
          ) : error ? (
            <div className="py-12 flex flex-col items-center justify-center text-sm text-rose-500">
              <Image src="/assets/images/message-icon.png" alt="No posts" width={160} height={160} className="object-contain mb-4 opacity-80" />
              <p className="mb-3 justify-center font-bold">{"Check your internet connection try again."}</p>
              <button onClick={() => window.location.reload()} className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition">
                Retry
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="py-12 flex items-center justify-center text-sm text-slate-500 font-medium">No posts found.</div>
          ) : (
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
          )}

          {/* Observer Target for Infinite Scroll */}
          {posts.length > 0 && hasMore && (
            <div ref={observerTarget} className="flex justify-center p-8">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
            </div>
          )}

          {!hasMore && posts.length > 0 && (
            <div className="text-center p-12 text-slate-400 text-sm font-medium">
              You've seen all the posts ✨
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedPost && <PostModal post={selectedPost} onClose={closeModal} onToggleLike={toggleLike} />}
        </AnimatePresence>
      </section>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  );
}
