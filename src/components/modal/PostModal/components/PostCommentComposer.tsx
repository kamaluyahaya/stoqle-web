import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Smile,
  AtSign,
  MessageCircleMore,
  Keyboard
} from "lucide-react";
import CachedImage from '@/src/components/common/CachedImage';
import { PostModalContext } from '../types';
import ComposerAttachmentsModal from './ComposerAttachmentsModal';
import AttachmentPostsModal from './AttachmentPostsModal';
import AttachmentProductsModal from './AttachmentProductsModal';
import AttachmentLocationModal from './AttachmentLocationModal';
import AttachmentMediaModal from './AttachmentMediaModal';

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
    registerMention,
    enrichTextWithSlugs,
    isFetchingMoreMentions,
    hasMoreMentions,
    currentQuery,
    setShowEmojiPicker,
    commentPosting,
    EMOJI_SHORTCUTS,
    comments,
    formatUrl,
    currentItem,
    showAttachmentsModal,
    setShowAttachmentsModal,
    activeAttachmentModal,
    setActiveAttachmentModal,
  } = ctx;

  const mirrorRef = useRef<HTMLDivElement>(null);
  const metadataRef = useRef<any[]>([]);
  const textareaRef = isMobileMode ? (reelTextareaRef as any) : (desktopTextareaRef as any);

  const handleEnrichedSubmit = (text?: string) => {
    const rawText = text ?? commentTextRef.current ?? commentText;
    // We enrich first, then trim whitespace from the resulting format
    // This preserves the internal ZWSP characters needed for detection
    const enriched = enrichTextWithSlugs(rawText);
    const final = enriched?.trim();

    if (final) {
      // Robust normalization helper for filtering
      const normalizeForFilter = (s: string) => s.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
      const normFinal = normalizeForFilter(final);

      // Only send metadata for tokens that are actually present in the text
      const filteredMetadata = (metadataRef.current || []).filter(meta => {
        if (!meta.display) return false;
        return normFinal.includes(normalizeForFilter(meta.display));
      });
      
      handleAddComment(final, filteredMetadata);
      setIsCommenting(false);
      setShowMentions(false);
      setShowAttachmentsModal?.(false);
      metadataRef.current = [];
    }
  };

  const handleInsertToken = (token: string, metadata: any) => {
    const val = commentText;
    const spacer = val && !val.endsWith(' ') ? ' ' : '';
    const newText = val + spacer + token + " ";
    setCommentText(newText);
    commentTextRef.current = newText;
    metadataRef.current.push(metadata);
    textareaRef.current?.focus();
    setTimeout(autoAdjustHeight, 0);
  };

  const autoAdjustHeight = () => {
    if (textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = 'auto';
      el.style.height = Math.max(isMobileMode ? 40 : 48, Math.min(el.scrollHeight, 120)) + 'px';
      el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden';
    }
  };

  const handleMentionsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollLeft + target.clientWidth >= target.scrollWidth - 50) {
      if (hasMoreMentions && !isFetchingMoreMentions) {
        fetchMentions(currentQuery, true);
      }
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (showAttachmentsModal || activeAttachmentModal) {
      textareaRef.current?.blur();
    }
  }, [showAttachmentsModal, activeAttachmentModal]);

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
          key="comment-backdrop"
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
          className={`${showAttachmentsModal && !activeAttachmentModal
            ? 'fixed bottom-[30vh] left-0 right-0 z-[210] p-4 border-t border-slate-200 sm:absolute sm:w-full sm:max-w-md sm:left-1/2 sm:-translate-x-1/2'
            : `relative ${isMobileMode ? 'z-50 p-1' : 'z-[100]'}`
            } space-y-3 pointer-events-auto bg-white transition-all duration-300 ease-in-out`}
        >
          {showMentions && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full bg-white z-[110] max-h-[160px] overflow-hidden"
            >
              {isLoadingMentions ? (
                <div className="flex gap-4 px-4 py-2 overflow-hidden">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 shrink-0 animate-pulse">
                      <div className="w-12 h-12 rounded-full bg-slate-100 shadow-inner" />
                      <div className="w-14 h-2 rounded-full bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : mentionsList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium italic">No users found</div>
              ) : (
                <div
                  onScroll={handleMentionsScroll}
                  className="flex overflow-x-auto gap-3 px-3 py-2 no-scrollbar snap-x"
                >
                  {mentionsList.map((u: any) => {
                    const fullName = u.full_name || u.business_name || u.user_name || u.name || 'User';
                    const mentionDisplay = `@${fullName}\u200B`;
                    const isSelected = commentText.includes(mentionDisplay);
                    return (
                      <button
                        key={u.user_id || u.id}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          const val = commentText;
                          const cursorRotate = textareaRef.current?.selectionStart || val.length;
                          const textBeforeCursor = val.slice(0, cursorRotate);
                          const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                          const textAfterAt = textBeforeCursor.slice(lastAtIndex);
                          const isActiveQuery = lastAtIndex !== -1 && !textAfterAt.includes('\u200B');

                          if (isActiveQuery) {
                            const textAfterCursor = val.slice(cursorRotate);
                            const mentionDisplay = `@${fullName}\u200B`;
                            registerMention(mentionDisplay, u.username || u.business_slug || u.handle || u.slug || u.user_name || 'user');
                            const newText = val.slice(0, lastAtIndex) + mentionDisplay + " " + textAfterCursor;
                            setCommentText(newText);
                            commentTextRef.current = newText;
                          } else {
                            const mentionDisplay = `@${fullName}\u200B`;
                            if (isSelected) {
                              const updated = commentText.replace(mentionDisplay, '');
                              setCommentText(updated);
                              commentTextRef.current = updated;
                            } else {
                              registerMention(mentionDisplay, u.username || u.business_slug || u.handle || u.slug || u.user_name || 'user');
                              const spacer = val && !val.endsWith(' ') ? ' ' : '';
                              const newText = val + spacer + mentionDisplay + " ";
                              setCommentText(newText);
                              commentTextRef.current = newText;
                            }
                          }
                          textareaRef.current?.focus();
                          setTimeout(autoAdjustHeight, 0);
                        }}
                        className="flex flex-col items-center gap-1.5 p-1 min-w-[72px] max-w-[80px] snap-center rounded-2xl transition-all duration-200"
                      >
                        <div className="relative flex-shrink-0 transition-transform active:scale-95">
                          <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white bg-slate-50 shadow-sm">
                            <CachedImage
                              src={formatUrl(u.profile_pic || u.business_logo || u.logo || u.profile_picture)}
                              alt={u.full_name || u.business_name || u.user_name || u.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {isSelected && (
                            <div className="absolute -bottom-0.5 -right-0.5 bg-rose-500 rounded-full p-0.5 shadow-md border-2 border-white animate-in zoom-in duration-200">
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-center min-w-0 w-full text-center">
                          <span className={`text-[11px] font-bold truncate w-full transition-colors ${isSelected ? 'text-rose-500' : 'text-slate-800'}`}>
                            {u.full_name || u.business_name || u.user_name || u.name}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {isFetchingMoreMentions && (
                    <div className="shrink-0 flex flex-col items-center justify-center gap-2 px-4">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-50 border-2 border-slate-100 border-t-rose-500 animate-spin" />
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Loading...</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
          <div className="relative w-full">
            <div
              ref={mirrorRef}
              className="absolute inset-0 px-4 py-2 text-sm font-medium leading-tight pointer-events-none whitespace-pre-wrap break-words overflow-hidden"
              aria-hidden="true"
            >
              {commentText.split(/(@[^\u200B]+\u200B|\[(?:Product|Post|Location|Media): [^\]]+\])/g).map((part, i) => {
                const isMention = part.startsWith('@') && part.endsWith('\u200B');
                const isAttachment = part.startsWith('[') && part.endsWith(']') && 
                                   (part.includes(': Product') || part.includes(': Post') || 
                                    part.includes(': Location') || part.includes(': Media') ||
                                    part.startsWith('[Product:') || part.startsWith('[Post:') || 
                                    part.startsWith('[Location:') || part.startsWith('[Media:'));

                if (isMention || isAttachment) {
                  return (
                    <span key={i} className="text-blue-600" style={{ textShadow: "0.4px 0 0 currentColor" }}>
                      {part}
                    </span>
                  );
                }
                return <span key={i} className="text-slate-800">{part}</span>;
              })}
            </div>
            <textarea
              id={isMobileMode ? "sheet-comment-input-active" : "desktop-comment-input-active"}
              autoFocus
              ref={(el) => {
                // @ts-ignore
                textareaRef.current = el;
                // Sync with context refs if necessary
                if (isMobileMode && reelTextareaRef) {
                  // @ts-ignore
                  reelTextareaRef.current = el;
                } else if (!isMobileMode && desktopTextareaRef) {
                  // @ts-ignore
                  desktopTextareaRef.current = el;
                }
              }}
              onScroll={(e) => {
                if (mirrorRef.current) {
                  mirrorRef.current.scrollTop = e.currentTarget.scrollTop;
                }
              }}
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

                // Mention detection logic
                const cursorRotate = el.selectionStart;
                const textBeforeCursor = val.slice(0, cursorRotate);
                const lastAtIndex = textBeforeCursor.lastIndexOf('@');

                if (lastAtIndex !== -1) {
                  const query = textBeforeCursor.slice(lastAtIndex + 1);
                  const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
                  if (!query.includes(' ') && (charBeforeAt === ' ' || charBeforeAt === '\n')) {
                    setShowMentions(true);
                    fetchMentions(query);
                  } else {
                    setShowMentions(false);
                  }
                } else {
                  setShowMentions(false);
                }
              }}
              onFocus={(e) => {
                if (showAttachmentsModal) {
                  e.target.blur();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleEnrichedSubmit();
                }
              }}
              style={{ caretColor: '#f43f5e' }}
              placeholder={activePlaceholder}
              className={`w-full rounded-xl bg-slate-100 text-transparent placeholder:text-slate-400 px-4 py-2 text-sm font-medium outline-none transition focus:ring-1 ${isMobileMode ? 'focus:ring-slate-200' : 'focus:ring-gray-300'} resize-none overflow-hidden leading-tight`}
              onClick={(e) => {
                if (!isMobileMode) e.stopPropagation();
                if (showAttachmentsModal) setShowAttachmentsModal?.(false);
              }}
              onMouseDown={(e) => !isMobileMode && e.stopPropagation()}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 px-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAttachmentsModal?.(!showAttachmentsModal);
                  if (showAttachmentsModal) {
                    textareaRef.current?.focus();
                  }
                }}
                className={`p-1.5 rounded-full transition-all active:scale-90 ${showAttachmentsModal ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-100'}`}
                title={showAttachmentsModal ? "Show keyboard" : "Add attachment"}
              >
                {showAttachmentsModal ? <Keyboard className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </button>
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
                <Smile className="w-5 h-5" />
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
                  setShowAttachmentsModal?.(false);
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
                  handleEnrichedSubmit(text);
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
          {!showAttachmentsModal && (
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
                  <Smile className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </motion.div>
      ) : (
        isMobileMode ? (
          <button
            key="mobile-comment-placeholder-btn"
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
      <AnimatePresence>
        {showAttachmentsModal && (
          <motion.div
            key="selection-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-transparent"
            onClick={() => setShowAttachmentsModal?.(false)}
          />
        )}
        {activeAttachmentModal && (
          <motion.div
            key="active-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[150] backdrop-blur-[2px]"
            onClick={() => {
              setActiveAttachmentModal?.(null);
            }}
          />
        )}
      </AnimatePresence>
      {showAttachmentsModal && (
        <ComposerAttachmentsModal
          key="attachments-modal"
          ctx={ctx}
          onClose={() => setShowAttachmentsModal?.(false)}
        />
      )}
      {activeAttachmentModal === 'posts' && (
        <AttachmentPostsModal
          key="attachment-posts"
          ctx={ctx}
          onClose={() => setActiveAttachmentModal?.(null)}
          onInsertToken={handleInsertToken}
        />
      )}
      {activeAttachmentModal === 'products' && (
        <AttachmentProductsModal
          key="attachment-products"
          ctx={ctx}
          onClose={() => setActiveAttachmentModal?.(null)}
          onInsertToken={handleInsertToken}
        />
      )}
      {activeAttachmentModal === 'location' && (
        <AttachmentLocationModal
          key="attachment-location"
          ctx={ctx}
          onClose={() => setActiveAttachmentModal?.(null)}
          onInsertToken={handleInsertToken}
        />
      )}
      {activeAttachmentModal === 'media' && (
        <AttachmentMediaModal
          key="attachment-media"
          ctx={ctx}
          onClose={() => {
            setActiveAttachmentModal?.(null);
            setShowAttachmentsModal?.(false);
          }}
          onInsertToken={handleInsertToken}
        />
      )}
    </AnimatePresence>
  );
}

