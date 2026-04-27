import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaHeart, FaRegHeart, FaImages } from "react-icons/fa";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";

const NO_IMAGE_PLACEHOLDER = "https://st4.depositphotos.com/14953852/22772/v/450/depositphotos_227725020-stock-illustration-image-available-icon-flat-vector.jpg";

export const getNoteStyles = (config: any) => {
  if (!config) return { background: "#f1f5f9" };
  let cfg = config;
  if (typeof config === "string") {
    try { cfg = JSON.parse(config); } catch (e) { return { background: "#f1f5f9" }; }
  }
  const { template, startColor, endColor, lineSpacing = 25 } = cfg;
  const baseBg = endColor ? `linear-gradient(135deg, ${startColor}, ${endColor})` : startColor;
  let patternCSS = "";
  let bgSize = "auto";
  if (template === "grid") {
    patternCSS = `linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)`;
    bgSize = `${lineSpacing}px ${lineSpacing}px`;
  } else if (template === "diagonal") {
    patternCSS = `repeating-linear-gradient(45deg, transparent, transparent ${lineSpacing}px, rgba(255,255,255,0.2) ${lineSpacing}px, rgba(255,255,255,0.2) ${lineSpacing * 2}px)`;
  } else if (template === "stripes") {
    patternCSS = `repeating-linear-gradient(0deg, transparent, transparent ${lineSpacing}px, rgba(0,0,0,0.03) ${lineSpacing}px, rgba(0,0,0,0.03) ${lineSpacing + 1}px)`;
  } else if (template === "dots") {
    patternCSS = `radial-gradient(rgba(0,0,0,0.1) 1.5px, transparent 0)`;
    bgSize = `${lineSpacing}px ${lineSpacing}px`;
  }
  return {
    backgroundColor: startColor,
    backgroundImage: patternCSS ? `${patternCSS}, ${baseBg}` : baseBg,
    backgroundSize: bgSize,
    color: cfg.textStyle?.color ?? "#111827",
    fontSize: `${(cfg.textStyle?.fontSize ?? 28) * 0.6}px`,
    fontWeight: cfg.textStyle?.fontWeight ?? "800",
  };
};

function LikeBurst() {
  const particles = Array.from({ length: 12 });
  const colors = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B"];
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
      {particles.map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: Math.cos((i * 30) * Math.PI / 180) * 60,
            y: Math.sin((i * 30) * Math.PI / 180) * 60,
            scale: [0.2, 1.2, 1.8, 0],
            opacity: [1, 1, 0.8, 0],
            rotate: [0, 45, 90, 180]
          }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute"
        >
          <FaHeart size={12} style={{ color: colors[i % colors.length] }} className="drop-shadow-sm" />
        </motion.div>
      ))}
    </div>
  );
}

