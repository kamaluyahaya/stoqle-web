import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  onTap?: () => void;
  delay?: number;
}

/**
 * Hook for detecting long-press (touch + mouse) on elements.
 * Returns handlers to spread onto any element.
 * Cancels long-press if the user moves their finger (drag threshold: 10px).
 */
export function useLongPress({ onLongPress, onTap, delay = 500 }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggeredRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback((x: number, y: number) => {
    triggeredRef.current = false;
    startPosRef.current = { x, y };
    clear();
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true;
      onLongPress();
    }, delay);
  }, [onLongPress, delay, clear]);

  const move = useCallback((x: number, y: number) => {
    if (!startPosRef.current) return;
    const dx = Math.abs(x - startPosRef.current.x);
    const dy = Math.abs(y - startPosRef.current.y);
    if (dx > 10 || dy > 10) {
      clear();
    }
  }, [clear]);

  const end = useCallback(() => {
    clear();
    if (!triggeredRef.current && onTap) {
      onTap();
    }
    startPosRef.current = null;
  }, [clear, onTap]);

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      start(touch.clientX, touch.clientY);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      move(touch.clientX, touch.clientY);
    },
    onTouchEnd: () => end(),
    onMouseDown: (e: React.MouseEvent) => {
      start(e.clientX, e.clientY);
    },
    onMouseMove: (e: React.MouseEvent) => {
      move(e.clientX, e.clientY);
    },
    onMouseUp: () => end(),
    onMouseLeave: () => clear(),
    onContextMenu: (e: React.MouseEvent) => {
      // Prevent native context menu on long-press
      e.preventDefault();
    },
  };

  return handlers;
}
