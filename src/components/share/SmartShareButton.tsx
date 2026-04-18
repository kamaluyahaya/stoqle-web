'use client';
/**
 * SmartShareButton.tsx
 *
 * Opens a premium bottom-sheet share modal on click.
 * Social options: WhatsApp · Facebook · TikTok · X · Copy Link
 */

import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpOnSquareIcon, CheckIcon, LinkIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useShareProduct } from '@/src/hooks/useShareProduct';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
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

// ── Props ─────────────────────────────────────────────────────────────────────
interface SmartShareButtonProps {
  productId: number | string;
  title?: string;
  token?: string | null;
  variant?: 'icon' | 'pill' | 'full';
  className?: string;
  zIndex?: number;
}

// ── Share Modal ───────────────────────────────────────────────────────────────
function ShareModal({
  open,
  onClose,
  shareUrl,
  title,
  isLoading,
  onGenerate,
  zIndex,
}: {
  open: boolean;
  onClose: () => void;
  shareUrl: string | null;
  title: string;
  isLoading: boolean;
  onGenerate: () => Promise<string | null>;
  zIndex?: number;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modalZIndex, setModalZIndex] = useState(() => zIndex || getNextZIndex());
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setModalZIndex(zIndex || getNextZIndex());
    }
  }, [open, zIndex]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2200);
    } catch (_) { }
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
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            ref={backdropRef}
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBackdrop}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            style={{ zIndex: modalZIndex }}
          />

          {/* Bottom sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 1000, damping: 70, mass: 0.4 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-2xl pb-[env(safe-area-inset-bottom,16px)]"
            style={{ zIndex: modalZIndex + 1 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Share</h3>
                {title && (
                  <p className="text-xs text-slate-400 mt-0.5 max-w-[240px] truncate">{title}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-100 mx-5 mb-6" />

            {/* Social platform grid */}
            <div className="px-6 pb-5">
              {/* Social platform grid */}
              <div className="flex items-start justify-around gap-2 mb-6">
                {PLATFORMS.map((p, i) => {
                  const copied = copiedId === p.id;
                  const isPending = isLoading && !shareUrl;

                  return (
                    <motion.button
                      key={p.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 800, damping: 50 }}
                      onClick={() => handlePlatformClick(p)}
                      whileTap={{ scale: 0.9 }}
                      disabled={isPending && p.id === 'clipboard'}
                      className={`flex flex-col items-center gap-2 min-w-[60px] group ${isPending ? 'opacity-70' : ''}`}
                    >
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm transition-all group-active:scale-90 ${copied ? 'bg-emerald-500' : p.bg
                          } ${p.color} relative`}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          {copied ? (
                            <motion.span
                              key="check"
                              initial={{ scale: 0, rotate: -30 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0 }}
                              className="text-white"
                            >
                              <CheckIcon className="w-6 h-6" />
                            </motion.span>
                          ) : isPending ? (
                            <motion.span
                              key="loading"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex items-center justify-center"
                            >
                              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                              </svg>
                            </motion.span>
                          ) : (
                            <motion.span key="icon" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                              {p.icon}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 text-center leading-tight">
                        {copied ? (p.id === 'tiktok' ? 'Copied!' : p.label) : p.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

                  {/* Divider */}
                  <div className="h-px bg-slate-100 mb-5" />

                  {/* Link copy row */}
                  <div className="flex items-center gap-3 bg-slate-50 rounded px-4 py-3 border border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                      <LinkIcon className="w-4.5 h-4.5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-400 font-medium mb-0.5">Share link</p>
                      <p className={`text-xs font-semibold text-slate-700 truncate ${isLoading && !shareUrl ? 'animate-pulse text-slate-300' : ''}`}>
                        {shareUrl || 'Generating link…'}
                      </p>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => shareUrl && handleCopy(shareUrl, 'clipboard')}
                      disabled={isLoading && !shareUrl}
                      className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${copiedId === 'clipboard'
                        ? 'bg-emerald-500 text-white'
                        : isLoading && !shareUrl
                          ? 'bg-slate-200 text-slate-400'
                          : 'bg-rose-500 text-white hover:bg-rose-600 active:scale-95'
                        }`}
                    >
                      {copiedId === 'clipboard' ? '✓ Copied' : 'Copy'}
                    </motion.button>
                  </div>

                  {/* TikTok hint */}
                  <AnimatePresence>
                    {copiedId === 'tiktok' && (
                      <motion.p
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-3 text-center text-[11px] text-slate-500"
                      >
                        Link copied — open TikTok and paste it in your bio or DMs 🎵
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ── Trigger Button ────────────────────────────────────────────────────────────
export default function SmartShareButton({
  productId,
  title = 'Check this out on Stoqle!',
  token,
  variant = 'icon',
  className = '',
  zIndex,
}: SmartShareButtonProps) {
  const { share, shareUrl, isSharing, reset } = useShareProduct(token);
  const [modalOpen, setModalOpen] = useState(false);
  const prevProductIdRef = useRef<number | string | null>(null);

  // Pre-fetch share link in background as soon as it mounts or product changes
  useEffect(() => {
    if (productId) {
      // Small delay to prioritize critical main content rendering
      const timer = setTimeout(() => {
        share(productId, title);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [productId, title, share]);

  // Reset cached URL whenever the product changes
  useEffect(() => {
    if (prevProductIdRef.current !== null && prevProductIdRef.current !== productId) {
      reset();
    }
    prevProductIdRef.current = productId;
  }, [productId, reset]);

  const handleOpen = () => {
    setModalOpen(true);
    // Always attempt to generate — the hook handles dedup internally via refs
    if (!isSharing) {
      share(productId, title);
    }
  };

  const icon = (
    <AnimatePresence mode="wait" initial={false}>
      {isSharing ? (
        <motion.span key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </motion.span>
      ) : (
        <motion.span
          key="share"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
        >
          <ArrowUpOnSquareIcon className="w-5 h-5" />
        </motion.span>
      )}
    </AnimatePresence>
  );

  const modal = (
    <ShareModal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      shareUrl={shareUrl}
      title={title}
      isLoading={isSharing}
      onGenerate={() => share(productId, title)}
      zIndex={zIndex}
    />
  );

  if (variant === 'icon') {
    return (
      <>
        <motion.button
          onClick={handleOpen}
          whileTap={{ scale: 0.88 }}
          title="Share"
          className={`p-2 rounded-full transition-colors hover:bg-slate-100/10 ${className}`}
        >
          {icon}
        </motion.button>
        {modal}
      </>
    );
  }

  if (variant === 'pill') {
    return (
      <>
        <motion.button
          onClick={handleOpen}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 ${className}`}
        >
          {icon}
          <span>Share</span>
        </motion.button>
        {modal}
      </>
    );
  }

  // full
  return (
    <>
      <motion.button
        onClick={handleOpen}
        whileTap={{ scale: 0.97 }}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all bg-slate-100 text-slate-800 hover:bg-slate-200 ${className}`}
      >
        {icon}
        <span>Share</span>
      </motion.button>
      {modal}
    </>
  );
}
