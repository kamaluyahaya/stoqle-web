import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { XMarkIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { FaHeart, FaRegHeart } from 'react-icons/fa6';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import VerifiedBadge from '@/src/components/common/VerifiedBadge';
import LikeBurst from '@/src/components/common/LikeBurst';
import PostCommentComposer from './PostCommentComposer';
import CommentText from './CommentText';
import { PostModalContext } from '../types';

interface MobileReelsCommentSectionProps {
  ctx: PostModalContext;
}

export default function MobileReelsCommentSection({ ctx }: MobileReelsCommentSectionProps) {
  const {
    showCommentsSheet,
    setShowCommentsSheet,
    commentSheetHeight,
    currentItem,
    handleProductClick,
    formatUrl,
    comments,
    setIsCommenting,
    commentsScrollRef,
    handleCommentsScroll,
    commentSheetEntryType,
    formatDate,
    loadingComments,
    expandedParents,
    setExpandedParents,
    setReplyingTo,
    toggleLikeComment,
    burstingCommentId,
    hasMoreComments,
    isFetchingMore,
  } = ctx;

  return (
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
                      src={formatUrl(currentItem?.linked_product?.image_url || currentItem?.linked_product?.first_image || "")}
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
                    <img src={currentItem?.user?.avatar || currentItem?.author_pic || "https://via.placeholder.com/100x100?text=User"} className="w-full h-full object-cover" alt="author" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-slate-900">{currentItem?.user?.name || currentItem?.author_name || "Unknown"}</span>
                      {!!currentItem.verified_badge || !!currentItem.user?.is_partner || !!currentItem.linked_product?.verified_badge || !!currentItem.linked_product?.trusted_partner ? (
                        <VerifiedBadge size="xs" label="Trusted Partner" />
                      ) : !!currentItem.user?.is_trusted ? (
                        <CheckBadgeIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" title="Verified Account" />
                      ) : null}
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">Post Author</span>
                  </div>
                </div>

                <div className="space-y-2 px-1">
                  {(currentItem.caption || currentItem.subtitle || currentItem.note_caption) && (
                    <div className="text-[14px] text-slate-800 leading-relaxed">
                      {currentItem.caption && <div className="font-bold mb-0.5">{currentItem.caption}</div>}
                      {currentItem.subtitle && <div className="text-slate-500 text-sm">{currentItem.subtitle}</div>}
                      {!currentItem.caption && !currentItem.subtitle && currentItem.note_caption}
                    </div>
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
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100 ">Author</span>
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
                              alert("Viewing media: " + (meta.name || "Attachment"));
                            }}
                            className="mt-1 text-sm text-slate-600 whitespace-pre-wrap" 
                          />

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
                                    <span className="text-[9px] px-1 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100 ">Author</span>
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
                                  onLocationClick={(meta) => {
                                    if (meta.lat && meta.lng) {
                                      window.open(`https://www.google.com/maps/search/?api=1&query=${meta.lat},${meta.lng}`, '_blank');
                                    } else {
                                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meta.name || meta.address)}`, '_blank');
                                    }
                                  }}
                                  onMediaClick={(meta) => {
                                    alert("Viewing media: " + (meta.name || "Attachment"));
                                  }}
                                  className="mt-0.5 text-xs text-slate-600 whitespace-pre-wrap" 
                                />

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
            <PostCommentComposer ctx={ctx} isMobileMode={true} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
