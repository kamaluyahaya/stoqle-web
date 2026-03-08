import React from "react";

export default function ThumbnailList({ images, video, selectedIndex, onSelect }: { images: Array<any>; video?: any; selectedIndex: number; onSelect: (i: number) => void }) {
  return (
    <div className="flex gap-2 w-full overflow-x-auto pb-1">
      {/* Show thumbnails only if there is more than 1 media item in total */}
      {(images.length + (video ? 1 : 0)) > 1 && (
        <>
          {video && (
            <button key="video" onClick={() => onSelect(-1)} onMouseDown={(e) => e.stopPropagation()} className={`flex-shrink-0 cursor-pointer rounded-sm border p-1 ${selectedIndex === -1 ? "ring-2 ring-red-500 bg-red-50" : "border-slate-100 hover:border-red-300"} overflow-hidden focus:outline-none flex flex-col items-center justify-center bg-slate-50 relative`} style={{ width: 60, height: 60 }} title={video.name ?? "Video preview"} aria-pressed={selectedIndex === -1}>
              <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white drop-shadow-md" fill="currentColor">
                  <path d="M5 3v18l15-9-15-9z" />
                </svg>
              </div>
              {video.url && <video src={video.url} className="w-full h-full object-cover" muted playsInline />}
            </button>
          )}
          {images.map((p, i) => (
            <button key={`img-${i}`} onClick={() => onSelect(i)} onMouseDown={(e) => e.stopPropagation()} className={`flex-shrink-0 rounded-sm border cursor-pointer p-1 ${i === selectedIndex ? "ring-2 ring-red-500 bg-red-50" : "border-slate-100 hover:border-red-300"} overflow-hidden focus:outline-none bg-slate-50`} style={{ width: 60, height: 60 }} title={p.name ?? `Image ${i + 1}`} aria-pressed={i === selectedIndex}>
              {p.url ? <img src={p.url} alt={p.name ?? `img-${i + 1}`} className="w-full h-full object-cover rounded-sm" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 p-2 break-all">{p.name ?? "file"}</div>}
            </button>
          ))}
        </>
      )}
    </div>
  );
}