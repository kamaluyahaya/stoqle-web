// ProfileHeader.tsx
"use client";

import React, { useEffect, useMemo, useLayoutEffect, useState, useRef } from "react";
import PostModal from "../../modal/postModal"; // adjust path if needed
import { useAuth } from "@/src/context/authContext";
import { useRouter } from "next/navigation";
import Header from "./header";
import ShimmerGrid from "../../shimmer";

type ApiPost = any;

type User = { name: string; avatar: string; id?: number | string; };

type Post = {
  id: number;
  src?: string;
  isVideo?: boolean;
  isImage?: boolean;
  caption?: string;
  note_caption?: string;
  user: User;
  liked: boolean;
  likeCount: number;
  coverType?: string;
  noteConfig?: any;
  rawCreatedAt?: string;
  apiId?: number;
};

type Props = { postCount?: number; userId?: string | number }; // <--- new userId prop
const STICKY_BUFFER = 10; // px — prevents shaking

const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i;
const isVideoUrl = (u?: string) => !!u && VIDEO_EXT_RE.test(u);
const isImageUrl = (u?: string) => !!u && IMAGE_EXT_RE.test(u);

// local images in public folder
const NO_IMAGE_PLACEHOLDER = "/assets/images/favio.png"; // fallback post image
const DEFAULT_AVATAR = "/assets/images/favio.png";       // fallback avatar
const DEFAULT_BG = "/assets/images/background.png";      // fallback background

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
      name: p.author_name ?? p.user?.full_name ?? "---",
      avatar: p.author_pic ?? p.user?.profile_pic ?? DEFAULT_AVATAR,
    },
    liked: Boolean(p.liked_by_me),
    likeCount: p.likes_count ?? 0,
    coverType: p.cover_type,
    noteConfig: p.config,
    rawCreatedAt: p.created_at,
  };
};

