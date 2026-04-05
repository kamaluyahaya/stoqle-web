"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

type AudioContextType = {
  isMuted: boolean;
  volume: number; // 0 to 1
  toggleMute: () => void;
  setVolume: (val: number) => void;
  playSound: (soundName: string) => void;
  hasUserInteracted: boolean;
  markInteracted: () => void;
  playingAudioId: string | null;
  registerPlayback: (id: string | null) => void;
};

const AudioContext = createContext<AudioContextType | undefined>(undefined);

const SOUND_MAP: Record<string, string> = {
  order_placed: "/assets/sound/order_placed.mp3",
  delivery_confirmed: "/assets/sound/delivery_confirmed.mp3",
  out_for_delivery: "/assets/sound/out_for_delivery.mp3",
  shipping: "/assets/sound/Shipping.mp3",
  credited: "/assets/sound/credited.mp3",
};

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("stoqle_muted_pref");
      return stored === "true" ? true : false;
    }
    return false;
  });

  const [volume, setVolumeState] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("stoqle_volume_pref");
      return stored !== null ? parseFloat(stored) : 0.8;
    }
    return 0.8;
  });

  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem("stoqle_muted_pref", String(next));
      return next;
    });
    setHasUserInteracted(true);
  }, []);

  const setVolume = useCallback((val: number) => {
    setVolumeState(val);
    localStorage.setItem("stoqle_volume_pref", String(val));
    if (val > 0 && isMuted) {
      setIsMuted(false);
      localStorage.setItem("stoqle_muted_pref", "false");
    } else if (val === 0 && !isMuted) {
      setIsMuted(true);
      localStorage.setItem("stoqle_muted_pref", "true");
    }
    setHasUserInteracted(true);
  }, [isMuted]);

  const playSound = useCallback((soundName: string) => {
    if (isMuted || !hasUserInteracted) return;

    const path = SOUND_MAP[soundName];
    if (!path) {
      console.warn(`Sound name "${soundName}" not found in SOUND_MAP`);
      return;
    }

    const audio = new Audio(path);
    audio.volume = volume;
    audio.play().catch((err) => {
      console.error(`Failed to play sound ${soundName}:`, err);
    });
  }, [isMuted, volume, hasUserInteracted]);

  const markInteracted = useCallback(() => {
    setHasUserInteracted(true);
  }, []);

  // One-time interaction listener to enable audio if browser blocked it
  useEffect(() => {
    const handleInteract = () => {
      setHasUserInteracted(true);
      window.removeEventListener("click", handleInteract);
      window.removeEventListener("touchstart", handleInteract);
      window.removeEventListener("keydown", handleInteract);
    };
    window.addEventListener("click", handleInteract, { passive: true });
    window.addEventListener("touchstart", handleInteract, { passive: true });
    window.addEventListener("keydown", handleInteract, { passive: true });
    return () => {
      window.removeEventListener("click", handleInteract);
      window.removeEventListener("touchstart", handleInteract);
      window.removeEventListener("keydown", handleInteract);
    };
  }, []);

  const registerPlayback = useCallback((id: string | null) => {
    setPlayingAudioId(id);
  }, []);

  return (
    <AudioContext.Provider value={{ 
      isMuted, 
      volume, 
      toggleMute, 
      setVolume, 
      playSound, 
      hasUserInteracted, 
      markInteracted, 
      playingAudioId, 
      registerPlayback 
    }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error("useAudio must be used within AudioProvider");
  return context;
};
