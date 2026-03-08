import React, { useState } from "react";
import { PreviewPayload } from "@/src/types/product";
import VideoPlayer from "@/src/components/posts/videoPlayer";
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";

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

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex > 0) {
      onIndexChange(selectedIndex - 1);
    } else {
      onIndexChange(images.length - 1);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex < images.length - 1) {
      onIndexChange(selectedIndex + 1);
    } else {
      onIndexChange(0);
    }
  };

  return (
    <div className="flex-1 min-h-[400px] bg-slate-100 flex items-center justify-center relative overflow-hidden group">
      {main && main.url ? (
        <div
          className="w-full h-full cursor-zoom-in"
          onClick={() => setIsFullScreen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={main.url} alt={main.name ?? payload.title} className="w-full h-full object-contain" />

          {/* Mobile indicator for count */}
          <div className="absolute top-4 right-4 bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded-full lg:hidden">
            {selectedIndex + 1} / {images.length}
          </div>
        </div>
      ) : payload.productVideo?.url ? (
        <VideoPlayer
          src={payload.productVideo.url}
          className="w-full h-full object-contain bg-black"
          autoplay={true}
          loop={true}
          mutedByDefault={true}
          playsInline={true}
        />
      ) : (
        <div className="text-sm text-slate-400 mt-20">No preview available</div>
      )}

      {/* Full Screen Overlay */}
      {isFullScreen && main && main.url && (
        <div
          className="fixed inset-0 z-[2000] bg-black flex items-center justify-center"
          onClick={() => setIsFullScreen(false)}
        >
          {/* Top Counter */}
          <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between text-white z-50">
            <div className="text-sm font-bold tracking-widest bg-black/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
              {selectedIndex + 1} / {images.length}
            </div>
            <button
              onClick={() => setIsFullScreen(false)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-colors shadow-lg"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-4 z-50 p-3 bg-black/20 hover:bg-white/10 text-white rounded-full backdrop-blur-md transition-all border border-white/5 active:scale-95"
              >
                <ChevronLeftIcon className="w-6 h-6" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 z-50 p-3 bg-black/20 hover:bg-white/10 text-white rounded-full backdrop-blur-md transition-all border border-white/5 active:scale-95"
              >
                <ChevronRightIcon className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Large Image */}
          <div className="w-full h-full p-4 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[selectedIndex]?.url}
              alt="Zoomed product"
              className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}