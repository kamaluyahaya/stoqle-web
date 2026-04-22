// PostModal.tsx (fix: target left media only + consistent image resizing)
"use client";

import Image from "next/image";

import { API_BASE_URL } from "@/src/lib/config";
import '@flaticon/flaticon-uicons/css/all/all.css';
import {
  ChevronLeftIcon,
  ChevronRightIcon,

  CheckIcon,
  ArrowDownTrayIcon,
  LinkIcon,
  UserGroupIcon,
  FlagIcon,
  ArrowUpRightIcon,
  XMarkIcon,
  EyeIcon
} from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import VerifiedBadge from "@/src/components/common/VerifiedBadge";
import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import { useAuth } from "@/src/context/authContext";
import { isOffline, safeFetch, ApiError } from "@/src/lib/api/handler";
import MobileVideoPlayer from "@/src/components/posts/mobileVideoPlayer";
import LargeScreenVideoPlayer from "@/src/components/posts/largeScreenVideoPlayer";
import { formatUrl } from "@/src/lib/utils/media";
import ImageViewer from "./imageViewer";

import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCachedLocationName, getCurrentLocationName } from "@/src/lib/location";
import { FaHeart, FaRegHeart, FaPaperPlane } from "react-icons/fa";
import { getNextZIndex } from "@/src/lib/utils/z-index";
import {
  MoreVertical,
  MoreHorizontal,
  ChevronLeft,
  Search,
  Share2,
  Heart,
  MessageCircleMore,
  Send,
  ArrowUpRightFromSquareIcon
  // ArrowUpRight
  // ArrowUpRightFromCircle
} from 'lucide-react';
import { io } from "socket.io-client";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import { fetchProductById } from "@/src/lib/api/productApi";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import type { PreviewPayload } from "@/src/types/product";
import { useAudio } from "@/src/context/audioContext";
import { copyToClipboard } from "@/src/lib/utils/utils";
import { CommentOverlay } from "./CommentOverlay";

import type { Post, User, APIComment } from "@/src/lib/types";
import { useSocialShare } from "@/src/hooks/useSocialShare";
import PostShareModal from "./PostShareModal";
import { createPortal } from "react-dom";
import { EMOJI_SHORTCUTS } from "@/src/lib/constants/emojis";

