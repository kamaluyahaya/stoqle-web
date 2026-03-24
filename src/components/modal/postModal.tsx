// PostModal.tsx (fix: target left media only + consistent image resizing)

"use client";

import { API_BASE_URL } from "@/src/lib/config";
import HeartIcon from "@heroicons/react/24/outline/HeartIcon";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/src/context/authContext";
import VideoPlayer from "@/src/components/posts/videoPlayer";
import ImageViewer from "./imageViewer";

import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCachedLocationName, getCurrentLocationName } from "@/src/lib/location";
import { FaHeart, FaRegHeart, FaPaperPlane } from "react-icons/fa";
import { io } from "socket.io-client";

type User = { name: string; avatar?: string; id?: number | string; };
type Post = { id: number | string; src?: string; isVideo?: boolean; caption?: string; note_caption?: string; user: User; liked: boolean; likeCount: number; coverType?: string; noteConfig?: any; rawCreatedAt?: string; allMedia?: string[]; location?: string | null; };
type APIComment = { comment_id: number; post_id: number; user_id: number; comment_content: string; location?: string | null; comment_at: string; is_author: number; is_first_comment: number; author_name: string; author_pic?: string; likes_count: number; author_liked?: boolean; followers_count?: number; posts_count?: number; liked_by_user?: boolean; parent_id?: number | null; };

type Props = {
  post: Post;
  onClose: () => void;
  onToggleLike: (postId: string | number) => void;
  userToken?: string | null;
  isPreview?: boolean;
  origin?: { x: number; y: number } | null;
};

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

function LikeBurst() {
  const particles = Array.from({ length: 8 });
  const colors = ["#EF4444", "#F43F5E", "#FB7185", "#FDA4AF"];
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {particles.map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: Math.cos((i * 45) * Math.PI / 180) * 45,
            y: Math.sin((i * 45) * Math.PI / 180) * 45,
            scale: [0.2, 1.2, 0],
            opacity: [1, 1, 0],
            rotate: [0, 45, 90]
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute"
        >
          <FaHeart size={8} style={{ color: colors[i % colors.length] }} />
        </motion.div>
      ))}
    </div>
  );
}

