// PostModal.tsx (fix: target left media only + consistent image resizing)
"use client";

import Image from "next/image";

import { API_BASE_URL } from "@/src/lib/config";
import '@flaticon/flaticon-uicons/css/all/all.css';
import {
  ArrowDownTrayIcon,
  LinkIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import VerifiedBadge from "@/src/components/common/VerifiedBadge";
import EmojiPickerModal from "@/src/components/modal/auth/EmojiPickerModal";
import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import { useAuth } from "@/src/context/authContext";
import { formatUrl } from "@/src/lib/utils/media";
import StoqleLoader from "@/src/components/common/StoqleLoader";
import ImageViewer from "./imageViewer";
import MobileReelsView from "./PostModal/components/MobileReelsView";
import StandardPostView from "./PostModal/components/StandardPostView";
import { PostModalContext } from "./PostModal/types";

import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCachedLocationName, getCurrentLocationName } from "@/src/lib/location";
import { getNextZIndex } from "@/src/lib/utils/z-index";

import { io } from "socket.io-client";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import { fetchProductById } from "@/src/lib/api/productApi";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import type { PreviewPayload } from "@/src/types/product";
import { useAudio } from "@/src/context/audioContext";
import { copyToClipboard } from "@/src/lib/utils/utils";

import type { Post, User, APIComment } from "@/src/lib/types";
import { useSocialShare } from "@/src/hooks/useSocialShare";
import PostShareModal from "./PostShareModal";
import { createPortal } from "react-dom";
import { EMOJI_SHORTCUTS } from "@/src/lib/constants/emojis";
import { getOrFetchImage } from "@/src/lib/indexedDB";
import { safeFetch } from "@/src/lib/api/handler";

