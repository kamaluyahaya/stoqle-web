"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { safeFetch } from "@/src/lib/api/handler";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverlayComment {
  id: number;
  text: string;
  is_funny: boolean;
  is_positive: boolean;
}

interface ActiveBubble {
  key: string;
  originalId: number;
  text: string;
  is_funny: boolean;
  lane: number;
  duration: number;
  startedAt: number;
  bubbleWidth: number;
}

interface LaneInfo {
  // When the tail of the current comment clears the right entry edge
  // (new comment can start entering without visual overlap at the right)
  safeEntryAt: number;
  // When the current comment fully exits the LEFT side of the screen
  // A faster follower must wait until this before entering the same lane
  exitAt: number;
  // Speed (px/s) of the last comment in this lane
  lastSpeed: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const NUM_LANES = 3;
const START_DELAY_MS = 4000;

// Lane top positions (%) — upper region of video
const LANE_Y = [4, 12, 20];

// Speed tiers (px/s)
const SPEED_FAST = 130;  // len < 20  — zips across fast
const SPEED_MED  = 72;   // len 20–60 — comfortable read pace
const SPEED_SLOW = 38;   // len > 60  — slow glide

// Gap between tail of leader and head of follower (only for same/slower speed)
const SAFETY_GAP_PX = 90;

// Dispatch intervals — dynamic per comment speed
const DISPATCH_FAST_MS = 500;
const DISPATCH_MED_MS  = 900;
const DISPATCH_SLOW_MS = 1400;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSpeed(text: string): number {
  const l = text.length;
  if (l < 20) return SPEED_FAST;
  if (l <= 60) return SPEED_MED;
  return SPEED_SLOW;
}

function estimateBubbleWidth(text: string): number {
  return Math.min(24 + text.length * 7, 320);
}

function getDuration(text: string, cw: number): number {
  return (cw + estimateBubbleWidth(text)) / getSpeed(text); // seconds
}

function getDispatchInterval(speed: number): number {
  if (speed >= SPEED_FAST) return DISPATCH_FAST_MS;
  if (speed >= SPEED_MED)  return DISPATCH_MED_MS;
  return DISPATCH_SLOW_MS;
}

function makeLanes(): LaneInfo[] {
  return Array.from({ length: NUM_LANES }, () => ({
    safeEntryAt: 0,
    exitAt: 0,
    lastSpeed: 0,
  }));
}

function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  postId: string | number;
  isPlaying: boolean;
  containerWidth: number;
}

