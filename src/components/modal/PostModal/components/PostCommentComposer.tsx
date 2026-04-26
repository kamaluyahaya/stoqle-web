import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaceSmileIcon, } from '@heroicons/react/24/outline';
import CachedImage from '@/src/components/common/CachedImage';
import { PostModalContext } from '../types';
import { MessageCircleMore, ArrowUpRightFromSquareIcon } from 'lucide-react';

interface PostCommentComposerProps {
  ctx: PostModalContext;
  isMobileMode?: boolean;
  desktopPlaceholderActions?: React.ReactNode;
}

export default function PostCommentComposer({ ctx, isMobileMode, desktopPlaceholderActions }: PostCommentComposerProps) {
  const {
    isCommenting,
    setIsCommenting,
    replyingTo,
    showMentions,
    setShowMentions,
    isLoadingMentions,
    mentionsList,
    commentText,
    setCommentText,
    commentTextRef,
    desktopTextareaRef,
    reelTextareaRef,
    fetchMentions,
    handleAddComment,
    commentPosting,
    EMOJI_SHORTCUTS,
    setShowEmojiPicker,
    formatUrl,
    comments,
    currentItem,
  } = ctx;

  const textareaRef = isMobileMode ? reelTextareaRef : desktopTextareaRef;

  const hasProduct = currentItem?.linked_product || currentItem?.is_product_linked;
  const noComments = (comments || []).length === 0;

  const activePlaceholder = replyingTo
    ? `Replying to ${replyingTo.author_name || replyingTo.user_name || 'someone'}...`
    : hasProduct
      ? "Like it? Comment for more details!"
      : noComments
        ? "Be the first to comments"
        : "Share your thoughts";

  return (
    <AnimatePresence mode="wait">
      {isCommenting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              setIsCommenting(false);
              setShowMentions(false);
            }
          }}
          className={`fixed inset-0 z-[${isMobileMode ? '40' : '90'}] bg-transparent`}
        />
      )}
      {isCommenting ? (
        <motion.div
          key={isMobileMode ? "sheet-comment-input-active" : "active-comment-input"}
          initial={{ opacity: 0, y: isMobileMode ? 5 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: isMobileMode ? 5 : 10 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className={`relative ${isMobileMode ? 'z-50 p-1' : 'z-[100]'} space-y-3 pointer-events-auto bg-white`}
        >
          {showMentions && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full bg-white border border-slate-100 rounded-2xl shadow-xl z-[110] max-h-[160px] overflow-hidden"
            >
              {isLoadingMentions ? (
                <div className="flex gap-4 px-4 py-4 overflow-hidden">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex flex-col items-center gap-2 shrink-0 animate-pulse">
                      <div className="w-12 h-12 rounded-full bg-slate-100 shadow-inner" />
                      <div className="w-14 h-2 rounded-full bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : mentionsList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium italic">No followers or following found</div>
              ) : (
                <div className="flex overflow-x-auto gap-3 px-3 py-4 no-scrollbar snap-x">
                  {mentionsList.map((u: any) => {
                    const mentionStr = `@${u.full_name || u.business_name || u.user_name || u.name} `;
                    const isSelected = commentText.includes(mentionStr);
                    return (
                      <button
                        key={u.user_id || u.id}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelected) {
                            setCommentText(prev => prev.replace(mentionStr, ''));
                            commentTextRef.current = commentTextRef.current.replace(mentionStr, '');
                          } else {
                            setCommentText(prev => prev + mentionStr);
                            commentTextRef.current += mentionStr;
                          }
                          textareaRef.current?.focus();
                        }}
                        className="flex flex-col items-center gap-1.5 p-1 min-w-[72px] max-w-[80px] snap-center rounded-2xl transition-all duration-200"
                      >
                        <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white bg-slate-50 flex-shrink-0 shadow-sm transition-transform active:scale-95">
                          <CachedImage
                            src={formatUrl(u.profile_pic || u.business_logo || u.logo || u.profile_picture)}
                            alt={u.full_name || u.business_name || u.user_name || u.name}
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-blue-500/30 backdrop-blur-[1px] flex items-center justify-center animate-in fade-in zoom-in duration-200">
                              <div className="bg-blue-600 rounded-full p-1 shadow-lg transform scale-110">
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-center min-w-0 w-full text-center">
                          <span className={`text-[11px] font-bold truncate w-full transition-colors ${isSelected ? 'text-blue-600' : 'text-slate-800'}`}>
                            {u.full_name || u.business_name || u.user_name || u.name}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
          <div className="relative w-full">
            <div
              className={`absolute inset-0 px-4 ${isMobileMode ? 'py-3' : 'py-3'} lg:text-[12px] text-[10px] sm:text-[8px] leading-tight pointer-events-none whitespace-pre-wrap break-words text-transparent`}
              aria-hidden="true"
            >
              {commentText.split(/(@[^@\n]+?(?:\s|$))/g).map((part, i) =>
                part.startsWith('@') ? <span key={i} className="text-blue-500 font-bold bg-blue-50/50 px-0.5 rounded-sm">{part}</span> : part
              )}
            </div>
            <textarea
              id={isMobileMode ? "sheet-comment-input-active" : "desktop-comment-input-active"}
              autoFocus
              ref={textareaRef}
              rows={2}
              value={commentText}
              onChange={(e) => {
                const val = e.target.value;
                setCommentText(val);
                commentTextRef.current = val;
                const el = e.target;
                el.style.height = 'auto';
                el.style.height = Math.max(isMobileMode ? 40 : 48, Math.min(el.scrollHeight, 120)) + 'px';
                el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden';

                if (showMentions && !val.endsWith('@')) setShowMentions(false);
                if (!showMentions && val.endsWith('@')) {
                  setShowMentions(true);
                  fetchMentions();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const text = commentText.trim();
                  if (text) {
                    handleAddComment(text);
                    setIsCommenting(false);
                  }
                }
              }}
              placeholder={activePlaceholder}
              className={`w-full rounded-xl bg-slate-100 text-slate-800  px-4 py-2 text-sm font-medium outline-none transition focus:ring-1 ${isMobileMode ? 'focus:ring-slate-200' : 'focus:ring-gray-300'} resize-none overflow-hidden leading-tight`}
              onMouseDown={(e) => !isMobileMode && e.stopPropagation()}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 px-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!showMentions) fetchMentions();
                  setShowMentions(!showMentions);
                }}
                className={`p-1.5 rounded-full transition-all active:scale-90 ${showMentions ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' : 'text-slate-400 hover:bg-slate-100'}`}
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
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 transition-all active:scale-90"
                title="Add emoji"
              >
                <FaceSmileIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCommenting(false);
                  if (isMobileMode && ctx.setReplyingTo) ctx.setReplyingTo(null);
                  setShowMentions(false);
                }}
                className={`px-4 py-2 rounded-full ${isMobileMode ? 'text-xs font-bold text-slate-500 bg-slate-50 border border-slate-100' : 'text-sm text-slate-600 hover:bg-slate-100'}`}
              >
                Cancel
              </button>

              <button
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const text = commentText.trim();
                  if (!text) return;
                  handleAddComment(text);
                  setIsCommenting(false);
                  setShowMentions(false);
                }}
                disabled={commentPosting || !commentText.trim()}
                className={`${isMobileMode ? 'px-6 py-2 bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-500/20 active:scale-95 disabled:opacity-40 disabled:grayscale transition-all' : 'h-7 flex px-4 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:brightness-105 active:scale-95 text-sm disabled:opacity-50 disabled:grayscale transition-all'}`}
                title="Send comment"
              >
                {commentPosting ? (
                  isMobileMode ? "Sending..." : (
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-20" fill="none" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                    </svg>
                  )
                ) : (
                  isMobileMode ? "Post" : "Send"
                )}
              </button>
            </div>
          </div>
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className={`flex items-center gap-2 overflow-x-auto ${isMobileMode ? 'py-2 px-0.5' : 'py-1 px-0.5'} no-scrollbar`}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {EMOJI_SHORTCUTS.slice(0, isMobileMode ? EMOJI_SHORTCUTS.length : 10).map((emoji) => (
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
                  textareaRef.current?.focus();
                }}
                className={`flex-shrink-0 w-8 h-8 flex items-center justify-center active:scale-90 transition-all text-lg ${isMobileMode ? 'hover:bg-slate-100 rounded-full' : 'rounded-full bg-slate-100 hover:bg-slate-200'}`}
              >
                {emoji}
              </button>
            ))}
            {!isMobileMode && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmojiPicker(true);
                }}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 active:scale-90 transition-all text-slate-500"
                title="Show more emojis"
              >
                <FaceSmileIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      ) : (
        isMobileMode ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCommenting(true);
            }}
            className="w-full rounded-full bg-slate-100 px-5 py-3 text-[14px] font-medium text-slate-400 cursor-text flex items-center justify-between transition-colors hover:bg-slate-200/50"
          >
            <span>{replyingTo ? activePlaceholder : "Add a comment..."}</span>
          </button>
        ) : (
          <motion.div
            key="comment-input-placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3"
          >
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
              {desktopPlaceholderActions}
            </div>
          </motion.div>
        )
      )}
    </AnimatePresence>
  );
}