const AttachmentPostCard = React.memo(({
  post,
  openPostWithUrl,
  toggleLike = () => {},
  setFullImageUrl = () => {}
}: any) => {
  const [showBurst, setShowBurst] = useState(false);

  return (
    <motion.article
      layout
      layoutId={`post-${post.id}`}
      transition={{ layout: { duration: 0.4, type: "spring", stiffness: 300, damping: 30 } }}
      onClick={() => openPostWithUrl(post)}
      className="group flex flex-col sm:rounded-xl rounded-md bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden"
    >
      <div className="relative w-full bg-slate-200 overflow-hidden post-media">

        {post.isPinned && (
          <div className="absolute top-3 left-3 z-20 flex items-center px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-md">
            <span className="text-[10px] font-bold">Pinned</span>
          </div>
        )}

        {post.isVideo && (
          <div className="absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/50">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white ml-0.5">
              <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" />
            </svg>
          </div>
        )}

        {!post.isVideo && post.allMedia && post.allMedia.length > 1 && (
          <div className="absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/50">
            <FaImages className="text-white text-[10px]" />
          </div>
        )}

        {post.status === 'processing' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin mb-2" />
            <span className="text-[10px] font-bold text-white px-2 text-center drop-shadow-md">
              Processing your video...
            </span>
          </div>
        )}

        {post.coverType === "note" && !post.src ? (
          <div
            className="w-full h-[180px] sm:h-[220px] flex items-center justify-center p-4 relative overflow-hidden"
            style={getNoteStyles(post.noteConfig)}
          >
            {(() => {
              const cfg = typeof post.noteConfig === "string" ? JSON.parse(post.noteConfig) : post.noteConfig;
              if (cfg?.emojis?.length > 0) {
                return (
                  <div className="absolute inset-0 flex items-center justify-around opacity-30 pointer-events-none" style={{ filter: cfg.emojiBlur ? "blur(4px)" : "none" }}>
                    {cfg.emojis.slice(0, 3).map((emoji: string, idx: number) => (
                      <span key={idx} className="text-4xl transform rotate-12">
                        {emoji}
                      </span>
                    ))}
                  </div>
                );
              }
              return null;
            })()}
            <div className="text-center relative z-10">
              <p className="line-clamp-4 px-2" style={{ color: "inherit", fontSize: "inherit", fontWeight: "inherit" }}>
                {post.noteConfig?.text ?? post.caption ?? "Note"}
              </p>
            </div>
          </div>
        ) : (
          <img
            src={post.thumbnail || post.src || NO_IMAGE_PLACEHOLDER}
            alt={post.caption}
            className="w-full h-auto sm:min-h-[160px] min-h-[140px] max-h-[220px] sm:max-h-[280px] object-cover transition-transform duration-700 group-hover:scale-110"
          />
        )}
      </div>

      <div className="p-3">
        <p className="text-sm text-slate-800 line-clamp-2 leading-snug font-semibold mb-3">
          {post.coverType === "note" && !post.src ? post.note_caption : post.caption}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="h-5 w-5 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer active:scale-90 transition-transform"
              onClick={(e) => { e.stopPropagation(); setFullImageUrl(post.user.avatar); }}
            >
              <img src={post.user.avatar} className="w-full h-full object-cover" alt={post.user.name} />
            </div>
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <span className="truncate text-[11px] font-semibold text-slate-400 capitalize">
                {post.user.name}
              </span>
              {post.user.is_trusted && (
                <CheckBadgeIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              )}
            </div>
          </div>

          <div
            className="flex items-center gap-1 cursor-pointer relative"
            onClick={(e) => {
              e.stopPropagation();
              if (!post.liked) {
                setShowBurst(true);
                setTimeout(() => setShowBurst(false), 800);
              }
              toggleLike(post.id);
            }}
          >
            {showBurst && <LikeBurst />}
            <div className="relative w-4 h-4 flex items-center justify-center">
              <AnimatePresence>
                <motion.div
                  key={post.liked ? "liked" : "unliked"}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  className={`absolute inset-0 flex items-center justify-center ${post.liked ? 'text-rose-500' : 'text-slate-400'}`}
                >
                  {post.liked ? <FaHeart className="text-sm" /> : <FaRegHeart className="text-sm" />}
                </motion.div>
              </AnimatePresence>
              {post.liked && (
                <motion.div
                  initial={{ scale: 1, opacity: 1 }}
                  animate={{ scale: [1, 1.8, 1], opacity: [1, 0.4, 0] }}
                  transition={{ duration: 0.6 }}
                  className="absolute text-rose-500 pointer-events-none"
                >
                  <FaHeart size={14} />
                </motion.div>
              )}
            </div>
            <span className={`text-xs font-bold ${post.liked ? "text-rose-500" : "text-slate-400"}`}>{post.likeCount}</span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}, (prev, next) => {
  return prev.post.id === next.post.id &&
    prev.post.liked === next.post.liked &&
    prev.post.likeCount === next.post.likeCount &&
    prev.post.isPinned === next.post.isPinned;
});

AttachmentPostCard.displayName = "AttachmentPostCard";

export default AttachmentPostCard;
