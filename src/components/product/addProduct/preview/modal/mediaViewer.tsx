import React, { useState } from "react";
import { PreviewPayload } from "@/src/types/product";
import VideoPlayer from "@/src/components/posts/videoPlayer";
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

export default function MediaViewer({
  main,
  payload,
  images,
  selectedIndex,
  onIndexChange
}: {
  main: { url?: string; name?: string } | null;
  payload: PreviewPayload;
  images: { url?: string; name?: string }[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
}) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [direction, setDirection] = useState(0);

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    if (newDirection === 1) {
      if (selectedIndex < images.length - 1) {
        onIndexChange(selectedIndex + 1);
      } else {
        onIndexChange(0);
      }
    } else {
      if (selectedIndex > 0) {
        onIndexChange(selectedIndex - 1);
      } else {
        onIndexChange(images.length - 1);
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

  return (
    <div className="w-full h-full flex-1 min-h-[400px] lg:min-h-0 aspect-square lg:aspect-auto flex items-center justify-center relative overflow-hidden group bg-slate-100">
      <AnimatePresence initial={false} custom={direction}>
        {main && main.url ? (
          <motion.div
            key={selectedIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
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
          </motion.div>
        ) : payload.productVideo?.url ? (
          <div className="w-full h-full absolute inset-0">
            <VideoPlayer
              src={payload.productVideo.url}
              className="w-full h-full object-contain bg-black"
              autoplay={true}
              loop={true}
              mutedByDefault={true}
              playsInline={true}
            />
          </div>
        ) : (
          <div className="text-sm text-slate-400 mt-20">No preview available</div>
        )}
      </AnimatePresence>

      {/* Mobile indicator for count */}
      <div className="absolute bottom-4 right-4 bg-black/50 text-white text-[10px] font-bold px-4 py-1.5 rounded-full lg:hidden z-20">
        {selectedIndex + 1} / {images.length}
      </div>

      {/* Full Screen Lightbox Overlay */}
      <Lightbox
        open={isFullScreen}
        close={() => setIsFullScreen(false)}
        index={selectedIndex}
        on={{ view: ({ index }) => onIndexChange(index) }}
        slides={images.map(img => ({ src: img.url || "" }))}
        portal={{ root: typeof document !== "undefined" ? document.body : undefined }}
        styles={{
          root: { zIndex: 30000 },
          container: { backgroundColor: "rgba(0,0,0,0.95)" }
        }}
      />
    </div>
  );
}