export default function ProfileHeader({ postCount = 12, userId }: Props) {
  const [profileApi, setProfileApi] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [mediaPosts, setMediaPosts] = useState<Post[]>([]);
  const [notePosts, setNotePosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const auth = useAuth();
  const router = useRouter();

  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const tabs = useMemo(() => {
    const base = ["Posts", "Notes"];
    if (profileApi?.is_business_owner) base.push("Products");
    return base;
  }, [profileApi?.is_business_owner]);

  const pushedRef = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Determine whether we're viewing "me" or another user
  // If userId prop is undefined => view "me"
  const viewUserId = userId ? String(userId) : "me";
  const currentUserId = auth?.user?.user_id ? String(auth.user.user_id) : null;
  const viewingOwnProfile = viewUserId === "me" || (currentUserId && viewUserId === currentUserId);

  // fetch profile (either /me or /api/auth/users/:user_id)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadProfile() {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const base = process.env.NEXT_PUBLIC_API_URL;
        if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined in environment");

        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const endpoint =
          viewUserId === "me"
            ? `${base.replace(/\/$/, "")}/api/auth/profile/me`
            : `${base.replace(/\/$/, "")}/api/auth/users/${encodeURIComponent(viewUserId)}`;

        const res = await fetch(endpoint, { signal: controller.signal, headers });

        if (!res.ok) {
          throw new Error(`Profile API returned ${res.status}`);
        }

        const json = await res.json();
        if (cancelled) return;

        // normalize response shapes (both your /me and /users/:id responses use data.user etc)
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
  }, [viewUserId]); // re-run when userId changes

  // fetch posts (either /me or /user/:user_id)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadPosts() {
      setPostsLoading(true);
      setPostsError(null);
      try {
        const base = process.env.NEXT_PUBLIC_API_URL;
        if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined in environment");
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const endpoint =
          viewUserId === "me"
            ? `${base.replace(/\/$/, "")}/api/social/me`
            : `${base.replace(/\/$/, "")}/api/social/user/${encodeURIComponent(viewUserId)}`;

        const resp = await fetch(endpoint, { signal: controller.signal, headers });

        if (!resp.ok) {
          throw new Error(`Posts API returned ${resp.status}`);
        }

        const json = await resp.json();

        // support different shapes (data.posts, data, posts)
        const apiPosts: any[] =
          json?.data?.posts && Array.isArray(json.data.posts)
            ? json.data.posts
            : Array.isArray(json?.data)
              ? json.data
              : Array.isArray(json?.posts)
                ? json.posts
                : Array.isArray(json?.data?.posts)
                  ? json.data.posts
                  : [];

        if (cancelled) return;

        const mapped = apiPosts.map((p) => mapApiPost(p));
        const ordered = mapped;

        const media: Post[] = [];
        const notes: Post[] = [];

        for (const m of ordered) {
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
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Failed to load posts:", err);
        if (!cancelled) setPostsError(err.message ?? "Failed to load posts");
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    }

    loadPosts();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [viewUserId, postCount]);

  // rest of your modal/url/popstate/tab/touch/keyboard logic unchanged...
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
          user: { name: "---", avatar: `---` },
          liked: false,
          likeCount: 0,
        });
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
              const res = await fetch(`${base.replace(/\/$/, "")}/api/social/${postId}`);
              if (!res.ok) throw new Error("Post not found");
              const json = await res.json();
              setSelectedPost(mapApiPost(json?.data ?? json));
            } catch {
              setSelectedPost({
                id: postId,
                caption: "Post unavailable",
                user: { name: "---", avatar: `---` },
                liked: false,
                likeCount: 0,
              });
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

  const toggleLike = (postId: string | number) => {
    // noop - implement your API call here if desired
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
    return user?.full_name ?? user?.name ?? "---";
  }, [profileApi]);

  // Sticky tabs logic (unchanged)
  const tabsWrapperRef = useRef<HTMLDivElement | null>(null);
  const tabsInnerRef = useRef<HTMLDivElement | null>(null);
  const tabsPlaceholderRef = useRef<HTMLDivElement | null>(null);
  const [isSticky, setIsSticky] = useState(false);
  const [stickyStyle, setStickyStyle] = useState<React.CSSProperties | undefined>(undefined);
  const tabsInitialTopRef = useRef<number | null>(null);

  const findNavbar = () =>
    document.querySelector("header, [role='banner'], .main-navbar") as HTMLElement | null;

  const updateStickyState = () => {
    const el = tabsWrapperRef.current;
    const initialTop = tabsInitialTopRef.current;
    if (!el || initialTop === null) return;

    const navbar = findNavbar();
    const navbarHeight = navbar ? navbar.offsetHeight : 0;

    const shouldStick = window.scrollY + navbarHeight >= initialTop + STICKY_BUFFER;

    if (shouldStick) {
      const rect = el.getBoundingClientRect();

      setStickyStyle({
        position: "fixed",
        top: `${navbarHeight}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 60,
      });

      if (tabsPlaceholderRef.current) {
        tabsPlaceholderRef.current.style.height = `${rect.height}px`;
      }
    } else {
      setStickyStyle(undefined);

      if (tabsPlaceholderRef.current) {
        tabsPlaceholderRef.current.style.height = "0px";
      }
    }

    setIsSticky(shouldStick);
  };

  useLayoutEffect(() => {
    const el = tabsWrapperRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    tabsInitialTopRef.current = rect.top + window.scrollY;

    const onScroll = () => updateStickyState();
    const onResize = () => updateStickyState();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Prepare logout handler only when viewing own profile
  const handleLogout = () => {
    auth.logout();
    router.push("/discover");
  };

  const getNoteStyles = (config: any) => {
    if (!config) return { background: "#f1f5f9" }; // Fallback

    // Ensure config is an object (parse if it's a string from API)
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
      fontSize: `${(cfg.textStyle?.fontSize ?? 28) * 0.6}px`, // Scale down for grid thumbnails
      fontWeight: cfg.textStyle?.fontWeight ?? "800",
    };
  };


  const TabsBar = (
    <>
      <div ref={tabsPlaceholderRef} style={{ height: 0, transition: "height 160ms ease" }} />

      <div ref={tabsWrapperRef} className="bg-white p-3 flex justify-center" style={stickyStyle}>
        <div ref={tabsInnerRef} className="flex gap-2 overflow-x-auto">
          {tabs.map((t, i) => (
            <button
              key={t}
              onClick={() => setActiveTabIndex(i)}
              className={`px-3 py-2 text-sm font-bold transition whitespace-nowrap ${i === activeTabIndex ? "bg-slate-100 text-black" : "text-slate-400 hover:bg-slate-100"
                }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  const TabPanes = (
    <div className="relative overflow-hidden w-full" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="flex transition-transform duration-450 ease-in-out" style={{ width: `${tabs.length * 100}%`, transform: `translateX(-${activeTabIndex * (100 / tabs.length)}%)` }}>
        <div style={{ width: `${100 / tabs.length}%` }} className="p-2">
          {postsLoading ? (
            <ShimmerGrid count={10} />
          ) : postsError ? (
            <div className="py-12 flex flex-col items-center justify-center text-sm text-rose-500">
              <img
                src="/assets/images/message-icon.png"
                alt="No posts"
                className="w-40 h-40 object-contain mb-4 opacity-80"
              />
              <p className="mb-3 justiffy-center font-bold">{"Check your internet connection try again."}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition"
              >
                Retry
              </button>
            </div>
          ) : mediaPosts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
              <img src="/assets/images/post.png" alt="No posts" className="w-40 h-40 object-contain mb-4 opacity-80" />
              <p className="text-sm font-medium">No image or video posts found.</p>
            </div>
          ) : (
            <div className="post-grid mb-20">
              {mediaPosts.map((post) => (
                <article key={post.id} onClick={() => openPostWithUrl(post)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") openPostWithUrl(post); }} className="group flex flex-col rounded-3xl bg-white cursor-pointer transition">
                  <div className="relative overflow-hidden rounded-2xl bg-slate-200">
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
                        {/* Emoji Layer (Parsed from config) */}
                        {(() => {
                          const cfg = typeof post.noteConfig === 'string' ? JSON.parse(post.noteConfig) : post.noteConfig;
                          if (cfg?.emojis?.length > 0) {
                            return (
                              <div
                                className="absolute inset-0 flex items-center justify-around opacity-30 pointer-events-none"
                                style={{ filter: cfg.emojiBlur ? "blur(4px)" : "none" }}
                              >
                                {cfg.emojis.slice(0, 3).map((emoji: string, idx: number) => (
                                  <span key={idx} className="text-4xl transform rotate-12">{emoji}</span>
                                ))}
                              </div>
                            );
                          }
                        })()}

                        <div className="text-center relative z-10">
                          <p
                            className="line-clamp-4 px-2"
                            style={{ color: 'inherit', fontSize: 'inherit', fontWeight: 'inherit' }}
                          >
                            {post.noteConfig?.text ?? post.caption ?? "Note"}
                          </p>
                        </div>
                      </div>
                    ) : post.isVideo ? (
                      <video src={post.src} className="w-full h-auto min-h-[200px] max-h-[350px] object-cover rounded-2xl border border-slate-200" muted loop playsInline />
                    ) : (
                      <img src={post.src} alt={post.caption} className="w-full h-auto min-h-[200px] max-h-[350px] object-cover border border-slate-200 rounded-2xl transition-transform duration-500 group-hover:scale-105 hover:border" />
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
        </div>

        {/* Notes pane */}
        <div style={{ width: `${100 / tabs.length}%` }} className="">
          {postsLoading ? (
            <ShimmerGrid count={10} />
          ) : notePosts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
              <img src="/assets/images/post.png" alt="No posts" className="w-40 h-40 object-contain mb-4 opacity-80" />
              <p className="text-sm font-medium">No note</p>
            </div>
          ) : (
            <div className="post-grid mb-20">
              {notePosts.map((post) => (
                <article key={post.id} onClick={() => openPostWithUrl(post)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") openPostWithUrl(post); }} className="group flex flex-col rounded-3xl bg-white cursor-pointer transition">
                  <div className="relative overflow-hidden rounded-2xl bg-slate-200">
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
                      <div className="w-full min-h-[200px] max-h-[400px] lg:h-[350px] h-[300px] flex items-center justify-center p-6 rounded-2xl border border-slate-200" style={{ background: post.noteConfig && post.noteConfig.startColor && post.noteConfig.endColor ? `linear-gradient(135deg, ${post.noteConfig.startColor}, ${post.noteConfig.endColor})` : undefined }}>
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
                    {post.coverType === "note" && !post.src ? (
                      <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed font-semibold mb-2">{post.note_caption}</p>
                    ) : (
                      <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed font-semibold mb-2">{post.caption}</p>
                    )}

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
        </div>

        {profileApi?.is_business_owner && (
          <div style={{ width: `${100 / tabs.length}%` }} className="p-4">
            <div className="rounded-2xl bg-white p-6 min-h-[220px] flex items-center justify-center text-slate-500">
              <div className="text-center">
                <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
                  <img src="/assets/images/post.png" alt="No posts" className="w-40 h-40 object-contain mb-4 opacity-80" />
                  <div className="text-xs mt-2">No Products.</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <Header
        profileApi={profileApi}
        displayName={displayName}
        // only provide the logout handler when viewing your own profile
        onLogout={viewingOwnProfile ? handleLogout : undefined}
      />

      {TabsBar}
      {TabPanes}


      {selectedPost && <PostModal post={selectedPost} onClose={closeModal} onToggleLike={toggleLike} />}
    </div>
  );
}
