import { useState, useRef, useEffect, useCallback } from "react";
import { getNextZIndex } from "@/src/lib/utils/z-index";

interface UsePostModalUIProps {
  open: boolean;
  onCloseProp: () => void;
  showCommentsSheet: boolean;
}

export function usePostModalUI({
  open,
  onCloseProp,
  showCommentsSheet
}: UsePostModalUIProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [modalZIndex, setModalZIndex] = useState(() => getNextZIndex());
  const [computedWidth, setComputedWidth] = useState<number | null>(null);
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth >= 768 : false
  );

  const [lockHeight, setLockHeight] = useState<string | number>("100%");
  const [videoPortHeight, setVideoPortHeight] = useState<string | number>("100%");
  const [commentSheetHeight, setCommentSheetHeight] = useState<string | number>("0%");

  const modalRef = useRef<HTMLDivElement | null>(null);
  const leftMediaRef = useRef<HTMLDivElement | null>(null);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (open) {
      setModalZIndex(getNextZIndex());
      // Strict body/html scroll lock
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [open]);

  const onClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    onCloseProp();
  }, [onCloseProp, isClosing]);

  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Keyboard awareness
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleResize = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const h = window.innerHeight - vv.height;
      const padValue = h > 50 ? `${h}px` : 'env(safe-area-inset-bottom, 16px)';
      document.documentElement.style.setProperty('--kb-pad', padValue);
      if (modalRef.current) {
        modalRef.current.style.setProperty('--kb-pad', padValue);
      }
    };

    window.visualViewport.addEventListener("resize", handleResize);
    window.visualViewport.addEventListener("scroll", handleResize);
    handleResize();
    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("scroll", handleResize);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const baseH = typeof lockHeight === "number" ? lockHeight : window.innerHeight;
      if (showCommentsSheet) {
        setVideoPortHeight(baseH * 0.25);
        setCommentSheetHeight(baseH * 0.75);
      } else {
        setVideoPortHeight(baseH);
      }
    }
  }, [showCommentsSheet, lockHeight]);

  const computeAndSetModalWidth = useCallback((naturalW: number, naturalH: number) => {
    if (!modalRef.current) return;
    const RIGHT_PANEL_WIDTH = 400;
    const MODAL_MAX_WIDTH = 1200;
    const MODAL_MIN_WIDTH = 420;
    const LEFT_MIN_WIDTH = 260;
    const LEFT_MAX_WIDTH = MODAL_MAX_WIDTH - RIGHT_PANEL_WIDTH;

    const modalHeight = modalRef.current.clientHeight || Math.round(window.innerHeight * 0.94);
    const aspect = naturalW / Math.max(1, naturalH);
    let leftWidth = Math.round(aspect * modalHeight);
    leftWidth = Math.min(LEFT_MAX_WIDTH, Math.max(LEFT_MIN_WIDTH, leftWidth));
    let total = leftWidth + RIGHT_PANEL_WIDTH;
    total = Math.min(MODAL_MAX_WIDTH, Math.max(MODAL_MIN_WIDTH, total));
    setComputedWidth(total);
  }, []);

  const handleVideoRegister = useCallback((el: HTMLVideoElement | null, isVisible: boolean) => {
    if (isVisible) activeVideoRef.current = el;
  }, []);

  return {
    isClosing,
    modalZIndex,
    isLargeScreen,
    lockHeight,
    videoPortHeight,
    commentSheetHeight,
    modalRef,
    leftMediaRef,
    activeVideoRef,
    onClose,
    handleVideoRegister,
    computedWidth,
    setComputedWidth,
    computeAndSetModalWidth
  };
}