import { usePostModalUI } from "./PostModal/hooks/usePostModalUI";
import { usePostMedia } from "./PostModal/hooks/usePostMedia";
import { usePostReels } from "./PostModal/hooks/usePostReels";
import { usePostComments } from "./PostModal/hooks/usePostComments";
import { usePostInteractions } from "./PostModal/hooks/usePostInteractions";
import { usePostMentions } from "./PostModal/hooks/usePostMentions";
import { usePostProducts } from "./PostModal/hooks/usePostProducts";
import { usePostActions } from "./PostModal/hooks/usePostActions";

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
  if (diff < 86500) return `${Math.floor(diff / 3600)} hr${Math.floor(diff / 3600) > 1 ? "s" : ""} ago`;
  if (diff < 604800) return `${Math.floor(diff / 86500)} day${Math.floor(diff / 86500) > 1 ? "s" : ""} ago`;
  if (diff < 2419200) return `${Math.floor(diff / 604800)} week${Math.floor(diff / 604800) > 1 ? "s" : ""} ago`;
  if (diff < 29030400) return `${Math.floor(diff / 2419200)} month${Math.floor(diff / 2419200) > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}


export default function PostModal({ post, onClose: onCloseProp, open, onToggleLike, userToken, isPreview = false, origin, targetUserId, isProductLinkedOnly = false, zIndex, onActivePostChange }: Props) {
  const auth = useAuth();
  const router = useRouter();

  const [showCommentsSheet, setShowCommentsSheet] = useState(false);
  const [commentSheetEntryType, setCommentSheetEntryType] = useState<"icon" | "caption" | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [viewerProfileUserId, setViewerProfileUserId] = useState<string | number | undefined>(undefined);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // 1. UI & Layout Hook
  const {
    isClosing,
    modalZIndex,
    isLargeScreen,
    lockHeight,
    videoPortHeight,
    commentSheetHeight,
    modalRef,
    leftMediaRef,
    activeVideoRef,
    onClose,
    handleVideoRegister,
    computedWidth,
    computeAndSetModalWidth
  } = usePostModalUI({ open, onCloseProp, showCommentsSheet });

  // 2. Reels & Reservoir Hook
  const isMobileReels = !isLargeScreen && !!post.isVideo;
  const {
    reelsList,
    setReelsList,
    currentReelIndex,
    setCurrentReelIndex,
    activePostId,
    showSwipeGuide,
    dismissSwipeGuide,
    isPaused,
    setIsPaused,
    handleVideoEnded,
    handleTimeUpdate,
    fastScrollVelocityRef,
    interactionTrackerRef,
    lastScrollTimeRef,
    userManualPauseRef,
    pendingTransitionRef
  } = usePostReels({ post, isMobileReels, userToken, targetUserId, onActivePostChange });

  // 3. Media & Audio Hook
  const allMedia = useMemo(() => {
    let rawMedia = post.allMedia || [];
    if (rawMedia.length === 0 && post.src && !post.isVideo) {
      rawMedia = [{ url: post.src, id: 'primary' }];
    }
    return rawMedia.filter((m: any) => {
      const url = m.url.toLowerCase();
      const isAudio = url.match(/\.(mp3|wav|ogg|m4a)$/i) || (url.endsWith('.webm') && !post.isVideo);
      return !isAudio;
    });
  }, [post.allMedia, post.src, post.isVideo]);

  const {
    currentMediaIndex,
    setCurrentMediaIndex,
    firstImageAspectRatio,
    setFirstImageAspectRatio,
    swipeDirection,
    setSwipeDirection,
    fullImageUrl,
    setFullImageUrl,
    backgroundAudioRef,
    backgroundAudioUrl,
    isDraggingRef
  } = usePostMedia({ post, allMedia, isMobileReels, reelsList, currentReelIndex, open, isPaused });

  // 4. Interactions Hook
  const {
    postLiked,
    postLikeCount,
    isPostOwner,
    isFollowing,
    followLoading,
    toggleFollowAuthor,
    showBurst,
    activeHeartPops,
    isPostShareModalOpen,
    setIsPostShareModalOpen,
    handleToggleLike,
    handleDoubleTap,
    handleShareClick,
    generateShareLink,
    shareUrl,
    isGeneratingShareLink
  } = usePostInteractions({
    post,
    activePostId,
    userToken,
    auth,
    isMobileReels,
    currentReelIndex,
    reelsList,
    setReelsList,
    isPreview,
    onToggleLikeProp: onToggleLike,
    setIsPaused
  });

  // 5. Comments Hook
  const {
    comments,
    setComments,
    loadingComments,
    commentsError,
    commentText,
    setCommentText,
    commentTextRef,
    commentPosting,
    replyingTo,
    setReplyingTo,
    commentsOffset,
    hasMoreComments,
    isFetchingMore,
    burstingCommentId,
    expandedParents,
    setExpandedParents,
    commentsScrollRef,
    sheetTextareaRef,
    desktopTextareaRef,
    reelTextareaRef,
    handleCommentsScroll,
    toggleLikeComment,
    handleAddComment,
    fetchComments
  } = usePostComments({
    postId: activePostId,
    userToken,
    auth,
    isPostOwner,
    isMobileReels,
    currentReelIndex,
    setReelsList,
    isPreview
  });

  // 6. Mentions Hook
  const {
    showMentions,
    setShowMentions,
    mentionsList,
    isLoadingMentions,
    fetchMentions
  } = usePostMentions({ auth, userToken });

  // 7. Products Hook
  const {
    selectedProductData,
    productPreviewOpen,
    setProductPreviewOpen,
    fetchingProductId,
    hydratedLinkedProducts,
    setHydratedLinkedProducts,
    handleProductClick
  } = usePostProducts({ auth, isMobileReels, setIsPaused, activeVideoRef });

  const {
    showLongTapMenu,
    setShowLongTapMenu,
    menuPosition,
    setMenuPosition,
    longTappedPost,
    setLongTappedPost,
    handleCopyLink,
    handleDownload
  } = usePostActions();

  useEffect(() => {
    if (!isCommenting) {
      setReplyingTo(null);
    }
  }, [isCommenting, setReplyingTo]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const portalTargetRef = useRef<Element | null>(null);
  useEffect(() => {
    if (typeof document !== "undefined") {
      portalTargetRef.current = document.body;
    }
  }, []);

  const stop = (e: React.MouseEvent) => e.stopPropagation();



  const currentItem = isMobileReels ? reelsList[currentReelIndex] : post;
  const mediaList = useMemo(() => allMedia.map(m => m.url), [allMedia]);

  const getStockCount = useCallback((lp: any) => {
    if (!lp) return 0;
    const inventory = Array.isArray(lp.inventory) ? lp.inventory : [];
    const hasVariants = lp.has_variants === 1 || lp.has_variants === true || inventory.length > 0;
    if (hasVariants && inventory.length > 0) {
      return inventory.reduce((acc: number, item: any) => acc + (Number(item.quantity ?? item.stock ?? item.initial_quantity ?? 0)), 0);
    }
    return Number(lp.total_quantity ?? lp.quantity ?? lp.stock ?? lp.total_stock ?? 0);
  }, []);

  const getDiscountInfo = useCallback((lp: any) => {
    if (!lp) return null;
    try {
      const settings = lp.policy_settings || {};
      const ps = typeof (settings.promotions_data || lp.promotions_data) === 'string'
        ? JSON.parse(settings.promotions_data || lp.promotions_data)
        : (settings.promotions_data || lp.promotions_data);
      if (Array.isArray(ps) && ps.length > 0) {
        const promo = ps[0];
        const discount = promo.discount || promo.discount_percent || promo.discount_percentage;
        const name = promo.title || promo.name || promo.occasion || promo.promo_name || promo.type || "Promotion";
        if (discount) return { discount: Number(discount), name };
      }
      const sd = typeof (settings.sale_discount_data || lp.sale_discount_data) === 'string'
        ? JSON.parse(settings.sale_discount_data || lp.sale_discount_data)
        : (settings.sale_discount_data || lp.sale_discount_data);
      if (sd?.discount || sd?.discount_percent || sd?.discount_percentage) {
        const discount = sd.discount || sd.discount_percent || sd.discount_percentage;
        const name = sd.title || sd.name || sd.sale_name || sd.discount_type || sd.type || sd.discount_name || "Sales";
        return { discount: Number(discount), name };
      }
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

  const getPolicyText = useCallback((lp: any) => {
    if (!lp) return "Verified Vendor";
    const settings = lp.policy_settings || {};
    const returnPol = settings.return_policy || {};
    const promoData = settings.promotions_data || lp.promotions_data || lp.promo_title;
    if (promoData) {
      if (typeof promoData === 'string' && promoData.length > 0) {
        try {
          const pd = JSON.parse(promoData);
          if (Array.isArray(pd) && pd.length > 0) return pd[0].title || "Special Offer";
        } catch { return promoData; }
      }
    }
    const saleData = settings.sale_discount_data || lp.sale_discount_data;
    if (saleData) {
      const sd = typeof saleData === 'string' ? JSON.parse(saleData) : saleData;
      if (sd?.discount || sd?.discount_percent) {
        return `${sd.discount || sd.discount_percent}% ${sd.title || "Discount"}`;
      }
    }
    if (settings.return_shipping_subsidy || returnPol.returnShippingSubsidy || lp.return_shipping_subsidy === 1) return "Return Shipping Subsidy";
    if (settings.seven_day_no_reason_return || returnPol.sevenDayNoReasonReturn || lp.seven_day_no_reason_return === 1) return "7-Days No-Reason Return";
    return null;
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

  const modalInlineStyle: React.CSSProperties | undefined =
    typeof window !== "undefined" && window.innerWidth >= 1024 && computedWidth
      ? { width: `${computedWidth}px` }
      : undefined;

  const modalContext: PostModalContext = {
    isMobileReels, videoPortHeight, showCommentsSheet, setShowCommentsSheet, currentReelIndex,
    fastScrollVelocityRef, dismissSwipeGuide, reelsList, setCurrentReelIndex, lastScrollTimeRef,
    handleVideoRegister, activeVideoRef, handleVideoEnded, handleToggleLike, postLiked, showBurst,
    postLikeCount, setCommentSheetEntryType, currentItem, setIsCommenting, isCommenting, modalZIndex,
    zIndex, showMentions, setShowMentions, isLoadingMentions, mentionsList, commentText, setCommentText,
    commentTextRef, reelTextareaRef, replyingTo, setReplyingTo, handleAddComment, fetchMentions,
    commentPosting, EMOJI_SHORTCUTS, commentsScrollRef, handleCommentsScroll, comments, formatDate,
    loadingComments, expandedParents, setExpandedParents, toggleLikeComment, burstingCommentId,
    hasMoreComments, isFetchingMore, commentSheetHeight, handleProductClick, formatUrl, desktopTextareaRef,
    setShowEmojiPicker, leftMediaRef, isLargeScreen, post, getNoteStyles, mediaList, currentMediaIndex,
    handleDoubleTap, activeHeartPops, swipeDirection, NO_IMAGE_PLACEHOLDER, isDraggingRef,
    setSwipeDirection, setCurrentMediaIndex, firstImageAspectRatio, setFirstImageAspectRatio,
    setViewerProfileUserId, setFullImageUrl, hydratedLinkedProducts, activePostId, getDiscountedPrice,
    getDiscountInfo, getPolicyText, getStockCount, auth, sheetTextareaRef, handleShareClick,
    commentSheetEntryType, isPostOwner, isFollowing, toggleFollowAuthor, followLoading,
    onClose, isPaused, setMenuPosition, setLongTappedPost, setShowLongTapMenu, handleTimeUpdate, showSwipeGuide,
    commentsError, isPreview, userManualPauseRef,
    computedWidth, computeAndSetModalWidth, isNavigating, setIsNavigating, pendingTransitionRef
  };


  if (!open || !portalTargetRef.current) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      ref={wrapperRef}
      className="fixed inset-0 flex items-center justify-center px-0 py-0"
      style={{ zIndex: zIndex || modalZIndex }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/55 cursor-pointer"
              aria-hidden
              onClick={onClose}
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
              className="relative z-10 w-full h-screen md:h-[94vh] bg-white flex flex-col overflow-hidden md:flex md:flex-row md:w-[96vw] md:max-w-[1100px] md:rounded-2xl min-h-[500px] sm:min-h-[600px] md:min-h-0"
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
                <header className="md:hidden flex-shrink-0 h-16 flex items-center justify-between px-2 p-3 bg-white border-b border-slate-100 z-30">
                  <div className="flex items-center gap-0">
                    <button onMouseDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Close" className="h-9 w-9  flex items-center justify-center" title="Close">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <div className="flex items-center min-w-0">
                      <Link
                        href={currentItem.author_handle ? `/${currentItem.author_handle}` : `/user/profile/${currentItem.user.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-shrink-0 active:scale-95 mr-2 transition-transform"
                      >
                        <img
                          src={currentItem.user?.avatar || ""}
                          alt={currentItem.user?.name || "Author"}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      </Link>
                      <div className="min-w-0">
                        <Link
                          href={currentItem.author_handle ? `/${currentItem.author_handle}` : `/user/profile/${currentItem.user.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[12px] text-black font-semibold hover:text-rose-500 transition-colors flex items-center gap-1 min-w-0"
                        >
                          <span className="truncate">{currentItem.user?.name || "Author"}</span>
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
                    <button onClick={(e) => { e.stopPropagation(); toggleFollowAuthor(); }} disabled={followLoading} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-shadow border-1 border-rose-500 text-rose-500">
                      Follow
                    </button>
                  )}
                </header>
              )}

              {isMobileReels ? (
                <MobileReelsView ctx={modalContext} />
              ) : (
                <StandardPostView ctx={modalContext} />
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
      {showEmojiPicker && (
        <EmojiPickerModal
          isOpen={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onSelect={(emoji) => {
            setCommentText(prev => prev + emoji);
            setShowEmojiPicker(false);
            // Re-focus the appropriate textarea
            if (isMobileReels) {
              reelTextareaRef.current?.focus();
            } else {
              desktopTextareaRef.current?.focus();
            }
          }}
        />
      )}
      {/* Global Navigation Loader Overlay */}
      {isNavigating && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-transparent pointer-events-none">
          <StoqleLoader size={50} />
        </div>
      )}
    </div>,
    document.body
  );
}
