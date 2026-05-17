"use client";
/**
 * PostImageViewer
 * ─────────────────────────────────────────────────────────────────────────────
 * A general-purpose full-screen image viewer built on `yet-another-react-lightbox`.
 * Used for post attachments, comment images, etc.
 */

import React, { useEffect, useState, useMemo } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { getNextZIndex } from "@/src/lib/utils/z-index";

interface PostImageViewerProps {
  open: boolean;
  onClose: () => void;
  images: string[];
  startIndex?: number;
  onIndexChange?: (index: number) => void;
}

const LIGHTBOX_CAROUSEL = { padding: 0, spacing: 0 };

export default function PostImageViewer({
  open,
  onClose,
  images,
  startIndex = 0,
  onIndexChange,
}: PostImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [prevStartIndex, setPrevStartIndex] = useState(startIndex);
  const [viewerZIndex, setViewerZIndex] = useState(900000);

  // Update z-index when opening
  useEffect(() => {
    if (open) {
      setViewerZIndex(getNextZIndex());
    }
  }, [open]);

  const LIGHTBOX_STYLES = useMemo(() => ({
    root: { zIndex: viewerZIndex },
    container: { backgroundColor: "rgba(0,0,0,0.98)" },
  }), [viewerZIndex]);

  // Sync internal index synchronously when external startIndex changes
  if (startIndex !== prevStartIndex) {
    setCurrentIndex(startIndex);
    setPrevStartIndex(startIndex);
  }

  // Prevent background scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const onIndexChangeRef = React.useRef(onIndexChange);
  React.useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
  }, [onIndexChange]);

  const handleView = React.useCallback(({ index }: { index: number }) => {
    setCurrentIndex(index);
    onIndexChangeRef.current?.(index);
  }, []);

  const lightboxOn = React.useMemo(() => ({ view: handleView }), [handleView]);
  const slides = React.useMemo(() => images.map((src) => ({ src })), [images]);

  if (!open || images.length === 0) return null;

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={currentIndex}
      slides={slides}
      portal={{ root: typeof document !== "undefined" ? document.body : undefined }}
      controller={{
        closeOnBackdropClick: true,
        closeOnPullDown: true,
      }}
      styles={LIGHTBOX_STYLES}
      carousel={LIGHTBOX_CAROUSEL}
      on={lightboxOn}
      render={{
        // Hide default buttons — we render our own overlay
        buttonPrev: () => null,
        buttonNext: () => null,
        buttonClose: () => null,
        controls: () => (
          <div 
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: viewerZIndex + 10 }}
          >
            {/* Top bar: close + counter */}
            <div className="absolute inset-x-0 top-0 px-6 py-5 flex items-center justify-between pointer-events-none">
              <button
                onClick={(e) => { e.preventDefault(); onClose(); }}
                className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-white shadow-xl active:scale-95 transition-transform cursor-pointer"
              >
                <XMarkIcon className="w-5 h-5 stroke-2" />
              </button>

              {images.length > 1 && (
                <div className="pointer-events-none px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-white text-[13px] font-black shadow-xl">
                  <span>{currentIndex + 1}</span>
                  <span className="opacity-40 mx-1">/</span>
                  <span>{images.length}</span>
                </div>
              )}
              <div className="w-10 h-10" />
            </div>

            {/* Bottom dot indicators */}
            {images.length > 1 && (
              <div className="pointer-events-none absolute bottom-10 inset-x-0 flex items-center justify-center gap-1.5">
                {images.map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-300 ${i === currentIndex ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"}`}
                  />
                ))}
              </div>
            )}
          </div>
        )
      }}
    />
  );
}