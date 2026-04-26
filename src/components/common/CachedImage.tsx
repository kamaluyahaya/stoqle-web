"use client";

import React, { useState, useEffect } from "react";
import { getOrFetchImage } from "@/src/lib/indexedDB";
import { motion, HTMLMotionProps } from "framer-motion";

interface CachedImageProps extends HTMLMotionProps<"img"> {
  src: string;
}

/**
 * A motion.img component that automatically caches its source in IndexedDB
 * for a lag-free, native-app-like experience.
 */
const CachedImage: React.FC<CachedImageProps> = ({ src, ...props }) => {
  const [displaySrc, setDisplaySrc] = useState<string>(src);
  const [isLoadedFromCache, setIsLoadedFromCache] = useState(false);

  useEffect(() => {
    let active = true;
    let blobUrl: string | null = null;

    async function loadAndCache() {
      if (!src) return;
      
      const url = await getOrFetchImage(src);
      if (active) {
        // If the returned URL is a blob URL, we store it to revoke later
        if (url.startsWith("blob:")) {
          blobUrl = url;
          setIsLoadedFromCache(true);
        }
        setDisplaySrc(url);
      }
    }

    loadAndCache();

    return () => {
      active = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [src]);

  return (
    <motion.img
      {...props}
      src={displaySrc}
      // Add a subtle fade-in if it's the first time loading from network
      initial={props.initial || { opacity: 0 }}
      animate={props.animate || { opacity: 1 }}
      transition={props.transition || { duration: 0.2 }}
    />
  );
};

export default CachedImage;