type Props = {
  post: Post;
  onClose: () => void;
  open: boolean;
  onToggleLike: (postId: string | number) => void;
  userToken?: string | null;
  isPreview?: boolean;
  origin?: { x: number; y: number } | null;
  targetUserId?: string | number | null;
  isProductLinkedOnly?: boolean;
  zIndex?: number;
  onActivePostChange?: (post: any) => void;
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


const VolumeHUD = React.memo(() => {
  const { isMuted, volume, toggleMute, setVolume } = useAudio();
  const isActuallyOn = !isMuted && volume > 0;

  return (
    <div className={`relative flex items-center group/volume transition-opacity duration-300 ${isActuallyOn ? "hidden md:flex" : "flex"}`}>
      <motion.div
        initial={false}
        animate={{ width: "auto", opacity: 1 }}
        className="flex items-center bg-black/40 backdrop-blur-md rounded-full px-1.5 py-1 gap-1 border border-white/10 shadow-lg"
      >
        <button
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
        >
          {isMuted || volume === 0 ? (
            <svg className="w-5 h-5 drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M23 9l-6 6m0-6l6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg className="w-5 h-5 drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Hover-expandable Apple-like Volume Slider */}
        <div className="w-0 group-hover/volume:w-24 overflow-hidden transition-all duration-300 ease-out flex items-center pr-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              e.stopPropagation();
              setVolume(parseFloat(e.target.value));
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white hover:accent-rose-500 transition-colors"
          />
        </div>
      </motion.div>

    </div>
  );
});


export default function PostModal({ post, onClose: onCloseProp, open, onToggleLike, userToken, isPreview = false, origin, targetUserId, isProductLinkedOnly = false, zIndex, onActivePostChange }: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const prevPostIdRef = useRef<string | number | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const interactionTrackerRef = useRef<Record<string, { watch_time: number, max_progress: number, completed: boolean, skipped: boolean, start_time: number, replays: number }>>({});
  const fastScrollVelocityRef = useRef<boolean>(false);
  const lastScrollTimeRef = useRef(0);
  const lastTapRef = useRef<number>(0);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const leftMediaRef = useRef<HTMLDivElement | null>(null);
  const mediaRef = useRef<HTMLElement | null>(null);
  const userManualPauseRef = useRef(false);
  const auth = useAuth();
  const router = useRouter();

  const [isClosing, setIsClosing] = useState(false);
  const [modalZIndex, setModalZIndex] = useState(() => getNextZIndex());

  useEffect(() => {
    if (open) {
      setModalZIndex(getNextZIndex());
    } else {
      lastFetchedPostIdRef.current = null;
    }
  }, [open]);

  const onClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    onCloseProp();
  }, [onCloseProp, isClosing]);

  const [computedWidth, setComputedWidth] = useState<number | null>(null);

  // PREVENT audio files from appearing in the media list (bug: they should be in original_audio_url only)
  const allMedia = useMemo(() => {
    if (!post.allMedia) return [];
    return post.allMedia.filter(m => {
      const url = m.url.toLowerCase();
      const isAudio = url.match(/\.(mp3|wav|ogg|m4a)$/i) || (url.endsWith('.webm') && !post.isVideo);
      return !isAudio;
    });
  }, [post.allMedia, post.isVideo]);

  const handleVideoRegister = useCallback((el: HTMLVideoElement | null, isVisible: boolean) => {
    if (isVisible) activeVideoRef.current = el;
  }, []);

  const prefetchTriggerRef = useRef<Record<string, boolean>>({});

  const handleTimeUpdate = useCallback((postId: string | number, currentTime: number, duration: number) => {
    const data = interactionTrackerRef.current[String(postId)];
    if (data) {
      if (duration > 0) {
        const pct = (currentTime / duration) * 100;
        if (pct > data.max_progress) data.max_progress = pct;
        if (pct > 95) data.completed = true;

        // Proactive Infinite Scroll Trigger: Fetch more when user is 70% through current video
        if (pct > 70 && !prefetchTriggerRef.current[String(postId)]) {
          prefetchTriggerRef.current[String(postId)] = true;
          // Trigger the reservoir maintenance loop early
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("trigger-reel-prefetch"));
          }
        }
      }
    }
  }, []);

  const handleVideoEnded = useCallback((postId: string | number) => {
    const data = interactionTrackerRef.current[String(postId)];
    if (data) {
      data.completed = true;
      data.replays = (data.replays || 0) + 1;
    }
  }, []);

  // GROUND ZERO: Force-kill every rogue video DOM element instantly
  const stopAllVideos = () => {
    if (typeof document === "undefined") return;
    const videos = document.querySelectorAll("video");
    videos.forEach((vid) => {
      try {
        vid.pause();
        vid.muted = true;
        vid.volume = 0;
        // vid.currentTime = vid.currentTime; (omitted as it can trigger re-loads in some browsers, but pause+mute is enough)
      } catch (e) { }
    });
  };
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(typeof window !== "undefined" ? window.innerWidth >= 768 : false);

  // REELS MODE (Mobile Video)
  const isMobileReels = !isLargeScreen && post.isVideo;

  // NORMALIZE INITIAL POST: Ensure property names match what the modal logic expects
  const normalizedInitialPost = useMemo(() => ({
    ...post,
    social_post_id: post.social_post_id || post.id || post.apiId,
    liked_by_me: post.liked_by_me ?? post.liked_by_user ?? post.liked ?? false,
    likes_count: post.likes_count ?? post.likesCount ?? post.likeCount ?? 0
  }), [post]);

  const [reelsList, setReelsList] = useState<any[]>([normalizedInitialPost]);
  const [showCommentsSheet, setShowCommentsSheet] = useState(false);
  const [currentReelIndex, setCurrentReelIndex] = useState(0);
  const [firstImageAspectRatio, setFirstImageAspectRatio] = useState<number | null>(null);

  const [showSwipeGuide, setShowSwipeGuide] = useState(false);

  useEffect(() => {
    if (open && isMobileReels && currentReelIndex === 0) {
      const seen = localStorage.getItem("stoqle_post_swipe_guide_v1");
      if (!seen) {
        const timer = setTimeout(() => setShowSwipeGuide(true), 2000); // Wait for video to start
        return () => clearTimeout(timer);
      }
    } else if (currentReelIndex > 0 && showSwipeGuide) {
      setShowSwipeGuide(false);
      localStorage.setItem("stoqle_post_swipe_guide_v1", "true");
    }
  }, [open, isMobileReels, currentReelIndex]);

  const dismissSwipeGuide = useCallback(() => {
    if (showSwipeGuide) {
      setShowSwipeGuide(false);
      localStorage.setItem("stoqle_post_swipe_guide_v1", "true");
    }
  }, [showSwipeGuide]);


  // CRITICAL SYNC: Ensure real-time updates (like processing -> ready) are reflected in the current reel
  useEffect(() => {
    setReelsList(prev => {
      if (prev.length === 0) return [normalizedInitialPost];
      const next = [...prev];
      next[0] = { ...next[0], ...normalizedInitialPost };
      return next;
    });
  }, [normalizedInitialPost]);

  // SINGLE SOURCE OF TRUTH: Index-based session management (Essential for recycling)
  const activePostId = reelsList[currentReelIndex]?.social_post_id ?? reelsList[currentReelIndex]?.id ?? post.social_post_id ?? post.id;

  // Sync interaction states when switching reels
  useEffect(() => {
    if (isMobileReels && reelsList[currentReelIndex]) {
      const active = reelsList[currentReelIndex];
      // Robust multi-key sync for likes - check all common API and UI field variations
      const isLiked = Boolean(active.liked_by_me ?? active.liked_by_user ?? active.liked ?? false);
      const likesCount = Number(active.likes_count ?? active.total_likes ?? active.likeCount ?? active.likesCount ?? 0);

      setPostLiked(isLiked);
      setPostLikeCount(likesCount);

      // HARD ISOLATION: Physical purge of conversation state to prevent residual "bleed"
      setComments([]);
      setCommentsError(null);
      setLoadingComments(false);

      // AUTO-RESET UI STATE ON SCROLL
      setIsCommenting(false);
      setShowCommentsSheet(false);
      setReplyingTo(null);
    }
  }, [activePostId, isMobileReels]);


  // Sync sheet visibility with comment drafting state
  useEffect(() => {
    if (!showCommentsSheet) {
      setIsCommenting(false);
      setReplyingTo(null);
    }
  }, [showCommentsSheet]);

  // SYNC LIVE RANKING: Flush previous reel's stats and reset hardware logic ONLY ON IDENTITY CHANGE
  useEffect(() => {
    if (!isMobileReels) return;
    const currentIdStr = `${activePostId}_${currentReelIndex}`;

    // identity changed
    prevPostIdRef.current = currentIdStr;

    // 4. Notify Parent of active post change for URL updates
    const currentPost = reelsList[currentReelIndex];
    if (currentPost && onActivePostChange) {
      onActivePostChange(currentPost);
    }

    // 1. HARD LOCK RESET for new reel
    userManualPauseRef.current = false;
    setIsPaused(false);

    // 2. SYNC WITH MANAGER: Prepare next reel buffer
    // Playback itself is now handled by the VideoPlayer component's isActive effect 
    // which includes the necessary Safari stabilization delays.
    import("@/src/lib/videoPlaybackManager").then(({ videoPlaybackManager }) => {
      const nextItem = reelsList[currentReelIndex + 1];
      if (nextItem) {
        videoPlaybackManager.prepare(`${nextItem.id}_${currentReelIndex + 1}`);
      }
    });

    // 3. FLUSH PREVIOUS REEL RANKING METRICS
    if (prevPostIdRef.current && prevPostIdRef.current !== currentIdStr) {
      const prevIdCanonical = String(prevPostIdRef.current).split('_')[0];
      const metrics = interactionTrackerRef.current[prevIdCanonical];
      if (metrics && metrics.start_time > 0) {
        const totalWatch = metrics.watch_time + (Date.now() - metrics.start_time);
        import("@/src/lib/api/social").then(({ logSocialActivity }) => {
          logSocialActivity({
            social_post_id: Number(prevIdCanonical),
            action_type: "view",
            watch_time: totalWatch,
            watch_progress: metrics.max_progress,
            completed: metrics.completed,
            replays: metrics.replays || 0,
            skipped: totalWatch < 2000 && metrics.max_progress < 15
          }, getToken()).catch(() => { });
        });
      }
    }

  }, [activePostId, isMobileReels, reelsList, currentReelIndex]);

  const [activeHeartPops, setActiveHeartPops] = useState<{ id: string, x: number, y: number, rotate: number, offsetX: number, offsetY: number }[]>([]);


  const [selectedProductData, setSelectedProductData] = useState<PreviewPayload | null>(null);
  const [productPreviewOpen, setProductPreviewOpen] = useState(false);
  const [fetchingProductId, setFetchingProductId] = useState<number | null>(null);
  const [hydratedLinkedProducts, setHydratedLinkedProducts] = useState<Record<string, any>>({});

  const getPolicyText = useCallback((lp: any) => {
    if (!lp) return "Verified Vendor";

    // 1. Check for nested policy_settings (common in hydrated products)
    const settings = lp.policy_settings || {};
    const returnPol = settings.return_policy || {};

    // 2. Promotions / Discounts
    const promoData = settings.promotions_data || lp.promotions_data || lp.promo_title;
    if (promoData) {
      if (typeof promoData === 'string' && promoData.length > 0) {
        try {
          const pd = JSON.parse(promoData);
          if (Array.isArray(pd) && pd.length > 0) return pd[0].title || "Special Offer";
        } catch {
          return promoData; // Return the raw text if it's just a title
        }
      }
    }

    const saleData = settings.sale_discount_data || lp.sale_discount_data;
    if (saleData) {
      const sd = typeof saleData === 'string' ? JSON.parse(saleData) : saleData;
      if (sd?.discount || sd?.discount_percent) {
        const name = sd.title || sd.name || sd.sale_name || sd.discount_type || sd.type || sd.discount_name || "Discount";
        return `${sd.discount || sd.discount_percent}% ${name}`;
      }
    }

    // 3. Shipping Subsidy
    if (settings.return_shipping_subsidy || returnPol.returnShippingSubsidy || lp.return_shipping_subsidy === 1) return "Return Shipping Subsidy";

    // 4. Return Policy
    if (settings.seven_day_no_reason_return || returnPol.sevenDayNoReasonReturn || lp.seven_day_no_reason_return === 1) return "7-Days No-Reason Return";

    return null;
  }, []);

  const getDiscountInfo = useCallback((lp: any) => {
    if (!lp) return null;
    try {
      const settings = lp.policy_settings || {};

      // 1. Check Promotions
      const ps = typeof (settings.promotions_data || lp.promotions_data) === 'string'
        ? JSON.parse(settings.promotions_data || lp.promotions_data)
        : (settings.promotions_data || lp.promotions_data);
      if (Array.isArray(ps) && ps.length > 0) {
        const promo = ps[0];
        const discount = promo.discount || promo.discount_percent || promo.discount_percentage;
        const name = promo.title || promo.name || promo.occasion || promo.promo_name || promo.type || "Promotion";
        if (discount) return { discount: Number(discount), name };
      }

      // 2. Check Sales Discount
      const sd = typeof (settings.sale_discount_data || lp.sale_discount_data) === 'string'
        ? JSON.parse(settings.sale_discount_data || lp.sale_discount_data)
        : (settings.sale_discount_data || lp.sale_discount_data);
      if (sd?.discount || sd?.discount_percent || sd?.discount_percentage) {
        const discount = sd.discount || sd.discount_percent || sd.discount_percentage;
        const name = sd.title || sd.name || sd.sale_name || sd.discount_type || sd.type || sd.discount_name || "Sales";
        return { discount: Number(discount), name };
      }

      // 3. Check raw feed fields as final fallback
      if (lp.promo_discount || lp.sale_discount || lp.discount_percentage) {
        return {
          discount: Number(lp.promo_discount || lp.sale_discount || lp.discount_percentage),
          name: lp.promo_title || lp.sale_type || lp.discount_name || lp.discount_type || "Discount"
        };
      }
    } catch (e) { }
    return null;
  }, []);

  const getDiscountedPrice = useCallback((lp: any) => {
    const basePrice = Number(lp.price || 0);
    const info = getDiscountInfo(lp);
    if (info && info.discount > 0 && info.discount < 100) {
      return basePrice * (1 - info.discount / 100);
    }
    return basePrice;
  }, [getDiscountInfo]);

  const formatProductUrl = useCallback((url: string) => {
    if (!url) return "https://via.placeholder.com/800x600?text=No+Image";
    let final = url;
    if (!url.startsWith('http')) {
      final = url.startsWith('/public') ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    }
    return encodeURI(final);
  }, []);

  const handleProductClick = useCallback(async (productId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (fetchingProductId) return;

    try {
      setFetchingProductId(productId);
      const res = await fetchProductById(productId, auth?.token || undefined);
      if (res?.data?.product) {
        // AUTO-PAUSE: Video must pause when entering product context EXCEPT for mobile reels (bottom sheet mode)
        if (!isMobileReels) {
          if (activeVideoRef.current) activeVideoRef.current.pause();
          setIsPaused(true);
        }

        const dbProduct = res.data.product;
        const mappedPayload = mapProductToPreviewPayload(dbProduct, formatProductUrl);
        setSelectedProductData(mappedPayload);
        setProductPreviewOpen(true);
      }
    } catch (err) {
      console.error("fetchProductById error", err);
      toast.error("Failed to load product details");
    } finally {
      setFetchingProductId(null);
    }
  }, [auth?.token, fetchingProductId, formatProductUrl, isMobileReels]);

  // 1A. Interaction state (Seed with all possible backend field names from the normalized post)
  const [postLiked, setPostLiked] = useState<boolean>(Boolean(normalizedInitialPost.liked_by_me));
  const [postLikeCount, setPostLikeCount] = useState<number>(Number(normalizedInitialPost.likes_count));
  const likingLock = useRef(false);

  // Dynamic Recommender Engine: Real-time Heartbeat & Precise interaction tracking

  useEffect(() => {
    if (!isMobileReels) return;

    const activeData = reelsList.find(r => String(r.id) === String(activePostId));
    if (!activeData) return;

    const trackedPostId = Number(activeData.id);
    let sessionWatchTime = 0;

    // Start Real-time Heartbeat (every 3 seconds)
    heartbeatRef.current = setInterval(() => {
      sessionWatchTime += 3;
      import("@/src/lib/api/social").then(({ logSocialActivity }) => {
        const data = interactionTrackerRef.current[String(trackedPostId)];
        logSocialActivity({
          social_post_id: trackedPostId,
          action_type: "view",
          watch_time: 3,
          watch_progress: data?.max_progress || 0,
          completed: !!data?.completed,
          skipped: false,
          scroll_velocity_flag: fastScrollVelocityRef.current
        }, userToken || undefined).catch(() => { });
      });
    }, 3000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);

      // Final Flush on exit/swipe
      const data = interactionTrackerRef.current[String(trackedPostId)];
      if (data) {
        import("@/src/lib/api/social").then(({ logSocialActivity }) => {
          logSocialActivity({
            social_post_id: trackedPostId,
            action_type: "view",
            watch_time: 1,
            watch_progress: data.max_progress,
            completed: data.completed,
            skipped: data.max_progress < 10,
            scroll_velocity_flag: fastScrollVelocityRef.current
          }, userToken || undefined).catch(() => { });
        });
      }
    };
  }, [post.id, userToken, currentReelIndex, isMobileReels, reelsList.length]);

  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followLoading, setFollowLoading] = useState<boolean>(false);
  const [showBurst, setShowBurst] = useState(false);

  // Social Share Integration
  const { share: generateShareLink, shareUrl, isSharing: isGeneratingShareLink, reset: resetSocialShare } = useSocialShare(userToken);
  const [isPostShareModalOpen, setIsPostShareModalOpen] = useState(false);

  const handleShareClick = useCallback(async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsPostShareModalOpen(true);
    const activeItem = isMobileReels ? reelsList[currentReelIndex] : post;
    const postId = activeItem?.id || activePostId;
    if (postId) {
      generateShareLink(postId);
    }
  }, [generateShareLink, activePostId, isMobileReels, reelsList, currentReelIndex, post]);

  // Sync with prop changes ONLY on mount or when the active reel changes
  useEffect(() => {
    const activeItem = isMobileReels ? reelsList[currentReelIndex] : post;
    if (!activeItem) return;

    setPostLiked(Boolean(activeItem.liked_by_user ?? activeItem.liked_by_me ?? activeItem.liked ?? false));
    setPostLikeCount(Number(activeItem.likes_count ?? activeItem.total_likes ?? activeItem.likeCount ?? activeItem.likesCount ?? 0));
  }, [post.id, currentReelIndex, reelsList.length, isMobileReels]); // re-init when switching reels or ID

  const { isMuted: globalMute, volume: globalVolume } = useAudio();

  // Handle real-time updates for this specific post
  useEffect(() => {
    const socket = io(API_BASE_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on("post:like", (data) => {
      const socketPostId = String(data.postId);
      const isActivePost = socketPostId === String(activePostId);

      const newCount = Number(data.likes_count ?? data.likesCount ?? data.likeCount ?? 0);
      const currentUserId = auth?.user?.user_id || auth?.user?.id;
      const wasLikedBySocketUser = data.liked_by && String(data.liked_by) === String(currentUserId);
      const wasUnlikedBySocketUser = data.unliked_by && String(data.unliked_by) === String(currentUserId);

      // 1. Update global active display if it touches the currently viewed reel
      if (isActivePost) {
        setPostLikeCount(newCount);
        if (wasLikedBySocketUser) setPostLiked(true);
        else if (wasUnlikedBySocketUser) setPostLiked(false);
      }

      // 2. IMPORTANT: Update the master Reels List record so swipe-back state is preserved
      if (isMobileReels) {
        setReelsList(prev => prev.map(item => {
          const itemId = String(item.social_post_id ?? item.id);
          if (itemId === socketPostId) {
            return {
              ...item,
              likes_count: newCount,
              liked_by_user: wasLikedBySocketUser ? true : (wasUnlikedBySocketUser ? false : item.liked_by_user)
            };
          }
          return item;
        }));
      }
    });

    // Support both 'post_updated' and 'post_update' (as seen in backend logs)
    const onPostUpdate = (updatedPost: any) => {
      if (String(updatedPost.social_post_id ?? updatedPost.id) === String(post.id)) {
        // If the update includes fresh like counts, sync them
        const freshLikes = updatedPost.likes_count ?? updatedPost.likeCount ?? updatedPost.likesCount;
        if (freshLikes !== undefined) setPostLikeCount(Number(freshLikes));

        const freshLiked = updatedPost.liked_by_user ?? updatedPost.liked;
        if (freshLiked !== undefined) setPostLiked(Boolean(freshLiked));

        if (updatedPost.status === 'done' || updatedPost.status === 'completed') {
          toast.success("Reel is ready!");
          window.dispatchEvent(new CustomEvent('re-fetch-posts'));
        }
      }
    };

    socket.on("post_updated", onPostUpdate);
    socket.on("post_update", onPostUpdate);

    return () => {
      socket.disconnect();
    };
  }, [activePostId, auth?.user]);
  const [isCommenting, setIsCommenting] = useState(false);
  const [comments, setComments] = useState<APIComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const lastFetchedPostIdRef = useRef<string | number | null>(null);
  // Ref mirror — always fresh in closures (no stale-state race on mobile touch events)
  const commentTextRef = useRef("");
  const sheetTextareaRef = useRef<HTMLTextAreaElement>(null);
  const desktopTextareaRef = useRef<HTMLTextAreaElement>(null);
  const reelTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [commentSheetEntryType, setCommentSheetEntryType] = useState<"icon" | "caption" | null>(null);
  const [commentsOffset, setCommentsOffset] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const commentsScrollRef = useRef<HTMLDivElement>(null);
  const COMMENTS_LIMIT = 10;
  const [commentPosting, setCommentPosting] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<APIComment | null>(null);
  const [burstingCommentId, setBurstingCommentId] = useState<number | null>(null);
  const [expandedParents, setExpandedParents] = useState<number[]>([]);
  const [viewerProfileUserId, setViewerProfileUserId] = useState<string | number | undefined>(undefined);
  const [lockHeight, setLockHeight] = useState<string | number>("100%");
  const [videoPortHeight, setVideoPortHeight] = useState<string | number>("100%");
  const [commentSheetHeight, setCommentSheetHeight] = useState<string | number>("0%");

  useEffect(() => {
    if (typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      const h = window.innerHeight;
      setLockHeight(h);
      // Initialize heights based on current state
      if (showCommentsSheet) {
        setVideoPortHeight(h * 0.25);
        setCommentSheetHeight(h * 0.75);
      } else {
        setVideoPortHeight(h);
        setCommentSheetHeight(0);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const baseH = typeof lockHeight === "number" ? lockHeight : window.innerHeight;
      if (showCommentsSheet) {
        setVideoPortHeight(baseH * 0.25);
        setCommentSheetHeight(baseH * 0.75);
      } else {
        setVideoPortHeight(baseH);
        // We keep commentSheetHeight at its last value so AnimatePresence can animate it out
      }
    }
  }, [showCommentsSheet, lockHeight]);

  // KEYBOARD AWARENESS: Track visual viewport to keep input above keyboard on mobile
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleResize = () => {
      const vv = window.visualViewport;
      if (!vv || !modalRef.current) return;
      const h = window.innerHeight - vv.height;

      if (h > 50) { // Threshold to detect actual keyboard
        modalRef.current.style.setProperty('--kb-pad', `${h + 8}px`);
      } else {
        modalRef.current.style.setProperty('--kb-pad', 'env(safe-area-inset-bottom, 16px)');
      }
    };

    window.visualViewport.addEventListener("resize", handleResize);
    window.visualViewport.addEventListener("scroll", handleResize);
    handleResize(); // Initial check
    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("scroll", handleResize);
    };
  }, []);

  const [currentMediaIndex, setCurrentMediaIndex] = useState(() => {
    if (allMedia && allMedia.length > 0 && post.src) {
      const idx = allMedia.findIndex(m => m.url === post.src);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });
  const [swipeDirection, setSwipeDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);

  const backgroundAudioUrl = useMemo(() => {
    const activeItem = (isMobileReels && reelsList[currentReelIndex]) ? reelsList[currentReelIndex] : post;
    const url = activeItem.original_audio_url;
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return url.startsWith('/public') ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
  }, [open, currentReelIndex, reelsList, post, isMobileReels]);

  useEffect(() => {
    if (open && backgroundAudioUrl && backgroundAudioRef.current) {
      const audio = backgroundAudioRef.current;
      audio.volume = globalVolume;
      audio.muted = globalMute;

      if (!isPaused) {
        // Force reload to ensure the new source is picked up especially if it was null before
        audio.load();
        audio.play().catch(e => console.warn("[PostModal] Playback blocked or interrupted:", e));
      } else {
        audio.pause();
      }
    } else if (backgroundAudioRef.current) {
      backgroundAudioRef.current.pause();
    }
  }, [open, backgroundAudioUrl, globalVolume, globalMute, isPaused]);

  // Continuous Background Streaming Reservoir (Dual-Buffer Internal Pipeline)
  const bgReservoirRef = useRef<Post[]>([]);
  const isFetchingReservoirRef = useRef(false);
  const activeCursorRef = useRef<string | null>(null);

  // State trackers for decoupled background interval
  const currentIdxRef = useRef(0);
  const activeLenRef = useRef(1);
  useEffect(() => { currentIdxRef.current = currentReelIndex; }, [currentReelIndex]);
  useEffect(() => { activeLenRef.current = reelsList.length; }, [reelsList.length]);

  // Reset reservoir if scope changes (e.g. from Discover to Profile)
  useEffect(() => {
    bgReservoirRef.current = [];
    activeCursorRef.current = null;
  }, [targetUserId, isMobileReels]);

  // 1. Uninterrupted Background Buffer Loop & Seamless Pointer Swap Hub
  // Heartbeat runs implicitly without depending on React Render cycles!
  useEffect(() => {
    if (!isMobileReels) return;

    const maintainReservoir = async () => {
      if (!isMobileReels) return;

      const activeIdx = currentIdxRef.current;
      const activeLen = activeLenRef.current;

      // 1. Proactive Reservoir Refill (Dual-Buffer Fetch)
      const remainingTotal = bgReservoirRef.current.length + (activeLen - 1 - activeIdx);
      if (remainingTotal < 15 && !isFetchingReservoirRef.current) {
        isFetchingReservoirRef.current = true;
        try {
          // Collect IDs already in memory to avoid server-side duplication
          const bufferIds = [
            ...reelsList.map(r => r.id),
            ...bgReservoirRef.current.map(r => r.id)
          ];

          const { fetchSmartReels } = await import("@/src/lib/api/social");
          const response = await fetchSmartReels({
            limit: 30,
            cursor: activeCursorRef.current,
            buffer_ids: bufferIds,
            targetUserId,
            is_product_linked: isProductLinkedOnly
          });

          if (response?.posts?.length > 0) {
            const videoOnlyPosts = response.posts.filter((p: any) => p.isVideo);
            bgReservoirRef.current = [...bgReservoirRef.current, ...videoOnlyPosts];
            activeCursorRef.current = response.nextCursor;
          }
        } catch (e) {
          console.error("Reservoir sync error", e);
        } finally {
          isFetchingReservoirRef.current = false;
        }
      }

      // 2. Active List Hydration (Flush from Reservoir to UI)
      const remainingUIBuffer = activeLen - 1 - activeIdx;
      if (remainingUIBuffer <= 8 && bgReservoirRef.current.length > 0) {
        const dumpSize = Math.min(15, bgReservoirRef.current.length);
        const nextSet = bgReservoirRef.current.splice(0, dumpSize);

        setReelsList(prev => [...prev, ...nextSet]);
      }
    };

    const interval = setInterval(maintainReservoir, 1000);
    maintainReservoir();

    const handleManualTrigger = () => {
      console.log("[Reels] Manual prefetch trigger received (Near-end)");
      maintainReservoir();
    };
    window.addEventListener("trigger-reel-prefetch", handleManualTrigger);

    return () => {
      clearInterval(interval);
      window.removeEventListener("trigger-reel-prefetch", handleManualTrigger);
    };
  }, [isMobileReels, targetUserId]);

  const [showLongTapMenu, setShowLongTapMenu] = useState(false);
  const [longTappedPost, setLongTappedPost] = useState<Post | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number, y: number } | null>(null);

  const handleCopyLink = useCallback((p: Post) => {
    const url = `${window.location.origin}/social/post/${p.id}`;
    copyToClipboard(url).then((success) => {
      if (success) toast.success("Link copied to clipboard!");
      else toast.error("Failed to copy link");
    });
  }, []);

  const handleDownload = useCallback(async (src?: string) => {
    if (!src) return;
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'stoqle_video.mp4');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      toast.success("Download started!");
    } catch (error) {
      window.open(src, '_blank');
      toast.info("Opened video link in new tab");
    }
  }, []);

  const reportUser = useCallback(() => {
    toast.info("Report submitted. Thank you for making Stoqle safe.");
  }, []);

  // 3. Telemetry Tracking Layer (Session interaction aggregation)
  const activePostIdRef = useRef<string | null>(null);

  // Monitor reel transitions to emit scroll-away exit telemetry for the previous explicitly active chunk
  useEffect(() => {
    if (!isMobileReels) return;

    const currentPost = reelsList[currentReelIndex];
    if (!currentPost) return;

    const postIdStr = String(currentPost.id);
    const prevId = activePostIdRef.current;

    // Send backend telemetry on scroll exit
    if (prevId && prevId !== postIdStr) {
      const data = interactionTrackerRef.current[prevId];
      if (data && data.start_time > 0) {
        const timeSpent = Date.now() - data.start_time;
        data.watch_time += timeSpent;
        data.start_time = 0; // stop timer

        // Determine strict skip heuristic
        if (data.watch_time < 2000 && data.max_progress < 15) {
          data.skipped = true;
        }

        import("@/src/lib/api/social").then(({ logSocialActivity }) => {
          logSocialActivity({
            social_post_id: Number(prevId),
            action_type: 'view',
            watch_time: data.watch_time,
            watch_progress: data.max_progress,
            completed: data.completed,
            skipped: data.skipped,
            scroll_velocity_flag: fastScrollVelocityRef.current
          }, getToken()).catch(() => { });
        });
      }
    }

    // Initialize or resume time accumulation block
    if (!interactionTrackerRef.current[postIdStr]) {
      interactionTrackerRef.current[postIdStr] = { watch_time: 0, max_progress: 0, completed: false, skipped: false, start_time: Date.now(), replays: 0 };
    } else {
      interactionTrackerRef.current[postIdStr].start_time = Date.now();
    }

    activePostIdRef.current = postIdStr;
  }, [currentReelIndex, reelsList, isMobileReels]);

  // Hook cleanup execution when modal completely unmounts
  useEffect(() => {
    return () => {
      const finalId = activePostIdRef.current;
      if (finalId) {
        const data = interactionTrackerRef.current[finalId];
        if (data && data.start_time > 0) {
          data.watch_time += (Date.now() - data.start_time);
          import("@/src/lib/api/social").then(({ logSocialActivity }) => {
            logSocialActivity({
              social_post_id: Number(finalId),
              action_type: 'view',
              watch_time: data.watch_time,
              watch_progress: data.max_progress,
              completed: data.completed,
              skipped: data.watch_time < 2000 && data.max_progress < 15,
              scroll_velocity_flag: fastScrollVelocityRef.current
            }, getToken()).catch(() => { });
          });
        }
      }
    };
  }, []);

  const mediaList = allMedia && allMedia.length > 0 ? allMedia.map(m => m.url) : (post.src ? [post.src] : []);

  const currentItem = (isMobileReels && reelsList[currentReelIndex]) ? reelsList[currentReelIndex] : post;
  const currentUserId = auth?.user?.user_id || auth?.user?.id;
  const postAuthorId = currentItem.user?.id;
  const isPostOwner = Boolean(currentUserId && postAuthorId && String(currentUserId) === String(postAuthorId));

  const getToken = () => userToken ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  useEffect(() => {
    if (allMedia && allMedia.length > 0 && post.src) {
      const idx = allMedia.findIndex(m => m.url === post.src);
      setCurrentMediaIndex(idx >= 0 ? idx : 0);
    } else {
      setCurrentMediaIndex(0);
    }
  }, [post.id, post.src, allMedia]);

  // Aspect ratio lock for non-video posts (Images)
  useEffect(() => {
    if (mediaList && mediaList.length > 0 && !post.isVideo) {
      const img = new window.Image();
      img.src = mediaList[0];
      img.onload = () => {
        if (img.width > 0 && img.height > 0) {
          setFirstImageAspectRatio(img.width / img.height);
        }
      };
    } else {
      setFirstImageAspectRatio(null);
    }
  }, [mediaList, post.isVideo]);

  // NEW: Update URL dynamically when scrolling through mobile reels
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const activeItem = reelsList.find(r => String(r.id) === String(activePostId));
    if (!isClosing && isMobileReels && activeItem) {
      timeout = setTimeout(async () => {
        const p = activeItem;

        // Smart history update: Only trigger API & replaceState if postId truly changed
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.get("post") === String(p.id)) return;

        try {
          const checkUrl = new URL(window.location.href);
          if (!checkUrl.searchParams.has("post")) return;

          const { fetchSecurePostUrl } = require("@/src/lib/api/social");
          const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
          const urlData = await fetchSecurePostUrl(p.id, "mobile_reels", token);

          if (urlData) {
            const currentUrl = new URL(window.location.href);
            if (!currentUrl.searchParams.has("post")) return; // re-check after async
            currentUrl.searchParams.set("post", String(p.id));
            if (urlData.xsec_token) currentUrl.searchParams.set("xsec_token", urlData.xsec_token);
            if (urlData.xsec_source) currentUrl.searchParams.set("xsec_source", urlData.xsec_source);
            window.history.replaceState({ postId: p.id, modal: true }, "", currentUrl.toString());
          } else {
            const currentUrl = new URL(window.location.href);
            if (!currentUrl.searchParams.has("post")) return; // re-check after async
            currentUrl.searchParams.set("post", String(p.id));
            window.history.replaceState({ postId: p.id, modal: true }, "", currentUrl.toString());
          }
        } catch (err) { }
      }, 500);
    }
    return () => clearTimeout(timeout);
  }, [activePostId, isMobileReels]);

  useEffect(() => {
    if (isClosing) return;

    const wasAlreadyLocked = document.body.classList.contains("overflow-hidden") ||
      window.getComputedStyle(document.body).overflow === "hidden";

    if (!wasAlreadyLocked) {
      document.body.classList.add("overflow-hidden");
    }

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);

    return () => {
      if (!wasAlreadyLocked) {
        document.body.classList.remove("overflow-hidden");
      }
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, isClosing]);

  // Aspect ratio lock for non-video posts (Images)
  useEffect(() => {
    if (mediaList && mediaList.length > 0 && !post.isVideo) {
      const img = new window.Image();
      img.src = mediaList[0];
      img.onload = () => {
        if (img.width > 0 && img.height > 0) {
          setFirstImageAspectRatio(img.width / img.height);
        }
      };
    } else {
      setFirstImageAspectRatio(null);
    }
  }, [mediaList, post.isVideo]);

  // Auto-swipe effect for images
  useEffect(() => {
    if (isPreview || post.isVideo || mediaList.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setSwipeDirection(1);
      setCurrentMediaIndex((prev) => (prev < mediaList.length - 1 ? prev + 1 : 0));
    }, 3500);

    return () => clearInterval(interval);
  }, [isPreview, post.isVideo, mediaList.length, isPaused]);

  // ON-DEMAND COMMENT ENGINE: Only fetch when user explicitly engages the sheet
  // ON-DEMAND COMMENT ENGINE with Pagination
  const fetchComments = useCallback(async (targetId?: string | number, isLoadMore = false) => {
    if (isPreview) return;
    const activeId = targetId || (isMobileReels ? reelsList[currentReelIndex]?.id : post.id);
    if (!activeId) return;

    if (isLoadMore) {
      if (!hasMoreComments || isFetchingMore) return;
      setIsFetchingMore(true);
    } else {
      setLoadingComments(true);
      setComments([]); // Clear previous for instant feel
      setCommentsOffset(0);
      setHasMoreComments(true);
    }

    setCommentsError(null);
    const token = getToken();

    try {
      const offset = isLoadMore ? commentsOffset + COMMENTS_LIMIT : 0;
      const json = await safeFetch<any>(`/api/social/${activeId}/comments?limit=${COMMENTS_LIMIT}&offset=${offset}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const fetched: APIComment[] = json?.data?.comments || [];

      if (fetched.length < COMMENTS_LIMIT) {
        setHasMoreComments(false);
      }

      const currentAuthorTrusted = Boolean(currentItem.user?.is_trusted);
      const mapped = fetched.map(c => ({
        ...c,
        liked_by_user: Boolean((c as any).liked_by_user || false),
        author_liked: Boolean((c as any).author_liked || false),
        likes_count: Number(c.likes_count ?? 0),
        author_is_trusted: Boolean((c as any).author_is_trusted || (c.is_author === 1 && currentAuthorTrusted)),
      }));

      if (isLoadMore) {
        setComments(prev => [...prev, ...mapped]);
        setCommentsOffset(offset);
      } else {
        setComments(mapped);
      }
    } catch (err: any) {
      console.error("fetchComments error", err);
      if (!isLoadMore) setCommentsError(err.message || "Unable to load comments");
    } finally {
      setLoadingComments(false);
      setIsFetchingMore(false);
    }
  }, [isPreview, isMobileReels, post.id, reelsList, currentReelIndex, currentItem.user?.is_trusted, commentsOffset, hasMoreComments, isFetchingMore]);


  const handleCommentsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      if (hasMoreComments && !isFetchingMore && !loadingComments) {
        fetchComments(activePostId, true);
      }
    }
  };


  useEffect(() => {
    if (isPreview) return;
    const controller = new AbortController();
    const token = getToken();
    const userId = Number(currentItem.user?.id ?? 0);
    if (!userId || isPostOwner) {
      setIsFollowing(false);
      return;
    }
    async function fetchFollowStatus() {
      if (!token) { setIsFollowing(false); return; }
      try {
        const json = await safeFetch<any>(`/api/follow/${userId}/status`, {
          method: "GET",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const isFollowingFromServer = Boolean(json?.data?.isFollowing ?? json?.data?.is_following ?? false);
        setIsFollowing(isFollowingFromServer);
      } catch (err) {
        console.warn("fetchFollowStatus error", err);
      }
    }
    fetchFollowStatus();
    return () => controller.abort();
  }, [currentItem.user?.id, userToken, isPostOwner]);

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
      const large = window.innerWidth >= 768;
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
          ? {
            ...c,
            liked_by_user: !c.liked_by_user,
            likes_count: c.liked_by_user ? Math.max(0, c.likes_count - 1) : c.likes_count + 1,
            author_liked: isPostOwner ? !c.liked_by_user : c.author_liked
          }
          : c
      )
    );

    try {
      const token = localGetToken();
      const json = await safeFetch<any>(`/api/social/comments/${commentId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!json.ok) {
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

  const handleAddComment = async (manualText?: string) => {
    if (isPreview) {
      toast.info("Interactions are not allowed in preview mode");
      return;
    }

    // Fast-path: skip expensive network round-trips when user is already logged in & verified
    const cachedUser = auth?.user;
    if (!cachedUser) {
      const ok = await auth.ensureAccountVerified();
      if (!ok) return;
    } else if (!cachedUser.phone_no || !cachedUser.email) {
      const ok = await auth.ensureAccountVerified();
      if (!ok) return;
    }

    // Read from ref first (always fresh) then fall back to manualText/state
    const finalCommentText = (manualText ?? commentTextRef.current ?? commentText)?.trim();
    if (!finalCommentText) return;

    // Phase 1: Optimistic Update (Instant UI reflection)
    const tokenUser = auth?.user;
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: APIComment = {
      comment_id: tempId as any,
      post_id: Number(currentItem.id),
      user_id: Number(auth?.user?.user_id ?? auth?.user?.id ?? 0),
      comment_content: finalCommentText,
      comment_at: new Date().toISOString(),
      is_author: Number(auth?.user?.user_id ?? auth?.user?.id) === Number(currentItem.user_id) ? 1 : 0,
      is_first_comment: comments.length === 0 ? 1 : 0,
      author_name: tokenUser?.full_name ?? tokenUser?.name ?? "You",
      author_pic: tokenUser?.profile_pic ?? tokenUser?.avatar,
      author_is_trusted: Number(auth?.user?.user_id) === Number(currentItem.user_id) ? Boolean(currentItem.user.is_trusted) : false,
      location: getCachedLocationName(),
      likes_count: 0,
      liked_by_user: false,
      parent_id: replyingTo?.parent_id ? replyingTo.parent_id : replyingTo?.comment_id ?? null,
    };

    // Instant injection into thread
    setComments((p) => [optimisticComment, ...p]);

    // Instant stat sync
    if (isMobileReels) {
      setReelsList(prev => prev.map((item, idx) =>
        idx === currentReelIndex ? { ...item, comment_count: (item.comment_count ?? 0) + 1 } : item
      ));
    }

    // Reset input immediately
    setCommentText("");
    commentTextRef.current = "";
    if (sheetTextareaRef.current) sheetTextareaRef.current.style.height = 'auto';
    if (desktopTextareaRef.current) desktopTextareaRef.current.style.height = 'auto';
    if (reelTextareaRef.current) reelTextareaRef.current.style.height = 'auto';
    setIsCommenting(false);
    setReplyingTo(null);

    setCommentPosting(true);
    try {
      const token = getToken();

      // Professional IP capture
      let userIp = null;
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipRes.json();
        userIp = ipData.ip;
      } catch (err) { }

      const freshLocation = await getCurrentLocationName();
      const location = freshLocation || getCachedLocationName();

      const res = await fetch(`${API_BASE_URL}/api/social/${currentItem.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          content: finalCommentText,
          location: location,
          user_ip: userIp,
          parent_comment_id: optimisticComment.parent_id
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to post comment");

      const created: APIComment | undefined = json?.data?.comment;

      // Phase 2: Reconciliation (Replace temp with real data)
      if (created) {
        setComments(prev => prev.map(c =>
          c.comment_id === (tempId as any)
            ? { ...created, liked_by_user: Boolean(created.liked_by_user) }
            : c
        ));
      }
    } catch (err) {
      console.error("add comment failed", err);
      toast.error("Failed to post comment. Please try again.");

      // Phase 3: Rollback (Safety net for failures)
      setComments(prev => prev.filter(c => c.comment_id !== (tempId as any)));
      if (isMobileReels) {
        setReelsList(prev => prev.map((item, idx) =>
          idx === currentReelIndex ? { ...item, comment_count: Math.max(0, (item.comment_count ?? 0) - 1) } : item
        ));
      }
    } finally {
      setCommentPosting(false);
    }
  };

  const handleToggleLike = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isPreview) {
      toast.info("Interactions are not allowed in preview mode");
      return;
    }

    if (likingLock.current) {
      console.warn("[ReelLike] Interaction throttled: Wait for server");
      return;
    }

    const ok = await auth.ensureAccountVerified();
    if (!ok) return;

    const activeItem = isMobileReels ? reelsList[currentReelIndex] : post;
    const activeId = activeItem.social_post_id ?? activeItem.id;
    const currentTargetId = activeId;
    const token = getToken();
    const oldLiked = postLiked;
    const oldLikeCount = postLikeCount;

    console.log(`[ReelLike] Processing tap: targeting ${currentTargetId}, currently liked=${oldLiked}`);

    if (!oldLiked) {
      setShowBurst(true);
      setTimeout(() => setShowBurst(false), 800);
    }

    // 1. Local Optimistic Update
    likingLock.current = true;
    setPostLiked(!oldLiked);
    setPostLikeCount(prev => oldLiked ? Math.max(0, prev - 1) : prev + 1);

    if (isMobileReels) {
      setReelsList(prev => prev.map((item, idx) =>
        idx === currentReelIndex
          ? { ...item, liked_by_user: !oldLiked, likes_count: oldLiked ? Math.max(0, (item.likes_count ?? 0) - 1) : (item.likes_count ?? 0) + 1 }
          : item
      ));
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/social/${currentTargetId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      const json = await res.json().catch(() => ({}));
      console.log(`[ReelLike] Response for ${currentTargetId}:`, json);

      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || `Server responded with ${res.status}`);
      }

      const { liked, likes_count } = json.data;
      const finalCount = Number(likes_count);

      // 2. Definitive Sync
      if (currentTargetId === activePostId) {
        setPostLiked(liked);
        setPostLikeCount(finalCount);
      }

      if (isMobileReels) {
        setReelsList(prev => prev.map((item) => {
          const itemId = String(item.social_post_id ?? item.id);
          if (itemId === String(currentTargetId)) {
            return {
              ...item,
              liked_by_me: liked,
              liked_by_user: liked,
              liked: liked,
              likes_count: finalCount,
              likeCount: finalCount,
              likesCount: finalCount
            };
          }
          return item;
        }));
      }

      try { onToggleLike(String(currentTargetId)); } catch { }

    } catch (err: any) {
      console.error(`[ReelLike] CRITICAL FAIL:`, err.message);
      toast.error(`Sync Error: ${err.message || "Failed to contact server"}`);

      // 3. Robust Rollback
      if (currentTargetId === activePostId) {
        setPostLiked(oldLiked);
        setPostLikeCount(oldLikeCount);
      }
      if (isMobileReels) {
        setReelsList(prev => prev.map((item, idx) =>
          idx === currentReelIndex ? { ...item, liked_by_user: oldLiked, likes_count: oldLikeCount } : item
        ));
      }
    } finally {
      // Small cooldown to ensure UI feedback is seen
      setTimeout(() => { likingLock.current = false; }, 300);
    }
  };

  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const delay = now - lastTapRef.current;

    if (delay < 300 && delay > 0) {
      // 1. Double Tap Trigger: Like the post
      lastTapRef.current = 0; // kill pending single tap

      const clientX = "touches" in (e as any) && (e as any).touches.length > 0 ? (e as any).touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = "touches" in (e as any) && (e as any).touches.length > 0 ? (e as any).touches[0].clientY : (e as React.MouseEvent).clientY;

      // Spawn 3 Hearts with unique offsets and rotations
      const newHearts = [
        { id: `${now}-1`, x: clientX, y: clientY, rotate: -25, offsetX: -40, offsetY: -30 },
        { id: `${now}-2`, x: clientX, y: clientY, rotate: 0, offsetX: 0, offsetY: -60 },
        { id: `${now}-3`, x: clientX, y: clientY, rotate: 25, offsetX: 40, offsetY: -30 },
      ];

      setActiveHeartPops(prev => [...prev, ...newHearts]);

      if (!postLiked) {
        handleToggleLike(e as any);
      }

      // Cleanup heart pops after animation
      setTimeout(() => {
        const heartIds = newHearts.map(h => h.id);
        setActiveHeartPops(prev => prev.filter(p => !heartIds.includes(p.id)));
      }, 1000);
    } else {
      // 2. Single Tap Probability: Toggle Pause/Play
      lastTapRef.current = now;

      // Delay the pause toggle to ensure it's not a double-tap
      setTimeout(() => {
        // If lastTapRef was reset to 0 by a double-tap, don't toggle pause
        if (lastTapRef.current === now) {
          userManualPauseRef.current = !userManualPauseRef.current;
          setIsPaused(userManualPauseRef.current);

          // DIRECT DOM CONTROL: If pausing, kill it instantly
          if (userManualPauseRef.current && activeVideoRef.current) {
            activeVideoRef.current.pause();
          }
        }
      }, 300);
    }
  };

  const toggleFollowAuthor = async () => {
    if (isPreview) {
      toast.info("Interactions are not allowed in preview mode");
      return;
    }
    const ok = await auth.ensureAccountVerified();
    if (!ok) return;
    const userId = Number(currentItem.user?.id);
    if (!userId || isPostOwner) return;

    if (followLoading) return;
    setFollowLoading(true);

    const oldIsFollowing = isFollowing;
    setIsFollowing(!oldIsFollowing);

    const token = getToken();
    try {
      const url = `${API_BASE_URL}/api/follow/${userId}/${oldIsFollowing ? "unfollow" : "follow"}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        setIsFollowing(oldIsFollowing);
      }
    } catch (err) {
      setIsFollowing(oldIsFollowing);
      console.error(err);
    } finally {
      setFollowLoading(false);
    }
  };

  // Desktop/Standard View Conversation Hydration: Auto-load comments on large screen
  useEffect(() => {
    if (!isMobileReels && activePostId && lastFetchedPostIdRef.current !== activePostId) {
      lastFetchedPostIdRef.current = activePostId;
      // Sync like counts for standard views as well
      const active = (isMobileReels && reelsList[currentReelIndex]) ? reelsList[currentReelIndex] : post;
      setPostLiked(Boolean(active.liked_by_user ?? active.liked_by_me ?? active.liked ?? false));
      setPostLikeCount(Number(active.likes_count ?? active.total_likes ?? active.likeCount ?? active.likesCount ?? 0));

      fetchComments(activePostId);
    }
  }, [activePostId, isMobileReels, fetchComments]);

  useEffect(() => {
    if (isCommenting && isMobileReels) {
      const timer = setTimeout(() => {
        reelTextareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isCommenting, isMobileReels]);

  // Mobile Reels View Hydration: Load comments when sheet opens


  useEffect(() => {
    if (showCommentsSheet && activePostId) {
      // Auto-trigger input if no comments exist to encourage engagement
      const count = currentItem?.comment_count ?? currentItem?.total_comments ?? currentItem?.comments_count ?? 0;
      if (count === 0 && !isCommenting) {
        setIsCommenting(true);
      }

      // Only trigger initial fetch if the post ID has changed or if it's a fresh open
      if (lastFetchedPostIdRef.current !== activePostId) {
        lastFetchedPostIdRef.current = activePostId;
        fetchComments(activePostId);
      }
    } else if (!showCommentsSheet && isMobileReels) {
      // Clear tracking and comments when closed (Mobile Specific)
      lastFetchedPostIdRef.current = null;
      setComments([]);
      setCommentsOffset(0);
      setHasMoreComments(true);
    }
  }, [showCommentsSheet, activePostId, isMobileReels, fetchComments]);

  // Background Linked Product Hydration Strategy:
  // Decouple product detail fetching from the modal opening sequence.
  // This ensures the modal pops instantly without waiting for product metadata.
  useEffect(() => {
    if (!open || !activePostId || isPreview) return;

    const activeItem = (isMobileReels && reelsList[currentReelIndex]) ? reelsList[currentReelIndex] : post;
    const productId = activeItem?.linked_product?.product_id ?? (activeItem as any)?.product_id;

    if (!activeItem?.is_product_linked || !productId) return;

    // Cache guard: Don't re-fetch if already hydrated in this session
    if (hydratedLinkedProducts[String(activePostId)]) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetchProductById(productId, auth?.token || undefined);
        if (res?.data?.product) {
          setHydratedLinkedProducts(prev => ({
            ...prev,
            [String(activePostId)]: res.data.product
          }));
        }
      } catch (err) {
        console.warn("[Background Hydration] Linked product fetch failed", err);
      }
    }, 150); // 150ms delay: enough to let the opening animation complete

    return () => clearTimeout(timer);
  }, [activePostId, open, isMobileReels, auth?.token, isPreview]);

  const getStockCount = useCallback((lp: any) => {
    if (!lp) return 0;

    // 1. Variant detection and stock summation
    const inventory = Array.isArray(lp.inventory) ? lp.inventory : [];
    const hasVariants = lp.has_variants === 1 || lp.has_variants === true || inventory.length > 0;

    if (hasVariants && inventory.length > 0) {
      const total = inventory.reduce((acc: number, item: any) => acc + (Number(item.quantity ?? item.stock ?? item.initial_quantity ?? 0)), 0);
      return total;
    }

    // 2. Basic stock fallbacks
    return Number(lp.total_quantity ?? lp.quantity ?? lp.stock ?? lp.total_stock ?? 0);
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

  // apply computedWidth only on lg screens
  const modalInlineStyle: React.CSSProperties | undefined =
    typeof window !== "undefined" && window.innerWidth >= 1024 && computedWidth
      ? { width: `${computedWidth}px` }
      : undefined;

  const portalTargetRef = useRef<Element | null>(null);
  if (typeof document !== "undefined" && !portalTargetRef.current) {
    portalTargetRef.current = document.body;
  }

  if (!open || !portalTargetRef.current) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      ref={wrapperRef}
      className="fixed inset-0 flex items-center justify-center px-0 py-0"
      style={{ zIndex: zIndex || modalZIndex }}
      onMouseDown={onClose}
    >
      <AnimatePresence>
        {open && (
          <>
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
                transformOrigin: origin ? `${origin.x}px ${origin.y}px` : "center",
                height: !isLargeScreen ? lockHeight : undefined
              }}
              initial={isLargeScreen ? { opacity: 0, scale: 0.3 } : { y: "100%", opacity: 1 }}
              animate={isLargeScreen ? { opacity: 1, scale: 1 } : { y: 0, opacity: 1 }}
              exit={isLargeScreen ? { opacity: 0, scale: 0.3 } : { y: "100%", opacity: 1 }}
              transition={isLargeScreen
                ? { type: "spring", damping: 30, stiffness: 300 }
                : { type: "spring", damping: 25, stiffness: 450, mass: 0.5 }
              }
              className="relative z-10 w-full bg-white flex flex-col overflow-y-auto md:flex md:flex-row md:overflow-hidden md:w-[96vw] md:max-w-[1100px] md:h-[94vh] md:rounded-2xl shadow-2xl min-h-[500px] sm:min-h-[600px] md:min-h-0"
            // style={{
            //   height: isMobileReels ? "100dvh" : (isLargeScreen ? "94vh" : "auto"),
            //   maxHeight: "100dvh"
            // }}
            >
              {backgroundAudioUrl && (
                <audio
                  key={backgroundAudioUrl}
                  ref={backgroundAudioRef}
                  src={backgroundAudioUrl}
                  loop
                  autoPlay
                  playsInline
                  crossOrigin="anonymous"
                  preload="auto"
                  className="hidden"
                />
              )}
              {/* MOBILE HEADER - Only show if not in immersive Reels mode AND on small screens */}
              {!isMobileReels && (
                <header className="md:hidden sticky top-0 z-30 h-16 flex items-center justify-between px-6 p-5 bg-white/95 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <button onMouseDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Close" className="h-9 w-9 flex items-center justify-center" title="Close">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-700"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                    </button>
                    <div className="flex items-center gap-3 min-w-0">
                      <Link
                        href={currentItem.author_handle ? `/${currentItem.author_handle}` : `/user/profile/${currentItem.user.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-shrink-0 active:scale-95 transition-transform"
                      >
                        <img
                          src={currentItem.user?.avatar || ""}
                          alt={currentItem.user?.name || "Author"}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      </Link>
                      <div className="min-w-0">
                        <Link
                          href={currentItem.author_handle ? `/${currentItem.author_handle}` : `/user/profile/${currentItem.user.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-black font-semibold truncate hover:text-rose-500 transition-colors block flex items-center gap-1"
                        >
                          {currentItem.user?.name || "Author"}
                          {!!currentItem.verified_badge || !!currentItem.user.is_partner || !!currentItem.linked_product?.verified_badge || !!currentItem.linked_product?.trusted_partner ? (
                            <VerifiedBadge size="xs" label="Trusted Partner" className="shrink-0" />
                          ) : !!currentItem.user.is_trusted ? (
                            <CheckBadgeIcon className="w-4 h-4 text-blue-500 shrink-0" title="Verified Account" />
                          ) : null}
                        </Link>
                      </div>
                    </div>
                  </div>

                  {!isPostOwner && !isFollowing && (
                    <button onClick={(e) => { e.stopPropagation(); toggleFollowAuthor(); }} disabled={followLoading} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-shadow bg-rose-500 text-white">
                      Follow
                    </button>
                  )}
                </header>
              )}

              {isMobileReels ? (
                /* FULLSCREEN REELS VIEW (MOBILE) - CUSTOM GESTURE ENGINE */
                <div
                  className="flex-1 flex flex-col bg-black overflow-hidden relative select-none"
                  style={{ contain: "layout size paint", overflowAnchor: "none" }}
                >
                  {/* Video Port (Top 25% if comments open, Else 100%) */}
                  <motion.div
                    className="relative overflow-hidden touch-none bg-black flex items-center justify-center p-0"
                    animate={{
                      height: videoPortHeight,
                    }}
                    transition={{
                      type: "tween",
                      ease: "easeOut",
                      duration: 0.3
                    }}
                    onClick={() => {
                      if (showCommentsSheet) setShowCommentsSheet(false);
                    }}
                  >
                    <motion.div
                      className="absolute inset-0 flex flex-col"
                      animate={{ y: `-${currentReelIndex * 100}%` }}
                      transition={{ type: "tween", ease: "circOut", duration: 0.15 }}
                      onPanStart={() => {
                        if (showCommentsSheet) return;
                        fastScrollVelocityRef.current = true;
                        dismissSwipeGuide();
                      }}
                      onPanEnd={(e, info) => {
                        if (showCommentsSheet) return;
                        fastScrollVelocityRef.current = false;
                        // LOCK-STEP SCROLLING: blink-of-an-eye speed, only 1 reel at a time
                        const threshold = 50;
                        const velocity = info.velocity.y;
                        const offset = info.offset.y;

                        if (Math.abs(offset) > threshold || Math.abs(velocity) > 500) {
                          if (offset < 0 || velocity < -500) {
                            // SWIPE UP -> NEXT REEL
                            if (currentReelIndex < reelsList.length - 1) {
                              setCurrentReelIndex(prev => prev + 1);
                            }
                          } else {
                            // SWIPE DOWN -> PREV REEL
                            if (currentReelIndex > 0) {
                              setCurrentReelIndex(prev => prev - 1);
                            }
                          }
                        }
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDragLeave={() => { }}
                      onWheel={(e) => {
                        if (showCommentsSheet) return; // Prevent scroll while commenting
                        if (Math.abs(e.deltaY) > 50) {
                          const now = Date.now();
                          if (now - lastScrollTimeRef.current < 800) return;
                          lastScrollTimeRef.current = now;
                          if (e.deltaY > 0) {
                            if (currentReelIndex < reelsList.length - 1) {
                              setCurrentReelIndex(prev => prev + 1);
                            }
                          } else {
                            if (currentReelIndex > 0) {
                              setCurrentReelIndex(prev => prev - 1);
                            }
                          }
                        }
                      }}
                    >
                      {reelsList.map((rp, i) => {
                        // Limit Hardware Decoder Pressure: Max 3 players strictly (Current, +1 Next, -1 Prev)
                        const isVisible = i === currentReelIndex;
                        const isNear = Math.abs(i - currentReelIndex) <= 1; // Preload strictly adjacent

                        return (
                          <div
                            key={`${rp.id}_${i}`}
                            className="w-full h-full flex-shrink-0 flex flex-col items-center bg-black overflow-hidden relative"
                            style={{ contain: "layout size paint" }}
                          >
                            {!isNear ? (
                              // Empty placeholder to preserve layout/scroll height
                              <div className="w-full h-full bg-slate-900/10" />
                            ) : (
                              <>
                                {/* Visual Media Engine */}
                                <motion.div
                                  className={`relative bg-black overflow-hidden pointer-events-auto ${showCommentsSheet ? "cursor-pointer" : "w-full h-full flex-1"}`}
                                  animate={{
                                    height: showCommentsSheet ? "25vh" : "100%"
                                  }}
                                  transition={{
                                    type: "tween",
                                    ease: "easeOut",
                                    duration: 0.3
                                  }}
                                  onClick={(e) => {
                                    if (showCommentsSheet) {
                                      setShowCommentsSheet(false);
                                    } else {
                                      handleDoubleTap(e);
                                    }
                                  }}
                                >
                                  <AnimatePresence>
                                    {activeHeartPops.map((pop) => (
                                      <motion.div
                                        key={pop.id}
                                        initial={{ scale: 0, opacity: 0, rotate: pop.rotate }}
                                        animate={{
                                          scale: [0, 1.3, 1.1],
                                          opacity: [0, 1, 0],
                                          y: [0, -50],
                                          rotate: [pop.rotate, pop.rotate + (pop.rotate > 0 ? 15 : -15)]
                                        }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.8, ease: "easeOut" }}
                                        style={{
                                          position: "fixed",
                                          left: pop.x + pop.offsetX - 40,
                                          top: pop.y + pop.offsetY - 40,
                                          zIndex: 10000,
                                          pointerEvents: "none",
                                        }}
                                      >
                                        <FaHeart className="w-20 h-20 text-rose-500/90 drop-shadow-2xl" />
                                      </motion.div>
                                    ))}
                                  </AnimatePresence>
                                  <MobileVideoPlayer
                                    videoId={`${rp.id}_${i}`}
                                    isActive={String(rp.id) === String(activePostId)}
                                    onLongPress={(e: React.MouseEvent | React.TouchEvent) => {
                                      if ('clientX' in e) {
                                        setMenuPosition({ x: e.clientX, y: e.clientY });
                                      } else {
                                        setMenuPosition(null);
                                      }
                                      setLongTappedPost(rp);
                                      setShowLongTapMenu(true);
                                    }}
                                    src={rp.src}
                                    poster={rp.thumbnail}
                                    loop={true}
                                    onRegisterRef={(el) => handleVideoRegister(el, isVisible)}
                                    userManualPause={isPaused}
                                    hideControls={showCommentsSheet}
                                    hideOverlay={showCommentsSheet}
                                    onTimeUpdateHandler={(cur, dur) => handleTimeUpdate(rp.id, cur, dur)}
                                    onEndedHandler={() => handleVideoEnded(rp.id)}
                                    className="w-full h-full"
                                    autoFitPortrait={true}
                                    progressBarClassName="absolute bottom-0 left-0 right-0 z-10"
                                  />

                                  {/* COMMENT OVERLAY: Floating animated comments on video */}
                                  {!showCommentsSheet && isVisible && (
                                    <CommentOverlay
                                      postId={rp.social_post_id ?? rp.id}
                                      isPlaying={!isPaused && String(rp.id) === String(activePostId)}
                                      containerWidth={typeof window !== "undefined" ? window.innerWidth : 390}
                                    />
                                  )}

                                  {/* Reels Top Bar - Absolute on Video */}
                                  {!showCommentsSheet && (
                                    <div className="absolute top-0 left-0 right-0 p-2 flex items-center justify-between z-50 pointer-events-auto bg-gradient-to-b from-black/50 to-transparent">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform"
                                      >
                                        <ChevronLeft className="w-7 h-7 drop-shadow-md" />
                                      </button>
                                      <div className="flex items-center gap-4">
                                        <VolumeHUD />
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const url = new URL(window.location.href);
                                            url.searchParams.set("typing", "true");
                                            window.history.pushState({}, "", url.toString());
                                          }}
                                          className="w-9 h-9 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 text-white active:scale-95 transition-transform text-white/90"
                                        >
                                          <Search className="w-5 h-5 drop-shadow-md" />
                                        </button>
                                        <button
                                          onClick={handleShareClick}
                                          className="w-9 h-9 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 text-white active:scale-95 transition-transform text-white/90"
                                        >
                                          <Share2 className="w-5 h-5 drop-shadow-md" />
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Reels Overlays (Left side info) - Absolute at bottom of video area */}
                                  {!showCommentsSheet && (
                                    <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-4 pb-2 bg-gradient-to-t from-black/70 via-transparent to-transparent z-[60]">
                                      <div className="flex flex-col gap-2.5 pointer-events-auto">
                                        <div className="flex items-center gap-2.5">
                                          <Link href={rp.author_handle ? `/${rp.author_handle}` : `/user/profile/${rp.user.id}`} className="w-10 h-10 rounded-full border border-white/20 overflow-hidden bg-slate-800 shrink-0">
                                            <img src={rp.user.avatar} className="w-full h-full object-cover" alt="author" />
                                          </Link>
                                          <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-1 min-w-0">
                                              <span className="text-sm font-black text-white shadow-sm truncate">{rp.user.name}</span>
                                              {!!rp.verified_badge || !!rp.user.is_partner || !!rp.linked_product?.verified_badge || !!rp.linked_product?.trusted_partner ? (
                                                <VerifiedBadge size="xs" label="Trusted Partner" className="drop-shadow-sm" />
                                              ) : !!rp.user.is_trusted ? (
                                                <CheckBadgeIcon className="w-4 h-4 text-blue-500 shrink-0 drop-shadow-sm" title="Verified Account" />
                                              ) : null}
                                            </div>
                                          </div>
                                          {!isPostOwner && !isFollowing && (
                                            <button onClick={(e) => { e.stopPropagation(); toggleFollowAuthor(); }} disabled={followLoading} className="px-2.5 py-1 bg-rose-500 rounded-full text-[10px] font-black text-white ml-1 active:scale-90 transition-transform">Follow</button>
                                          )}
                                        </div>

                                        {(rp.caption || rp.note_caption) && (
                                          <p
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setCommentSheetEntryType("caption");
                                              setShowCommentsSheet(true);
                                            }}
                                            className="text-white text-sm font-medium line-clamp-2 drop-shadow-lg max-w-[90%] -mt-0.5 cursor-pointer active:opacity-70 transition-opacity"
                                          >
                                            {rp.caption || rp.note_caption}
                                          </p>
                                        )}

                                        {/* Linked Product Overlay */}
                                        {/* Linked Product Overlay */}
                                        {(() => {
                                          const lp = hydratedLinkedProducts[String(rp.id)] || rp.linked_product;
                                          if (!rp.is_product_linked || !lp) return null;
                                          return (
                                            <div
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (lp.product_id) {
                                                  handleProductClick(Number(lp.product_id), e);
                                                }
                                              }}
                                              className={`${!(rp.caption || rp.note_caption) ? "mt-1" : ""} p-1 px-1.5 bg-white/10  rounded-[0.5rem] flex items-center gap-2.5 active:scale-[0.98] transition-all cursor-pointer group/item w-full`}
                                            >
                                              <div className="relative w-10 h-10 rounded-[0.4rem] overflow-hidden shrink-0 bg-slate-800">
                                                {(() => {
                                                  const isHydrated = !!hydratedLinkedProducts[String(rp.id)];
                                                  const currentLp = hydratedLinkedProducts[String(rp.id)] || lp;
                                                  const stock = getStockCount(currentLp);
                                                  const shouldShowSoldOut = isHydrated && stock <= 0;
                                                  const imgSrc = currentLp.image_url || currentLp.first_image || currentLp.first_image_url || currentLp.thumbnail || currentLp.image || (Array.isArray(currentLp.media) ? currentLp.media[0]?.url : undefined);

                                                  if (!imgSrc || imgSrc === "") return null;

                                                  return (
                                                    <Image
                                                      src={formatUrl(imgSrc)}
                                                      fill
                                                      className={`object-cover transition-transform duration-500 group-hover/item:scale-110 ${shouldShowSoldOut ? 'opacity-40 grayscale' : ''}`}
                                                      alt={currentLp.title || "Product"}
                                                      sizes="40px"
                                                    />
                                                  );
                                                })()}
                                                {(() => {
                                                  const isHydrated = !!hydratedLinkedProducts[String(rp.id)];
                                                  const lp = hydratedLinkedProducts[String(rp.id)] || rp.linked_product;
                                                  const stock = getStockCount(lp);
                                                  if (isHydrated && stock <= 0) {
                                                    return (
                                                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
                                                        <span className="text-[6px] text-white px-1 py-0.5 bg-rose-500 rounded-sm  tracking-tighter">Sold Out</span>
                                                      </div>
                                                    );
                                                  }
                                                  return null;
                                                })()}
                                              </div>
                                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <h4 className="text-[11px] text-white truncate pr-2 leading-tight">
                                                  {lp.title}
                                                </h4>
                                                <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap overflow-hidden pr-3 w-full">
                                                  <span className="text-[12px] text-white shrink-0 font-bold">
                                                    ₦{getDiscountedPrice(lp).toLocaleString()}
                                                  </span>

                                                  {Number(lp.total_sold || 0) > 0 && (
                                                    <>
                                                      <span className="w-0.5 h-0.5 rounded-full bg-white/40 shrink-0" />
                                                      <span className="text-[9px] text-white/80 shrink-0">{lp.total_sold}+ Sold</span>
                                                    </>
                                                  )}
                                                  {getPolicyText(lp) && (
                                                    <>
                                                      <span className="w-0.5 h-0.5 rounded-full bg-white/40 shrink-0" />
                                                      <span className="text-[9px] text-slate-300 truncate max-w-[100px]">{getPolicyText(lp)}</span>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="shrink-0">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const isHydrated = !!hydratedLinkedProducts[String(rp.id)];
                                                    const lp = hydratedLinkedProducts[String(rp.id)] || rp.linked_product;
                                                    const stock = getStockCount(lp);

                                                    if (isHydrated && stock <= 0) return;
                                                    if (lp.product_id) {
                                                      handleProductClick(Number(lp.product_id), e);
                                                    }
                                                  }}
                                                  className={`px-2.5 py-1 ${(() => {
                                                    const isHydrated = !!hydratedLinkedProducts[String(rp.id)];
                                                    const lp = hydratedLinkedProducts[String(rp.id)] || rp.linked_product;
                                                    const stock = getStockCount(lp);
                                                    return isHydrated && stock <= 0;
                                                  })() ? 'bg-slate-600 cursor-not-allowed' : 'bg-rose-500 hover:bg-rose-500 active:scale-95'} text-white text-[9px]  rounded-full transition-all`}
                                                >
                                                  {(() => {
                                                    const isHydrated = !!hydratedLinkedProducts[String(rp.id)];
                                                    const lp = hydratedLinkedProducts[String(rp.id)] || rp.linked_product;
                                                    const stock = getStockCount(lp);
                                                    return isHydrated && stock <= 0 ? 'Sold out' : 'Buy now';
                                                  })()}
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  )}
                                </motion.div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </motion.div>

                    {/* SWIPE GUIDE OVERLAY (Mobile Specific) */}
                    <AnimatePresence>
                      {showSwipeGuide && (
                        <>
                          {/* Dimmed Background Overlay */}
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 z-[69] pointer-events-none"
                          />
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[70] flex items-center justify-center pointer-events-none"
                          >
                            <motion.div
                              animate={{ y: [40, -40, 40] }}
                              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                              className="flex flex-col items-center gap-4"
                            >
                              <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-2xl">
                                <motion.div
                                  animate={{ opacity: [0.3, 1, 0.3] }}
                                  transition={{ repeat: Infinity, duration: 2 }}
                                >
                                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                                    <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </motion.div>
                              </div>
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-white text-sm font-black drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] uppercase tracking-[0.2em]">Swipe Up</span>
                                <span className="text-white/70 text-[10px] font-bold drop-shadow-md uppercase tracking-wider">To watch more</span>
                              </div>
                            </motion.div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  <AnimatePresence>
                    {!showCommentsSheet && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="h-[58px] bg-black border-t border-white/10 flex flex-col px-4 shrink-0 z-50 pointer-events-auto transition-all"
                        style={{
                          paddingBottom: "env(safe-area-inset-bottom, 12px)"
                        }}
                      >
                        <div className="h-full flex items-center justify-between gap-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsCommenting(true);
                            }}
                            className="flex-1 h-9 bg-white/10 hover:bg-white/15 rounded-full px-4 flex items-center gap-2 transition-colors border border-white/5"
                          >
                            <MessageCircleMore className="w-3.5 h-3.5 text-white/40" />
                            <span className="text-[11px] text-white/50 font-medium">Say something...</span>
                          </button>

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 min-w-[32px]">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleToggleLike(e); }}
                                className="w-6 h-6 flex items-center justify-center text-white active:scale-110 transition-transform relative"
                              >
                                {showBurst && <LikeBurst />}
                                <div className="relative w-full h-full flex items-center justify-center">
                                  <AnimatePresence>
                                    <motion.div
                                      key={postLiked ? "liked" : "unliked"}
                                      initial={{ scale: 0.6, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0.6, opacity: 0 }}
                                      transition={{ type: "spring", stiffness: 400, damping: 12 }}
                                      className="absolute inset-0 flex items-center justify-center"
                                    >
                                      {postLiked ? (
                                        <FaHeart className="w-4.5 h-4.5 text-rose-500 fill-current drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                      ) : (
                                        <FaRegHeart className="w-4.5 h-4.5 text-white stroke-[2.5]" />
                                      )}
                                    </motion.div>
                                  </AnimatePresence>
                                </div>
                              </button>
                              <span className="text-[11px] font-black text-white/90 tracking-tighter tabular-nums drop-shadow-sm">
                                {postLikeCount > 0 ? (postLikeCount >= 1000 ? `${(postLikeCount / 1000).toFixed(1)}k` : postLikeCount) : "Like"}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 min-w-[32px]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCommentSheetEntryType("icon");
                                  setShowCommentsSheet(true);
                                }}
                                className="w-6 h-6 flex items-center justify-center text-white active:scale-90 transition-transform"
                                aria-label="Open comments"
                              >
                                <MessageCircleMore size={18} strokeWidth={2.5} className="text-white" />
                              </button>
                              <span className="text-[11px] font-black text-white/90 tracking-tighter tabular-nums drop-shadow-sm">
                                {(() => {
                                  // Robust multi-field extraction for flexible API compatibility
                                  const count = Number(currentItem?.comment_count ?? currentItem?.total_comments ?? currentItem?.comments_count ?? 0);
                                  return count > 0 ? (count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count) : "cmt";
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>

                      </motion.div>
                    )}
                  </AnimatePresence>

                  {isCommenting && !showCommentsSheet && typeof document !== "undefined" && createPortal(
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 flex flex-col justify-end pointer-events-none"
                      style={{ transform: 'translateZ(0)', zIndex: (zIndex || modalZIndex) + 50 }}
                    >
                      {/* Backdrop — only closes when tapping OUTSIDE the panel */}
                      <div
                        className="absolute inset-0 bg-transparent pointer-events-auto"
                        onTouchStart={(e) => {
                          // Only dismiss if touch started directly on backdrop (not panel)
                          if (e.target === e.currentTarget) {
                            setIsCommenting(false);
                            setCommentText("");
                          }
                        }}
                        onMouseDown={(e) => {
                          if (e.target === e.currentTarget) {
                            setIsCommenting(false);
                            setCommentText("");
                          }
                        }}
                      />
                      {/* Bottom Panel — blocks ALL touch/click from reaching backdrop */}
                      <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        className="relative bg-zinc-900 border-t border-white/10 px-4 py-4 pointer-events-auto w-full z-10"
                        style={{
                          paddingBottom: "var(--kb-pad, env(safe-area-inset-bottom, 24px))",
                          transform: 'translateZ(0)',
                          WebkitFontSmoothing: 'antialiased'
                        }}
                        onTouchStart={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col gap-4">
                          {/* Emoji Shortcuts */}
                          <div
                            className="flex items-center gap-2 overflow-x-auto pb-1 px-0.5"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                          >
                            {EMOJI_SHORTCUTS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newText = commentText + emoji;
                                  setCommentText(newText);
                                  commentTextRef.current = newText;
                                  reelTextareaRef.current?.focus();
                                }}
                                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 transition-all text-xl"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          {replyingTo && (
                            <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 rounded-lg text-[11px] mb-1">
                              <span className="text-white/50">Replying to <span className="font-bold text-white/90">{(replyingTo as any).author_name || (replyingTo as any).user_name}</span></span>
                              <button onClick={() => { setReplyingTo(null); }} className="text-white/30 hover:text-white"><XMarkIcon className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                          <textarea
                            autoFocus
                            ref={reelTextareaRef}
                            rows={1}
                            value={commentText}
                            onChange={(e) => {
                              // Sync both state AND ref so touch handlers always have fresh value
                              commentTextRef.current = e.target.value;
                              setCommentText(e.target.value);
                              const el = e.target;
                              el.style.height = 'auto';
                              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                // Read from ref — always current
                                const text = commentTextRef.current.trim();
                                if (text) handleAddComment(text);
                              }
                            }}
                            placeholder={replyingTo ? "Write a reply..." : "Say something..."}
                            className="w-full bg-white/5 rounded-xl px-5 py-2 text-[14px] text-white outline-none border border-white/10 resize-none overflow-hidden leading-snug"
                          />
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                commentTextRef.current = "";
                                setIsCommenting(false);
                                setCommentText("");
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                commentTextRef.current = "";
                                setIsCommenting(false);
                                setCommentText("");
                              }}
                              className="px-5 py-2.5 rounded-full text-[13px] font-bold text-white/60 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              disabled={commentPosting || !commentText.trim()}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (commentPosting) return;
                                // Read from DOM ref directly — most reliable source on mobile
                                const domText = reelTextareaRef.current?.value?.trim();
                                const refText = commentTextRef.current?.trim();
                                const text = domText || refText;
                                if (!text) return;
                                handleAddComment(text);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (commentPosting) return;
                                const domText = reelTextareaRef.current?.value?.trim();
                                const refText = commentTextRef.current?.trim();
                                const text = domText || refText;
                                if (!text) return;
                                handleAddComment(text);
                              }}
                              className="px-8 py-2.5 rounded-full bg-rose-500 text-white text-[13px] font-black shadow-xl shadow-rose-500/20 active:scale-95 transition-all disabled:opacity-40"
                            >
                              {commentPosting ? "Sending..." : "Send"}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>,
                    document.body
                  )}
                  <AnimatePresence>
                    {showCommentsSheet && (
                      <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}

                        style={{ height: commentSheetHeight }}
                        className="absolute bottom-0 inset-x-0 bg-white rounded-t-[0.5rem] z-[100] flex flex-col overflow-hidden shadow-[0_-20px_50px_rgba(0,0,0,0.5)] touch-none"
                      >


                        {/* Header */}
                        <div className="px-4 py-3 border-b border-slate-50 flex flex-col shrink-0">
                          <div className="flex items-center justify-between gap-4">
                            {currentItem?.linked_product ? (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleProductClick(Number(currentItem.linked_product?.product_id), e);
                                }}
                                className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer group active:scale-[0.98] transition-all"
                              >
                                <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-100 flex-shrink-0">
                                  <img
                                    src={formatUrl(currentItem.linked_product.image_url || currentItem.linked_product.first_image)}
                                    className="w-full h-full object-cover"
                                    alt="product"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-bold text-slate-800 truncate leading-tight flex items-center gap-1.5">
                                    {currentItem.linked_product.title}
                                    <ChevronRightIcon className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <h3 className="text-sm text-slate-800 font-bold">
                                {(currentItem?.comment_count ?? currentItem?.total_comments ?? currentItem?.comments_count ?? comments.length) > 0 ? (
                                  `${currentItem?.comment_count ?? currentItem?.total_comments ?? currentItem?.comments_count ?? comments.length} Comment(s)`
                                ) : (
                                  "Comments"
                                )}
                              </h3>
                            )}

                            <button onClick={() => { setShowCommentsSheet(false); setIsCommenting(false); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 shrink-0 active:scale-90 transition-transform">
                              <XMarkIcon className="w-5 h-5 text-slate-500" />
                            </button>
                          </div>

                          {currentItem?.linked_product && (
                            <div className="mt-2 text-[11px] text-slate-400 font-bold px-1">
                              {(currentItem?.comment_count ?? currentItem?.total_comments ?? currentItem?.comments_count ?? comments.length) > 0 ? (
                                `${currentItem?.comment_count ?? currentItem?.total_comments ?? currentItem?.comments_count ?? comments.length} Comment(s)`
                              ) : (
                                "Comments"
                              )}
                            </div>
                          )}
                        </div>

                        {/* Scrollable Comments */}
                        <div
                          ref={commentsScrollRef}
                          onScroll={handleCommentsScroll}
                          className="flex-1 overflow-y-auto px-5 py-4 space-y-6 relative pb-32"
                        >
                          {/* Post Context Header (Author + Caption + Metadata) - ONLY when navigating through title */}
                          {commentSheetEntryType === "caption" && (
                            <div className="flex flex-col gap-3 pb-6 border-b border-slate-50 mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-100 flex-shrink-0">
                                  <img src={currentItem.user.avatar} className="w-full h-full object-cover" alt="author" />
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm font-bold text-slate-900">{currentItem.user.name}</span>
                                    {!!currentItem.verified_badge || !!currentItem.user.is_partner || !!currentItem.linked_product?.verified_badge || !!currentItem.linked_product?.trusted_partner ? (
                                      <VerifiedBadge size="xs" label="Trusted Partner" />
                                    ) : !!currentItem.user.is_trusted ? (
                                      <CheckBadgeIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" title="Verified Account" />
                                    ) : null}
                                  </div>
                                  <span className="text-[11px] text-slate-400 font-medium">Post Author</span>
                                </div>
                              </div>

                              <div className="space-y-2 px-1">
                                {(currentItem.caption || currentItem.note_caption) && (
                                  <p className="text-[14px] text-slate-800 leading-relaxed">
                                    {currentItem.caption || currentItem.note_caption}
                                  </p>
                                )}

                                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                                  {currentItem.location && (
                                    <span className="flex items-center gap-1">
                                      <i className="fi fi-rr-marker text-[10px]" />
                                      {currentItem.location}
                                    </span>
                                  )}
                                  {currentItem.location && <span>•</span>}
                                  <span>{formatDate(currentItem.rawCreatedAt || currentItem.created_at)}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {loadingComments && comments.length === 0 ? (
                            <div className="flex flex-col gap-6 ">
                              {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-start gap-4 animate-pulse">
                                  <div className="h-9 w-9 rounded-full bg-slate-100 shrink-0" />
                                  <div className="flex-1 space-y-3 py-1">
                                    <div className="h-2 bg-slate-100 rounded w-1/4" />
                                    <div className="h-2 bg-slate-100 rounded w-full" />
                                    <div className="h-2 bg-slate-100 rounded w-3/4" />
                                    <div className="flex items-center gap-4 pt-1">
                                      <div className="h-2 bg-slate-50 rounded w-12" />
                                      <div className="h-2 bg-slate-50 rounded w-12" />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
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
                                const parentReplies = replies.filter(r => String(r.parent_id) === String(c.comment_id));
                                const isExpanded = expandedParents.includes(c.comment_id);
                                const visibleReplies = isExpanded ? parentReplies : parentReplies.slice(0, 2);

                                return (
                                  <div key={c.comment_id} className="space-y-4 relative">
                                    {parentReplies.length > 0 && (
                                      <div className="absolute left-[18px] top-9 bottom-0 w-[1.2px] bg-slate-100 z-0" />
                                    )}

                                    <div className="flex items-start gap-4 relative z-10">
                                      <Link href={c.author_handle ? `/${c.author_handle}` : `/user/profile/${c.user_id}`} onClick={(e) => e.stopPropagation()}>
                                        <img
                                          src={c.author_pic ?? `https://i.pravatar.cc/40?u=${c.author_name}-${c.comment_id}`}
                                          alt={c.author_name}
                                          className="h-9 w-9 rounded-full object-cover bg-white"
                                        />
                                      </Link>

                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <Link href={c.author_handle ? `/${c.author_handle}` : `/user/profile/${c.user_id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-medium text-slate-400 truncate flex items-center gap-1">
                                            {c.author_name}
                                            {!!c.verified_badge ? (
                                              <VerifiedBadge size="xs" label="Trusted Partner" className="shrink-0" />
                                            ) : !!c.author_is_trusted ? (
                                              <CheckBadgeIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" title="Verified Account" />
                                            ) : null}
                                          </Link>
                                          {c.is_author === 1 && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100 font-bold">Author</span>
                                          )}
                                        </div>
                                        <div className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{c.comment_content}</div>

                                        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                                          <div className="flex items-center gap-1.5">
                                            <span>{formatDate(c.comment_at)}</span>
                                            {c.location && (
                                              <>
                                                <span className="text-[8px] opacity-40">•</span>
                                                <span className="text-slate-400 font-medium">{c.location}</span>
                                              </>
                                            )}
                                          </div>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setReplyingTo(c);
                                              setShowCommentsSheet(true);
                                              setIsCommenting(true);
                                              setTimeout(() => {
                                                const input = document.getElementById('sheet-comment-input-active');
                                                if (input) input.focus();
                                              }, 100);
                                            }}
                                            className="font-bold hover:text-slate-600"
                                          >
                                            Reply
                                          </button>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleLikeComment(c.comment_id);
                                            }}
                                            className={`ml-auto flex flex-col items-center gap-0.5 transition-colors relative ${c.liked_by_user ? "text-rose-500" : "text-slate-400"}`}
                                          >
                                            {burstingCommentId === c.comment_id && <LikeBurst />}
                                            <div className="relative flex items-center justify-center">
                                              <AnimatePresence mode="wait">
                                                <motion.div
                                                  key={c.liked_by_user ? "liked" : "unliked"}
                                                  initial={{ scale: 0.7, opacity: 0 }}
                                                  animate={{ scale: 1, opacity: 1 }}
                                                  exit={{ scale: 0.7, opacity: 0 }}
                                                >
                                                  {c.liked_by_user ? <FaHeart className="h-3.5 w-3.5" /> : <FaRegHeart className="h-3.5 w-3.5" />}
                                                </motion.div>
                                              </AnimatePresence>
                                            </div>
                                            <span className="text-[10px] min-w-[12px] leading-none">{c.likes_count}</span>
                                          </button>
                                        </div>

                                        {(c.is_first_comment === 1 || Boolean(c.author_liked)) && (
                                          <div className="mt-2 flex items-center gap-2">
                                            {c.is_first_comment === 1 && (
                                              <span className="text-[10px] inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-100 transition-all hover:bg-slate-100">First to Comment</span>
                                            )}
                                            {Boolean(c.author_liked) && (
                                              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-100 text-[10px] transition-all hover:bg-rose-100 cursor-default">
                                                <span>Author liked</span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {parentReplies.length > 0 && (
                                      <div className="ml-[18px] pl-6 space-y-4">
                                        {visibleReplies.map((r) => (
                                          <div key={r.comment_id} className="flex items-start gap-3 relative">
                                            <div className="absolute -left-6 top-0 w-6 h-[14px] border-l-[1.2px] border-b-[1.2px] border-slate-100 rounded-bl-[12px]" />
                                            <Link href={r.author_handle ? `/${r.author_handle}` : `/user/profile/${r.user_id}`} onClick={(e) => e.stopPropagation()}>
                                              <img
                                                src={r.author_pic ?? `https://i.pravatar.cc/40?u=${r.author_name}-${r.comment_id}`}
                                                alt={r.author_name}
                                                className="h-7 w-7 rounded-full object-cover bg-white"
                                              />
                                            </Link>
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2">
                                                <Link href={r.author_handle ? `/${r.author_handle}` : `/user/profile/${r.user_id}`} onClick={(e) => e.stopPropagation()} className="text-xs font-medium text-slate-400 flex items-center gap-1">
                                                  {r.author_name}
                                                  {!!r.verified_badge ? (
                                                    <VerifiedBadge size="xs" label="Trusted Partner" className="shrink-0" />
                                                  ) : !!r.author_is_trusted ? (
                                                    <CheckBadgeIcon className="w-3 h-3 text-blue-500 shrink-0" title="Verified Account" />
                                                  ) : null}
                                                </Link>
                                                {r.is_author === 1 && (
                                                  <span className="text-[9px] px-1 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100 font-bold">Author</span>
                                                )}
                                              </div>
                                              <div className="mt-0.5 text-xs text-slate-600 whitespace-pre-wrap">{r.comment_content}</div>

                                              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                                                <div className="flex items-center gap-1.5">
                                                  <span>{formatDate(r.comment_at)}</span>
                                                  {r.location && (
                                                    <>
                                                      <span className="text-[8px] opacity-40">•</span>
                                                      <span className="text-slate-400 font-medium">{r.location}</span>
                                                    </>
                                                  )}
                                                </div>

                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setReplyingTo(r); // Now you can reply to a reply
                                                    setShowCommentsSheet(true);
                                                    setIsCommenting(true);
                                                    setTimeout(() => {
                                                      const input = document.getElementById('sheet-comment-input-active');
                                                      if (input) input.focus();
                                                    }, 100);
                                                  }}
                                                  className="font-bold hover:text-slate-600"
                                                >
                                                  Reply
                                                </button>

                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleLikeComment(r.comment_id);
                                                  }}
                                                  className={`ml-auto flex flex-col items-center gap-0.5 transition-colors relative ${r.liked_by_user ? "text-rose-500" : "text-slate-400"}`}
                                                >
                                                  {burstingCommentId === r.comment_id && <LikeBurst />}
                                                  <div className="relative flex items-center justify-center">
                                                    <AnimatePresence mode="wait">
                                                      <motion.div
                                                        key={r.liked_by_user ? "liked" : "unliked"}
                                                        initial={{ scale: 0.7, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        exit={{ scale: 0.7, opacity: 0 }}
                                                      >
                                                        {r.liked_by_user ? <FaHeart className="h-3 w-3" /> : <FaRegHeart className="h-3 w-3" />}
                                                      </motion.div>
                                                    </AnimatePresence>
                                                  </div>
                                                  <span className="text-[10px] min-w-[10px] leading-none">{r.likes_count}</span>
                                                </button>
                                              </div>

                                              {Boolean(r.author_liked) && (
                                                <div className="mt-1.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100 text-[9px] font-bold w-fit z-10 transition-all hover:bg-rose-100 cursor-default">
                                                  <FaHeart className="w-2 h-2" />
                                                  <span>Author liked</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ))}

                                        {parentReplies.length > 2 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setExpandedParents(prev =>
                                                isExpanded ? prev.filter(id => id !== c.comment_id) : [...prev, c.comment_id]
                                              );
                                            }}
                                            className="text-[10px] font-bold text-slate-400 hover:text-rose-500 pl-1"
                                          >
                                            {isExpanded ? "Hide replies" : `View ${parentReplies.length - 2} more replies`}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              });
                            })()
                          )}
                          {comments.length > 0 && !hasMoreComments && <div className="text-center text-slate-300 text-sm font-Medium">-THE END-</div>}
                          {isFetchingMore && (
                            <div className="flex justify-center py-4">
                              <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>

                        {/* Input Pad (Sticky) - Expandable to match desktop */}
                        <div
                          className="absolute bottom-0 inset-x-0 z-[110] px-5 py-2 bg-white border-t border-slate-100 shrink-0"
                          style={{
                            paddingBottom: "var(--kb-pad, env(safe-area-inset-bottom, 16px))"
                          }}
                        >
                          {replyingTo && (
                            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded-lg text-[10px] mb-3">
                              <span className="text-slate-500">Replying to <span className="font-bold text-slate-700">{replyingTo.author_name}</span></span>
                              <button onClick={() => { setReplyingTo(null); setIsCommenting(false); }} className="text-slate-400"><XMarkIcon className="w-3 h-3" /></button>
                            </div>
                          )}

                          {isCommenting ? (
                            <div className="space-y-1">
                              {/* Emoji Shortcuts */}
                              <div
                                className="flex items-center gap-2 overflow-x-auto pb-1 px-0.5"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                              >
                                {EMOJI_SHORTCUTS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newText = commentText + emoji;
                                      setCommentText(newText);
                                      commentTextRef.current = newText;
                                      sheetTextareaRef.current?.focus();
                                    }}
                                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center active:scale-90 transition-all text-md"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                              <textarea
                                id="desktop-comment-input-active"
                                autoFocus
                                ref={desktopTextareaRef}
                                rows={1}
                                value={commentText}
                                onChange={(e) => {
                                  commentTextRef.current = e.target.value;
                                  setCommentText(e.target.value);
                                  const el = e.target;
                                  el.style.height = 'auto';
                                  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                                  el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden';
                                }}
                                placeholder={replyingTo ? "Add a reply..." : "Add a comment..."}
                                className="w-full rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 outline-none transition focus:ring-1 focus:ring-slate-200 resize-none overflow-hidden leading-tight"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    const text = commentTextRef.current.trim();
                                    if (text) handleAddComment(text);
                                  }
                                }}
                              />
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsCommenting(false);
                                    setCommentText("");
                                    setReplyingTo(null);
                                  }}
                                  className="px-4 py-2 rounded-full text-xs font-bold text-slate-500 bg-slate-50 border border-slate-100"
                                >
                                  Cancel
                                </button>
                                <button
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onTouchEnd={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (commentPosting) return;
                                    const domText = sheetTextareaRef.current?.value?.trim();
                                    const refText = commentTextRef.current?.trim();
                                    const text = domText || refText;
                                    if (!text) return;
                                    handleAddComment(text);
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (commentPosting) return;
                                    const domText = sheetTextareaRef.current?.value?.trim();
                                    const refText = commentTextRef.current?.trim();
                                    const text = domText || refText;
                                    if (!text) return;
                                    handleAddComment(text);
                                  }}
                                  disabled={commentPosting || !commentText.trim()}
                                  className="px-6 py-2 rounded-full bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-500/20 active:scale-95 transition-all disabled:opacity-40 disabled:grayscale transition-all"
                                >
                                  {commentPosting ? "Sending..." : "Post"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsCommenting(true);
                              }}
                              className="w-full rounded-full bg-slate-100 px-5 py-3 text-[14px] font-medium text-slate-400 cursor-text flex items-center justify-between transition-colors hover:bg-slate-200/50"
                            >
                              <span>{replyingTo ? "Write a reply..." : "Add a comment..."}</span>
                              <div className="flex items-center gap-1 opacity-40">
                                <div className="w-1 h-1 rounded-full bg-slate-400 animate-pulse" />
                                <div className="w-1 h-1 rounded-full bg-slate-400 animate-pulse delay-75" />
                              </div>
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                /* STANDARD VIEW (IMAGES OR DESKTOP VIDEO) */
                <>
                  {/* LEFT: media side of the standard modal layout */}
                  <div
                    ref={leftMediaRef}
                    className="md:flex-1 min-w-0 w-full flex flex-col items-center justify-between min-h-[400px] md:min-h-0 border-r border-slate-200 relative group/media bg-slate-50"
                  >
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
                    ) : (
                      <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden">
                        {/* Processing Overlay */}
                        {post.status === 'processing' && (
                          <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md text-white border-r">
                            <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin mb-4" />
                            <h3 className="text-lg font-black mb-1">Post Studio</h3>
                            <p className="text-sm text-white/70 font-bold px-10 text-center leading-relaxed">
                              Optimizing and merging your media into a single high-quality reel... Please stay on this page.
                            </p>
                          </div>
                        )}

                        {post.isVideo ? (
                          <div
                            className="absolute inset-0 bg-black cursor-pointer"
                            onClick={handleDoubleTap}
                          >
                            <AnimatePresence>
                              {activeHeartPops.map((pop) => (
                                <motion.div
                                  key={pop.id}
                                  initial={{ scale: 0, opacity: 0, rotate: pop.rotate }}
                                  animate={{
                                    scale: [0, 1.3, 1.1],
                                    opacity: [0, 1, 0],
                                    y: [0, -50],
                                    rotate: [pop.rotate, pop.rotate + (pop.rotate > 0 ? 15 : -15)]
                                  }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.8, ease: "easeOut" }}
                                  style={{
                                    position: "fixed",
                                    left: pop.x + pop.offsetX - 40,
                                    top: pop.y + pop.offsetY - 40,
                                    zIndex: 10000,
                                    pointerEvents: "none",
                                  }}
                                >
                                  <FaHeart className="w-20 h-20 text-rose-500/90 drop-shadow-2xl" />
                                </motion.div>
                              ))}
                            </AnimatePresence>
                            <LargeScreenVideoPlayer
                              videoId={`desktop_modal_${post.id}`}
                              isActive={true}
                              onRegisterRef={(el) => handleVideoRegister(el, true)}
                              onLongPress={(e: React.MouseEvent | React.TouchEvent) => {
                                if ('clientX' in e) {
                                  setMenuPosition({ x: e.clientX, y: e.clientY });
                                } else {
                                  setMenuPosition(null);
                                }
                                setLongTappedPost(post);
                                setShowLongTapMenu(true);
                              }}
                              src={post.final_video_url || post.src}
                              poster={post.thumbnail}
                              className="w-full h-full"
                              videoClassName="object-contain"
                              userManualPause={isPaused}
                            />
                          </div>
                        ) : (
                          <>
                            <div
                              className="relative w-full h-full flex items-center justify-center overflow-hidden"
                              style={(!post.isVideo && firstImageAspectRatio) ? { aspectRatio: `${firstImageAspectRatio}`, maxHeight: '70vh' } : {}}
                            >
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
                            </div>
                          </>
                        )}


                      </div>

                    )}
                    {/* Pagination dots at the very bottom of the left media panel */}
                    {mediaList.length > 1 && !post.isVideo && (
                      <div className="flex items-center justify-center py-4 w-full bg-white/30">
                        <div className="flex gap-1.5 px-3 py-1.5 bg-slate-50/50 rounded-full border border-slate-100/50">
                          {mediaList.map((_, i) => (
                            <div
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentMediaIndex
                                ? "bg-rose-500 shadow-sm shadow-rose-200"
                                : "bg-slate-300"
                                }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RIGHT Panel Side (details + comments) for standard layout */}
                  <div className="flex flex-col min-h-0 md:w-[400px] md:shrink-0 w-full relative">
                    {/* HEADER for md+ screens */}
                    <div className="flex items-center justify-between gap-4 p-4 md:p-5 flex-shrink-0 border-b md:border-b-0 border-slate-200 hidden md:flex">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={currentItem.user.avatar}
                          alt={currentItem.user.name}
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
                          onClick={(e) => { e.stopPropagation(); setFullImageUrl(currentItem.user.avatar || null); setViewerProfileUserId(currentItem.user.id); }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className="text-base font-semibold text-slate-900 truncate">{currentItem.user.name}</div>
                            {!!currentItem.verified_badge || !!currentItem.user.is_partner || !!currentItem.linked_product?.verified_badge || !!currentItem.linked_product?.trusted_partner ? (
                              <VerifiedBadge size="sm" label="Trusted Partner" />
                            ) : !!currentItem.user.is_trusted ? (
                              <CheckBadgeIcon className="w-5 h-5 text-blue-500 shrink-0" title="Verified Account" />
                            ) : null}                          </div>
                        </div>
                      </div>

                      {!isPostOwner && !isFollowing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFollowAuthor();
                          }}
                          disabled={followLoading}
                          className="inline-flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-all bg-rose-500 text-white hover:bg-rose-500 shadow-sm"
                        >
                          Follow
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-h-0 lg:overflow-auto">
                      <div className="p-5 lg:p-6">
                        {currentItem.coverType === "note" && !currentItem.src ? (
                          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed font-semibold mb-2">{currentItem.note_caption}</p>
                        ) : (
                          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed font-semibold mb-2">{currentItem.caption}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{formatDate(currentItem.rawCreatedAt)}</span>
                          {currentItem.location && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[8px] opacity-40">•</span>
                              <div className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500">
                                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                </svg>
                                <span>{currentItem.location}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Linked Product Section - Under the duration/location */}
                        {(() => {
                          const lp = hydratedLinkedProducts[String(activePostId)] || currentItem.linked_product;
                          if (!currentItem.is_product_linked || !lp) return null;
                          return (
                            <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (lp.product_id) {
                                    handleProductClick(Number(lp.product_id), e);
                                  }
                                }}
                                className="p-1 bg-slate-50 rounded-[0.5rem]  border-slate-100 flex items-center gap-3 active:scale-[0.98] transition-all cursor-pointer group/linked hover:bg-slate-100"
                              >
                                <div className="relative w-12 h-12 rounded-[0.5rem] overflow-hidden shrink-0 bg-white  border-slate-200">
                                  {(() => {
                                    const imgSrc = lp.image_url || lp.first_image || lp.first_image_url || lp.thumbnail || lp.image || (Array.isArray(lp.media) ? lp.media[0]?.url : undefined);
                                    if (!imgSrc || imgSrc === "") return null;
                                    return (
                                      <Image
                                        src={formatUrl(imgSrc)}
                                        fill
                                        className="object-cover transition-transform duration-500 group-hover/linked:scale-110"
                                        alt={lp.title || "Product"}
                                        sizes="48px"
                                      />
                                    );
                                  })()}
                                  <div className="absolute inset-0 bg-black/0 group-hover/linked:bg-black/5 flex items-center justify-center transition-all z-10">
                                    <EyeIcon className="w-4 h-4 text-white opacity-0 group-hover/linked:opacity-100" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-bold text-slate-900 truncate leading-tight">
                                    {lp.title}
                                  </h4>
                                  <div className="flex items-center gap-1.5 mt-1 whitespace-nowrap overflow-hidden pr-2">
                                    <span className="text-[13px] font-black text-rose-500 shrink-0">
                                      ₦{getDiscountedPrice(lp).toLocaleString()}
                                    </span>
                                    {getDiscountInfo(lp) && (
                                      <span className="text-[10px] bg-rose-100 text-rose-500 px-1.5 py-0.5 rounded shrink-0 ">
                                        {getDiscountInfo(lp)?.name} ({getDiscountInfo(lp)?.discount}% Off)
                                      </span>
                                    )}
                                    {Number(lp.total_sold || 0) > 0 && (
                                      <>
                                        <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                                        <span className="text-[10px] text-slate-500 shrink-0">{lp.total_sold}+ Sold</span>
                                      </>
                                    )}
                                    {getPolicyText(lp) && (
                                      <>
                                        <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                                        <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{getPolicyText(lp)}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="shrink-0 pr-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (getStockCount(lp) <= 0) return;
                                      if (lp.product_id) {
                                        handleProductClick(Number(lp.product_id), e);
                                      }
                                    }}
                                    className={`px-4 py-1.5 ${getStockCount(lp) <= 0 ? 'bg-slate-500 cursor-not-allowed' : 'bg-rose-500 hover:bg-rose-500 active:scale-95'} text-white text-[10px]  rounded-full transition-all shadow-sm`}
                                  >
                                    {getStockCount(lp) <= 0 ? 'Sold out' : 'Buy now'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
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
                          <div className="text-xs text-rose-500">{commentsError}</div>
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
                              const parentReplies = replies.filter(r => String(r.parent_id) === String(c.comment_id));
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
                                      href={c.author_handle ? `/${c.author_handle}` : `/user/profile/${c.user_id}`}
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
                                        <div className="flex items-center gap-1 min-w-0">
                                          <Link
                                            href={c.author_handle ? `/${c.author_handle}` : `/user/profile/${c.user_id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-sm font-medium text-slate-400 truncate hover:text-rose-500 transition-colors"
                                          >
                                            {c.author_name}
                                          </Link>
                                          {!!c.verified_badge ? (
                                            <VerifiedBadge size="xs" label="Trusted Partner" />
                                          ) : !!c.author_is_trusted ? (
                                            <CheckBadgeIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" title="Verified Account" />
                                          ) : null}
                                        </div>
                                        {c.is_author === 1 && (
                                          <span className="text-[10px] inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100 font-bold">Author</span>
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
                                          className={`ml-auto flex flex-col items-center gap-0.5 font-medium transition-colors relative ${c.liked_by_user ? "text-rose-500" : "text-slate-400 hover:text-slate-500"}`}
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
                                          </div>
                                          <span className="text-[10px] min-w-[12px] leading-none">{c.likes_count}</span>
                                        </button>
                                      </div>

                                      {(c.is_first_comment === 1 || Boolean(c.author_liked)) && (
                                        <div className="mt-2 flex items-center gap-2">
                                          {c.is_first_comment === 1 && (
                                            <span className="text-[10px] inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-100  transition-all hover:bg-slate-100">First to Comment</span>
                                          )}
                                          {Boolean(c.author_liked) && (
                                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100 text-[10px] transition-all hover:bg-rose-100 cursor-default">
                                              <FaHeart className="w-2 h-2" />
                                              <span>Author liked</span>
                                            </div>
                                          )}
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
                                                href={r.author_handle ? `/${r.author_handle}` : `/user/profile/${r.user_id}`}
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
                                                    href={r.author_handle ? `/${r.author_handle}` : `/user/profile/${r.user_id}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-xs font-medium text-slate-400 truncate hover:text-rose-500 transition-colors"
                                                  >
                                                    {r.author_name}
                                                  </Link>
                                                  {!!r.verified_badge ? (
                                                    <VerifiedBadge size="xs" label="Trusted Partner" />
                                                  ) : !!r.author_is_trusted ? (
                                                    <CheckBadgeIcon className="w-3 h-3 text-blue-500 shrink-0" title="Verified Account" />
                                                  ) : null}
                                                  {r.is_author === 1 && (
                                                    <span className="text-[9px] inline-flex items-center px-1 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100 font-bold">Author</span>
                                                  )}
                                                </div>

                                                <div className="mt-0.5 text-xs text-slate-600 whitespace-pre-wrap mb-1">{r.comment_content}</div>

                                                <div className="flex items-center gap-3 text-[10px] text-slate-400 relative w-full">
                                                  <div className="flex items-center gap-1.5">
                                                    <span>{formatDate(r.comment_at)}</span>
                                                    {r.location && (
                                                      <>
                                                        <span className="text-[8px] opacity-40">•</span>
                                                        <span className="text-slate-500 font-bold">{r.location}</span>
                                                      </>
                                                    )}
                                                  </div>

                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setReplyingTo(r); // Now you can reply to a reply in desktop too
                                                      setIsCommenting(true);
                                                      setCommentText("");
                                                      setTimeout(() => {
                                                        const input = document.getElementById('desktop-comment-input-active') || document.getElementById('sheet-comment-input-active');
                                                        if (input) input.focus();
                                                      }, 100);
                                                    }}
                                                    className="font-bold hover:text-slate-600 transition-colors"
                                                  >
                                                    Reply
                                                  </button>

                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleLikeComment(r.comment_id);
                                                    }}
                                                    className={`ml-auto flex flex-col items-center gap-0.5 font-medium transition-colors relative ${r.liked_by_user ? "text-rose-500" : "text-slate-400 hover:text-slate-500"}`}
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
                                                    </div>
                                                    <span className="text-[10px] min-w-[10px] leading-none">{r.likes_count}</span>
                                                  </button>
                                                </div>

                                                {Boolean(r.author_liked) && (
                                                  <div className="mt-1.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100 text-[9px] font-bold w-fit z-10 transition-all hover:bg-rose-100 cursor-default">
                                                    <FaHeart className="w-2 h-2" />
                                                    <span>Author liked</span>
                                                  </div>
                                                )}
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
                                                className="text-[10px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1.5 transition-colors py-1 pl-1"
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
                                                className="text-[10px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1.5 transition-colors py-1 pl-1"
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

                        {comments.length > 0 && <div className="text-center text-slate-300 font-Medium mt- mb-10">-THE END-</div>}
                      </div>
                    </div>

                    {!isPreview && (
                      <div className="md:absolute fixed left-0 w-full bg-white border-t border-slate-200 z-50 p-2 bottom-0 md:p-4">
                        {replyingTo && (
                          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-t-lg border-x border-t border-slate-100 -mt-2 mb-2 text-xs">
                            <span className="text-slate-500">
                              Replying to <span className="font-semibold text-slate-700">{replyingTo.author_name}</span>
                            </span>
                            <button
                              onClick={() => { setReplyingTo(null); if (!commentText) setIsCommenting(false); }}
                              className="text-slate-400 hover:text-rose-500"
                            >
                              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                          </div>
                        )}
                        {isCommenting ? (
                          <div className="space-y-3">
                            <textarea
                              id="desktop-comment-input-active"
                              autoFocus
                              ref={desktopTextareaRef}
                              rows={1}
                              value={commentText}
                              onChange={(e) => {
                                setCommentText(e.target.value);
                                const el = e.target;
                                el.style.height = 'auto';
                                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                                el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden';
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleAddComment();
                                  setIsCommenting(false);
                                }
                              }}
                              placeholder="Say something..."
                              className="w-full rounded-full bg-gray-100 px-4 py-2 lg:text-[12px] text-[10px] sm:text-[8px] text-black caret-rose-500 outline-none transition focus:ring-1 focus:ring-gray-300 resize-none overflow-hidden leading-tight"
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
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const text = commentText.trim();
                                  if (!text) return;
                                  handleAddComment(text);
                                }}
                                disabled={commentPosting || !commentText.trim()}
                                className="h-7 flex px-4 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:brightness-105 active:scale-95 text-sm disabled:opacity-50 disabled:grayscale transition-all"
                                title="Send comment"
                              >
                                {commentPosting ? (
                                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-20" fill="none" />
                                    <path fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                                  </svg>
                                ) : (
                                  "Send"
                                )}
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
                              className="flex-1 inline-flex items-center border border-slate-300 gap-3 px-5 py-2 bg-slate-50 hover:bg-slate-100 rounded-full text-sm text-slate-500 transition-all border border-slate-200/50 group"
                            >
                              <MessageCircleMore className="w-4 h-4 text-slate-400 group-hover:text-rose-500 transition-colors" />
                              <span className="text-[13px] font-medium">Add a comment...</span>
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

                              <button
                                onClick={handleShareClick}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-slate-600 hover:bg-slate-50 transition-colors group"
                                title="Share post"
                              >
                                <ArrowUpRightFromSquareIcon className="w-5 h-5 text-slate-800 group-hover:text-rose-500 transition-colors" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
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
            {productPreviewOpen && selectedProductData && (
              <ProductPreviewModal
                open={productPreviewOpen}
                onClose={() => {
                  setProductPreviewOpen(false);
                  // AUTO-RESUME: Restore playback when exiting product context
                  setIsPaused(false);
                  userManualPauseRef.current = false;
                }}
                payload={selectedProductData}
                onProductClick={(id) => handleProductClick(Number(id))}
                ignoreRouterBack={true}
                isFromReel={isMobileReels}
                onExpand={() => {
                  if (activeVideoRef.current) activeVideoRef.current.pause();
                  setIsPaused(true);
                }}
                onCollapse={() => {
                  if (activeVideoRef.current) activeVideoRef.current.play();
                  setIsPaused(false);
                }}
              />
            )}

            {/* LONG TAP CONTEXT MENU MODAL */}
            <AnimatePresence>
              {showLongTapMenu && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={(e) => { e.stopPropagation(); setShowLongTapMenu(false); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="fixed inset-0 bg-black/40 z-[99999] backdrop-blur-sm lg:bg-transparent"
                  />
                  <motion.div
                    initial={menuPosition ? { opacity: 0, scale: 0.9, x: menuPosition.x, y: menuPosition.y } : { y: "100%" }}
                    animate={menuPosition ? { opacity: 1, scale: 1, x: Math.min(menuPosition.x, typeof window !== 'undefined' ? window.innerWidth - 240 : 0), y: Math.min(menuPosition.y, typeof window !== 'undefined' ? window.innerHeight - 300 : 0) } : { y: 0 }}
                    exit={menuPosition ? { opacity: 0, scale: 0.9 } : { y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={menuPosition ? { position: 'fixed', left: 0, top: 0, width: '220px' } : {}}
                    className={`fixed bg-white z-[100000] overflow-hidden shadow-2xl ${menuPosition ? 'rounded-xl p-1 border border-slate-100' : 'bottom-0 left-0 right-0 rounded-t-[2rem] lg:max-w-md lg:mx-auto lg:rounded-3xl lg:bottom-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:translate-y-1/2'
                      }`}
                  >
                    {/* Header Drag Handle - Mobile Only */}
                    {!menuPosition && <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1" />}

                    {!menuPosition && (
                      <div className="p-4 flex items-center justify-between border-b border-slate-100">
                        <span className="font-black text-slate-800 text-lg">Reel Actions</span>
                        <button onClick={() => setShowLongTapMenu(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors">
                          <XMarkIcon className="w-5 h-5 text-slate-500" />
                        </button>
                      </div>
                    )}

                    <div className={`${menuPosition ? 'space-y-0.5' : 'p-4 space-y-2'}`}>
                      <button
                        onClick={() => {
                          if (longTappedPost) handleDownload(longTappedPost.final_video_url || longTappedPost.src);
                          setShowLongTapMenu(false);
                        }}
                        className={`w-full flex items-center gap-3 active:scale-[0.98] transition-all group ${menuPosition ? 'p-2.5 rounded-lg hover:bg-slate-50' : 'p-4 rounded-2xl bg-slate-50 hover:bg-slate-100'}`}
                      >
                        <div className={`${menuPosition ? 'w-8 h-8' : 'w-11 h-11'} rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20`}>
                          <ArrowDownTrayIcon className={`${menuPosition ? 'w-4 h-4' : 'w-5 h-5'}`} />
                        </div>
                        <div className="flex flex-col items-start text-left">
                          <span className={`${menuPosition ? 'text-xs' : 'text-sm'} font-bold text-slate-800`}>Download</span>
                          {!menuPosition && <span className="text-[10px] text-slate-500 font-medium">Save this reel to your device</span>}
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          if (longTappedPost) handleCopyLink(longTappedPost);
                          setShowLongTapMenu(false);
                        }}
                        className={`w-full flex items-center gap-3 active:scale-[0.98] transition-all group ${menuPosition ? 'p-2.5 rounded-lg hover:bg-slate-50' : 'p-4 rounded-2xl bg-slate-50 hover:bg-slate-100'}`}
                      >
                        <div className={`${menuPosition ? 'w-8 h-8' : 'w-11 h-11'} rounded-full bg-slate-800 flex items-center justify-center text-white shadow-lg shadow-slate-800/20`}>
                          <LinkIcon className={`${menuPosition ? 'w-4 h-4' : 'w-5 h-5'}`} />
                        </div>
                        <div className="flex flex-col items-start text-left">
                          <span className={`${menuPosition ? 'text-xs' : 'text-sm'} font-bold text-slate-800`}>Copy Link</span>
                          {!menuPosition && <span className="text-[10px] text-slate-500 font-medium">Share this reel with others</span>}
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setShowLongTapMenu(false);
                          handleShareClick();
                        }}
                        className={`w-full flex items-center gap-3 active:scale-[0.98] transition-all group ${menuPosition ? 'p-2.5 rounded-lg hover:bg-slate-50' : 'p-4 rounded-2xl bg-slate-50 hover:bg-slate-100'}`}
                      >
                        <div className={`${menuPosition ? 'w-8 h-8' : 'w-11 h-11'} rounded-full bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20`}>
                          <UserGroupIcon className={`${menuPosition ? 'w-4 h-4' : 'w-5 h-5'}`} />
                        </div>
                        <div className="flex flex-col items-start text-left">
                          <span className={`${menuPosition ? 'text-xs' : 'text-sm'} font-bold text-slate-800`}>Share to Socials</span>
                          {!menuPosition && <span className="text-[10px] text-slate-500 font-medium">Post to WhatsApp, Twitter, etc.</span>}
                        </div>
                      </button>

                      <div className="h-px bg-slate-100 my-1 mx-2" />
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </>
        )}
      </AnimatePresence>
      {isPostShareModalOpen && (
        <PostShareModal
          isOpen={isPostShareModalOpen}
          onClose={() => setIsPostShareModalOpen(false)}
          shareUrl={shareUrl}
          title={(isMobileReels ? reelsList[currentReelIndex]?.caption : post.caption) || "Check out this reel on Stoqle!"}
          isLoading={isGeneratingShareLink}
          onGenerate={async () => {
            const activeItem = isMobileReels ? reelsList[currentReelIndex] : post;
            return generateShareLink(activeItem?.id || activePostId);
          }}
          zIndex={getNextZIndex()}
        />
      )}
    </div>,
    document.body
  );
}
