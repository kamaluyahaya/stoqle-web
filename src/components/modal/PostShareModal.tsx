'use client';
/**
 * PostShareModal.tsx
 *
 * A premium social sharing modal for posts and reels.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { XMarkIcon, LinkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { getNextZIndex } from '@/src/lib/utils/z-index';
import { toast } from 'sonner';

// ── Social platform configs ──────────────────────────────────────────────────
interface SocialPlatform {
  id: string;
  label: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
  getHref: (url: string, title: string) => string | null;
}

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.94a8.24 8.24 0 004.84 1.55V7.04a4.85 4.85 0 01-1.07-.35z" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const PLATFORMS: SocialPlatform[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: 'text-white',
    bg: 'bg-[#25D366]',
    icon: <WhatsAppIcon />,
    getHref: (url, title) =>
      `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    color: 'text-white',
    bg: 'bg-[#1877F2]',
    icon: <FacebookIcon />,
    getHref: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    color: 'text-white',
    bg: 'bg-black',
    icon: <TikTokIcon />,
    // TikTok has no web share URL — we copy and show instruction
    getHref: () => null,
  },
  {
    id: 'x',
    label: 'X / Twitter',
    color: 'text-white',
    bg: 'bg-black',
    icon: <XIcon />,
    getHref: (url, title) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
];

interface PostShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string | null;
  title: string;
  isLoading: boolean;
  onGenerate: () => Promise<string | null>;
  zIndex?: number;
}

export default function PostShareModal({
  isOpen,
  onClose,
  shareUrl,
  title,
  isLoading,
  onGenerate,
  zIndex,
}: PostShareModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modalZIndex, setModalZIndex] = useState(() => zIndex || getNextZIndex());
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setModalZIndex(zIndex || getNextZIndex());
    }
  }, [isOpen, zIndex]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
      toast.success("Link copied to clipboard!");
    } catch (_) {
      toast.error("Failed to copy link");
    }
  };

  const handlePlatformClick = async (p: SocialPlatform) => {
    let url = shareUrl;
    if (!url) {
      if (isLoading) {
        toast.info("Generating your secure link...", { duration: 1500 });
      }
      url = await onGenerate();
    }
    if (!url) {
      toast.error("Failed to generate share link. Please try again.");
      return;
    }

    if (p.id === 'tiktok') {
      // TikTok: copy + hint
      handleCopy(url, 'tiktok');
      return;
    }
    const href = p.getHref(url, title);
    if (href) window.open(href, '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Modal Container (Backdrop) */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => {
              e.stopPropagation();
              handleBackdrop(e);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ zIndex: modalZIndex }}
          >
            {/* Modal Content (Sheet/Box) */}
            <motion.div
              key="sheet"
              initial={typeof window !== 'undefined' && window.innerWidth < 640 ? { y: '100%' } : { scale: 0.95, opacity: 0 }}
              animate={typeof window !== 'undefined' && window.innerWidth < 640 ? { y: 0 } : { scale: 1, opacity: 1 }}
              exit={typeof window !== 'undefined' && window.innerWidth < 640 ? { y: '100%' } : { scale: 0.95, opacity: 0 }}
              transition={typeof window !== 'undefined' && window.innerWidth < 640
                ? { type: 'spring', stiffness: 1000, damping: 70, mass: 0.4 }
                : { duration: 0.2 }
              }
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full rounded-t-[0.5rem] sm:rounded-[0.5rem] overflow-hidden sm:max-w-md pb-[env(safe-area-inset-bottom,16px)] sm:pb-4"
            >
              {/* Handle - Mobile Only */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-slate-200" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-4 pb-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Share to:</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Spread the vibes with your circle</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="px-6 py-4">
                {/* Social platform grid */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                  {PLATFORMS.map((p, i) => {
                    const copied = copiedId === p.id;
                    const isPending = isLoading && !shareUrl;

                    return (
                      <motion.button
                        key={p.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => handlePlatformClick(p)}
                        className="flex flex-col items-center gap-2 group"
                      >
                        <div
                          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all group-active:scale-90 ${copied ? 'bg-emerald-500' : p.bg
                            } ${p.color} relative`}
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            {copied ? (
                              <motion.span
                                key="check"
                                initial={{ scale: 0, rotate: -30 }}
                                animate={{ scale: 1, rotate: 0 }}
                                exit={{ scale: 0 }}
                              >
                                <CheckIcon className="w-6 h-6" />
                              </motion.span>
                            ) : isPending ? (
                              <motion.span
                                key="loading"
                                className="flex items-center justify-center"
                              >
                                <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                              </motion.span>
                            ) : (
                              <motion.span key="icon">{p.icon}</motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 truncate w-full text-center">
                          {p.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Link copy row */}
                <div className="flex items-center gap-3 bg-slate-50 rounded-[0.5rem] px-4 py-4 border border-slate-100">

                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-400 font-bold  tracking-wider mb-0.5">Direct Link</p>
                    <p className={`text-xs font-bold text-slate-900 truncate ${isLoading && !shareUrl ? 'animate-pulse text-slate-300' : ''}`}>
                      {shareUrl || 'Generating link...'}
                    </p>
                  </div>
                  <button
                    onClick={() => shareUrl && handleCopy(shareUrl, 'clipboard')}
                    disabled={isLoading && !shareUrl}
                    className={`shrink-0 px-4 py-2 rounded-full text-xs font-black transition-all active:scale-95 ${copiedId === 'clipboard'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                      }`}
                  >
                    {copiedId === 'clipboard' ? 'Copied' : 'Copy'}
                  </button>
                </div>

                {/* TikTok hint */}
                <AnimatePresence>
                  {copiedId === 'tiktok' && (
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-4 text-center text-[10px] text-slate-500 font-medium"
                    >
                      Link copied — open TikTok and paste it in your bio or DMs 🎵
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
