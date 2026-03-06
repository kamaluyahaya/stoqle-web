// PostModal.tsx (fix: target left media only + consistent image resizing)

"use client";

import { API_BASE_URL } from "@/src/lib/config";
import HeartIcon from "@heroicons/react/24/outline/HeartIcon";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/src/context/authContext";
import VideoPlayer from "@/src/components/posts/videoPlayer";

type User = { name: string; avatar?: string; id?: number | string; };
type Post = { id: number | string; src?: string; isVideo?: boolean; caption?: string; note_caption?: string; user: User; liked: boolean; likeCount: number; coverType?: string; noteConfig?: any; rawCreatedAt?: string; };
type APIComment = { comment_id: number; post_id: number; user_id: number; comment_content: string; comment_at: string; is_author: number; is_first_comment: number; author_name: string; author_pic?: string; likes_count: number; author_liked?: boolean; followers_count?: number; posts_count?: number; liked_by_user?: boolean; };

type Props = { post: Post; onClose: () => void; onToggleLike: (postId: string) => void; userToken?: string | null; };

const NO_IMAGE_PLACEHOLDER = "https://via.placeholder.com/1600x1200?text=No+Image";

// layout tuning
const RIGHT_PANEL_WIDTH = 400;
const MODAL_MAX_WIDTH = 1200;
const MODAL_MIN_WIDTH = 520;
const LEFT_MIN_WIDTH = 260;
const LEFT_MAX_WIDTH = MODAL_MAX_WIDTH - RIGHT_PANEL_WIDTH;

