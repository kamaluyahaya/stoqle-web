import React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  ChatBubbleOvalLeftIcon,
  BookmarkIcon,
  ClipboardIcon,
  PaperAirplaneIcon,
  TrashIcon,
  HandThumbDownIcon,
  FlagIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { APIComment } from '@/src/lib/types';

interface CommentContextMenuProps {
  comment: APIComment | null;
  isOpen: boolean;
  onClose: () => void;
  isOwnComment: boolean;
  onReply: (comment: APIComment) => void;
  onDelete: (commentId: number) => void;
  isMobile?: boolean;
}

export default function CommentContextMenu({
  comment,
  isOpen,
  onClose,
  isOwnComment,
  onReply,
  onDelete,
  isMobile = false,
}: CommentContextMenuProps) {
  const router = useRouter();

  if (!comment) return null;

  const handleCopyComment = () => {
    if (comment.comment_content) {
      navigator.clipboard.writeText(comment.comment_content).then(() => {
        toast.success('Copied');
      }).catch(() => {
        toast.error('Failed to copy');
      });
    }
    onClose();
  };

  const handleMessage = () => {
    onClose();
    if (comment.user_id) {
      router.push(`/messages?user=${comment.user_id}`);
    }
  };

  const handleSave = () => {
    toast.success('Comment saved');
    onClose();
  };

  const handleDislike = () => {
    toast('Feedback recorded', { icon: '👎' });
    onClose();
  };

  const handleReport = () => {
    toast.success('Comment reported. We\'ll review it shortly.');
    onClose();
  };

  const handleDelete = () => {
    onDelete(comment.comment_id);
    onClose();
  };

  const handleReply = () => {
    onReply(comment);
    onClose();
  };

  const primaryGroup = [
    { label: 'Reply', icon: ChatBubbleOvalLeftIcon, onClick: handleReply },
    { label: 'Save', icon: BookmarkIcon, onClick: handleSave },
    { label: 'Copy', icon: ClipboardIcon, onClick: handleCopyComment },
    { label: 'Message', icon: PaperAirplaneIcon, onClick: handleMessage },
  ];

  if (isOwnComment) {
    primaryGroup.push({
      label: 'Delete',
      icon: TrashIcon,
      onClick: handleDelete,
    });
  }

  const secondaryGroup = [
    { label: 'Not interested', icon: HandThumbDownIcon, onClick: handleDislike },
    { label: 'Report', icon: FlagIcon, onClick: handleReport }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <motion.div
            key="comment-menu-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Menu Sheet */}
          <motion.div
            key="comment-menu-sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="relative w-full bg-white rounded-t-[0.5rem] overflow-hidden sm:max-w-md sm:rounded-xl sm:mb-0 pb-10"
          >
            {/* Header / Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-1 sm:hidden" />

            <div className="px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative">
                  <Image
                    src={comment.author_pic ?? `https://i.pravatar.cc/40?u=${comment.author_name}`}
                    alt={comment.author_name}
                    width={48}
                    height={48}
                    className="rounded-full object-cover bg-slate-100 border-2 border-white shadow-md"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-800 rounded-full border-2 border-white flex items-center justify-center">
                    <ChatBubbleOvalLeftIcon className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate">@{comment.author_handle || comment.author_name}</p>
                  <p className="text-[11px] text-slate-400 font-bold truncate max-w-[200px]">
                    {comment.comment_content}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-90"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 space-y-4 max-h-[65vh] overflow-y-auto">
              {/* Card 1 — Primary Actions */}
              <div className="bg-slate-50/80 rounded-[0.5rem] p-2 border border-slate-100/50 ">
                <div className="space-y-1">
                  {primaryGroup.map((action) => (
                    <button
                      key={action.label}
                      onClick={action.onClick}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98] group ${action.label === 'Delete' ? 'hover:bg-rose-50' : 'hover:bg-white hover:shadow-sm'
                        }`}
                    >
                      <div className={`flex items-center justify-center transition-transform group-hover:scale-110 ${action.label === 'Delete' ? 'text-rose-500' : 'text-slate-500'}`}>
                        <action.icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 text-left">
                        <span className={`text-[13px] font-black ${action.label === 'Delete' ? 'text-rose-600' : 'text-slate-700'}`}>
                          {action.label}
                        </span>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-white/50 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Card 2 — Secondary Actions */}
              <div className="bg-slate-50/80 rounded-[0.5rem] p-2 border border-slate-100/50 ">
                <div className="space-y-1">
                  {secondaryGroup.map((action) => (
                    <button
                      key={action.label}
                      onClick={action.onClick}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98] group hover:bg-white hover:shadow-sm"
                    >
                      <div className="flex items-center justify-center text-slate-500 transition-transform group-hover:scale-110">
                        <action.icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 text-left">
                        <span className="text-[13px] font-black text-slate-700">
                          {action.label}
                        </span>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-white/50 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
