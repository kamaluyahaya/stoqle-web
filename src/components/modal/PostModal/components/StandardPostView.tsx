import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { EyeIcon, ArrowUpRightFromSquareIcon } from 'lucide-react';
import { FaHeart, FaRegHeart } from 'react-icons/fa6';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';

import LargeScreenVideoPlayer from '@/src/components/posts/largeScreenVideoPlayer';
import VerifiedBadge from '@/src/components/common/VerifiedBadge';
import LikeBurst from '@/src/components/common/LikeBurst';
import CachedImage from '@/src/components/common/CachedImage';
import CommentText from './CommentText';

import { PostModalContext } from '../types';
import { getNoteStyles } from '@/src/components/common/PostCard';
import PostCommentComposer from './PostCommentComposer';

interface StandardPostViewProps {
  ctx: PostModalContext;
}

export default function StandardPostView({ ctx }: StandardPostViewProps) {
  const {
    leftMediaRef,
    isLargeScreen,
    post,
    activeHeartPops,
    handleVideoRegister,
    setMenuPosition,
    setLongTappedPost,
    setShowLongTapMenu,
    isPaused,
    firstImageAspectRatio,
    mediaList,
    NO_IMAGE_PLACEHOLDER,
    swipeDirection,
    currentMediaIndex,
    isDraggingRef,
    setSwipeDirection,
    setCurrentMediaIndex,
    setFirstImageAspectRatio,
    setViewerProfileUserId,
    setFullImageUrl,
    handleDoubleTap,
    currentItem,
    isPostOwner,
    isFollowing,
    toggleFollowAuthor,
    followLoading,
    formatDate,
    hydratedLinkedProducts,
    activePostId,
    handleProductClick,
    formatUrl,
    getDiscountedPrice,
    getDiscountInfo,
    getStockCount,
    getPolicyText,
    comments,
    setIsCommenting,
    desktopTextareaRef,
    sheetTextareaRef,
    auth,
    loadingComments,
    commentsError,
    expandedParents,
    setReplyingTo,
    setCommentText,
    commentText,
    toggleLikeComment,
    burstingCommentId,
    setExpandedParents,
    isPreview,
    replyingTo,
    handleToggleLike,
    postLiked,
    showBurst,
    postLikeCount,
    handleShareClick,
    computeAndSetModalWidth,
    setIsNavigating
  } = ctx;
  const router = useRouter();

  const handleProfileNavigation = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (setIsNavigating) setIsNavigating(true);
    router.push(href);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-hidden">
        {/* LEFT: media side of the standard modal layout */}
        <div
          ref={leftMediaRef}
          className={`min-w-0 w-full flex flex-col border-r border-slate-200 relative group/media bg-slate-50 ${isLargeScreen ? "md:flex-1 items-center justify-between md:min-h-0" : "h-auto"}`}
        >
          {post.coverType === "note" && !post.src ? (
            <div className={`w-full flex items-center justify-center p-6 border border-slate-200 relative ${isLargeScreen ? "h-full" : "h-[65vh]"}`} style={getNoteStyles(post.noteConfig)}>
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
            <div className={`relative w-full ${isLargeScreen ? "flex-1 flex items-center justify-center overflow-hidden" : "h-auto"}`}>
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
                  className="absolute inset-0 bg-white cursor-pointer"
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
                    onLoadedMetadata={(w, h) => {
                      if (isLargeScreen) computeAndSetModalWidth(w, h);
                    }}
                    userManualPause={isPaused}
                  />
                </div>
              ) : (
                <>
                  <div
                    className={`${isLargeScreen ? "absolute inset-0" : "relative w-full h-auto max-h-[65vh] overflow-hidden"} bg-white cursor-pointer flex items-center justify-center`}
                    style={!isLargeScreen && firstImageAspectRatio && mediaList.length > 1 ? { aspectRatio: `${firstImageAspectRatio}` } : {}}
                    onClick={(e) => handleDoubleTap(e, { disableSingleTapPause: true })}
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
                    <AnimatePresence initial={false} custom={swipeDirection} mode="popLayout">
                      <CachedImage
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
                        onDragStart={() => {
                          isDraggingRef.current = true;
                        }}
                        onDragEnd={(e, info) => {
                          // Delay resetting isDragging to ensure tap handler doesn't catch it
                          setTimeout(() => {
                            isDraggingRef.current = false;
                          }, 100);

                          const swipeThreshold = 50;
                          if (info.offset.x < -swipeThreshold) {
                            setSwipeDirection(1);
                            setCurrentMediaIndex((prev) => (prev < mediaList.length - 1 ? prev + 1 : 0));
                          } else if (info.offset.x > swipeThreshold) {
                            setSwipeDirection(-1);
                            setCurrentMediaIndex((prev) => (prev > 0 ? prev - 1 : mediaList.length - 1));
                          }
                        }}
                        onLoad={(e) => {
                          if (currentMediaIndex === 0 && !firstImageAspectRatio) {
                            const img = e.currentTarget;
                            if (img.naturalWidth && img.naturalHeight) {
                              setFirstImageAspectRatio(img.naturalWidth / img.naturalHeight);
                              if (isLargeScreen) {
                                computeAndSetModalWidth(img.naturalWidth, img.naturalHeight);
                              }
                            }
                          }
                        }}
                        onTap={() => {
                          if (isDraggingRef.current) return;
                          setViewerProfileUserId(undefined);
                          setFullImageUrl(mediaList[currentMediaIndex]);
                        }}
                        className={`${isLargeScreen ? "w-auto h-auto object-cover" : "w-full h-full max-h-[65vh] object-contain block"} cursor-zoom-in active:cursor-grabbing touch-none`}
                      />
                    </AnimatePresence>
                  </div>
                </>
              )}

            </div>

          )}
          {/* Pagination dots floating on top of the left media panel */}
          {mediaList.length > 1 && !post.isVideo && isLargeScreen && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center z-[20] pointer-events-none w-full">
              <div className="flex gap-1.5 px-3 py-1.5 bg-black/20 backdrop-blur-md rounded-full border border-white/10 shadow-lg">
                {mediaList.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentMediaIndex
                      ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                      : "bg-white/40"
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
                src={currentItem?.user?.avatar || currentItem?.author_pic || "https://via.placeholder.com/100x100?text=User"}
                alt={currentItem?.user?.name || currentItem?.author_name || "author"}
                className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
                onClick={(e) => { e.stopPropagation(); setFullImageUrl(currentItem?.user?.avatar || currentItem?.author_pic || null); setViewerProfileUserId(currentItem?.user?.id || currentItem?.user_id || currentItem?.author_id); }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={currentItem?.author_handle ? `/${currentItem.author_handle}` : `/user/profile/${currentItem?.user?.id || currentItem?.user_id || currentItem?.author_id}`}
                    onClick={(e) => handleProfileNavigation(e, currentItem?.author_handle ? `/${currentItem.author_handle}` : `/user/profile/${currentItem?.user?.id || currentItem?.user_id || currentItem?.author_id}`)}
                    className="text-base font-semibold text-slate-900 truncate hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    {currentItem?.user?.name || currentItem?.author_name || "Unknown"}
                  </Link>
                  {!!currentItem?.verified_badge || !!currentItem?.user?.is_partner || !!currentItem?.linked_product?.verified_badge || !!currentItem?.linked_product?.trusted_partner ? (
                    <VerifiedBadge size="sm" label="Trusted Partner" />
                  ) : !!currentItem?.user?.is_trusted ? (
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
              {/* Mobile Image Pagination Dots - Positioned at the TOP of details */}
              {!isLargeScreen && mediaList.length > 1 && !post.isVideo && (
                <div className="mb-4 flex items-center justify-center">
                  <div className="flex gap-1.5">
                    {mediaList.map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentMediaIndex ? "bg-rose-500" : "bg-slate-300"}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {currentItem.coverType === "note" && !currentItem.src ? (
                <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed font-semibold mb-2">
                  {currentItem.note_caption || currentItem.caption}
                </p>
              ) : (
                <div className="mb-3">
                  {currentItem.caption && (
                    <p className="text-sm text-slate-900 leading-relaxed font-bold mb-1">
                      {currentItem.caption}
                    </p>
                  )}
                  {currentItem.subtitle && (
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      {currentItem.subtitle}
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{formatDate(currentItem.rawCreatedAt)}</span>
                {currentItem.location && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] opacity-40">•</span>
                    <div className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500">
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
              <div className="flex items-center justify-between text-slate-600">
                <span className="lg:text-md text-[13px]">{comments.length} comment(s)</span>
              </div>
              <div
                className="flex items-center gap-3 mt-3 mb-8 cursor-pointer"
                onClick={() => {
                  setIsCommenting(true);
                  setTimeout(() => {
                    desktopTextareaRef.current?.focus();
                    sheetTextareaRef.current?.focus();
                  }, 100);
                }}
              >
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border-2 border-slate-100 shadow-sm bg-white">
                  <img
                    src={auth?.user?.profile_pic ? formatUrl(auth.user.profile_pic) : "/assets/images/favio.png"}
                    alt="Me"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 bg-slate-50 p-2 px-4 rounded-full border border-slate-100 text-[13px] text-slate-400 font-medium hover:bg-slate-100 transition-all active:scale-[0.98]">
                  Share your thoughts...
                </div>
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
                  <img src="/assets/images/message-icons.png" alt="No comments" className="lg:w-30 w-20 opacity-50" />
                  <div className="text-xs text-slate-400 text-center">No comments yet — be the first.</div>
                </div>
              ) : (
                (() => {
                  const uniqueComments = Array.from(new Map(comments.map(c => [String(c.comment_id), c])).values());
                  const mainComments = uniqueComments.filter(c => !c.parent_id);
                  const replies = uniqueComments.filter(c => c.parent_id);

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
                            onClick={(e) => handleProfileNavigation(e, c.author_handle ? `/${c.author_handle}` : `/user/profile/${c.user_id}`)}
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
                                  onClick={(e) => handleProfileNavigation(e, c.author_handle ? `/${c.author_handle}` : `/user/profile/${c.user_id}`)}
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
                                <span className="text-[10px] inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100 ">Author</span>
                              )}
                            </div>

                            <CommentText
                              content={c.comment_content}
                              metadata={c.metadata}
                              onPostClick={(id, meta) => {
                                if (meta?.handle && Number(id) >= 30000000000) {
                                  window.location.href = `/${meta.handle}/${id}`;
                                } else {
                                  window.location.href = `/discover?post=${id}`;
                                }
                              }}
                              onProductClick={(id) => ctx.handleProductClick(id as number)}
                              onLocationClick={(meta) => {
                                if (meta.lat && meta.lng) {
                                  window.open(`https://www.google.com/maps/search/?api=1&query=${meta.lat},${meta.lng}`, '_blank');
                                } else {
                                  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meta.name || meta.address)}`, '_blank');
                                }
                              }}
                              onMediaClick={(meta) => {
                                // For now, just show a toast or alert if it's a temp media
                                alert("Viewing media: " + (meta.name || "Attachment"));
                              }}
                              className="mt-1 text-sm text-slate-600 mb-1"
                            />

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
                                  <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100 text-[10px] transition-all hover:bg-slate-100 cursor-default">
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
                                      onClick={(e) => handleProfileNavigation(e, r.author_handle ? `/${r.author_handle}` : `/user/profile/${r.user_id}`)}
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
                                          onClick={(e) => handleProfileNavigation(e, r.author_handle ? `/${r.author_handle}` : `/user/profile/${r.user_id}`)}
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
                                          <span className="text-[9px] inline-flex items-center px-1 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100 ">Author</span>
                                        )}
                                      </div>

                                      <CommentText
                                        content={r.comment_content}
                                        metadata={r.metadata}
                                        onPostClick={(id, meta) => {
                                if (meta?.handle && Number(id) >= 30000000000) {
                                  window.location.href = `/${meta.handle}/${id}`;
                                } else {
                                  window.location.href = `/discover?post=${id}`;
                                }
                              }}
                                        onProductClick={(id) => ctx.handleProductClick(id as number)}
                                        className="mt-0.5 text-xs text-slate-600 whitespace-pre-wrap mb-1"
                                      />

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

              {comments.length > 0 && <div className="text-center text-slate-300 font-Medium text-[10px] mt- mb-10">-THE END-</div>}
            </div>
          </div>

        </div>

        {!isPreview && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="md:absolute fixed right-0 md:w-[400px] w-full bg-white border-l border-t border-slate-200 z-[100] p-2 md:p-4"
            style={{
              bottom: isLargeScreen ? "0px" : "var(--kb-pad, 0px)"
            }}
          >
            <PostCommentComposer
              ctx={ctx}
              isMobileMode={false}
              desktopPlaceholderActions={
                <>
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
                </>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
