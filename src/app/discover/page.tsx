"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import PostModal from "../../components/modal/postModal";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import LoginModal from "@/src/components/modal/auth/loginModal";
import ShimmerGrid from "@/src/components/shimmer";
import type { Post } from "@/src/lib/types";
import { fetchDiscoverFeed, fetchSocialPosts, fetchSocialPostById, prefetchMediaConservative, logSocialActivity } from "@/src/lib/api/social";
import { DISCOVERY_CACHE } from "@/src/lib/cache";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { FaHeart, FaRegHeart, FaChevronRight, FaCompass, FaUsers, FaHistory } from "react-icons/fa";
import { io } from "socket.io-client";
import { API_BASE_URL } from "@/src/lib/config";
import { toggleSocialPostLike } from "@/src/lib/api/social";
import { toast } from "sonner";

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
  isRestored = false,
  isCarousel = false
}: any) => {
  const [showBurst, setShowBurst] = useState(false);

  const entryVariants = {
    initial: isRestored ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.95, y: 15 },
    animate: { opacity: 1, scale: 1, y: 0 },
  };

  return (
    <article
      onClick={(e) => openPostWithUrl(post, e)}
      className={`group flex flex-col rounded-[0.8rem] bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden hover:shadow-md ${isCarousel ? 'w-48 shrink-0' : 'w-full'}`}
    >
      <div className={`relative w-full bg-slate-100 overflow-hidden post-media ${isCarousel ? 'h-56' : 'min-h-[200px]'}`}>
        <motion.div
          initial={entryVariants.initial}
          animate={entryVariants.animate}
          className="w-full h-full"
        >
          {post.isVideo && (
            <div className="absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white ml-0.5">
                <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" />
              </svg>
            </div>
          )}

          {post.coverType === "note" && !post.src ? (
            <div
              className={`w-full ${isCarousel ? 'h-full' : 'h-[250px] sm:h-[300px]'} flex items-center justify-center p-6 relative overflow-hidden`}
              style={getNoteStyles(post.noteConfig)}
            >
              <div className="text-center relative z-10">
                <p className="line-clamp-4 px-2" style={{ color: "inherit", fontSize: "inherit", fontWeight: "inherit" }}>
                  {post.noteConfig?.text ?? post.caption ?? "Note"}
                </p>
              </div>
            </div>
          ) : post.isVideo && !isCarousel ? (
            <div className={`relative w-full aspect-[4/5] bg-slate-100 overflow-hidden`}>
              <video
                src={post.src}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                autoPlay muted loop playsInline preload="auto"
              />
            </div>
          ) : (
            <div className={`relative w-full ${isCarousel ? 'h-full' : 'aspect-[4/5]'} bg-slate-50 overflow-hidden`}>
              <style jsx global>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              `}</style>
              <Image
                src={post.src ? encodeURI(post.src) : "https://via.placeholder.com/800x600?text=No+Image"}
                alt={post.caption || "Post image"}
                fill
                sizes={isCarousel ? "200px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"}
                className="object-cover transition-opacity duration-1000 group-hover:scale-105"
                onLoadingComplete={(img) => { img.style.animation = "fadeIn 1s ease-in-out forwards"; }}
                style={{ opacity: 0 }}
              />
            </div>
          )}
        </motion.div>
      </div>

      <div className="p-2.5">
        <p className="text-[11px] text-slate-800 line-clamp-1 leading-snug font-semibold mb-2">
          {post.coverType === "note" && !post.src ? post.note_caption : post.caption}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="h-4 w-4 rounded-full overflow-hidden shrink-0 relative border border-slate-200">
              <Image src={encodeURI(post.user.avatar)} fill sizes="16px" className="object-cover" alt={post.user.name} />
            </div>
            <span className="truncate text-[10px] font-medium text-slate-500 capitalize">
              {post.user.name}
            </span>
          </div>

          <div
            className="flex items-center gap-1 cursor-pointer relative"
            onClick={(e) => {
              e.stopPropagation();
              if (post.liked) {
                // if unliking, just toggle
              } else {
                setShowBurst(true);
                setTimeout(() => setShowBurst(false), 800);
              }
              toggleLike(post.id);
            }}
          >
            {showBurst && <LikeBurst />}
            <div className="relative w-4 h-4 flex items-center justify-center">
              <AnimatePresence mode="wait">
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
                  animate={{ scale: [1, 2, 1], opacity: [1, 0.4, 0] }}
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
});

const PostCarousel = ({ title, icon: Icon, posts, openPostWithUrl, toggleLike, user, setShowLoginModal, router, getNoteStyles }: any) => {
  if (!posts || posts.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between px-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-slate-900 text-white">
            <Icon size={14} />
          </div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
        </div>
        <button className="text-xs font-bold text-slate-400 flex items-center gap-1 hover:text-slate-600 transition-colors">
          See All <FaChevronRight size={8} />
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 pb-2">
        {posts.map((post: any) => (
          <PostCard
            key={post.id}
            post={post}
            isCarousel={true}
            openPostWithUrl={openPostWithUrl}
            toggleLike={toggleLike}
            user={user}
            setShowLoginModal={setShowLoginModal}
            router={router}
            getNoteStyles={getNoteStyles}
          />
        ))}
      </div>
    </div>
  );
};

const MasonryGrid = ({ items, openPostWithUrl, toggleLike, user, setShowLoginModal, router, getNoteStyles, isRestored }: any) => {
  const [columns, setColumns] = useState(5);

  useEffect(() => {
    const updateColumns = () => {
      const w = window.innerWidth;
      if (w < 700) setColumns(2);
      else if (w < 1210) setColumns(3);
      else if (w < 1530) setColumns(4);
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
    <div className="flex gap-2 sm:gap-4 items-start w-full">
      {columnData.map((colItems, colIdx) => (
        <div key={colIdx} className="flex-1 flex flex-col gap-2 sm:gap-4 min-w-0">
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
      ))}
    </div>
  );
};

export default function Discover({ postCount = 100 }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>(DISCOVERY_CACHE.category);
  const [posts, setPosts] = useState<Post[]>(DISCOVERY_CACHE.posts);
  const [sections, setSections] = useState<{ trending: Post[], following: Post[], similar: Post[] }>({
    trending: [],
    following: [],
    similar: []
  });
  const [loading, setLoading] = useState<boolean>(DISCOVERY_CACHE.posts.length === 0);
  const [batchLoading, setBatchLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [modalOrigin, setModalOrigin] = useState<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const router = useRouter();
  const { user, token, ensureLoggedIn } = useAuth();
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
      setLoading(true);
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
            setPosts(forYou.map((p: any, i: number) => ({ ...p, originalIndex: i })));
            setSections({ trending, following, similar });
            setOffset(forYou.length);
            setHasMore(forYou.length >= BATCH_SIZE);

            // Prefetch
            const allMedia = [...forYou, ...trending].slice(0, 10).map(p => p.src).filter(Boolean) as string[];
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
            setPosts(mapped.map((p, i) => ({ ...p, originalIndex: i })));
            setSections({ trending: [], following: [], similar: [] });
            setOffset(mapped.length);
            setHasMore(mapped.length >= BATCH_SIZE);
            prefetchMediaConservative(mapped.slice(0, 8).map(p => p.src).filter(Boolean) as string[]).catch(() => { });
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
  }, [activeCategory, token]);

  // Real-time synchronization
  useEffect(() => {
    const socket = io(API_BASE_URL);

    socket.on("connect", () => {
      console.log("Discovery Socket connected");
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

  const openPostWithUrl = (post: Post, e?: React.MouseEvent) => {
    if (e) setModalOrigin({ x: e.clientX, y: e.clientY });
    setSelectedPost(post);

    // Log view activity
    logSocialActivity({
      social_post_id: Number(post.id),
      action_type: "view",
      category: post.category
    }, token || undefined);

    const url = new URL(window.location.href);
    url.searchParams.set("post", String(post.id));
    window.history.pushState({ postId: post.id, modal: true }, "", url.toString());
    pushedRef.current = true;
  };

  const closeModal = () => {
    setSelectedPost(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("post")) {
      url.searchParams.delete("post");
      window.history.replaceState({}, "", url.toString());
    }
  };

  const toggleLike = async (postId: string | number) => {
    const ok = await ensureLoggedIn();
    if (!ok || !token) {
      setShowLoginModal(true);
      return;
    }

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, liked: !p.liked, likeCount: p.liked ? Math.max(0, p.likeCount - 1) : p.likeCount + 1 } : p
      )
    );

    try {
      await toggleSocialPostLike(postId, token);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update like status");
      // Rollback
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, liked: !p.liked, likeCount: p.liked ? p.likeCount + 1 : Math.max(0, p.likeCount - 1) } : p
        )
      );
    }
  };

  const getNoteStyles = (config: any) => {
    if (!config) return { background: "#f8fafc" };
    let cfg = typeof config === "string" ? JSON.parse(config) : config;
    const { startColor, endColor } = cfg;
    return {
      background: endColor ? `linear-gradient(135deg, ${startColor}, ${endColor})` : startColor,
      color: cfg.textStyle?.color ?? "#1e293b",
      fontSize: "14px",
      fontWeight: "700",
    } as React.CSSProperties;
  };

  return (
    <>
      <section className="min-h-screen bg-slate-50 pb-20">
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-100">
          <div className="flex px-4 py-4 gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                onClick={() => setActiveCategory(item)}
                className={`whitespace-nowrap rounded-2xl px-5 py-2 text-xs font-bold transition-all duration-300 ${activeCategory === item ? "bg-slate-900 text-white shadow-lg scale-105" : "text-slate-500 bg-slate-50 hover:bg-slate-100"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="p-0 sm:p-4">
          {loading ? (
            <ShimmerGrid count={6} />
          ) : error ? (
            <div className="py-20 flex flex-col items-center justify-center text-center px-4">
              <FaCompass className="text-slate-200 mb-4" size={60} />
              <p className="text-slate-900 font-bold mb-2">Something went wrong</p>
              <p className="text-slate-400 text-sm mb-6">{error}</p>
              <button onClick={() => window.location.reload()} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:bg-slate-800 transition">
                Try Again
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              {activeCategory === "Recommend" && (
                <>

                </>
              )}

              <div className="px-2 sm:px-0">
                <MasonryGrid
                  items={posts}
                  openPostWithUrl={openPostWithUrl}
                  toggleLike={toggleLike}
                  user={user}
                  setShowLoginModal={setShowLoginModal}
                  router={router}
                  getNoteStyles={getNoteStyles}
                />
              </div>
            </div>
          )}

          {posts.length > 0 && hasMore && (
            <div ref={observerTarget} className="flex justify-center p-12">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedPost && (
            <PostModal post={selectedPost} onClose={closeModal} onToggleLike={toggleLike} origin={modalOrigin} />
          )}
        </AnimatePresence>
      </section>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}