export default function PostModal({ post, onClose, onToggleLike, userToken, isPreview = false, origin }: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  // NEW: explicit left-media container ref so we only measure the main media
  const leftMediaRef = useRef<HTMLDivElement | null>(null);

  // mediaRef still used for convenience measurement (will point to *main* img/video)
  const mediaRef = useRef<HTMLElement | null>(null);
  const auth = useAuth();
  const router = useRouter();

  const [computedWidth, setComputedWidth] = useState<number | null>(null);
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(typeof window !== "undefined" ? window.innerWidth >= 1024 : false);

  // UI state (kept as your original)
  const [postLiked, setPostLiked] = useState<boolean>(Boolean(post.liked));
  const [postLikeCount, setPostLikeCount] = useState<number>(Number(post.likeCount ?? 0));
  const startTimeRef = useRef<number>(Date.now());

  // Track watch time and log on unmount
  useEffect(() => {
    startTimeRef.current = Date.now();
    return () => {
      const endTime = Date.now();
      const seconds = Math.floor((endTime - startTimeRef.current) / 1000);
      if (seconds > 0) {
        import("@/src/lib/api/social").then(({ logSocialActivity }) => {
          logSocialActivity({
            social_post_id: Number(post.id),
            action_type: "view",
            watch_time: seconds
          }, userToken || undefined).catch(() => {});
        });
      }
    };
  }, [post.id, userToken]);  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followLoading, setFollowLoading] = useState<boolean>(false);
  const [showBurst, setShowBurst] = useState(false);

  // Sync with prop changes (if parent state updates via socket)
  useEffect(() => {
    setPostLiked(Boolean(post.liked));
    setPostLikeCount(Number(post.likeCount ?? 0));
  }, [post.liked, post.likeCount]);

  // Handle real-time updates for this specific post
  useEffect(() => {
    const socket = io(API_BASE_URL);

    socket.on("post:like", (data) => {
      if (String(data.postId) === String(post.id)) {
        setPostLikeCount(data.likes_count);
        
        // If the update was triggered by the current user, sync the liked status
        const currentUserId = auth?.user?.user_id || auth?.user?.id;
        if (data.liked_by && String(data.liked_by) === String(currentUserId)) {
          setPostLiked(true);
        } else if (data.unliked_by && String(data.unliked_by) === String(currentUserId)) {
          setPostLiked(false);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [post.id, auth?.user]);
  const [isCommenting, setIsCommenting] = useState(false);
  const [comments, setComments] = useState<APIComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<APIComment | null>(null);
  const [burstingCommentId, setBurstingCommentId] = useState<number | null>(null);
  const [expandedParents, setExpandedParents] = useState<number[]>([]);
  const [viewerProfileUserId, setViewerProfileUserId] = useState<string | number | undefined>(undefined);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(() => {
    if (post.allMedia && post.allMedia.length > 0 && post.src) {
      const idx = post.allMedia.indexOf(post.src);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });
  const [swipeDirection, setSwipeDirection] = useState(0);

  const mediaList = post.allMedia && post.allMedia.length > 0 ? post.allMedia : (post.src ? [post.src] : []);

  const currentUserId = auth?.user?.user_id || auth?.user?.id;
  const postAuthorId = post.user?.id;
  const isPostOwner = Boolean(currentUserId && postAuthorId && String(currentUserId) === String(postAuthorId));

  const getToken = () => userToken ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  useEffect(() => {
    if (post.allMedia && post.allMedia.length > 0 && post.src) {
      const idx = post.allMedia.indexOf(post.src);
      setCurrentMediaIndex(idx >= 0 ? idx : 0);
    } else {
      setCurrentMediaIndex(0);
    }
  }, [post.id, post.src]);

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
    if (isPreview) return;
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
    if (isPreview) return;
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
  }, [post.src, post.isVideo, post.coverType, isLargeScreen, currentMediaIndex]);

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

  // --- Action handlers ---
  const toggleLikeComment = async (commentId: number) => {
    if (isPreview) {
      toast.info("Interactions are not allowed in preview mode");
      return;
    }
    const localGetToken = () => userToken ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    const ok = await auth.ensureAccountVerified();
    if (!ok) return;

    const comment = comments.find(c => c.comment_id === commentId);
    if (comment && !comment.liked_by_user) {
      setBurstingCommentId(commentId);
      setTimeout(() => setBurstingCommentId(null), 800);
    }

    setComments((prev) =>
      prev.map((c) =>
        c.comment_id === commentId
          ? { ...c, liked_by_user: !c.liked_by_user, likes_count: c.liked_by_user ? Math.max(0, c.likes_count - 1) : c.likes_count + 1 }
          : c
      )
    );

    try {
      const token = localGetToken();
      const res = await fetch(`${API_BASE_URL}/api/social/comments/${commentId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
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
    if (isPreview) {
      toast.info("Interactions are not allowed in preview mode");
      return;
    }
    const ok = await auth.ensureAccountVerified();
    if (!ok) return;
    const token = getToken();
    if (!commentText || commentText.trim().length === 0) return;
    setCommentPosting(true);
    try {
      // Get current location (fresh) to update profile and indicate comment placement
      const freshLocation = await getCurrentLocationName();
      const location = freshLocation || getCachedLocationName();

      const res = await fetch(`${API_BASE_URL}/api/social/${post.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          content: commentText.trim(),
          location: location,
          parent_comment_id: replyingTo?.comment_id || null
        }),
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
          location: getCachedLocationName(),
          likes_count: 0,
          liked_by_user: false,
        };
        setComments((p) => [newC, ...p]);
      }
      setCommentText("");
      setIsCommenting(false);
      setReplyingTo(null);
    } catch (err) {
      console.error("add comment failed", err);
    } finally {
      setCommentPosting(false);
    }
  };

  const handleToggleLike = async () => {
    if (isPreview) {
      toast.info("Interactions are not allowed in preview mode");
      return;
    }
    const ok = await auth.ensureAccountVerified();
    if (!ok) return;
    
    if (!postLiked) {
      setShowBurst(true);
      setTimeout(() => setShowBurst(false), 800);
    }

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
    if (isPreview) {
      toast.info("Interactions are not allowed in preview mode");
      return;
    }
    const ok = await auth.ensureAccountVerified();
    if (!ok) return;
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
    <div role="dialog" aria-modal="true" ref={wrapperRef} className="fixed inset-0 z-[3500] flex items-center justify-center px-0 py-0" onMouseDown={onClose}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/55"
        aria-hidden
      />

      <button onMouseDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Close post" className="hidden lg:flex absolute top-5 right-5 z-50 h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/7 transition-shadow shadow-sm" title="Close">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/85"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
      </button>

      <motion.div
        ref={modalRef}
        onMouseDown={stop}
        style={{
          ...modalInlineStyle,
          transformOrigin: origin ? `${origin.x}px ${origin.y}px` : "center"
        }}
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.3 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative z-10 w-full h-full bg-white flex flex-col overflow-y-auto lg:flex lg:flex-row lg:overflow-hidden lg:w-[96vw] lg:max-w-[1100px] lg:h-[94vh] lg:rounded-2xl shadow-2xl"
      >
        {/* MOBILE HEADER */}
        <header className="lg:hidden sticky top-0 z-30 h-16 flex items-center justify-between px-6 p-5 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-2">
            <button onMouseDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Close" className="h-9 w-9 flex items-center justify-center" title="Close">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-700"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href={`/user/profile/${post.user.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex-shrink-0 active:scale-95 transition-transform"
              >
                <img
                  src={post.user.avatar}
                  alt={post.user.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              </Link>
              <div className="min-w-0">
                <Link
                  href={`/user/profile/${post.user.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm text-black font-semibold truncate hover:text-red-500 transition-colors block"
                >
                  {post.user.name}
                </Link>
                {post.location && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium truncate">
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    <span>{post.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {!isPostOwner && !isFollowing && (
            <button onClick={(e) => { e.stopPropagation(); toggleFollowAuthor(); }} disabled={followLoading} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-shadow bg-red-500 text-white">
              Follow
            </button>
          )}
        </header>

        {/* LEFT: media */}
        {/* NOTE: we attach leftMediaRef here so our effects look only inside this container */}
        <div ref={leftMediaRef} className="flex-1 flex items-center justify-center min-h-[300px] lg:min-h-0 border-r border-slate-200 relative group/media bg-slate-50">
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
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <AnimatePresence initial={false} custom={swipeDirection} mode="popLayout">
                <motion.img
                  key={currentMediaIndex}
                  src={mediaList[currentMediaIndex] ?? NO_IMAGE_PLACEHOLDER}
                  alt={post.caption}
                  custom={swipeDirection}
                  variants={{
                    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
                    center: { x: 0, opacity: 1 },
                    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 })
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.6}
                  onDragEnd={(e, info) => {
                    const swipeThreshold = 50;
                    if (info.offset.x < -swipeThreshold) {
                      setSwipeDirection(1);
                      setCurrentMediaIndex((prev) => (prev < mediaList.length - 1 ? prev + 1 : 0));
                    } else if (info.offset.x > swipeThreshold) {
                      setSwipeDirection(-1);
                      setCurrentMediaIndex((prev) => (prev > 0 ? prev - 1 : mediaList.length - 1));
                    }
                  }}
                  onTap={() => {
                    setViewerProfileUserId(undefined);
                    setFullImageUrl(mediaList[currentMediaIndex]);
                  }}
                  className="w-full h-full object-contain cursor-zoom-in active:cursor-grabbing touch-none"
                />
              </AnimatePresence>

              {mediaList.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSwipeDirection(-1);
                      setCurrentMediaIndex((prev) => (prev > 0 ? prev - 1 : mediaList.length - 1));
                    }}
                    className="absolute left-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-all opacity-0 group-hover/media:opacity-100 backdrop-blur-sm z-20"
                  >
                    <ChevronLeftIcon className="w-6 h-6" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSwipeDirection(1);
                      setCurrentMediaIndex((prev) => (prev < mediaList.length - 1 ? prev + 1 : 0));
                    }}
                    className="absolute right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-all opacity-0 group-hover/media:opacity-100 backdrop-blur-sm z-20"
                  >
                    <ChevronRightIcon className="w-6 h-6" />
                  </button>

                  <div className="absolute bottom-4 left-0 right-0 flex items-center justify-between px-6 z-20 pointer-events-none">
                    <div className="flex-1" /> {/* Spacer */}

                    <div className="flex gap-1.5 px-3 py-1.5 pointer-events-auto">
                      {mediaList.map((_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentMediaIndex ? "bg-red-500 scale-125" : "bg-white/40 shadow-sm"
                            }`}
                        />
                      ))}
                    </div>

                    <div className="flex-1 flex justify-end">
                      {/* Counter Badge */}
                      <div className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-black text-white/90 tracking-widest shadow-lg border border-white/10 pointer-events-auto">
                        {currentMediaIndex + 1} / {mediaList.length}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: details + comments */}
        <div className="flex flex-col min-h-0 lg:w-[400px] w-full relative">
          {/* HEADER for lg */}
          <div className="flex items-center justify-between gap-4 p-4 lg:p-5 flex-shrink-0 border-b lg:border-b-0 border-slate-200 hidden lg:flex">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={post.user.avatar}
                alt={post.user.name}
                className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
                onClick={(e) => { e.stopPropagation(); setFullImageUrl(post.user.avatar || null); setViewerProfileUserId(post.user.id); }}
              />
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-900 truncate">{post.user.name}</div>
              </div>
            </div>

            {!isPostOwner && !isFollowing && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFollowAuthor();
                }}
                disabled={followLoading}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all bg-red-500 text-white hover:bg-red-600"
              >
                Follow
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
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{formatDate(post.rawCreatedAt)}</span>
                {post.location && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] opacity-40">•</span>
                    <div className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500">
                      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      <span>{post.location}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-b border-slate-200" />
            {/* Comments area */}
            <div className="space-y-3 p-5 lg:p-6 mb-15">
              <div className="flex items-center justify-between text-slate-400 mb-4">
                <span>Total Comments</span>
                <span className="font-medium">{comments.length}</span>
              </div>

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
                (() => {
                  const mainComments = comments.filter(c => !c.parent_id);
                  const replies = comments.filter(c => c.parent_id);

                  return mainComments.map((c) => {
                    const parentReplies = replies.filter(r => r.parent_id === c.comment_id);
                    const isExpanded = expandedParents.includes(c.comment_id);
                    const visibleReplies = isExpanded ? parentReplies : parentReplies.slice(0, 2);

                    return (
                      <div key={c.comment_id} className="space-y-4 relative">
                        {/* Continuous vertical line for the whole thread if there are replies */}
                        {parentReplies.length > 0 && (
                          <div className="absolute left-[18px] top-9 bottom-0 w-[1.2px] bg-slate-100 z-0" />
                        )}

                        {/* Parent Comment */}
                        <div className="flex items-start gap-4 relative z-10">
                          <Link
                            href={`/user/profile/${c.user_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0 active:scale-95 transition-transform"
                          >
                            <img
                              src={c.author_pic ?? `https://i.pravatar.cc/40?u=${c.author_name}-${c.comment_id}`}
                              alt={c.author_name}
                              className="h-9 w-9 rounded-full object-cover bg-white"
                            />
                          </Link>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <Link
                                href={`/user/profile/${c.user_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm font-medium text-slate-400 truncate hover:text-red-500 transition-colors"
                              >
                                {c.author_name}
                              </Link>
                              {c.is_author === 1 && (
                                <span className="text-[10px] inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 font-bold">Author</span>
                              )}
                            </div>

                            <div className="mt-1 text-sm text-slate-600 mb-1">{c.comment_content}</div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-400 relative w-full">
                              <span>{formatDate(c.comment_at)}</span>

                              {c.location && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] opacity-40">•</span>
                                  <div className="flex items-center gap-0.5 font-medium text-slate-400">
                                    <span>{c.location}</span>
                                  </div>
                                </div>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReplyingTo(c);
                                  setIsCommenting(true);
                                  setCommentText("");
                                }}
                                className="font-bold hover:text-slate-600 transition-colors"
                              >
                                Reply
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLikeComment(c.comment_id);
                                }}
                                className={`ml-auto flex items-center gap-1.5 font-medium transition-colors relative ${c.liked_by_user ? "text-rose-500" : "text-slate-400 hover:text-slate-500"}`}
                                aria-pressed={c.liked_by_user}
                              >
                                <div className="relative flex items-center justify-center">
                                  {burstingCommentId === c.comment_id && <LikeBurst />}
                                  <AnimatePresence mode="wait">
                                    <motion.div
                                      key={c.liked_by_user ? "liked" : "unliked"}
                                      initial={{ scale: 0.7, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0.7, opacity: 0 }}
                                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                    >
                                      {c.liked_by_user ? (
                                        <FaHeart className="h-3.5 w-3.5" />
                                      ) : (
                                        <FaRegHeart className="h-3.5 w-3.5" />
                                      )}
                                    </motion.div>
                                  </AnimatePresence>

                                  {c.liked_by_user && burstingCommentId === c.comment_id && (
                                    <motion.div
                                      initial={{ scale: 1, opacity: 1 }}
                                      animate={{ scale: [1, 2, 1], opacity: [1, 0, 0] }}
                                      transition={{ duration: 0.5 }}
                                      className="absolute text-rose-500 pointer-events-none"
                                    >
                                      <FaHeart className="h-3.5 w-3.5 fill-current" />
                                    </motion.div>
                                  )}
                                </div>
                                <span className="min-w-[12px]">{c.likes_count}</span>
                              </button>
                            </div>

                            {/* Tags under the metadata row */}
                            {c.is_first_comment === 1 && (
                              <div className="mt-2">
                                <span className="text-[10px] inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-100">First to Comment</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Replies Container */}
                        {parentReplies.length > 0 && (
                          <div className="ml-[18px] relative">
                            <div className="pl-6 space-y-4">
                              {visibleReplies.map((r, i) => {
                                const isAbsolutelyLast = (i === visibleReplies.length - 1) && (parentReplies.length <= 2);
                                return (
                                <div key={r.comment_id} className="flex items-start gap-3 relative">
                                  {/* Curved connector */}
                                  <div className="absolute -left-6 top-0 w-6 h-[14px] border-l-[1.2px] border-b-[1.2px] border-slate-100 rounded-bl-[12px] z-[2]" />
                                  
                                  {/* Masking line below if this is the last element in the entire thread */}
                                  {isAbsolutelyLast && (
                                    <div className="absolute -left-[28px] top-[14px] bottom-[-40px] w-5 bg-white z-[1]" />
                                  )}

                                  <Link
                                    href={`/user/profile/${r.user_id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-shrink-0 active:scale-95 transition-transform z-10"
                                  >
                                    <img
                                      src={r.author_pic ?? `https://i.pravatar.cc/40?u=${r.author_name}-${r.comment_id}`}
                                      alt={r.author_name}
                                      className="h-7 w-7 rounded-full object-cover bg-white"
                                    />
                                  </Link>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Link
                                        href={`/user/profile/${r.user_id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-xs font-medium text-slate-400 truncate hover:text-red-500 transition-colors"
                                      >
                                        {r.author_name}
                                      </Link>
                                      {r.is_author === 1 && (
                                        <span className="text-[9px] inline-flex items-center px-1 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 font-bold">Author</span>
                                      )}
                                    </div>

                                    <div className="mt-0.5 text-xs text-slate-600 mb-1">{r.comment_content}</div>

                                    <div className="flex items-center gap-3 text-[10px] text-slate-400 relative w-full">
                                      <span>{formatDate(r.comment_at)}</span>

                                      {r.location && (
                                        <div className="flex items-center gap-1">
                                          <span className="text-[8px] opacity-40">•</span>
                                          <div className="flex items-center gap-0.5 font-medium text-slate-400">
                                            <span>{r.location}</span>
                                          </div>
                                        </div>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleLikeComment(r.comment_id);
                                        }}
                                        className={`ml-auto flex items-center gap-1.5 font-medium transition-colors relative ${r.liked_by_user ? "text-rose-500" : "text-slate-400 hover:text-slate-500"}`}
                                      >
                                        <div className="relative flex items-center justify-center">
                                          {burstingCommentId === r.comment_id && <LikeBurst />}
                                          <AnimatePresence mode="wait">
                                            <motion.div
                                              key={r.liked_by_user ? "liked" : "unliked"}
                                              initial={{ scale: 0.7, opacity: 0 }}
                                              animate={{ scale: 1, opacity: 1 }}
                                              exit={{ scale: 0.7, opacity: 0 }}
                                              transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                            >
                                              {r.liked_by_user ? (
                                                <FaHeart className="h-3 w-3" />
                                              ) : (
                                                <FaRegHeart className="h-3 w-3" />
                                              )}
                                            </motion.div>
                                          </AnimatePresence>

                                          {r.liked_by_user && burstingCommentId === r.comment_id && (
                                            <motion.div
                                              initial={{ scale: 1, opacity: 1 }}
                                              animate={{ scale: [1, 2, 1], opacity: [1, 0, 0] }}
                                              transition={{ duration: 0.5 }}
                                              className="absolute text-rose-500 pointer-events-none"
                                            >
                                              <FaHeart className="h-3 w-3 fill-current" />
                                            </motion.div>
                                          )}
                                        </div>
                                        <span className="min-w-[10px]">{r.likes_count}</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                              })}
                            </div>

                            {/* Folding Actions */}
                            {parentReplies.length > 2 && (
                              <div className="pl-6 mt-2 mb-2">
                                <div className="relative flex items-center">
                                  {/* Curved connector up to the toggle button */}
                                  <div className="absolute -left-6 top-[-4px] w-6 h-[18px] border-l-[1.2px] border-b-[1.2px] border-slate-100 rounded-bl-[12px] z-[2]" />
                                  
                                  {/* Masking line below since this is the last piece of thread */}
                                  <div className="absolute -left-8 top-[14px] w-8 h-[200px] bg-white z-[1]" />

                                {!isExpanded ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedParents(prev => [...prev, c.comment_id]);
                                    }}
                                    className="text-[10px] font-bold text-slate-400 hover:text-red-500 flex items-center gap-1.5 transition-colors py-1 pl-1"
                                  >
                                    View {parentReplies.length - 2} more replies
                                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-current transform rotate-0 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedParents(prev => prev.filter(id => id !== c.comment_id));
                                    }}
                                    className="text-[10px] font-bold text-slate-400 hover:text-red-500 flex items-center gap-1.5 transition-colors py-1 pl-1"
                                  >
                                    Hide replies
                                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-current transform rotate-180 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                                  </button>
                                )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()
              )}

              <div className="text-center text-slate-300 font-Medium mt- mb-10">-THE END-</div>
            </div>
          </div>

          {!isPreview && (
            <div className="lg:absolute fixed left-0 w-full bg-white border-t border-slate-200 z-50 p-4 bottom-0 lg:p-4">
              {replyingTo && (
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-t-lg border-x border-t border-slate-100 -mt-2 mb-2 text-xs">
                  <span className="text-slate-500">
                    Replying to <span className="font-semibold text-slate-700">{replyingTo.author_name}</span>
                  </span>
                  <button
                    onClick={() => { setReplyingTo(null); if (!commentText) setIsCommenting(false); }}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </div>
              )}
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
                    className="w-full rounded-full bg-gray-100 px-3 py-3 lg:text-[12px] text-[10px] sm:text-[8px] text-black caret-red-500 outline-none transition focus:ring-1 focus:ring-gray-300"
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
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition relative ${postLiked ? "text-rose-500" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      {showBurst && <LikeBurst />}
                      <div className="relative flex items-center justify-center">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={postLiked ? "liked" : "unliked"}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                          >
                            {postLiked ? <FaHeart className="w-5 h-5" /> : <FaRegHeart className="w-5 h-5" />}
                          </motion.div>
                        </AnimatePresence>
                        {postLiked && (
                          <motion.div
                            initial={{ scale: 1, opacity: 1 }}
                            animate={{ scale: [1, 2, 1], opacity: [1, 0.4, 0] }}
                            transition={{ duration: 0.6 }}
                            className="absolute text-rose-500 pointer-events-none"
                          >
                            <FaHeart size={20} />
                          </motion.div>
                        )}
                      </div>
                      <span className="text-xs font-bold">{postLikeCount}</span>
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
          )}
        </div>
      </motion.div>
      <ImageViewer
        src={fullImageUrl ? (viewerProfileUserId ? fullImageUrl : mediaList[currentMediaIndex]) : null}
        onClose={() => setFullImageUrl(null)}
        profileUserId={viewerProfileUserId}
        mediaList={viewerProfileUserId ? [] : mediaList}
        currentIndex={currentMediaIndex}
        onIndexChange={(idx) => {
          setSwipeDirection(idx > currentMediaIndex ? 1 : -1);
          setCurrentMediaIndex(idx);
        }}
        direction={swipeDirection}
      />
    </div>
  );
}
