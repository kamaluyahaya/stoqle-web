import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { PreviewPayload } from "@/src/types/product";
import { XMarkIcon, PlayIcon, PauseIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import Lightbox from "yet-another-react-lightbox";
import Video from "yet-another-react-lightbox/plugins/video";
import "yet-another-react-lightbox/styles.css";

export default function MediaViewer({
  main,
  payload,
  images,
  variantImages = [],
  selectedIndex,
  viewMode = "images",
  onIndexChange,
  isFromReel,
  isExpanded,
  onClose
}: {
  main: { url?: string; name?: string; groupTitle?: string } | null;
  payload: PreviewPayload;
  images: { url?: string; name?: string }[];
  variantImages?: { url?: string; name?: string; groupTitle?: string }[];
  selectedIndex: number;
  viewMode?: "video" | "images" | "styles";
  onIndexChange: (index: number, mode?: "video" | "images" | "styles") => void;
  isFromReel?: boolean;
  isExpanded?: boolean;
  onClose?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fullScreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [direction, setDirection] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [isMainVideoPlaying, setIsMainVideoPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    setHasPlayed(false);
  }, [payload?.productId]);

  const prevIndexRef = useRef(selectedIndex);
  const prevModeRef = useRef(viewMode);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Persist main video state across tab switches
  const mainVideoSavedTimeRef = useRef(0);
  const mainVideoWasPlayingRef = useRef(false);

  // Sync video progress
  useEffect(() => {
    const v = fullScreenVideoRef.current;
    if (!v) return;

    const updateProgress = () => {
      if (v.duration) {
        setVideoProgress((v.currentTime / v.duration) * 100);
        // Real-time sync to background video
        if (videoRef.current && isFullScreen) {
          videoRef.current.currentTime = v.currentTime;
        }
      }
    };

    const handlePlay = () => {
      setIsVideoPaused(false);
      setHasPlayed(true);
      // Ensure background video also plays to stay in sync visually
      if (isFullScreen) {
        videoRef.current?.play().catch(() => { });
      }
    };

    const handlePause = () => {
      setIsVideoPaused(true);
      // Ensure background video also pauses
      if (isFullScreen) {
        videoRef.current?.pause();
      }
    };

    v.addEventListener("timeupdate", updateProgress);
    v.addEventListener("play", handlePlay);
    v.addEventListener("pause", handlePause);

    return () => {
      v.removeEventListener("timeupdate", updateProgress);
      v.removeEventListener("play", handlePlay);
      v.removeEventListener("pause", handlePause);
    };
  }, [isFullScreen, viewMode]);

  // Initial sync from main view to full-screen when opening
  useEffect(() => {
    if (isFullScreen && viewMode === "video") {
      const mainV = videoRef.current;
      const fullV = fullScreenVideoRef.current;

      if (mainV && fullV) {
        fullV.currentTime = mainV.currentTime;
        // If main was playing, ensure full screen continues
        if (!mainV.paused) {
          fullV.play().catch(() => { });
          setIsVideoPaused(false);
        } else {
          fullV.pause();
          setIsVideoPaused(true);
        }
      }
    }
  }, [isFullScreen, viewMode]);

  // Restore video state when switching back to video tab
  useEffect(() => {
    if (viewMode === "video") {
      // Let the video element mount first
      const timer = setTimeout(() => {
        const v = videoRef.current;
        if (v) {
          v.currentTime = mainVideoSavedTimeRef.current;
          if (mainVideoWasPlayingRef.current) {
            v.play().catch(() => { });
          } else {
            // Ensure play icon shows
            setIsMainVideoPlaying(false);
          }
        }
      }, 30);
      return () => clearTimeout(timer);
    } else {
      // Leaving video tab — reset play icon state
      setIsMainVideoPlaying(false);
    }
  }, [viewMode]);

  // Handle background video muted state to avoid echo when full screen is open
  useEffect(() => {
    if (videoRef.current) {
      // If full screen is open, background MUST be muted
      if (isFullScreen) {
        videoRef.current.muted = true;
      } else {
        // Restore user's muted preference when closing
        videoRef.current.muted = isMuted;
      }
    }
  }, [isFullScreen, isMuted]);

  // Prevent background scrolling when full screen is open
  React.useLayoutEffect(() => {
    if (isFullScreen) {
      const originalBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const scrollableParent = (scrollRef.current || containerRef.current)?.closest(".overflow-y-auto") as HTMLElement;
      let originalParentOverflow = "";
      if (scrollableParent) {
        originalParentOverflow = scrollableParent.style.overflow;
        scrollableParent.style.overflow = "hidden";
      }
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        if (scrollableParent) scrollableParent.style.overflow = originalParentOverflow;
      };
    }
  }, [isFullScreen]);

  const hasVideo = !!payload.productVideo?.url;
  const hasStyles = variantImages.length > 1;

  const mediaItems = React.useMemo(() => {
    const items: any[] = [];
    if (hasVideo) {
      items.push({
        id: 'video-main',
        type: 'video',
        url: payload.productVideo?.url,
        poster: images[0]?.url,
        mode: 'video' as const,
        index: -1
      });
    }
    images.forEach((img, idx) => {
      items.push({ id: `img-${idx}`, type: 'image', url: img.url, mode: 'images' as const, index: idx });
    });
    variantImages.forEach((img, idx) => {
      items.push({ id: `style-${idx}`, type: 'image', url: img.url, mode: 'styles' as const, index: idx });
    });
    return items;
  }, [hasVideo, payload.productVideo?.url, images, variantImages]);

  const currentMediaId = viewMode === 'video' ? 'video-main' :
    viewMode === 'images' ? `img-${selectedIndex}` :
      `style-${selectedIndex}`;

  const scrollToMode = (mode: "video" | "images" | "styles") => {
    if (!scrollRef.current) return;
    const firstIdx = mediaItems.findIndex(m => m.mode === mode);
    if (firstIdx !== -1) {
      const itemWidth = scrollRef.current.offsetWidth * 0.5;
      scrollRef.current.scrollTo({ left: firstIdx * itemWidth, behavior: 'smooth' });
    }
  };

  // Flat index helper for direction calculation
  const flatIndex = (idx: number, mode?: string) => {
    if (!mode || mode === "video") return -1;
    if (mode === "images") return idx;
    return images.length + idx;
  };

  // Navigate with slide direction tracking
  const navigate = (newIndex: number, newMode?: "video" | "images" | "styles") => {
    const cur = flatIndex(selectedIndex, viewMode);
    const next = flatIndex(newIndex, newMode);
    setDirection(next >= cur ? 1 : -1);
    onIndexChange(newIndex, newMode);
  };

  // Slide variants for directional animation
  const slideVariants = {
    enter: (dir: number) => ({ x: dir === 0 ? 0 : (dir > 0 ? "100%" : "-100%"), opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir === 0 ? 0 : (dir < 0 ? "100%" : "-100%"), opacity: 0 }),
  };

  const slideTransition = { type: "tween", ease: "easeOut", duration: 0.18 } as const;

  const lightboxSlides = React.useMemo(() => {
    const slides: any[] = [];
    if (hasVideo) {
      slides.push({
        type: "video",
        sources: [{ src: payload.productVideo?.url || "", type: "video/mp4" }],
        poster: images[0]?.url || "",
      });
    }
    images.forEach(img => slides.push({ src: img.url || "" }));
    variantImages.forEach(img => slides.push({ src: img.url || "" }));
    return slides;
  }, [hasVideo, payload.productVideo?.url, images, variantImages]);

  const lightboxIndex = React.useMemo(() => {
    if (viewMode === "video") return 0;
    const base = hasVideo ? 1 : 0;
    if (viewMode === "styles") return base + images.length + selectedIndex;
    return base + selectedIndex;
  }, [viewMode, hasVideo, images.length, selectedIndex]);

  // Compact View (Horizontal Scroll)
  if (isFromReel && !isExpanded) {
    return (
      <div className="w-full bg-slate-100 animate-in fade-in duration-300 relative">
        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const scrollPos = el.scrollLeft;
            const itemWidth = el.offsetWidth * 0.5;
            const newIndex = Math.round(scrollPos / itemWidth);
            const item = mediaItems[newIndex];
            if (item && (item.index !== selectedIndex || item.mode !== viewMode)) {
              onIndexChange(item.index, item.mode);
            }
          }}
          className="flex gap-0 p-0 overflow-x-auto no-scrollbar snap-x snap-mandatory"
        >
          {mediaItems.map((item, idx) => (
            <motion.div
              key={item.id}
              layoutId={item.id}
              className="flex-none w-[50%] aspect-[1/1] relative overflow-hidden bg-slate-50 snap-start active:scale-95 transition-transform cursor-pointer"
              onClick={() => {
                onIndexChange(item.index, item.mode);
                if (item.type !== 'video' || isExpanded) setIsFullScreen(true);
              }}
            >
              {item.type === 'video' ? (
                <div className="w-full h-full relative bg-black group/compact-video">
                  <video src={item.url} poster={item.poster} className="w-full h-full object-contain" muted playsInline autoPlay={false} loop={false} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-active/compact-video:scale-110 transition-transform">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                      <PlayIcon className="w-6 h-6 text-white drop-shadow-md fill-white" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full relative bg-slate-100">
                  <img src={item.url} alt="" className="w-full h-full object-contain" />
                </div>
              )}
            </motion.div>
          ))}
          <div className="flex-none w-2 h-full" />
        </div>

        {(payload.productVideo?.url || hasStyles) ? (
          <div className="absolute bottom-2 right-2 z-40 transform scale-90 origin-bottom-right">
            <div className="flex p-0.5 bg-black/60 backdrop-blur-md rounded-full border border-white/20 relative shadow-lg">
              {payload.productVideo?.url && (
                <button onClick={(e) => { e.stopPropagation(); scrollToMode("video"); onIndexChange(-1, "video"); }} className={`relative px-2.5 py-1 text-[7px] font-black transition-colors duration-300 whitespace-nowrap ${viewMode === "video" ? "text-slate-900" : "text-white/70"}`}>
                  {viewMode === "video" && <motion.div layoutId="activeTabBackgroundCompact" className="absolute inset-0 bg-white rounded-full z-0" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                  <span className="relative z-10">Video</span>
                </button>
              )}
              {images.length > 0 && (
                <button onClick={(e) => { e.stopPropagation(); scrollToMode("images"); onIndexChange(0, "images"); }} className={`relative px-2.5 py-1 text-[7px] font-black transition-colors duration-300 whitespace-nowrap ${viewMode === "images" ? "text-slate-900" : "text-white/70"}`}>
                  {viewMode === "images" && <motion.div layoutId="activeTabBackgroundCompact" className="absolute inset-0 bg-white rounded-full z-0" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                  <span className="relative z-10">Images {viewMode === "images" ? `${selectedIndex + 1}/${images.length}` : ""}</span>
                </button>
              )}
              {hasStyles && (
                <button onClick={(e) => { e.stopPropagation(); scrollToMode("styles"); onIndexChange(0, "styles"); }} className={`relative px-2.5 py-1 text-[7px] font-black transition-colors duration-300 whitespace-nowrap ${viewMode === "styles" ? "text-slate-900" : "text-white/70"}`}>
                  {viewMode === "styles" && <motion.div layoutId="activeTabBackgroundCompact" className="absolute inset-0 bg-white rounded-full z-0" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                  <span className="relative z-10">Styles {viewMode === "styles" ? `${selectedIndex + 1}/${variantImages.length}` : ""}</span>
                </button>
              )}
            </div>
          </div>
        ) : images.length > 1 && (
          <div className="absolute bottom-4 right-4 z-40 pointer-events-none">
            <div className="px-2.5 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-xl flex items-center gap-1.5 transition-all duration-500 scale-95 group-hover:scale-100">
              <span className="text-[10px] font-black text-white drop-shadow-sm">{selectedIndex + 1}<span className="opacity-40 mx-0.5">/</span>{images.length}</span>
            </div>
          </div>
        )}
      </div>
    );
  }


  return (
    <div ref={containerRef} className="w-full flex-1 flex items-center justify-center relative overflow-hidden group bg-slate-100 h-[50vh] max-h-[50vh] lg:h-full lg:max-h-none lg:min-h-0">
      {images.length > 0 && <img src={images[0].url} alt="" className="w-full h-full invisible pointer-events-none lg:hidden object-contain" />}

      <AnimatePresence mode="sync" custom={direction}>
        {viewMode === "video" && payload.productVideo?.url ? (
          <motion.div
            key="video"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(_, { offset }) => {
              // Swipe left from Video → first Image
              if (offset.x < -60 && images.length > 0) navigate(0, "images");
            }}
            className="absolute inset-0 w-full h-full flex items-center justify-center bg-black group/video"
            onClick={() => setIsFullScreen(true)}
          >
            <video
              ref={videoRef}
              src={payload.productVideo.url}
              poster={images[0]?.url || ""}
              className="w-full h-full object-contain pointer-events-none"
              muted={isMuted}
              playsInline
              onTimeUpdate={() => {
                if (videoRef.current) mainVideoSavedTimeRef.current = videoRef.current.currentTime;
              }}
              onPlay={() => {
                setIsMainVideoPlaying(true);
                setHasPlayed(true);
                mainVideoWasPlayingRef.current = true;
              }}
              onPause={() => { setIsMainVideoPlaying(false); mainVideoWasPlayingRef.current = false; }}
              onEnded={() => { setIsMainVideoPlaying(false); mainVideoWasPlayingRef.current = false; }}
            />

            {/* Custom Image Cover before the video starts playing */}
            {!hasPlayed && images[0]?.url && (
              <img
                src={images[0].url}
                alt=""
                className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none bg-black animate-in fade-in duration-200"
              />
            )}

            {/* Centered Play Button (Hides when playing) */}
            {!isMainVideoPlaying && (
              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (videoRef.current) {
                      videoRef.current.play().catch(() => { });
                    }
                  }}
                  className="w-15 h-15 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center text-white shadow-[0_0_50px_rgba(0,0,0,0.3)] hover:bg-white/30 active:scale-95 transition-all pointer-events-auto"
                >
                  <PlayIcon className="w-10 h-10 fill-white ml-1.5" />
                </button>
              </div>
            )}

            {/* Main View Speaker Icon (Bottom Left) */}
            <div className="absolute bottom-4 left-4 z-20 pointer-events-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white shadow-lg active:scale-90 transition-all"
              >
                {isMuted ? <SpeakerXMarkIcon className="w-4 h-4" /> : <SpeakerWaveIcon className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        ) : main && main.url ? (
          <motion.div
            key={`${viewMode}-${selectedIndex}`}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="absolute inset-0 w-full h-full flex items-center justify-center cursor-zoom-in"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            onDragEnd={(_, { offset }) => {
              const isImages = viewMode === "images";
              const isStyles = viewMode === "styles";
              const total = isStyles ? variantImages.length : images.length;

              if (offset.x < -50) {
                if (selectedIndex < total - 1) {
                  navigate(selectedIndex + 1, viewMode as any);
                } else if (isImages && hasStyles) {
                  navigate(0, "styles");
                }
              } else if (offset.x > 50) {
                if (selectedIndex > 0) {
                  navigate(selectedIndex - 1, viewMode as any);
                } else if (isImages && hasVideo) {
                  navigate(-1, "video");
                } else if (isStyles) {
                  navigate(images.length - 1, "images");
                }
              }
            }}
            onClick={() => setIsFullScreen(true)}
          >
            <img src={main.url} alt="" className="w-full h-full object-contain pointer-events-none" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Main View Category Tabs (Bottom Right) */}
      {!isFullScreen && (payload.productVideo?.url || hasStyles) && (
        <div className="absolute bottom-2 right-4 z-[45]">
          <div className="flex p-1 bg-black/60 backdrop-blur-md rounded-full relative shadow-2xl">
            {payload.productVideo?.url && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(-1, "video"); }}
                className={`relative px-2.5 py-1 text-[7px] font-black transition-colors duration-300 whitespace-nowrap ${viewMode === "video" ? "text-slate-900" : "text-white/70"}`}
              >
                {viewMode === "video" && (
                  <motion.div layoutId="activeTabBackgroundMain" className="absolute inset-0 bg-white rounded-full z-0" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                )}
                <span className="relative z-10">Video</span>
              </button>
            )}
            {images.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(0, "images"); }}
                className={`relative px-2.5 py-1 text-[7px] font-black transition-colors duration-300 whitespace-nowrap ${viewMode === "images" ? "text-slate-900" : "text-white/70"}`}
              >
                {viewMode === "images" && (
                  <motion.div layoutId="activeTabBackgroundMain" className="absolute inset-0 bg-white rounded-full z-0" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                )}
                <span className="relative z-10">
                  Images {viewMode === "images" ? `${selectedIndex + 1}/${images.length}` : ""}
                </span>
              </button>
            )}
            {hasStyles && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(0, "styles"); }}
                className={`relative px-3 py-1 text-[7px] font-black transition-colors duration-300 whitespace-nowrap ${viewMode === "styles" ? "text-slate-900" : "text-white/70"}`}
              >
                {viewMode === "styles" && (
                  <motion.div layoutId="activeTabBackgroundMain" className="absolute inset-0 bg-white rounded-full z-0" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                )}
                <span className="relative z-10">
                  Styles {viewMode === "styles" ? `${selectedIndex + 1}/${variantImages.length}` : ""}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main View Image Counter (fallback when no video/styles) */}
      {!isFullScreen && viewMode !== "video" && !(payload.productVideo?.url || hasStyles) && images.length > 1 && (
        <div className="absolute bottom-4 right-4 z-[45] pointer-events-none">
          <div className=" bg-black/40 backdrop-blur-md rounded-full shadow-xl flex items-center transition-all duration-500 scale-95 group-hover:scale-100">
            <span className="text-[10px] font-black text-white drop-shadow-sm">
              {selectedIndex + 1}
              <span className="opacity-40 mx-0.5">/</span>
              {images.length}
            </span>
          </div>
        </div>
      )}

      <Lightbox
        open={isFullScreen}
        close={() => setIsFullScreen(false)}
        index={lightboxIndex}
        plugins={[Video]}
        video={{
          controls: false,
          autoPlay: true,
          loop: true,
          muted: isMuted,
        }}
        render={{
          buttonPrev: () => null,
          buttonNext: () => null,
          buttonClose: () => null,
          slide: ({ slide }) => {
            if (slide.type === "video") {
              return (
                <video
                  ref={fullScreenVideoRef}
                  src={(slide as any).sources?.[0]?.src}
                  poster={images[0]?.url || ""}
                  className="w-full h-full object-contain"
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                />
              );
            }
            return undefined;
          }
        }}
        on={{
          view: ({ index }) => {
            const base = hasVideo ? 1 : 0;
            if (hasVideo && index === 0) onIndexChange(-1, "video");
            else if (index < base + images.length) onIndexChange(index - base, "images");
            else onIndexChange(index - base - images.length, "styles");
          }
        }}
        slides={lightboxSlides}
        portal={{ root: typeof document !== "undefined" ? document.body : undefined }}
        controller={{ closeOnBackdropClick: true, closeOnPullDown: true, closeOnPullUp: true }}
        styles={{ root: { zIndex: 9999999 }, container: { backgroundColor: "rgba(0,0,0,1)" } }}
      />

      {isFullScreen && typeof document !== "undefined" && createPortal(
        <React.Fragment>
          {/* Header */}
          <div className="fixed inset-x-0 top-0 z-[2147483647] p-6 flex items-center justify-between pointer-events-none" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <div className="pointer-events-auto">
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsFullScreen(false); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md  text-white shadow-xl active:scale-95"><XMarkIcon className="w-6 h-6 stroke-[2.5]" /></button>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-full  text-white text-[13px] font-black shadow-xl pointer-events-auto"><span>{lightboxIndex + 1}</span><span className="opacity-40 mx-1">/</span><span>{lightboxSlides.length}</span></div>
            </div>
            <div className="w-10 h-10" />
          </div>

          {/* Footer UI (Tabs + Video Controls) */}
          <div className="fixed bottom-10 right-8 z-[2147483647] flex flex-col items-end gap-4 pointer-events-none" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>

            {/* No video controls in the right column — play/pause is handled by center overlay */}

            {/* Media Tabs (Right) */}
            {(payload.productVideo?.url || hasStyles) && (
              <div className="flex p-1.5 bg-black/60 backdrop-blur-md rounded-full relative shadow-2xl scale-110 origin-bottom-right pointer-events-auto">
                {payload.productVideo?.url && (
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onIndexChange(-1, "video"); }} className={`relative px-3 py-1.5 text-[10px] font-black transition-colors ${viewMode === "video" ? "text-slate-900" : "text-white/70"}`}>
                    {viewMode === "video" && <motion.div layoutId="activeTabFS" className="absolute inset-0 bg-white rounded-full z-0" />}
                    <span className="relative z-10">Video</span>
                  </button>
                )}
                {images.length > 0 && (
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onIndexChange(0, "images"); }} className={`relative px-3 py-1.5 text-[10px] font-black transition-colors ${viewMode === "images" ? "text-slate-900" : "text-white/70"}`}>
                    {viewMode === "images" && <motion.div layoutId="activeTabFS" className="absolute inset-0 bg-white rounded-full z-0" />}
                    <span className="relative z-10">Images {viewMode === "images" ? `${selectedIndex + 1}/${images.length}` : ""}</span>
                  </button>
                )}
                {hasStyles && (
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onIndexChange(0, "styles"); }} className={`relative px-3 py-1.5 text-[10px] font-black transition-colors ${viewMode === "styles" ? "text-slate-900" : "text-white/70"}`}>
                    {viewMode === "styles" && <motion.div layoutId="activeTabFS" className="absolute inset-0 bg-white rounded-full z-0" />}
                    <span className="relative z-10">Styles {viewMode === "styles" ? `${selectedIndex + 1}/${variantImages.length}` : ""}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bottom Left Speaker (Only in video mode) */}
          {viewMode === "video" && (
            <div className="fixed bottom-8 left-8 z-[2147483647] pointer-events-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                  if (fullScreenVideoRef.current) fullScreenVideoRef.current.muted = !isMuted;
                }}
                className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white shadow-xl active:scale-95"
              >
                {isMuted ? <SpeakerXMarkIcon className="w-5 h-5" /> : <SpeakerWaveIcon className="w-5 h-5" />}
              </button>
            </div>
          )}

          {/* Centered Play/Pause overlay in full-screen video — tapping it toggles playback */}
          {viewMode === "video" && (
            <div
              className="fixed inset-0 flex items-center justify-center z-[2147483646]"
              style={{ pointerEvents: isVideoPaused ? "auto" : "none" }}
              onClick={(e) => {
                if (!isVideoPaused) return;
                e.stopPropagation();
                fullScreenVideoRef.current?.play();
              }}
            >
              {isVideoPaused && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.2 }}
                  className="w-24 h-24 rounded-full bg-black/30 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-2xl pointer-events-auto"
                >
                  <PlayIcon className="w-12 h-12 fill-white ml-2" />
                </motion.div>
              )}
            </div>
          )}

          {/* Style Selector */}
          {isFullScreen && viewMode === "styles" && variantImages.length > 0 && (
            <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[2147483647] flex flex-col items-center gap-4 pointer-events-none w-full max-w-lg px-6" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              <div className="pointer-events-auto">
                <motion.div key={variantImages[selectedIndex]?.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-5 py-2.5 bg-white text-black text-[10px] font-black rounded-xl shadow-2xl ">
                  {variantImages[selectedIndex]?.name || "Select Style"}
                </motion.div>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pointer-events-auto bg-black/60 backdrop-blur-2xl p-2.5 rounded-2xl">
                {variantImages.map((style, idx) => (
                  <button key={idx} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onIndexChange(idx, "styles"); }} className={`flex-none w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-500 ${idx === selectedIndex ? "border-white scale-110 shadow-lg" : "border-transparent opacity-40"}`}><img src={style.url} alt="" className="w-full h-full object-cover" /></button>
                ))}
              </div>
            </div>
          )}
        </React.Fragment>,
        document.body
      )}
    </div>
  );
}