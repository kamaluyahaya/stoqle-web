import React from "react";

export default function ThumbnailList({
  payload,
  images,
  variantImages = [],
  selectedIndex,
  viewMode = "images",
  onIndexChange,
  onAllStyles
}: {
  payload: any;
  images: { url?: string; name?: string }[];
  variantImages?: { url?: string; name?: string; name_group?: string }[];
  selectedIndex: number;
  viewMode?: "video" | "images" | "styles";
  onIndexChange: (index: number, mode?: "video" | "images" | "styles") => void;
  onAllStyles?: () => void;
}) {
  const hasStyles = variantImages.length > 0;

  return (
    <div className="relative w-full flex items-center bg-white group/thumb">
      {hasStyles ? (
        <>
          <div className="flex-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex gap-2.5 pb-1 px-1">
            {variantImages.map((v, i) => {
              const isSelected = viewMode === "styles" && i === selectedIndex;
              return (
                <button
                  key={`style-${i}`}
                  onClick={() => onIndexChange(i, "styles")}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`flex-shrink-0 flex items-center group relative rounded-lg border p-0.5 transition-all duration-500 ease-in-out ${isSelected
                    ? "border-rose-500 bg-rose-50"
                    : "border-transparent hover:border-slate-200"
                    } overflow-hidden focus:outline-none`}
                  style={{
                    width: isSelected ? "auto" : 58,
                    height: 58,
                    maxWidth: isSelected ? 160 : 58
                  }}
                  aria-pressed={isSelected}
                >
                  <div className="w-[50px] h-[50px] flex-shrink-0 rounded-[6px] overflow-hidden relative bg-slate-100 transition-all duration-300">
                    {v.url ? (
                      <img src={v.url} alt={v.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-50 text-[9px] text-slate-400 p-2 text-center leading-tight">
                        {v.name}
                      </div>
                    )}
                    {/* Normal overlay for non-selected items (optional, hidden when selected) */}
                    {!isSelected && (
                      <div className="absolute bottom-0 left-0 right-0 p-0.5 bg-black/60 backdrop-blur-[1px] transition-transform duration-300 translate-y-full group-hover:translate-y-0">
                        <p className="text-[7px] font-black text-white truncate text-center leading-none">
                          {v.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Active Selected Name on the Right */}
                  {isSelected && (
                    <div className="flex-1 px-2 overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300">
                      <p className="text-[9px] font-bold text-slate-800 leading-[1.2] line-clamp-2 text-left">
                        {v.name}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}

            {/* Add extra padding at the end to allow for sticky link space */}
            <div className="flex-shrink-0 w-24" />
          </div>

          {/* Sticky "All styles" Link on the right */}
          <div className="absolute top-0 right-0 h-full pl-8 pr-1 flex items-center bg-gradient-to-l from-white via-white/95 to-transparent pointer-events-none">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAllStyles?.(); }}
              className="pointer-events-auto flex flex-col items-center justify-center whitespace-nowrap active:scale-95 transition-transform"
            >
              <span className="text-[10px] font-black text-rose-500 hover:text-rose-700 transition-colors p-0.5">
                All {variantImages.length} styles
              </span>
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}