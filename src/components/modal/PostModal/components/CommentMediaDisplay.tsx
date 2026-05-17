import React, { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, FileText } from 'lucide-react';
import { APIComment } from '@/src/lib/types';
import PostImageViewer from '@/src/components/modal/PostImageViewer';
import StoqleLoader from '@/src/components/common/StoqleLoader';

interface CommentMediaDisplayProps {
  comment: APIComment;
  compact?: boolean;
}

// ── Audio Singleton ──────────────────────────────────────────────────────────
let activeAudio: HTMLAudioElement | null = null;
let stopPrevious: (() => void) | null = null;

// ── Mini audio player ────────────────────────────────────────────────────────
function MiniAudioPlayer({ url, durationMs }: { url: string; durationMs?: number | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number>(durationMs ? durationMs / 1000 : 0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      if (activeAudio === audio) { activeAudio = null; stopPrevious = null; }
    } else {
      if (activeAudio && activeAudio !== audio) { activeAudio.pause(); if (stopPrevious) stopPrevious(); }
      audio.play().then(() => { setPlaying(true); activeAudio = audio; stopPrevious = () => setPlaying(false); }).catch(() => { });
    }
  }, [playing]);

  useEffect(() => {
    return () => { if (playing && activeAudio === audioRef.current) { activeAudio = null; stopPrevious = null; } };
  }, [playing]);

  return (
    <div className="inline-flex items-center mt-1.5">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={() => { const a = audioRef.current; if (a) setCurrentTime(a.currentTime); }}
        onLoadedMetadata={() => { const a = audioRef.current; if (a && a.duration && !isNaN(a.duration)) setDuration(a.duration); }}
        onEnded={() => { setPlaying(false); setCurrentTime(0); if (activeAudio === audioRef.current) { activeAudio = null; stopPrevious = null; } }}
      />
      <button onClick={togglePlay} className="group relative h-9 w-9 flex items-center justify-center text-slate-600 active:scale-90 transition-all duration-300">
        <AnimatePresence mode="wait">
          {playing ? (
            <motion.div key="playing" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="flex items-center justify-center gap-[2px] h-3.5">
              {[0, 1, 2, 3].map((i) => (
                <motion.div key={i} animate={{ height: [3, 14, 3], opacity: [0.6, 1, 0.6] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }} className="w-[2.5px] bg-slate-600 rounded-full" />
              ))}
            </motion.div>
          ) : (
            <motion.div key="paused" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="rotate-90">
              <Wifi className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
      {duration > 0 && <span className="text-[11px] font-bold text-slate-400 ml-1 mb-0.5">{Math.round(duration)}"</span>}
    </div>
  );
}

// ── Single image tile with StoqleLoader overlay ──────────────────────────────
function CommentImage({
  url, idx, isSingle, onClick, showPlusOverlay, extraCount,
}: {
  url: string; idx: number; isSingle: boolean; onClick: () => void; showPlusOverlay: boolean; extraCount: number;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-lg cursor-zoom-in bg-slate-100 border border-slate-100 active:scale-[0.97] transition-transform ${isSingle ? 'max-w-[160px]' : 'aspect-square'}`}
    >
      {/* StoqleLoader — fades out once image loads */}
      <AnimatePresence>
        {!loaded && (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10"
          >
            <StoqleLoader size={isSingle ? 25 : 18} />
          </motion.div>
        )}
      </AnimatePresence>

      <Image
        src={url}
        alt={`Comment image ${idx + 1}`}
        fill={!isSingle}
        width={isSingle ? 160 : undefined}
        height={isSingle ? 200 : undefined}
        className={`${isSingle ? 'h-auto' : 'object-cover'} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        sizes={isSingle ? "160px" : "200px"}
      />

      {/* +N overlay on last tile when > 4 */}
      {showPlusOverlay && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-lg z-20">
          +{extraCount}
        </div>
      )}
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function CommentMediaDisplay({ comment, compact = false }: CommentMediaDisplayProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const images: string[] = React.useMemo(() => {
    const raw = comment.comment_images;
    if (!raw) return [];
    if (Array.isArray(raw)) return (raw as string[]).filter(Boolean);
    try { return JSON.parse(raw as string).filter(Boolean); } catch { return []; }
  }, [comment.comment_images]);

  const hasAudio = !!(comment.audio_url && (comment.audio_status === 'ready' || comment.audio_url.startsWith('blob:')));
  const hasTranscription = !!(comment.transcription);
  const hasImages = images.length > 0;

  if (!hasImages && !hasAudio) return null;

  return (
    <div className={`${compact ? 'mt-1' : 'mt-2'} flex flex-col gap-2`}>

      {/* ── Images grid ─────────────────────────────────────────────────── */}
      {hasImages && (
        <>
          <div className={`grid gap-1 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : images.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {images.slice(0, 4).map((url, idx) => (
              <CommentImage
                key={idx}
                url={url}
                idx={idx}
                isSingle={images.length === 1}
                onClick={() => { setViewerIndex(idx); setViewerOpen(true); }}
                showPlusOverlay={idx === 3 && images.length > 4}
                extraCount={images.length - 4}
              />
            ))}
          </div>

          <PostImageViewer
            open={viewerOpen}
            onClose={() => setViewerOpen(false)}
            images={images}
            startIndex={viewerIndex}
            onIndexChange={(idx) => setViewerIndex(idx)}
          />
        </>
      )}

      {/* ── Audio player ─────────────────────────────────────────────────── */}
      {hasAudio && <MiniAudioPlayer url={comment.audio_url!} durationMs={comment.audio_duration_ms} />}

      {/* ── Transcription ─────────────────────────────────────────────────── */}
      {hasAudio && hasTranscription && (
        <div className="flex items-start gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100 max-w-[260px]">
          <FileText className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-slate-500 leading-relaxed italic">{comment.transcription}</p>
        </div>
      )}
    </div>
  );
}
