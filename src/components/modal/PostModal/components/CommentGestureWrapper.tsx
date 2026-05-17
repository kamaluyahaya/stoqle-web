import React, { useRef, useCallback } from 'react';

interface CommentGestureWrapperProps {
  comment: any;
  onTapReply: (comment: any) => void;
  onLongPress: (comment: any) => void;
  children: React.ReactNode;
  className?: string;
  longPressDelay?: number;
}

/**
 * Wraps a comment item to provide:
 * - Tap → trigger reply to that comment
 * - Long press → open context menu
 * 
 * Uses touch events for mobile and mouse events for desktop.
 * Cancels long-press on drag (10px threshold).
 * Prevents tap from firing on long-press.
 */
export default function CommentGestureWrapper({
  comment,
  onTapReply,
  onLongPress,
  children,
  className = '',
  longPressDelay = 400,
}: CommentGestureWrapperProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggeredRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isMovedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback((x: number, y: number) => {
    triggeredRef.current = false;
    isMovedRef.current = false;
    startPosRef.current = { x, y };
    clear();
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true;
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(40);
      }
      onLongPress(comment);
    }, longPressDelay);
  }, [comment, onLongPress, longPressDelay, clear]);

  const move = useCallback((x: number, y: number) => {
    if (!startPosRef.current) return;
    const dx = Math.abs(x - startPosRef.current.x);
    const dy = Math.abs(y - startPosRef.current.y);
    if (dx > 15 || dy > 15) {
      isMovedRef.current = true;
      clear();
    }
  }, [clear]);

  const end = useCallback(() => {
    clear();
    startPosRef.current = null;
  }, [clear]);

  return (
    <div
      className={`${className} cursor-pointer select-none`}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        start(touch.clientX, touch.clientY);
      }}
      onTouchMove={(e) => {
        const touch = e.touches[0];
        move(touch.clientX, touch.clientY);
      }}
      onTouchEnd={() => end()}
      onMouseDown={(e) => {
        // Only track left clicks for long-press
        if (e.button !== 0) return;
        start(e.clientX, e.clientY);
      }}
      onMouseMove={(e) => {
        move(e.clientX, e.clientY);
      }}
      onMouseUp={() => end()}
      onMouseLeave={() => clear()}
      onContextMenu={(e) => {
        // Prevent native context menu
        e.preventDefault();
      }}
      onClick={(e) => {
        // If long press was triggered or the user moved their finger/mouse (drag), don't treat as a tap
        if (triggeredRef.current || isMovedRef.current) return;
        
        // Let buttons and links handle their own clicks (they should call stopPropagation)
        // This is a safety check in case they don't
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a')) return;

        onTapReply(comment);
      }}
    >
      {children}
    </div>
  );
}
