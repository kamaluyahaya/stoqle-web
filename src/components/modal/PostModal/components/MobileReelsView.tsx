import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft, Search, Share2, MessageCircleMore } from 'lucide-react';
import { FaHeart, FaRegHeart } from 'react-icons/fa6';
import { XMarkIcon, FaceSmileIcon } from '@heroicons/react/24/outline';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import { createPortal } from 'react-dom';

import MobileVideoPlayer from '@/src/components/posts/mobileVideoPlayer';
import { CommentOverlay } from '@/src/components/modal/CommentOverlay';
import VolumeHUD from '@/src/components/common/VolumeHUD';
import VerifiedBadge from '@/src/components/common/VerifiedBadge';
import LikeBurst from '@/src/components/common/LikeBurst';
import CachedImage from '@/src/components/common/CachedImage';

import MobileReelsCommentSection from './MobileReelsCommentSection';
import { PostModalContext } from '../types';

interface MobileReelsViewProps {
  ctx: PostModalContext;
}

export default function MobileReelsView({ ctx }: MobileReelsViewProps) {
  const {
    videoPortHeight,
    showCommentsSheet,
    setShowCommentsSheet,
    currentReelIndex,
    fastScrollVelocityRef,
    dismissSwipeGuide,
    reelsList,
    setCurrentReelIndex,
    lastScrollTimeRef,
    handleVideoRegister,
    handleVideoEnded,
    activePostId,
    activeHeartPops,
    handleDoubleTap,
    showSwipeGuide,
    onClose,
    isPaused,
    setMenuPosition,
    setLongTappedPost,
    setShowLongTapMenu,
    handleTimeUpdate,
    handleShareClick,
    isPostOwner,
    isFollowing,
    toggleFollowAuthor,
    followLoading,
    setCommentSheetEntryType,
    hydratedLinkedProducts,
    handleProductClick,
    getStockCount,
    formatUrl,
    getDiscountedPrice,
    getPolicyText,
    setIsCommenting,
    handleToggleLike,
    showBurst,
    postLiked,
    postLikeCount,
    currentItem,
    isCommenting,
    zIndex,
    modalZIndex,
    showMentions,
    setShowMentions,
    isLoadingMentions,
    mentionsList,
    commentText,
    setCommentText,
    commentTextRef,
    reelTextareaRef,
    replyingTo,
    setReplyingTo,
    fetchMentions,
    handleAddComment,
    commentPosting,
    EMOJI_SHORTCUTS,
    desktopTextareaRef,
    setShowEmojiPicker,
    setIsNavigating,
    pendingTransitionRef
  } = ctx;

  const router = useRouter();
  const [showTransitionLoader, setShowTransitionLoader] = useState(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whenever the currentReelIndex changes, dismiss the transition loader immediately
  // (the swipe completed — the new reel is being shown)
  const prevReelIndexRef = useRef(currentReelIndex);
  useEffect(() => {
    if (prevReelIndexRef.current !== currentReelIndex) {
      prevReelIndexRef.current = currentReelIndex;
      // Clear any pending loaders — the swipe succeeded
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      if (transitionHideTimerRef.current) clearTimeout(transitionHideTimerRef.current);
      setShowTransitionLoader(false);
    }
  }, [currentReelIndex]);

  // Helper: show the transition loader for up to 3s, then auto-hide
  const triggerTransitionLoader = useCallback((nextIndex: number, totalCount: number) => {
    if (nextIndex < 0 || nextIndex >= totalCount) return;
    // Check if next video element is ready (readyState >= 2 = HAVE_CURRENT_DATA)
    // We can't directly query MobileVideoPlayer's ref here, so we poll via a short delay
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    if (transitionHideTimerRef.current) clearTimeout(transitionHideTimerRef.current);

    setShowTransitionLoader(true);

    // Auto-hide after 3 seconds max
    transitionHideTimerRef.current = setTimeout(() => {
      setShowTransitionLoader(false);
    }, 3000);
  }, []);

  const handleProfileNavigation = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (setIsNavigating) setIsNavigating(true);
    // Restore the clean page URL before pushing the profile route so that
    // pressing Back from the profile returns to the correct page (not a stale
    // post/product URL that the modal may have pushed via pushState).
    try {
      const cleanUrl = window.location.pathname.replace(/\/(product|post)\/[^/]+/, '');
      window.history.replaceState(null, '', cleanUrl || '/');
    } catch { }
    router.push(href);
  };

  return (
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
                  triggerTransitionLoader(currentReelIndex + 1, reelsList.length);
                  setCurrentReelIndex(prev => prev + 1);
                } else {
                  // No more reels — trigger prefetch and show brief loader
                  window.dispatchEvent(new CustomEvent("trigger-reel-prefetch"));
                }
              } else {
                // SWIPE DOWN -> PREV REEL
                if (currentReelIndex > 0) {
                  triggerTransitionLoader(currentReelIndex - 1, reelsList.length);
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
                  triggerTransitionLoader(currentReelIndex + 1, reelsList.length);
                  setCurrentReelIndex(prev => prev + 1);
                }
              } else {
                if (currentReelIndex > 0) {
                  triggerTransitionLoader(currentReelIndex - 1, reelsList.length);
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
                        isActive={isVisible}
                        onLongPress={(e: React.MouseEvent | React.TouchEvent) => {
                          if ('clientX' in e) {
                            setMenuPosition({ x: e.clientX, y: e.clientY });
                          } else {
                            setMenuPosition(null);
                          }
                          setLongTappedPost(rp);
                          setShowLongTapMenu(true);
                        }}
                        src={rp.final_video_url || rp.src || rp.original_video_url || rp.video_url}
                        poster={rp.thumbnail}
                        loop={true}
                        onRegisterRef={(el) => {
                          handleVideoRegister(el, isVisible);
                          // If this video becomes ready and it's the next one being transitioned to, dismiss loader
                          if (el && isVisible && showTransitionLoader) {
                            if (el.readyState >= 2) {
                              setShowTransitionLoader(false);
                              if (transitionHideTimerRef.current) clearTimeout(transitionHideTimerRef.current);
                            } else {
                              el.addEventListener('canplay', () => {
                                setShowTransitionLoader(false);
                                if (transitionHideTimerRef.current) clearTimeout(transitionHideTimerRef.current);
                              }, { once: true });
                            }
                          }
                        }}
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
                              <Link 
                                href={rp.author_handle ? `/${rp.author_handle}` : `/user/profile/${rp.user?.id || rp.user_id || rp.author_id}`} 
                                onClick={(e) => handleProfileNavigation(e, rp.author_handle ? `/${rp.author_handle}` : `/user/profile/${rp.user?.id || rp.user_id || rp.author_id}`)}
                                className="w-10 h-10 rounded-full border border-white/20 overflow-hidden bg-slate-800 shrink-0"
                              >
                                <img src={rp.user?.avatar || rp.author_pic || "https://via.placeholder.com/100x100?text=User"} className="w-full h-full object-cover" alt="author" />
                              </Link>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1 min-w-0">
                                    <Link
                                      href={rp.author_handle ? `/${rp.author_handle}` : `/user/profile/${rp.user?.id || rp.user_id || rp.author_id}`}
                                      onClick={(e) => handleProfileNavigation(e, rp.author_handle ? `/${rp.author_handle}` : `/user/profile/${rp.user?.id || rp.user_id || rp.author_id}`)}
                                      className="text-sm font-black text-white shadow-sm truncate hover:text-rose-400 transition-colors"
                                    >
                                    {rp.user?.name || rp.author_name || "Unknown"}
                                  </Link>
                                  {!!rp.verified_badge || !!rp.user?.is_partner || !!rp.linked_product?.verified_badge || !!rp.linked_product?.trusted_partner ? (
                                    <VerifiedBadge size="xs" label="Trusted Partner" className="drop-shadow-sm" />
                                  ) : !!rp.user?.is_trusted ? (
                                    <CheckBadgeIcon className="w-4 h-4 text-blue-500 shrink-0 drop-shadow-sm" title="Verified Account" />
                                  ) : null}
                                </div>
                              </div>
                              {!isPostOwner && !isFollowing && (
                                <button onClick={(e) => { e.stopPropagation(); toggleFollowAuthor(); }} disabled={followLoading} className="px-2.5 py-1 bg-rose-500 rounded-full text-[10px] font-black text-white ml-1 active:scale-90 transition-transform">Follow</button>
                              )}
                            </div>

                            {(rp.caption || rp.subtitle || rp.note_caption) && (
                              <div
                                className="max-w-[90%] -mt-0.5"
                              >
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCommentSheetEntryType("caption");
                                    setShowCommentsSheet(true);
                                  }}
                                  className="text-white text-sm font-medium line-clamp-2 drop-shadow-lg cursor-pointer active:opacity-70 transition-opacity"
                                >
                                  {rp.caption && <span className="font-bold">{rp.caption}</span>}
                                  {rp.caption && rp.subtitle && <span className="text-white/60"> </span>}
                                  {rp.subtitle && <span className="font-medium text-white/90 text-xs">{rp.subtitle}</span>}
                                  {!rp.caption && !rp.subtitle && rp.note_caption}
                                </div>
                                {/* Show 'More' if combined text is long enough to overflow 2 lines */}
                                {((rp.caption?.length || 0) + (rp.subtitle?.length || 0) > 80 || (rp.caption && rp.subtitle)) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCommentSheetEntryType("caption");
                                      setShowCommentsSheet(true);
                                    }}
                                    className="text-white/50 text-[11px] font-semibold mt-0.5 hover:text-white transition-colors active:opacity-70"
                                  >
                                    More
                                  </button>
                                )}
                              </div>
                            )}

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

        {/* TRANSITION LOADER OVERLAY: Shows briefly when swiping to a video that isn't buffered yet */}
        <AnimatePresence>
          {showTransitionLoader && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-[75] flex items-center justify-center pointer-events-none"
            >
              <div className="flex flex-col items-center gap-3">
                {/* Chasing segments spinner matching StoqleLoader style */}
                <svg viewBox="0 0 36 36" className="w-10 h-10 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]">
                  <motion.circle
                    cx="18" cy="18" r="14"
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="50 38"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                    style={{ transformOrigin: "18px 18px" }}
                  />
                  <motion.circle
                    cx="18" cy="18" r="14"
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="20 68"
                    strokeDashoffset={25}
                    animate={{ rotate: [360, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                    style={{ transformOrigin: "18px 18px", opacity: 0.5 }}
                  />
                </svg>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
            className="bg-black border-t border-white/10 flex flex-col px-4 pt-2 pb-2 shrink-0 z-50 pointer-events-auto"
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)"
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCommenting(true);
                  }}
                  className="w-full h-9 bg-white/10 hover:bg-white/15 rounded-full px-4 flex items-center gap-2 transition-colors border border-white/5"
                >
                  <MessageCircleMore className="w-3.5 h-3.5 text-white/40" />
                  <span className="text-[11px] text-white/50 font-medium">Say something...</span>
                </button>
              </div>

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
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) {
                setIsCommenting(false);
              }
            }}
            onTouchStart={(e) => {
              if (e.target === e.currentTarget) {
                setIsCommenting(false);
              }
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setIsCommenting(false);
              }
            }}
          />
          {/* Bottom Panel — blocks ALL touch/click from reaching backdrop */}
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-zinc-900 border-t border-white/10 px-4 py-4 pointer-events-auto w-full z-10"
            style={{
              paddingBottom: "var(--kb-pad, env(safe-area-inset-bottom, 24px))",
              transform: 'translateZ(0)',
              WebkitFontSmoothing: 'antialiased'
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-4">
              {showMentions && (
                <div className="relative">
                  <div className="absolute bottom-2 left-0 w-full bg-zinc-800 border border-white/10 z-[110] max-h-[220px] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-2 duration-200">
                    <div className="p-2.5 border-b border-white/5 sticky top-0 bg-zinc-800/90 backdrop-blur-md flex items-center justify-between">
                      <button onClick={() => setShowMentions(false)} className="text-white/40 p-1 hover:text-white transition-colors"><XMarkIcon className="w-3.5 h-3.5" /></button>
                    </div>
                    {isLoadingMentions ? (
                      <div className="p-8 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : mentionsList.length === 0 ? (
                      <div className="p-8 text-center text-white/40 text-xs font-medium italic">No followers or following found</div>
                    ) : (
                      <div className="py-1">
                        {mentionsList.map((u: any) => (
                          <button
                            key={u.user_id || u.id}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              const mention = `@${u.user_name || u.name} `;
                              setCommentText(prev => prev + mention);
                              commentTextRef.current += mention;
                              reelTextareaRef.current?.focus();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors active:bg-white/10 text-left"
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-white/5 flex-shrink-0">
                              <CachedImage
                                src={formatUrl(u.profile_picture || u.logo)}
                                alt={u.user_name || u.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[13px] font-bold text-white truncate">{u.user_name || u.name}</span>
                              <span className="text-[10px] text-white/50 font-medium truncate">@{u.user_name || u.name}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                placeholder={replyingTo ? `Replying to ${(replyingTo as any).author_name || (replyingTo as any).user_name || 'someone'}...` : "Say something..."}
                className="w-full bg-white/5 rounded-xl px-5 py-2 text-[14px] text-white outline-none border border-white/10 resize-none overflow-hidden leading-snug"
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 px-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!showMentions) fetchMentions();
                      setShowMentions(!showMentions);
                    }}
                    className={`p-1.5 rounded-full transition-all active:scale-90 ${showMentions ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' : 'text-white/40 hover:bg-white/10'}`}
                    title="Mention someone"
                  >
                    <span className="text-lg font-black leading-none px-0.5">@</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEmojiPicker(true);
                    }}
                    className="p-1.5 rounded-full text-white/40 hover:bg-white/10 transition-all active:scale-90"
                    title="Add emoji"
                  >
                    <FaceSmileIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsCommenting(false);
                      setShowMentions(false);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCommenting(false);
                      setShowMentions(false);
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
              {/* Emoji Shortcuts */}
              <div
                className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 no-scrollbar"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
              >
                {EMOJI_SHORTCUTS.slice(0, 10).map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const newText = commentText + emoji;
                      setCommentText(newText);
                      commentTextRef.current = newText;
                      reelTextareaRef.current?.focus();
                    }}
                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 transition-all text-xl text-white"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEmojiPicker(true);
                  }}
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 transition-all text-white/50"
                  title="Show more emojis"
                >
                  <FaceSmileIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>,
        document.body
      )}
      <MobileReelsCommentSection ctx={ctx} />
    </div>
  );
}