export function CommentOverlay({ postId, isPlaying, containerWidth }: Props) {
  const [pool, setPool]       = useState<OverlayComment[]>([]);
  const [bubbles, setBubbles] = useState<ActiveBubble[]>([]);
  const [ready, setReady]     = useState(false);

  const bubblesRef    = useRef<ActiveBubble[]>([]);
  const laneRef       = useRef<LaneInfo[]>(makeLanes());
  const queueRef      = useRef<OverlayComment[]>([]);
  const poolRef       = useRef<OverlayComment[]>([]);
  const isPlayingRef  = useRef(isPlaying);
  const readyRef      = useRef(false);
  const schedulerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { bubblesRef.current = bubbles; },    [bubbles]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { readyRef.current = ready; },         [ready]);
  useEffect(() => { poolRef.current = pool; },           [pool]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    (async () => {
      try {
        const json = await safeFetch<any>(`/api/social/${postId}/overlay-comments`);
        if (cancelled) return;
        const data: OverlayComment[] = (json?.data?.comments ?? []).map((c: any) => ({
          ...c,
          is_funny:    Boolean(c.is_funny),
          is_positive: Boolean(c.is_positive),
        }));
        if (!cancelled && data.length > 0) {
          setPool(data);
          queueRef.current = [...data].sort(() => Math.random() - 0.5);
        }
      } catch { /* non-critical background fetch */ }
    })();
    return () => { cancelled = true; };
  }, [postId]);

  // ── Warm-up ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying && pool.length > 0 && !ready) {
      startTimerRef.current = setTimeout(() => setReady(true), START_DELAY_MS);
    }
    if (!isPlaying && startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    return () => { if (startTimerRef.current) clearTimeout(startTimerRef.current); };
  }, [isPlaying, pool.length, ready]);

  // ── Remove bubble (via CSS animationend — suppressed while paused) ─────────
  const removeBubble = useCallback((key: string) => {
    setBubbles(prev => {
      const next = prev.filter(b => b.key !== key);
      bubblesRef.current = next;
      return next;
    });
  }, []);

  // ── Spawn ─────────────────────────────────────────────────────────────────
  const spawnInLane = useCallback((laneIndex: number, comment: OverlayComment) => {
    const cw  = containerWidth || 390;
    const bw  = estimateBubbleWidth(comment.text);
    const dur = getDuration(comment.text, cw);
    const now = performance.now();
    const spd = getSpeed(comment.text);
    const key = `${comment.id}-${laneIndex}-${now}`;

    laneRef.current[laneIndex] = {
      // Tail clears right entry edge after this time
      safeEntryAt: now + ((bw + SAFETY_GAP_PX) / spd) * 1000,
      // Comment fully exits the left side after its full duration
      exitAt: now + dur * 1000,
      lastSpeed: spd,
    };

    const bubble: ActiveBubble = {
      key, originalId: comment.id, text: comment.text,
      is_funny: comment.is_funny, lane: laneIndex,
      duration: dur, startedAt: now, bubbleWidth: bw,
    };

    setBubbles(prev => {
      const next = [...prev, bubble];
      bubblesRef.current = next;
      return next;
    });
  }, [containerWidth]);

  // ── Scheduler ─────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    if (!isPlayingRef.current || !readyRef.current) {
      schedulerRef.current = setTimeout(tick, 400);
      return;
    }

    // Refill queue
    if (queueRef.current.length === 0 && poolRef.current.length > 0) {
      queueRef.current = [...poolRef.current].sort(() => Math.random() - 0.5);
    }
    if (queueRef.current.length === 0) {
      schedulerRef.current = setTimeout(tick, 600);
      return;
    }

    const now       = performance.now();
    const activeIds = new Set(bubblesRef.current.map(b => b.originalId));

    // Find next unique comment not on screen
    let commentIndex = -1;
    for (let i = 0; i < queueRef.current.length; i++) {
      if (!activeIds.has(queueRef.current[i].id)) { commentIndex = i; break; }
    }
    if (commentIndex === -1) {
      schedulerRef.current = setTimeout(tick, 1200);
      return;
    }

    const nextComment = queueRef.current[commentIndex];
    const newSpeed    = getSpeed(nextComment.text);

    // ── Lane classification ────────────────────────────────────────────────
    // 
    // FREE:       Leader has fully exited the screen
    // FOLLOWABLE: Entry point is clear and new comment is NOT faster than the leader
    // WAIT:       Entry not yet clear but would eventually be followable
    // BLOCKED:    New comment is FASTER than the leader still on screen.

    const freeLanes:      number[] = [];
    const followLanes:    number[] = [];
    const waitCandidates: { lane: number; readyAt: number }[] = [];

    for (let i = 0; i < NUM_LANES; i++) {
      const lane = laneRef.current[i];

      const leaderGone  = now >= lane.exitAt || lane.lastSpeed === 0;
      const entryOpen   = now >= lane.safeEntryAt;
      const compatible  = newSpeed <= lane.lastSpeed; // same or slower = safe

      if (leaderGone) {
        freeLanes.push(i);
      } else if (entryOpen && compatible) {
        followLanes.push(i);
      } else if (!entryOpen && compatible) {
        waitCandidates.push({ lane: i, readyAt: lane.safeEntryAt });
      }
    }

    let chosenLane = -1;

    if (freeLanes.length > 0) {
      chosenLane = freeLanes[randInt(freeLanes.length)];
    } else if (followLanes.length > 0) {
      chosenLane = followLanes[randInt(followLanes.length)];
    } else if (waitCandidates.length > 0) {
      waitCandidates.sort((a, b) => a.readyAt - b.readyAt);
      const waitMs = Math.max(waitCandidates[0].readyAt - now + 20, 100);
      schedulerRef.current = setTimeout(tick, waitMs);
      return;
    } else {
      const soonestExit = Math.min(...laneRef.current.map(l => l.exitAt));
      const waitMs = Math.max(soonestExit - now + 30, 400);
      schedulerRef.current = setTimeout(tick, waitMs);
      return;
    }

    queueRef.current.splice(commentIndex, 1);
    spawnInLane(chosenLane, nextComment);

    schedulerRef.current = setTimeout(tick, getDispatchInterval(newSpeed));
  }, [spawnInLane]);

  // ── Start / stop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (ready && isPlaying && pool.length > 0) {
      if (!schedulerRef.current) {
        schedulerRef.current = setTimeout(tick, 50);
      }
    }
    if (!isPlaying && schedulerRef.current) {
      clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
    }
  }, [ready, isPlaying, pool.length, tick]);

  // ── Reset on post change ──────────────────────────────────────────────────
  useEffect(() => {
    setPool([]);
    setBubbles([]);
    bubblesRef.current = [];
    setReady(false);
    queueRef.current   = [];
    laneRef.current    = makeLanes();
    if (schedulerRef.current)  { clearTimeout(schedulerRef.current);  schedulerRef.current  = null; }
    if (startTimerRef.current) { clearTimeout(startTimerRef.current); startTimerRef.current = null; }
  }, [postId]);

  if (bubbles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {bubbles.map(b => (
        <CommentBubble
          key={b.key}
          bubble={b}
          isPlaying={isPlaying}
          containerWidth={containerWidth || 390}
          laneY={LANE_Y[b.lane]}
          onDone={removeBubble}
        />
      ))}
    </div>
  );
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function CommentBubble({
  bubble, isPlaying, containerWidth, laneY, onDone,
}: {
  bubble: ActiveBubble;
  isPlaying: boolean;
  containerWidth: number;
  laneY: number;
  onDone: (key: string) => void;
}) {
  const totalDistance = containerWidth + bubble.bubbleWidth + 20;
  const durationMs    = bubble.duration * 1000;
  const elapsed       = useRef(performance.now() - bubble.startedAt);

  return (
    <div
      style={{
        position: "absolute",
        top: `${laneY}%`,
        left: 0,
        width: "100%",
        height: 28,
        pointerEvents: "none",
      }}
    >
      <div
        onAnimationEnd={() => onDone(bubble.key)}
        style={{
          display:            "inline-flex",
          alignItems:         "center",
          gap:                5,
          animation:          `overlay-slide ${durationMs}ms linear`,
          animationDelay:     `-${elapsed.current}ms`,
          animationPlayState: isPlaying ? "running" : "paused",
          animationFillMode:  "forwards",
          whiteSpace:         "nowrap",
          ["--slide-distance" as any]: `${totalDistance}px`,
        }}
      >
        {bubble.is_funny && (
          <span style={{ fontSize: 13, lineHeight: 1 }}>😂</span>
        )}
        <span
          style={{
            fontSize:      13,
            fontWeight:    700,
            color:         "#ffffff",
            lineHeight:    1,
            letterSpacing: 0.1,
            textShadow:    "0 1px 6px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.6)",
            fontFamily:    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
          }}
        >
          {bubble.text}
        </span>
      </div>
    </div>
  );
}