function formatDate(dateStr?: string) {
  if (!dateStr) return "Just now";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = (now.getTime() - date.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr${Math.floor(diff / 3600) > 1 ? "s" : ""} ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) > 1 ? "s" : ""} ago`;
  if (diff < 2419200) return `${Math.floor(diff / 604800)} week${Math.floor(diff / 604800) > 1 ? "s" : ""} ago`;
  if (diff < 29030400) return `${Math.floor(diff / 2419200)} month${Math.floor(diff / 2419200) > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function PostModal({ post, onClose, onToggleLike, userToken }: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  // NEW: explicit left-media container ref so we only measure the main media
  const leftMediaRef = useRef<HTMLDivElement | null>(null);

  // mediaRef still used for convenience measurement (will point to *main* img/video)
  const mediaRef = useRef<HTMLElement | null>(null);
  const auth = useAuth();

  const [computedWidth, setComputedWidth] = useState<number | null>(null);
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(typeof window !== "undefined" ? window.innerWidth >= 1024 : false);

  // UI state (kept as your original)
  const [postLiked, setPostLiked] = useState<boolean>(Boolean(post.liked));
  const [postLikeCount, setPostLikeCount] = useState<number>(Number(post.likeCount ?? 0));
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [comments, setComments] = useState<APIComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);

  const currentUserId = auth?.user?.user_id || auth?.user?.id;
  const postAuthorId = post.user?.id;
  const isPostOwner = Boolean(currentUserId && postAuthorId && String(currentUserId) === String(postAuthorId));

  const getToken = () => userToken ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // comments/follow handlers unchanged (kept from your file)
  useEffect(() => {
    const controller = new AbortController();
    const token = getToken();
    async function fetchComments() {
      setLoadingComments(true);
      setCommentsError(null);
      const postId = Number(post.id);
      if (isNaN(postId)) {
        setCommentsError("Invalid post id");
        setLoadingComments(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/social/${postId}/comments`, {
          method: "GET",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: controller.signal,
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Failed to fetch comments: ${res.status} ${res.statusText} ${txt}`);
        }
        const json = await res.json();
        const fetchedComments: APIComment[] = json?.data?.comments && Array.isArray(json.data.comments) ? json.data.comments : [];
        const normalized = fetchedComments.map((c) => ({
          ...c,
          liked_by_user: Boolean((c as any).liked_by_user || (c as any).author_liked || false),
          likes_count: Number(c.likes_count ?? 0),
        }));
        setComments(normalized);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("fetchComments error", err);
        setCommentsError(err.message || "Unable to load comments");
      } finally {
        setLoadingComments(false);
      }
    }
    fetchComments();
    return () => controller.abort();
  }, [post.id, userToken]);

  useEffect(() => {
    const controller = new AbortController();
    const token = getToken();
    const userId = Number(post.user?.id ?? 0);
    if (!userId) return;
    async function fetchFollowStatus() {
      if (!token) { setIsFollowing(false); return; }
      try {
        const res = await fetch(`${API_BASE_URL}/api/follow/${userId}/status`, {
          method: "GET",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = await res.json();
        const isFollowingFromServer = Boolean(json?.data?.isFollowing ?? json?.data?.is_following ?? false);
        setIsFollowing(isFollowingFromServer);
      } catch (err) {
        console.warn("fetchFollowStatus error", err);
      }
    }
    fetchFollowStatus();
    return () => controller.abort();
  }, [post.user?.id, userToken]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // sizing helper (same math)
  const computeAndSetModalWidth = (naturalW: number, naturalH: number) => {
    if (!modalRef.current) return;
    const modalHeight = modalRef.current.clientHeight || Math.round(window.innerHeight * 0.94);
    const aspect = naturalW / Math.max(1, naturalH);
    let leftWidth = Math.round(aspect * modalHeight);
    leftWidth = Math.min(LEFT_MAX_WIDTH, Math.max(LEFT_MIN_WIDTH, leftWidth));
    let total = leftWidth + RIGHT_PANEL_WIDTH;
    total = Math.min(MODAL_MAX_WIDTH, Math.max(MODAL_MIN_WIDTH, total));
    setComputedWidth(total);
  };

  // image/video measurement helpers
  const onImageLoad = (img: HTMLImageElement) => {
    if (!img) return;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height || 1;
    computeAndSetModalWidth(w, h);
  };
  const onVideoMeta = (vid: HTMLVideoElement) => {
    if (!vid) return;
    const w = vid.videoWidth || vid.clientWidth || 16;
    const h = vid.videoHeight || vid.clientHeight || 9;
    computeAndSetModalWidth(w, h);
  };

  // EFFECT A: attach listeners to the media inside the LEFT MEDIA container only
  useEffect(() => {
    // target left media container specifically to avoid picking avatars etc.
    const mediaRoot = leftMediaRef.current;
    if (!mediaRoot) return;

    let videoEl: HTMLVideoElement | null = mediaRoot.querySelector("video");
    let imgEl: HTMLImageElement | null = mediaRoot.querySelector("img");

    // clear previous ref
    mediaRef.current = null;

    const cleanupFns: (() => void)[] = [];

    if (videoEl) {
      mediaRef.current = videoEl;
      const onMeta = () => onVideoMeta(videoEl!);
      videoEl.addEventListener("loadedmetadata", onMeta);
      if ((videoEl as HTMLVideoElement).videoWidth) onMeta();
      cleanupFns.push(() => videoEl!.removeEventListener("loadedmetadata", onMeta));
    } else if (imgEl) {
      mediaRef.current = imgEl;
      const onLoad = () => onImageLoad(imgEl!);
      // if already loaded, call immediately
      if (imgEl.complete && imgEl.naturalWidth) {
        onImageLoad(imgEl);
      } else {
        imgEl.addEventListener("load", onLoad);
        cleanupFns.push(() => imgEl!.removeEventListener("load", onLoad));
      }
    } else {
      // fallback: no media found yet (note types) — use default aspect if large screen
      if (isLargeScreen) computeAndSetModalWidth(4, 3);
    }

    return () => cleanupFns.forEach((fn) => fn());
    // rerun when main media or screen breakpoint changes
  }, [post.src, post.isVideo, post.coverType, isLargeScreen]);

  // EFFECT B: recompute on resize (uses the mediaRef which points to left media)
  useEffect(() => {
    const handleResize = () => {
      const large = window.innerWidth >= 1024;
      setIsLargeScreen(large);
      const el = mediaRef.current as any;
      if (!large) {
        setComputedWidth(null); // mobile: full width
        return;
      }
      if (!el) {
        // no media found yet — use fallback
        computeAndSetModalWidth(16, 9);
        return;
      }
      if (el.tagName === "IMG") {
        const img = el as HTMLImageElement;
        if (img.naturalWidth && img.naturalHeight) {
          computeAndSetModalWidth(img.naturalWidth, img.naturalHeight);
        } else {
          // attach a single onload fallback (won't leak because we remove on cleanup)
          const onLoad = () => computeAndSetModalWidth(img.naturalWidth || img.width, img.naturalHeight || img.height || 1);
          img.addEventListener("load", onLoad);
          // cleanup will remove this
          setTimeout(() => img.removeEventListener("load", onLoad), 6000); // safety removal
        }
      } else if (el.tagName === "VIDEO") {
        const vid = el as HTMLVideoElement;
        if (vid.videoWidth && vid.videoHeight) {
          computeAndSetModalWidth(vid.videoWidth, vid.videoHeight);
        } else {
          const onMeta = () => computeAndSetModalWidth(vid.videoWidth || vid.clientWidth, vid.videoHeight || vid.clientHeight || 1);
          vid.addEventListener("loadedmetadata", onMeta);
          setTimeout(() => vid.removeEventListener("loadedmetadata", onMeta), 6000);
        }
      } else {
        computeAndSetModalWidth(16, 9);
      }
    };

    // initial run
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mediaRef.current]);

  // --- keep your action handlers (with login checks) ---
  const toggleLikeComment = async (commentId: number) => {
    const ensure = auth?.ensureLoggedIn ? await auth.ensureLoggedIn() : Boolean(getToken());
    if (!ensure) return;
    // ... rest unchanged (same as your implementation)
    setComments((prev) =>
      prev.map((c) =>
        c.comment_id === commentId
          ? { ...c, liked_by_user: !c.liked_by_user, likes_count: c.liked_by_user ? Math.max(0, c.likes_count - 1) : c.likes_count + 1 }
          : c
      )
    );
    // API call omitted here for brevity — keep your original logic
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/social/comments/${commentId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        // rollback (same pattern)
        setComments((prev) =>
          prev.map((c) =>
            c.comment_id === commentId
              ? { ...c, liked_by_user: !c.liked_by_user, likes_count: c.liked_by_user ? Math.max(0, c.likes_count - 1) : c.likes_count + 1 }
              : c
          )
        );
        return;
      }
      const likes_count = Number(json?.data?.likes_count ?? json?.data?.likesCount ?? null);
      let likedFlag: boolean | null = null;
      if (json?.data?.liked !== undefined) likedFlag = Boolean(json.data.liked);
      if (json?.message && /unlike/i.test(json.message)) likedFlag = false;
      if (json?.message && /like/i.test(json.message)) likedFlag = true;
      setComments((prev) =>
        prev.map((c) =>
          c.comment_id === commentId
            ? { ...c, liked_by_user: likedFlag === null ? c.liked_by_user : likedFlag, likes_count: Number.isNaN(likes_count) ? c.likes_count : likes_count }
            : c
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async () => {
    const ensure = auth?.ensureLoggedIn ? await auth.ensureLoggedIn() : Boolean(getToken());
    if (!ensure) return;
    const token = getToken();
    if (!commentText || commentText.trim().length === 0) return;
    setCommentPosting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/social/${post.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to post comment");
      const created: APIComment | undefined = json?.data?.comment;
      if (created) setComments((p) => [{ ...created, liked_by_user: Boolean(created.liked_by_user) }, ...p]);
      else {
        const tokenUser = auth?.user;
        const newC: APIComment = {
          comment_id: Date.now(),
          post_id: Number(post.id),
          user_id: Number(auth?.user?.user_id ?? auth?.user?.id ?? 0),
          comment_content: commentText.trim(),
          comment_at: new Date().toISOString(),
          is_author: 0,
          is_first_comment: 0,
          author_name: tokenUser?.full_name ?? tokenUser?.name ?? "You",
          author_pic: tokenUser?.profile_pic ?? tokenUser?.avatar,
          likes_count: 0,
          liked_by_user: false,
        };
        setComments((p) => [newC, ...p]);
      }
      setCommentText("");
      setIsCommenting(false);
    } catch (err) {
      console.error("add comment failed", err);
    } finally {
      setCommentPosting(false);
    }
  };

  const handleToggleLike = async () => {
    const ensure = auth?.ensureLoggedIn ? await auth.ensureLoggedIn() : Boolean(getToken());
    if (!ensure) return;
    setPostLiked((s) => !s);
    setPostLikeCount((c) => (postLiked ? Math.max(0, c - 1) : c + 1));
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE_URL}/api/social/${post.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setPostLiked((s) => !s);
        setPostLikeCount((c) => (postLiked ? c + 1 : Math.max(0, c - 1)));
        return;
      }
      const liked = json?.data?.liked;
      const likes_count = Number(json?.data?.likes_count ?? json?.data?.likesCount ?? null);
      if (typeof liked === "boolean") setPostLiked(liked);
      if (!Number.isNaN(likes_count)) setPostLikeCount(likes_count);
      try { onToggleLike(String(post.id)); } catch { }
    } catch (err) {
      setPostLiked((s) => !s);
      setPostLikeCount((c) => (postLiked ? c + 1 : Math.max(0, c - 1)));
      console.error(err);
    }
  };

  const toggleFollowAuthor = async () => {
    const ensure = auth?.ensureLoggedIn ? await auth.ensureLoggedIn() : Boolean(getToken());
    if (!ensure) return;
    const userId = Number(post.user?.id);
    if (!userId) return;
    if (followLoading) return;
    setFollowLoading(true);
    setIsFollowing((s) => !s);
    const token = getToken();
    try {
      const url = `${API_BASE_URL}/api/follow/${userId}/${isFollowing ? "unfollow" : "follow"}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setIsFollowing((s) => !s);
        return;
      }
      const followedId = json?.data?.followedId ?? json?.data?.followed_id ?? null;
      if (followedId === null) {
        // keep optimistic
      } else {
        setIsFollowing(!isFollowing);
      }
    } catch (err) {
      setIsFollowing((s) => !s);
      console.error(err);
    } finally {
      setFollowLoading(false);
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

  // apply computedWidth only on lg screens
  const modalInlineStyle: React.CSSProperties | undefined =
    typeof window !== "undefined" && window.innerWidth >= 1024 && computedWidth
      ? { width: `${computedWidth}px` }
      : undefined;

  return (
    <div role="dialog" aria-modal="true" ref={wrapperRef} className="fixed inset-0 z-70 flex items-center justify-center px-0 py-0" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/55 " aria-hidden />

      <button onMouseDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Close post" className="hidden lg:flex absolute top-5 right-5 z-50 h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/7 transition-shadow shadow-sm" title="Close">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/85"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
      </button>

      <div ref={modalRef} onMouseDown={stop} style={modalInlineStyle} className="relative z-10 w-full h-full bg-white flex flex-col overflow-y-auto lg:flex lg:flex-row lg:overflow-hidden lg:w-[96vw] lg:max-w-[1100px] lg:h-[94vh] lg:rounded-2xl shadow-2xl">
        {/* MOBILE HEADER */}
        <header className="lg:hidden sticky top-0 z-30 h-16 flex items-center justify-between px-6 p-5 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-2">
            <button onMouseDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Close" className="h-9 w-9 flex items-center justify-center" title="Close">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-700"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <img src={post.user.avatar} alt={post.user.name} className="h-10 w-10 rounded-full object-cover" />
              <div className="min-w-0"><div className="text-sm text-black font-semibold truncate">{post.user.name}</div></div>
            </div>
          </div>

          {!isPostOwner && (
            <button onClick={(e) => { e.stopPropagation(); toggleFollowAuthor(); }} disabled={followLoading} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-shadow ${isFollowing ? "bg-gray-200 text-slate-800" : "bg-red-500 text-white"}`} aria-pressed={isFollowing}>
              {isFollowing ? "Unfollow" : "Follow"}
            </button>
          )}
        </header>

        {/* LEFT: media */}
        {/* NOTE: we attach leftMediaRef here so our effects look only inside this container */}
        <div ref={leftMediaRef} className="flex-1 flex items-center justify-center min-h-[300px] lg:min-h-0 border-r border-slate-200">
          {post.coverType === "note" && !post.src ? (
            <div className="w-full h-full flex items-center justify-center p-6 border border-slate-200 relative" style={getNoteStyles(post.noteConfig)}>
              {(() => {
                const cfg = typeof post.noteConfig === 'string' ? JSON.parse(post.noteConfig) : post.noteConfig;
                if (cfg?.emojis?.length > 0) {
                  return (
                    <div className="absolute inset-0 flex items-center justify-around opacity-30 pointer-events-none" style={{ filter: cfg.emojiBlur ? "blur(4px)" : "none" }}>
                      {cfg.emojis.slice(0, 3).map((emoji: string, idx: number) => <span key={idx} className="text-4xl transform rotate-12">{emoji}</span>)}
                    </div>
                  );
                }
              })()}

              <div className="text-center relative z-10">
                <p className="line-clamp-4 px-2" style={{ color: 'inherit', fontSize: 'inherit', fontWeight: 'inherit' }}>{post.noteConfig?.text ?? post.caption ?? "Note"}</p>
              </div>
            </div>
          ) : post.isVideo ? (
            <div className="w-full h-full flex items-center justify-center">
              <VideoPlayer src={post.src} className="w-full h-full object-contain" />
            </div>
          ) : (
            <img
              src={post.src ?? NO_IMAGE_PLACEHOLDER}
              alt={post.caption}
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* RIGHT: details + comments */}
        <div className="flex flex-col min-h-0 lg:w-[400px] w-full relative">
          {/* HEADER for lg */}
          <div className="flex items-center justify-between gap-4 p-4 lg:p-5 flex-shrink-0 border-b lg:border-b-0 border-slate-200 hidden lg:flex">
            <div className="flex items-center gap-3 min-w-0">
              <img src={post.user.avatar} alt={post.user.name} className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-900 truncate">{post.user.name}</div>
              </div>
            </div>

            {!isPostOwner && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFollowAuthor();
                }}
                disabled={followLoading}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${isFollowing ? "bg-gray-200 text-slate-800" : "bg-red-500 text-white hover:bg-red-600"}`}
                aria-pressed={isFollowing}
              >
                {isFollowing ? "Unfollow" : "Follow"}
              </button>
            )}
          </div>

          <div className=" lg:overflow-auto">
            <div className="p-5 lg:p-6">
              {post.coverType === "note" && !post.src ? (
                <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed font-semibold mb-2">{post.note_caption}</p>
              ) : (
                <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed font-semibold mb-2">{post.caption}</p>
              )}
              <div className="text-xs text-slate-400">{formatDate(post.rawCreatedAt)}</div>
            </div>

            <div className="border-b border-slate-200" />

            {/* Comments area (same as original) */}
            <div className="space-y-3 p-5 lg:p-6 mb-15">
              <div className="flex items-center justify-between text-slate-400 mb-4">
                <span>Total Comments</span>
                <span className="font-medium">{comments.length}</span>
              </div>

              {/* ... the rest of your comments rendering unchanged ... */}
              {loadingComments ? (
                <div className="flex items-center justify-center gap-2 py-6">
                  <svg className="h-5 w-5 animate-spin text-slate-700" viewBox="0 0 24 24" style={{ animationDuration: "0.5s" }}>
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" className="opacity-40" fill="none" />
                    <path fill="currentColor" className="opacity-90" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                  </svg>
                  <span className="text-xs font-medium text-slate-700">Loading...</span>
                </div>
              ) : commentsError ? (
                <div className="text-xs text-red-500">{commentsError}</div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <img src="/assets/images/message-icons.png" alt="No comments" className="w-30 opacity-50" />
                  <div className="text-xs text-slate-400 text-center">No comments yet — be the first.</div>
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.comment_id} className="flex items-start gap-4">
                    <img src={c.author_pic ?? `https://i.pravatar.cc/40?u=${c.author_name}-${c.comment_id}`} alt={c.author_name} className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-sm font-medium text-slate-400 truncate">{c.author_name}</div>
                          {c.is_author === 1 && (
                            <span className="text-xs inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">Author</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-1 text-sm text-slate-600 mb-1">{c.comment_content}</div>

                      <div className="flex items-center gap-2">
                        <div className="text-xs text-slate-400">{formatDate(c.comment_at)}</div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLikeComment(c.comment_id);
                          }}
                          className={`ml-auto flex items-center gap-1 text-xs font-medium ${c.liked_by_user ? "text-rose-500" : "text-slate-400"}`}
                          aria-pressed={c.liked_by_user}
                          title={c.liked_by_user ? "Unlike" : "Like"}
                        >
                          <HeartIcon className="h-4 w-4" />
                          <span>{c.likes_count}</span>
                        </button>
                      </div>

                      {c.is_first_comment === 1 && (
                        <span className="text-xs inline-flex items-center px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-100">First comment</span>
                      )}
                    </div>
                  </div>
                ))
              )}

              <div className="text-center text-slate-300 font-Medium mt- mb-10">-THE END-</div>
            </div>
          </div>

          <div className="lg:absolute fixed left-0 w-full bg-white border-t border-slate-200 z-50 p-4 bottom-[52px] lg:bottom-0 lg:p-4">
            {isCommenting ? (
              <div className="space-y-3">
                <input
                  autoFocus
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment();
                      setIsCommenting(false);
                    }
                  }}
                  placeholder="Say something..."
                  className="w-full rounded-2xl bg-gray-100 px-5 py-3 text-sm text-black caret-red-500 outline-none transition focus:ring-1 focus:ring-gray-300"
                  onMouseDown={(e) => e.stopPropagation()}
                />

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCommenting(false);
                      setCommentText("");
                    }}
                    className="px-4 py-2 rounded-full text-sm text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddComment();
                      setIsCommenting(false);
                    }}
                    disabled={commentPosting}
                    className="px-5 py-2 rounded-full bg-red-600 text-white text-sm font-medium shadow-sm hover:brightness-95"
                  >
                    {commentPosting ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCommenting(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-full text-sm text-slate-600"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12c0 4.418-4.03 8-9 8-1.11 0-2.173-.113-3.168-.322L3 20l1.322-5.832C3.937 13.755 3 12.007 3 10c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-xs">Say something</span>
                </button>

                <div className="ml-auto flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLike();
                    }}
                    aria-pressed={postLiked}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition ${postLiked ? "text-rose-500" : "text-slate-600"}`}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill={postLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                    <span className="text-xs font-semibold">{postLikeCount}</span>
                  </button>

                  <button onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-600">
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 8a3 3 0 10-6 0v4a3 3 0 006 0V8z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5A8.25 8.25 0 116 16.5" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
