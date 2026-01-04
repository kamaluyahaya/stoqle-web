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

type Props = { postCount?: number };

export default function Discover({ postCount = 100 }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>("Recommend");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

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

  // ------------------------
  // Data loading (UI-only component)
  // ------------------------
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const mapped = await fetchSocialPosts({ signal: controller.signal });

        const ordered =
          activeCategory === "Recommend"
            ? mapped
            : [...mapped].sort((a, b) => {
                const ta = a.rawCreatedAt ? new Date(a.rawCreatedAt).getTime() : 0;
                const tb = b.rawCreatedAt ? new Date(b.rawCreatedAt).getTime() : 0;
                return tb - ta;
              });

        if (!cancelled) setPosts(ordered.slice(0, postCount));

        const mediaUrls = ordered.slice(0, Math.min(8, postCount)).map((p) => p.src).filter(Boolean) as string[];
        prefetchMediaConservative(mediaUrls, { maxMb: 20 }).catch(() => {});
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Failed to fetch social posts:", err);
        if (!cancelled) setError(err?.message ?? "Failed to load posts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [postCount, activeCategory]);

  // ------------------------
  // Try open modal from URL ?post=ID
  // ------------------------
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
      } catch {
        // ignore malformed URL
      }
    };

    tryOpenFromUrl();
  }, [posts]);

  // ------------------------
  // Popstate handler to respond to back/forward
  // ------------------------
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
          // fallback: attempt fetch
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

  // ------------------------
  // Open/close modal + update URL
  // ------------------------
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

  // ------------------------
  // Placeholder like toggle (wire this to API later)
  // ------------------------
  const toggleLike = (postId: string | number) => {
    // optimistic UI example (no network)
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

  // ------------------------
  // Note styles helper (copied from original)
  // ------------------------
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

  // ------------------------
  // Intersection observer for lazy-load & video play/pause
  // ------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.querySelector(".post-grid");
    if (!root) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement;
          // image handling
          if (el.tagName === "IMG") {
            const img = el as HTMLImageElement;
            const data = img.dataset.src;
            if (entry.isIntersecting && data) {
              if (img.src !== data) img.src = data;
            }
            return;
          }

          // video handling
          if (el.tagName === "VIDEO") {
            const vid = el as HTMLVideoElement;
            const data = vid.dataset.src;
            if (entry.intersectionRatio >= 0.5) {
              if (data && vid.getAttribute("data-loaded") !== "1") {
                vid.setAttribute("preload", "metadata");
                vid.src = data;
                vid.load();
                vid.setAttribute("data-loaded", "1");
              }
              vid.play().catch(() => {});
            } else {
              if (!vid.paused) try { vid.pause(); } catch {}
            }
            return;
          }
        });
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    const observeAll = () => {
      root.querySelectorAll(".post-media img[data-src]").forEach((img) => io.observe(img));
      root.querySelectorAll(".post-media video[data-src]").forEach((v) => io.observe(v));
    };

    observeAll();

    const mo = new MutationObserver(() => observeAll());
    mo.observe(root, { subtree: true, childList: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [posts]);

  // ------------------------
  // JSX
  // ------------------------
  return (
    <>
      <section>
        <div className="top-10 z-10 mb-10">
          <div className="flex mt-5 gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                onClick={() => setActiveCategory(item)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition-all ${
                  activeCategory === item ? "bg-slate-100 text-gray-700 font-bold" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <ShimmerGrid count={10} />
        ) : error ? (
          <div className="py-12 flex flex-col items-center justify-center text-sm text-rose-500">
            <img src="/assets/images/message-icon.png" alt="No posts" className="w-40 h-40 object-contain mb-4 opacity-80" />
            <p className="mb-3 justiffy-center font-bold">{"Check your internet connection try again."}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition">
              Retry
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-12 flex items-center justify-center text-sm text-slate-500">No posts found.</div>
        ) : (
          <div className="post-grid">
            {posts.map((post) => (
              <article
                key={post.id}
                onClick={() => openPostWithUrl(post)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") openPostWithUrl(post);
                }}
                className="group flex flex-col rounded-3xl bg-white cursor-pointer transition"
              >
                <div className="relative overflow-hidden rounded-2xl bg-slate-200 post-media">
                  {post.isVideo && (
                   <div className="absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/50">
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-4 h-4 text-white ml-0.5"
                    >
                      <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" />
                    </svg>
                  </div>

                  )}

                  {post.coverType === "note" && !post.src ? (
                    <div
                      className="w-full min-h-[200px] max-h-[400px] lg:h-[350px] h-[300px] flex items-center justify-center p-6 rounded-2xl border border-slate-200 relative overflow-hidden"
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
                      data-src={post.src}
                      className="w-full h-auto min-h-[200px] max-h-[350px] object-cover rounded-2xl border border-slate-200"
                      muted
                      loop
                      playsInline
                      preload="none"
                    />
                  ) : (
                    <img
                      data-src={post.src}
                      src="https://via.placeholder.com/800x600?text=No+Image"
                      alt={post.caption}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-auto min-h-[200px] max-h-[350px] object-cover border border-slate-200 rounded-2xl transition-transform duration-500 group-hover:scale-105 hover:border"
                    />
                  )}
                </div>

                <div className="flex flex-col p-4">
                  {post.coverType === "note" && !post.src ? (
                    <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed font-semibold mb-2">{post.note_caption}</p>
                  ) : (
                    <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed font-semibold mb-2">{post.caption}</p>
                  )}

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={post.user.avatar}
                        alt={post.user.name}
                        className="h-5 w-5 rounded-full object-cover ring-2 ring-white cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!user) {
                            setShowLoginModal(true);
                            return;
                          }
                          router.push(`/user/profile/${post.user.id}`);
                        }}
                      />

                      <span
                        className="max-w-[150px] truncate text-xs font-medium text-slate-500 capitalize cursor-pointer hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!user) {
                            setShowLoginModal(true);
                            return;
                          }
                          router.push(`/user/profile/${post.user.id}`);
                        }}
                      >
                        {post.user.name}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(post.id);
                      }}
                      className="flex items-center gap-1.5 transition-all active:scale-90"
                      aria-label="Like post"
                    >
                      <svg viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill={post.liked ? "currentColor" : "none"} className={`w-6 h-6 transition-colors duration-300 ${post.liked ? "text-rose-500" : "text-slate-300 hover:text-slate-400"}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                      </svg>
                      <span className={`text-xs font-bold ${post.liked ? "text-rose-500" : "text-slate-400"}`}>{post.likeCount}</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {selectedPost && <PostModal post={selectedPost} onClose={closeModal} onToggleLike={toggleLike} />}
      </section>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  );
}
