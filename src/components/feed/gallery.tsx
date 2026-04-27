"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import PostModal from "../modal/postModal";
import type { Post } from "@/src/lib/types";
import { AnimatePresence } from "framer-motion";
import { safeFetch } from "@/src/lib/api/handler";

type Props = { postCount?: number };

const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;
const isVideoUrl = (u?: string) => !!u && VIDEO_EXT_RE.test(u);
const NO_IMAGE_PLACEHOLDER = "https://via.placeholder.com/800x600?text=No+Image";

const mapApiPost = (p: any): Post => {
  const apiId = p.social_post_id ?? Math.floor(Math.random() * 1e6);
  let src: string | undefined = undefined;
  if (Array.isArray(p.images) && p.images.length > 0) {
    const cover = p.images.find((i: any) => i.is_cover === 1) ?? p.images[0];
    src = cover?.image_url;
  }
  if (!src && p.cover_type !== "note") {
    src = NO_IMAGE_PLACEHOLDER;
  }
  const isVideo = isVideoUrl(src);
  const caption = p.text ?? p.subtitle ?? "";
  return {
    id: apiId,
    apiId,
    src,
    isVideo,
    caption,
    user: {
      id: p.user_id ?? p.user?.user_id ?? p.user?.id,
      name: p.author_name ?? "Unknown",
      avatar: p.author_pic ?? `https://i.pravatar.cc/100?u=${p.user_id ?? apiId}`,
    },
    liked: Boolean(p.liked_by_me),
    likeCount: p.likes_count ?? 0,
    coverType: p.cover_type,
    noteConfig: p.config,
    rawCreatedAt: p.created_at,
    status: p.status,
    mediaType: p.media_type,
    is_product_linked: Boolean(p.is_product_linked),
    linked_product: p.linked_product,
    original_audio_url: p.original_audio_url,
    original_video_url: p.original_video_url,
    post_public_id: p.post_public_id,
  };
};

export default function RandomPostsGallery({ postCount = 12 }: Props) {
  const [activeCategory, setActiveCategory] = useState("Recommend");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const pushedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function fetchPosts() {
      setLoading(true);
      setError(null);
      try {
        const json = await safeFetch<any>("/api/social/", {
          signal: controller.signal,
        });

        const apiPosts: any[] =
          json?.data?.posts && Array.isArray(json.data.posts) ? json.data.posts : [];

        const mapped = apiPosts.map(mapApiPost).sort((a, b) => {
          const ta = a.rawCreatedAt ? new Date(a.rawCreatedAt).getTime() : 0;
          const tb = b.rawCreatedAt ? new Date(b.rawCreatedAt).getTime() : 0;
          return tb - ta;
        });

        if (!cancelled) {
          setPosts(mapped.slice(0, postCount));
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        if (!cancelled) setError(err.message ?? "Failed to load posts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPosts();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [postCount]);

  useEffect(() => {
    const tryOpenFromUrl = async () => {
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
        const json = await safeFetch<any>(`/api/social/${postId}`);
        const single = mapApiPost(json?.data ?? json);
        setSelectedPost(single);
        pushedRef.current = false;
      } catch (err) {
        setSelectedPost({
          id: postId,
          caption: "Post unavailable",
          user: { id: 0, name: "Unknown", avatar: `https://i.pravatar.cc/100?u=post-${postId}` },
          liked: false,
          likeCount: 0,
        } as Post);
        pushedRef.current = false;
      }
    };

    tryOpenFromUrl();
  }, [posts]);

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
              const json = await safeFetch<any>(`/api/social/${postId}`);
              setSelectedPost(mapApiPost(json?.data ?? json));
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
        }
      } else {
        setSelectedPost(null);
      }
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [posts]);

  const openPostWithUrl = (post: Post) => {
    setSelectedPost(post);
    try {
      const username = post.author_handle || post.user.username || "user";
      const publicId = post.post_public_id || post.id;
      const newPath = `/${username}/${publicId}`;
      
      const url = new URL(window.location.href);
      url.pathname = newPath;
      url.searchParams.set("xsec_source", "gallery");
      window.history.pushState({ postId: post.id, modal: true }, "", url.toString());
      pushedRef.current = true;
    } catch (err) {
      pushedRef.current = false;
    }
  };

  const closeModal = () => {
    setSelectedPost(null);

    try {
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
          url.pathname = "/";
          changed = true;
        }

        // 2. Check search param
        if (url.searchParams.has("post")) {
          url.searchParams.delete("post");
          changed = true;
        }

        if (changed || url.pathname !== "/") {
          window.history.replaceState({}, "", "/");
        }
      }
      pushedRef.current = false;
    } catch (err) {
      console.warn("Failed to clean URL after modal close", err);
    }
  };

  const toggleLike = (postId: string | number) => {
    setPosts(prev => prev.map(p => {
      if (String(p.apiId ?? p.id) === String(postId)) {
        const newLiked = !p.liked;
        return {
          ...p,
          liked: newLiked,
          likeCount: newLiked ? p.likeCount + 1 : Math.max(0, p.likeCount - 1)
        };
      }
      return p;
    }));
  };

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

  return (
    <section className="">
      <div className="top-24 z-10 mb-6">
        <div className="flex mt-5 gap-2 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              onClick={() => setActiveCategory(item)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition-all ${activeCategory === item ? "bg-slate-100 text-gray-700 font-bold" : "text-slate-600 hover:bg-slate-100"
                }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center text-sm text-slate-500">Loading posts...</div>
      ) : error ? (
        <div className="py-12 flex items-center justify-center text-sm text-rose-500">{error}</div>
      ) : posts.length === 0 ? (
        <div className="py-12 flex items-center justify-center text-sm text-slate-500">No posts found.</div>
      ) : (
        <div className="post-grid ">
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
              <div className="relative overflow-hidden rounded-2xl bg-slate-200">
                {post.isVideo && (
                  <div className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-xl bg-white">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-900 ml-0.5">
                      <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" />
                    </svg>
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
                    className="w-full min-h-[200px] max-h-[400px] lg:h-[350px] h-[300px] flex items-center justify-center p-6 rounded-2xl border"
                    style={{
                      background:
                        post.noteConfig && post.noteConfig.startColor && post.noteConfig.endColor
                          ? `linear-gradient(135deg, ${post.noteConfig.startColor}, ${post.noteConfig.endColor})`
                          : undefined,
                    }}
                  >
                    <div className="text-center ">
                      <p className="text-slate-900 text-lg font-semibold">{post.noteConfig?.text ?? post.caption ?? "Note"}</p>
                    </div>
                  </div>
                ) : post.isVideo ? (
                  <video src={post.src} className="w-full h-auto min-h-[200px] max-h-[350px] object-cover rounded-2xl border" muted loop playsInline />
                ) : (
                  <img src={post.src} alt={post.caption} className="w-full h-auto min-h-[200px] max-h-[350px] object-cover border rounded-2xl transition-transform duration-500 group-hover:scale-105 hover:border" />
                )}
              </div>

              <div className="flex flex-col p-4">
                <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed font-semibold mb-2">{post.caption}</p>

                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={post.user.avatar} className="h-5 w-5 rounded-full object-cover ring-2 ring-white" alt={post.user.name} />
                    <span className="max-w-[150px] truncate text-xs font-medium text-slate-400 capitalize">{post.user.name}</span>
                  </div>

                  <button onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 transition-all active:scale-90" aria-label="Like post">
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

      {/* Modal */}
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
    </section>
  );
}
