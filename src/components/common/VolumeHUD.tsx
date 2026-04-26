import React from 'react';
import { motion } from 'framer-motion';
import { useAudio } from '@/src/context/audioContext';

export const VolumeHUD = React.memo(() => {
  const { isMuted, volume, toggleMute, setVolume } = useAudio();
  const isActuallyOn = !isMuted && volume > 0;

  return (
    <div className={`relative flex items-center group/volume transition-opacity duration-300 ${isActuallyOn ? "hidden md:flex" : "flex"}`}>
      <motion.div
        initial={false}
        animate={{ width: "auto", opacity: 1 }}
        className="flex items-center bg-black/40 backdrop-blur-md rounded-full px-1.5 py-1 gap-1 border border-white/10 shadow-lg"
      >
        <button
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
        >
          {isMuted || volume === 0 ? (
            <svg className="w-5 h-5 drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M23 9l-6 6m0-6l6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg className="w-5 h-5 drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Hover-expandable Apple-like Volume Slider */}
        <div className="w-0 group-hover/volume:w-24 overflow-hidden transition-all duration-300 ease-out flex items-center pr-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              e.stopPropagation();
              setVolume(parseFloat(e.target.value));
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white hover:accent-rose-500 transition-colors"
          />
        </div>
      </motion.div>

    </div>
  );
});

export default VolumeHUD;
