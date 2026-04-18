import React, { useState, useRef } from "react";
import { PreviewPayload } from "@/src/types/product";
import { PlayIcon } from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import Lightbox from "yet-another-react-lightbox";
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
  isExpanded
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
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [direction, setDirection] = useState(1);
  const prevIndexRef = useRef(selectedIndex);
  const prevModeRef = useRef(viewMode);
  const scrollRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (selectedIndex !== prevIndexRef.current || viewMode !== prevModeRef.current) {
      setDirection(1);
      prevIndexRef.current = selectedIndex;
      prevModeRef.current = viewMode;
    }
  }, [selectedIndex, viewMode]);

  const hasVideo = !!payload.productVideo?.url;
  const hasStyles = variantImages.length > 1;

  // Unified media list for carousel and tabs with stable IDs
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
      items.push({
        id: `img-${idx}`,
        type: 'image',
        url: img.url,
        mode: 'images' as const,
        index: idx
      });
    });
    variantImages.forEach((img, idx) => {
      items.push({
        id: `style-${idx}`,
        type: 'image',
        url: img.url,
        mode: 'styles' as const,
        index: idx
      });
    });
    return items;
  }, [hasVideo, payload.productVideo?.url, images, variantImages]);

  const currentMediaId = viewMode === 'video' ? 'video-main' : 
                         viewMode === 'images' ? `img-${selectedIndex}` : 
                         `style-${selectedIndex}`;

  // Sync scroll position with tab clicking (in compact mode)
  const scrollToMode = (mode: "video" | "images" | "styles") => {
    if (!scrollRef.current) return;
    const firstIdx = mediaItems.findIndex(m => m.mode === mode);
    if (firstIdx !== -1) {
      const itemWidth = scrollRef.current.offsetWidth * 0.5;
      scrollRef.current.scrollTo({ left: firstIdx * itemWidth, behavior: 'smooth' });
    }
  };

  // Sync tab highlighting with scroll position (in compact mode)
  const handleScroll = () => {
    if (!scrollRef.current || !isFromReel || isExpanded) return;
    const { scrollLeft, offsetWidth } = scrollRef.current;
    if (offsetWidth === 0) return;
    const itemWidth = offsetWidth * 0.5;
    const activeIdx = Math.round(scrollLeft / itemWidth);
    const item = mediaItems[activeIdx];
    if (item && item.mode !== viewMode) {
      onIndexChange(item.index, item.mode);
    }
  };

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    const currentList = viewMode === "styles" ? variantImages : images;

    if (newDirection === 1) {
      if (selectedIndex < currentList.length - 1) {
        onIndexChange(selectedIndex + 1, viewMode);
      } else if (selectedIndex === currentList.length - 1 && hasVideo) {
        onIndexChange(-1, "video");
      } else {
        const nextMode = hasVideo ? "video" : (images.length > 0 ? "images" : hasStyles ? "styles" : "images");
        onIndexChange(0, nextMode as any);
      }
    } else {
      if (selectedIndex > 0) {
        onIndexChange(selectedIndex - 1, viewMode);
      } else if (selectedIndex === 0 && hasVideo) {
        onIndexChange(-1, "video");
      } else if (selectedIndex === -1) {
        const prevMode = hasStyles ? "styles" : "images";
        const prevList = prevMode === "styles" ? variantImages : images;
        onIndexChange(prevList.length - 1, prevMode);
      } else {
        onIndexChange(currentList.length - 1, viewMode);
      }
    }
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  // Compact View (Horizontal Scroll) for Reels 80% state
  if (isFromReel && !isExpanded) {
    return (
      <div className="w-full bg-slate-100 animate-in fade-in duration-300 relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-0 p-0 overflow-x-auto no-scrollbar snap-x snap-mandatory"
        >
          {mediaItems.map((item, idx) => (
            <motion.div
              key={item.id}
              layoutId={item.id}
              className="flex-none w-[50%] aspect-[1/1] relative overflow-hidden bg-slate-50 snap-start active:scale-95 transition-transform cursor-pointer"
              onClick={() => onIndexChange(item.index, item.mode)}
            >
              {item.type === 'video' ? (
                <div 
                  className="w-full h-full relative bg-black group/compact-video"
                  onClick={(e) => {
                    if (!isExpanded) {
                      e.stopPropagation();
                      const v = e.currentTarget.querySelector('video');
                      if (v) {
                        if (v.paused) v.play();
                        else v.pause();
                      }
                    }
                  }}
                >
                  <video
                    src={item.url}
                    poster={item.poster}
                    className="w-full h-full object-contain"
                    muted
                    playsInline
                    autoPlay={false}
                    loop={false}
                  />
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
          {/* Subtle placeholder to hint at more items or end spacing */}
          <div className="flex-none w-2 h-full" />
        </div>

        {/* Media Toggle or Image Counter inside Compact View */}
        {(payload.productVideo?.url || hasStyles) ? (
          <div className="absolute bottom-2 right-2 z-40 transform scale-90 origin-bottom-right">
            <div className="flex p-0.5 bg-black/60 backdrop-blur-md rounded-full border border-white/20 relative shadow-lg">
              {payload.productVideo?.url && (
                <button
                  onClick={(e) => { e.stopPropagation(); scrollToMode("video"); onIndexChange(-1, "video"); }}
                  className={`relative px-2.5 py-1 text-[7px] font-black transition-colors duration-300 whitespace-nowrap ${viewMode === "video" ? "text-slate-900" : "text-white/70"}`}
                >
                  {viewMode === "video" && (
                    <motion.div layoutId="activeTabBackgroundCompact" className="absolute inset-0 bg-white rounded-full z-0" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                  )}
                  <span className="relative z-10">Video</span>
                </button>
              )}
              {images.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); scrollToMode("images"); onIndexChange(0, "images"); }}
                  className={`relative px-2.5 py-1 text-[7px] font-black transition-colors duration-300 whitespace-nowrap ${viewMode === "images" ? "text-slate-900" : "text-white/70"}`}
                >
                  {viewMode === "images" && (
                    <motion.div layoutId="activeTabBackgroundCompact" className="absolute inset-0 bg-white rounded-full z-0" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                  )}
                  <span className="relative z-10">
                    Images {viewMode === "images" ? `${selectedIndex + 1}/${images.length}` : ""}
                  </span>
                </button>
              )}
              {hasStyles && (
                <button
                  onClick={(e) => { e.stopPropagation(); scrollToMode("styles"); onIndexChange(0, "styles"); }}
                  className={`relative px-2.5 py-1 text-[7px] font-black transition-colors duration-300 whitespace-nowrap ${viewMode === "styles" ? "text-slate-900" : "text-white/70"}`}
                >
                  {viewMode === "styles" && (
                    <motion.div layoutId="activeTabBackgroundCompact" className="absolute inset-0 bg-white rounded-full z-0" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                  )}
                  <span className="relative z-10">
                    Styles {viewMode === "styles" ? `${selectedIndex + 1}/${variantImages.length}` : ""}
                  </span>
                </button>
              )}
            </div>
          </div>
        ) : images.length > 1 && (
          <div className="absolute bottom-4 right-4 z-40 pointer-events-none">
            <div className="px-2.5 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-xl flex items-center gap-1.5 transition-all duration-500 scale-95 group-hover:scale-100">
              <span className="text-[10px] font-black text-white drop-shadow-sm">
                {selectedIndex + 1}
                <span className="opacity-40 mx-0.5">/</span>
                {images.length}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full flex-1 flex items-center justify-center relative overflow-hidden group bg-slate-100 h-[50vh] max-h-[50vh] lg:h-full lg:max-h-none lg:min-h-0`}>
      {/* Hidden Ghost Media to define width behavior (for non-video view on mobile) */}
      {images.length > 0 && (
        <img
          src={images[0].url}
          alt="height-limit"
          className="w-full h-full invisible pointer-events-none lg:hidden object-contain"
          aria-hidden="true"
        />
      )}

      <AnimatePresence initial={false} custom={direction}>
        {main && main.url ? (
          <motion.div
            key={`${viewMode}-${selectedIndex}`}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            layoutId={currentMediaId}
            transition={{
              layout: { type: "spring", stiffness: 300, damping: 30 },
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x);

              if (swipe < -swipeConfidenceThreshold) {
                paginate(1);
              } else if (swipe > swipeConfidenceThreshold) {
                paginate(-1);
              }
            }}
            className="absolute inset-0 w-full h-full flex items-center justify-center cursor-zoom-in"
            onClick={() => setIsFullScreen(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={main.url} alt={main.name ?? payload.title} className="w-full h-full object-contain pointer-events-none" />

            {/* Variant badge removed as per request */}
          </motion.div>
        ) : viewMode === "video" && payload.productVideo?.url ? (
          <motion.div
            key="video"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 w-full h-full flex items-center justify-center bg-black group/video"
            onClick={(e) => {
              e.stopPropagation();
              // Outer tap: Trigger Fullscreen
              if (videoRef.current) {
                if (videoRef.current.requestFullscreen) {
                  videoRef.current.requestFullscreen();
                } else if ((videoRef.current as any).webkitRequestFullscreen) {
                  (videoRef.current as any).webkitRequestFullscreen();
                }
              }
            }}
          >
            <video
              ref={videoRef}
              src={payload.productVideo.url}
              poster={payload.productImages?.[0]?.url || ""}
              className="w-full lg:w-auto h-full object-contain"
              autoPlay={false}
              loop={false}
              muted={isMuted}
              playsInline={true}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => onIndexChange(0, images.length > 0 ? "images" : hasStyles ? "styles" : "images")}
            />

            {/* Custom Discovery Play Overlay (Central Tap Area) */}
            <div
              className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const v = videoRef.current;
                  if (!v) return;
                  if (v.paused) {
                    v.play();
                    setIsPlaying(true);
                  } else {
                    v.pause();
                    setIsPlaying(false);
                  }
                }}
                className="w-24 h-24 flex items-center justify-center pointer-events-auto group/btn transition-transform active:scale-95"
              >
                {!isPlaying && (
                  <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl scale-100 group-hover/btn:scale-110 transition-transform">
                    <PlayIcon className="w-8 h-8 fill-white ml-1" />
                  </div>
                )}
              </button>
            </div>

            {/* Hardware Audio Toggle (Left Side) */}
            <div className="absolute bottom-4 left-4 z-30">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 transition-colors shadow-lg"
              >
                {isMuted ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path d="M11 5L6 9H2V15H6L11 19V5Z" fill="white" />
                    <line x1="23" y1="9" x2="17" y2="15" stroke="white" />
                    <line x1="17" y1="9" x2="23" y2="15" stroke="white" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path d="M11 5L6 9H2V15H6L11 19V5Z" fill="white" />
                    <path d="M19.07 4.93C20.89 6.75 22 9.25 22 12C22 14.75 20.89 17.25 19.07 19.07" stroke="white" />
                    <path d="M15.54 8.46C16.45 9.37 17 10.62 17 12C17 13.38 16.45 14.63 15.54 15.54" stroke="white" />
                  </svg>
                )}
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="text-sm text-slate-400 mt-20">No preview available</div>
        )}
      </AnimatePresence>


      {/* Image Counter (Floating Badge) - Only show for simple image-only posts */}
      {viewMode !== "video" && !(payload.productVideo?.url || hasStyles) && (
        <div className="absolute bottom-4 right-4 z-[45] pointer-events-none">
          <div className="px-2.5 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-xl flex items-center gap-1.5 transition-all duration-500 scale-95 group-hover:scale-100">
            <span className="text-[10px] font-black text-white  drop-shadow-sm">
              {selectedIndex + 1}
              <span className="opacity-40 mx-0.5">/</span>
              {images.length}
            </span>
          </div>
        </div>
      )}

      {/* Segmented Media Toggle (Bottom Right - Ultra Compact) */}
      {(payload.productVideo?.url || hasStyles) && (
        <div className="absolute bottom-4 right-4 z-40">
          <div className="flex p-0.5 bg-black/60 backdrop-blur-md rounded-full border border-white/20 relative shadow-lg group/toggle">
            {payload.productVideo?.url && (
              <button
                onClick={(e) => { e.stopPropagation(); onIndexChange(-1, "video"); }}
                className={`relative px-2.5 py-1 text-[7px] font-black transition-colors duration-300 whitespace-nowrap ${viewMode === "video" ? "text-slate-900" : "text-white/70"
                  }`}
              >
                {viewMode === "video" && (
                  <motion.div
                    layoutId="activeTabBackground"
                    className="absolute inset-0 bg-white rounded-full z-0"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Video</span>
              </button>
            )}
            {images.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onIndexChange(0, "images"); }}
                className={`relative px-2.5 py-1 text-[7px] font-black transition-colors duration-300 whitespace-nowrap ${viewMode === "images" ? "text-slate-900" : "text-white/70"
                  }`}
              >
                {viewMode === "images" && (
                  <motion.div
                    layoutId="activeTabBackground"
                    className="absolute inset-0 bg-white rounded-full z-0"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">
                  Images {viewMode === "images" ? `${selectedIndex + 1}/${images.length}` : ""}
                </span>
              </button>
            )}
            {hasStyles && (
              <button
                onClick={(e) => { e.stopPropagation(); onIndexChange(0, "styles"); }}
                className={`relative px-2.5 py-1 text-[7px] font-black transition-colors duration-300 whitespace-nowrap ${viewMode === "styles" ? "text-slate-900" : "text-white/70"
                  }`}
              >
                {viewMode === "styles" && (
                  <motion.div
                    layoutId="activeTabBackground"
                    className="absolute inset-0 bg-white rounded-full z-0"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">
                  Styles {viewMode === "styles" ? `${selectedIndex + 1}/${variantImages.length}` : ""}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Full Screen Lightbox Overlay */}
      <Lightbox
        open={isFullScreen}
        close={() => setIsFullScreen(false)}
        index={selectedIndex === -1 ? 0 : selectedIndex}
        on={{ view: ({ index }) => onIndexChange(index, viewMode) }}
        slides={(viewMode === "styles" ? variantImages : images).map(img => ({ src: img.url || "" }))}
        portal={{ root: typeof document !== "undefined" ? document.body : undefined }}
        controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
        styles={{
          root: { zIndex: 9999999 },
          container: { backgroundColor: "rgba(0,0,0,0.95)" }
        }}
      />
    </div>
  );
}