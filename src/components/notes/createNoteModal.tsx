// src/components/modal/CreateNoteModal.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/src/context/authContext";
import Swal from "sweetalert2";
import DefaultInput from "@/src/components/input/default-input-post";
import { motion, AnimatePresence } from "framer-motion";
import {
  XMarkIcon,
  CheckIcon,
  LockOpenIcon,
  LockClosedIcon,
  UsersIcon
} from "@heroicons/react/24/outline";
import { API_BASE_URL } from "@/src/lib/config";
import { getCurrentLocationName, getCachedLocationName, getCurrentCoordinates } from "@/src/lib/location";
import { isOffline } from "@/src/lib/api/handler";

type Visibility = "public" | "private" | "friends";

type BackgroundConfig = {
  seed?: number;
  template?: "gradient" | "stripes" | "solid" | "grid" | "diagonal" | "dots";
  patternType?: "horizontal" | "vertical" | "both" | "diagonal";
  startColor?: string;
  endColor?: string;
  emojis?: string[];
  emojiBlur?: boolean; // New: toggle for blurrose emojis
  stripeCount?: number;
  lineSpacing?: number;
  rotation?: number;
  textStyle?: { color?: string; fontSize?: number; fontWeight?: string };
  text?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (post: any) => void;
};

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const palettes = [
  ["#FFEDD5", "#FED7AA"],
  ["#FDE68A", "#FCA5A5"],
  ["#E9D5FF", "#C4B5FD"],
  ["#D1FAE5", "#A7F3D0"],
  ["#E0F2FE", "#BFDBFE"],
  ["#FEF3C7", "#FDE68A"],
  ["#FFE4E6", "#FFC4D6"],
  ["#FFF7ED", "#FFEFC7"],
  ["#FEE2E2", "#FECACA"],
  ["#FEEBC8", "#FCD34D"],
  ["#F3E8FF", "#E9D5FF"],
  ["#E6FFFA", "#CFFAFE"],
  ["#FFF1F2", "#FFE4E6"],
  ["#FFFFFF", "#F8FAFC"], // White/Clean
  ["#FDF2F8", "#FCE7F3"], // Soft Pink
  ["#F472B6", "#DB2777"], // Vibrant Pink
];





export default function CreateNoteModal({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState(0); // 0 write, 1 backgrounds & preview, 2 details & post
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");

  const [backgrounds, setBackgrounds] = useState<BackgroundConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<BackgroundConfig | null>(null);
  const [posting, setPosting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const { user, token, ensureAccountVerified } = useAuth();
  const router = useRouter();

  // derive seed from logged-in user if available (localStorage.user) else random
  const userSeed = useMemo(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      if (raw) {
        const u = JSON.parse(raw);
        const id = Number(u?.user_id ?? u?.id ?? 0);
        if (id) return id;
        const s = (u?.email ?? u?.full_name ?? u?.name ?? "").toString();
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
        return Math.abs(h) || Date.now();
      }
    } catch { }
    return Math.floor(Math.random() * 1e9);
  }, [open]);

  // helper: truncate text for thumbnail
  const truncate = (str?: string, n = 40) => {
    if (!str) return "";
    return str.length > n ? str.slice(0, n - 1) + "…" : str;
  };

  // fallback deterministic generator (keeps previous behaviour)
  const generateFallbackBackgrounds = (seed: number, count = 20) => {
    const rng = mulberry32(seed);
    const list: BackgroundConfig[] = [];

    const emojiSets = [
      ["✨", "☁️", "🌙"], ["🌸", "🎀", "💖"], ["🔥", "⚡", "🚀"],
      ["🎨", "🎭", "🖌️"], ["🌿", "🍃", "🌳"], ["💡", "🧠", "📚"]
    ];

    for (let i = 0; i < count; i++) {
      const p = palettes[Math.floor(rng() * palettes.length)];
      const stylePick = rng();

      let template: BackgroundConfig["template"] = "gradient";
      let patternType: BackgroundConfig["patternType"] = "horizontal";
      let emojiBlur = false;
      let emojis: string[] = [];

      // Assign Unique Style Profiles
      if (stylePick > 0.8) {
        template = "grid"; // Modern graph paper style
        patternType = "both";
      } else if (stylePick > 0.6) {
        template = "diagonal"; // High energy diagonal lines
        patternType = "diagonal";
      } else if (stylePick > 0.4) {
        template = "stripes"; // Notebook/Lined paper style
        patternType = "horizontal";
        emojiBlur = true; // Blurrose aesthetic emojis
        emojis = emojiSets[Math.floor(rng() * emojiSets.length)];
      } else {
        template = "dots"; // Minimalist dotted background
        emojis = rng() > 0.5 ? emojiSets[Math.floor(rng() * emojiSets.length)] : [];
      }

      const cfg: BackgroundConfig = {
        seed: Math.floor(rng() * 1e9),
        template,
        patternType,
        startColor: p[0],
        endColor: p[1] ?? p[0],
        emojis,
        emojiBlur,
        lineSpacing: 20 + Math.floor(rng() * 30),
        textStyle: {
          color: p[0] === "#FFFFFF" ? "#1e293b" : "#111827",
          fontSize: 32,
          fontWeight: "800"
        },
      };
      list.push(cfg);
    }
    return list;
  };

  // try to fetch backgrounds from backend (randomized by seed). fallback to generator if fetch fails.
  useEffect(() => {
    if (!open) return;

    let mounted = true;
    const base = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";

    const fetchFromBackend = async () => {
      if (!base) {
        // no base configurose -> fallback
        const fb = generateFallbackBackgrounds(userSeed);
        if (!mounted) return;
        setBackgrounds(fb);
        setSelectedConfig(fb[0] ?? null);
        return;
      }

      try {
        // attempt endpoint that many backends use; backend should accept seed and count to produce consistent random list
        const url = `${base.replace(/\/$/, "")}/api/backgrounds/random?seed=${encodeURIComponent(String(userSeed))}&count=20`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Bad response");
        const json = await res.json().catch(() => null);
        // backend might return { backgrounds: [...] } or an array directly
        const arr: any[] = Array.isArray(json) ? json : json?.backgrounds ?? json?.data ?? json?.items ?? [];
        if (!Array.isArray(arr) || arr.length === 0) throw new Error("No backgrounds");

        const mapped: BackgroundConfig[] = arr.map((item: any, i: number) => {
          const palette = palettes[i % palettes.length];
          return {
            seed: item.seed ?? item.id ?? Math.floor(Math.random() * 1e9),
            template: item.template ?? item.type ?? "gradient",
            startColor: item.startColor ?? item.start_color ?? (item.colors && item.colors[0]) ?? palette[0],
            endColor: item.endColor ?? item.end_color ?? (item.colors && item.colors[1]) ?? palette[1],
            stripeCount: item.stripeCount ?? item.stripe_count ?? item.stripes ?? 4,
            lineSpacing: item.lineSpacing ?? item.line_spacing ?? 20,
            rotation: item.rotation ?? 0,
            emojis: item.emojis ?? (item.emoji ? ("" + item.emoji).split(",") : undefined),
            textStyle:
              item.textStyle ??
              (item.textColor || item.fontSize || item.fontWeight
                ? { color: item.textColor ?? "#111827", fontSize: Number(item.fontSize ?? 28), fontWeight: item.fontWeight ?? "700" }
                : undefined),
            text: item.text ?? undefined,
          } as BackgroundConfig;
        });

        if (!mounted) return;
        setBackgrounds(mapped);
        setSelectedConfig(mapped[0] ?? null);
      } catch (e) {
        // fallback deterministic generation
        const fb = generateFallbackBackgrounds(userSeed);
        if (!mounted) return;
        setBackgrounds(fb);
        setSelectedConfig(fb[0] ?? null);
      }
    };

    fetchFromBackend();

    return () => {
      mounted = false;
    };
  }, [userSeed, open]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      // reset internal state when closed
      setStep(0);
      setText("");
      setTitle("");
      setVisibility("public");
      setBackgrounds([]);
      setSelectedConfig(null);
      setPosting(false);
    }
  }, [open]);

  if (!open) return null;

  const goNext = () => setStep((s) => Math.min(2, s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const buildConfigPayload = (): BackgroundConfig => {
    return {
      ...(selectedConfig ?? {}),
      text,
    };
  };

  const handlePost = async () => {
    if (isOffline()) {
      toast.error("No internet connection. Please connect to internet to post your note.");
      return;
    }

    // 1. Ensure verified before any backend interaction
    const isVerified = await ensureAccountVerified();
    if (!isVerified) return; // verification failed or was cancelled

    try {
      setPosting(true);
      const base = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";
      if (!base) throw new Error("API base not configurose (NEXT_PUBLIC_API_URL)");

      const cfg = buildConfigPayload();

      // Capture current location for the note
      const [freshLocation, freshCoords] = await Promise.all([
        getCurrentLocationName(),
        getCurrentCoordinates()
      ]);
      const location = freshLocation || getCachedLocationName();

      const body: any = {
        text: title || null,
        subtitle: title || null,
        config: JSON.stringify(cfg),
        privacy: visibility,
        cover_type: "note",
        location: location || null,
        latitude: freshCoords?.latitude || null,
        longitude: freshCoords?.longitude || null,
      };

      // Call the backend directly — IP extraction is handled by the Express backend using getClientIp(req)
      const res = await fetch(`${API_BASE_URL}/api/social`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403 || res.status === 429) {
          Swal.fire({
            title: "Security Alert",
            text: json?.message || json?.error || "Action restricted by security engine.",
            icon: "error",
            confirmButtonColor: "#e11d48",
          });
          setPosting(false);
          return;
        }
        throw new Error(json?.message || json?.error || "Failed to create note");
      }

      const p = json?.data?.post || json?.post || json;
      window.dispatchEvent(new CustomEvent("post-created", { detail: p }));

      if (onCreated) {
        onCreated(p);
        return;
      }

      toast.success("Note posted successfully");
      router.push("/profile?tab=Notes");
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Failed to post note");
    } finally {
      setPosting(false);
    }
  };

  const PreviewCard = ({ cfg, compact = false }: { cfg: BackgroundConfig | null; compact?: boolean }) => {
    if (!cfg) return null;

    const { template, startColor, endColor, lineSpacing = 25, emojiBlur, emojis, seed } = cfg;

    // 1. Determine Base CSS
    const baseBg = endColor ? `linear-gradient(135deg, ${startColor}, ${endColor})` : startColor;

    let patternCSS = "";
    let bgSize = "auto";

    // 2. Apply Unique Patterns
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

    // 3. Crazy Font Selection Logic
    const crazyFonts = [
      "'Courier New', Courier, monospace",
      "'Brush Script MT', cursive",
      "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
      "'Comic Sans MS', 'Comic Sans', cursive",
      "Georgia, serif",
      "'Trebuchet MS', sans-serif"
    ];
    // Select a font based on the seed so it stays consistent for that background
    const selectedFont = crazyFonts[(seed || 0) % crazyFonts.length];

    // 4. Content Alignment Logic
    const displayLines = text || cfg?.text || "Your unique note style";
    const isLongText = displayLines.length > 120;

    return (
      <div
        className="w-full rounded-2xl overflow-hidden relative flex items-center border border-slate-100 shadow-inner"
        style={{
          backgroundColor: startColor,
          backgroundImage: patternCSS ? `${patternCSS}, ${baseBg}` : baseBg,
          backgroundSize: bgSize,
          // If text is long, we align the container to the start (left)
          justifyContent: isLongText ? "flex-start" : "center",
        }}
      >
        {/* Layer: Decorative Emojis */}
        {emojis && emojis.length > 0 && (
          <div
            className="absolute inset-0 flex items-center justify-around opacity-40 pointer-events-none"
            style={{ filter: emojiBlur ? "blur(12px)" : "none" }}
          >
            {emojis.map((emoji, idx) => (
              <span key={idx} className="text-7xl transform rotate-12 select-none">
                {emoji}
              </span>
            ))}
          </div>
        )}

        {/* Layer: Text Content */}
        <div
          className="relative z-10 w-full p-8 flex flex-col"
          style={{
            minHeight: compact ? 220 : 380,
            // Handle the vertical/horizontal alignment of the container
            justifyContent: isLongText ? "flex-start" : "center",
            alignItems: isLongText ? "flex-start" : "center",
            textAlign: isLongText ? "left" : "center",
          }}
        >
          <div
            className="max-w-full break-words"
            style={{
              color: cfg?.textStyle?.color ?? "#111827",
              fontSize: cfg?.textStyle?.fontSize ?? 28,
              fontWeight: cfg?.textStyle?.fontWeight ?? "800",
              lineHeight: 1.4, // Increased for readability with new lines
              fontFamily: selectedFont, // Crazy Font applied here
              whiteSpace: "pre-wrap", // THIS MAINTAINS THE NEXT LINE / LINE BREAKS
              textShadow: startColor === "#FFFFFF" ? "none" : "0 2px 10px rgba(0,0,0,0.05)"
            }}
          >
            {displayLines}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* backdrop: dark + slight blur */}
      <div className="fixed inset-0 z-[4000] bg-black/50 " onClick={onClose} />

      <div className="fixed inset-0 z-[4100] flex items-center justify-center md:p-8">
        <div
          className="w-full h-full md:h-[90vh] md:max-h-[92vh] md:max-w-4xl bg-green-50 rounded-none md:rounded-2xl shadow-xl overflow-hidden flex flex-col"
          role="dialog"
          aria-modal="true"
        >
          {/* header */}
          <div className="flex items-center justify-between p-4 ">
            <div className="flex items-center gap-3"></div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-bold text-slate-700 text-lg">Text note</label>
            </div>

            <div className="flex items-center gap-1">
              {/* top-right close icon */}
              <button
                onClick={onClose}
                aria-label="Close create note modal"
                className="rounded-full p-2 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto lg:px-10 lg:p-6 p-4">
            {/* Step 0: Big tall input for notes (placeholder: "Say Something") */}
            {step === 0 && (
              <div className="h-full flex flex-col gap-6">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={!isFocused ? "Say Something" : ""}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className={
                    "w-full h-full min-h-[360px] p-6 pt-20 bg-white rounded-2xl resize-none " +
                    "text-slate-800 text-lg leading-relaxed " +
                    "placeholder:text-4xl placeholder:font-semibold placeholder:text-slate-400 " +
                    "outline-none focus:outline-none focus:ring-0 focus:border-transparent " +
                    "text-left"
                  }
                  style={{
                    fontSize: "20px",
                    caretColor: "#ef4444",
                    lineHeight: 1.5,
                  }}
                />

                {/* Action */}
                <button
                  onClick={goNext}
                  disabled={!text.trim()}
                  className="
      w-full
      px-4
      py-2
      rounded-full
      bg-rose-500
      text-white
      font-medium
      transition
      active:scale-95
      disabled:opacity-40
      disabled:cursor-not-allowed
      hover:bg-rose-500
    "
                >
                  Next
                </button>
              </div>
            )}

            {/* Step 1: Background selection + large live preview */}
            {step === 1 && (
              <div className="flex flex-col gap-6">
                <div>
                  <div className="mt-3">
                    <PreviewCard cfg={selectedConfig} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-900">Choose a background</label>
                  <div className="overflow-x-auto py-2">
                    <div className="flex gap-3 items-center">

                      {backgrounds.map((b, i) => {
                        const selected = selectedConfig?.seed === b.seed;

                        // Pattern Logic for Thumbnail
                        const baseBg = b.endColor ? `linear-gradient(135deg, ${b.startColor}, ${b.endColor})` : b.startColor;
                        let thumbPattern = "";
                        let thumbSize = "auto";
                        const spacing = (b.lineSpacing || 25) / 4; // Scale down pattern for small thumb
                        const thumbText = truncate(text?.trim() || b.text || b.emojis?.slice(0, 3).join(" ") || b.template || "", 36);

                        if (b.template === "grid") {
                          thumbPattern = `linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)`;
                          thumbSize = `${spacing}px ${spacing}px`;
                        } else if (b.template === "diagonal") {
                          thumbPattern = `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.2) 4px, rgba(255,255,255,0.2) 8px)`;
                        } else if (b.template === "dots") {
                          thumbPattern = `radial-gradient(rgba(0,0,0,0.1) 1px, transparent 0)`;
                          thumbSize = `6px 6px`;
                        }

                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedConfig(b)}
                            className={`flex-none w-20 h-20 rounded-xl shadow-sm border overflow-hidden transform transition active:scale-95 relative ${selected ? "ring-4 ring-rose-400 border-white scale-105 z-10" : "border-slate-200 hover:scale-[1.03]"
                              }`}
                            style={{
                              backgroundColor: b.startColor,
                              backgroundImage: thumbPattern ? `${thumbPattern}, ${baseBg}` : baseBg,
                              backgroundSize: thumbSize,
                            }}
                            aria-pressed={selected}
                          >
                            {/* Mini Emoji Preview */}
                            {b.emojis && b.emojis.length > 0 && (
                              <div
                                className="absolute inset-0 flex items-center justify-center opacity-40"
                                style={{ filter: b.emojiBlur ? "blur(2px)" : "none" }}
                              >
                                <span className="text-xl transform rotate-12">{b.emojis[0]}</span>
                              </div>
                            )}

                            {/* Indicator for style type (optional hint) */}

                            <div className="text-xs mt-1 text-slate-700 break-words px-1">{thumbText}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-sm text-slate-900">Text color / size</label>
                    <input
                      type="color"
                      value={selectedConfig?.textStyle?.color ?? "#111827"}
                      onChange={(e) => setSelectedConfig((s) => ({ ...(s ?? {}), textStyle: { ...(s?.textStyle ?? {}), color: e.target.value } }))}
                      className="w-10 h-10 p-0"
                    />
                    <input
                      type="range"
                      min={16}
                      max={64}
                      value={selectedConfig?.textStyle?.fontSize ?? 32}
                      onChange={(e) => setSelectedConfig((s) => ({ ...(s ?? {}), textStyle: { ...(s?.textStyle ?? {}), fontSize: Number(e.target.value) } }))}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={goBack} className="px-4 py-2 rounded-md bg-slate-100 text-slate-800">
                    Back
                  </button>

                  <div className="flex gap-3">
                    <button onClick={goNext} className="px-4 py-2 rounded-md bg-rose-500 hover:bg-rose-500 max-w-4xl text-white active:scale-95 transition">
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Title, visibility, and post */}
            {step === 2 && (
              <div className="flex gap-10 justify-between flex-col w-full p-4 rounded-2xl h-full bg-white">
                <div className="mt-3">
                  <PreviewCard cfg={selectedConfig} />
                </div>

                <div className="justify-between flex flex-col space-y-5">
                  <DefaultInput
                    value={title}
                    onChange={(e: any) => setTitle(e.target.value)}
                    placeholder="Add title"
                  />

                  <div className="pt-2">
                    <button
                      onClick={() => setIsPrivacyModalOpen(true)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors group"
                    >
                      {visibility === "public" && <LockOpenIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500" />}
                      {visibility === "private" && <LockClosedIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500" />}
                      {visibility === "friends" && <UsersIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500" />}
                      <span className="text-[10px] font-black  text-slate-500 group-hover:text-rose-500">
                        {visibility === "public" ? "Public" : visibility === "private" ? "Private" : "Friends Only"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Visibility Select Modal */}
                <AnimatePresence>
                  {isPrivacyModalOpen && (
                    <div className="fixed inset-0 z-[5000] flex items-end justify-center">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsPrivacyModalOpen(false)}
                        className="absolute inset-0 bg-slate-900/60"
                      />
                      <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="relative w-full max-w-xl bg-white rounded-t-[0.5rem] shadow-2xl p-8 space-y-6 pb-12"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-black text-slate-400">Visibility</h3>
                          <button
                            onClick={() => setIsPrivacyModalOpen(false)}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                          >
                            <XMarkIcon className="w-5 h-5 text-slate-400" />
                          </button>
                        </div>

                        <div className="space-y-3">
                          {[
                            { id: "public", label: "Public", desc: "Anyone on Stoqle can see this", icon: LockOpenIcon },
                            { id: "private", label: "Private", desc: "Only you can see this", icon: LockClosedIcon },
                            { id: "friends", label: "Friends Only", desc: "Only your friends can see this", icon: UsersIcon },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => {
                                setVisibility(opt.id as any);
                                setIsPrivacyModalOpen(false);
                              }}
                              className={`w-full flex items-center justify-between p-3 rounded-[0.5rem] transition-all border-2 ${visibility === opt.id
                                ? "bg-rose-50 border-rose-100 text-rose-500 shadow-sm"
                                : "bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100"
                                }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl ${visibility === opt.id ? "bg-white shadow-sm" : "bg-white/50"}`}>
                                  <opt.icon className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                  <span className="text-sm font-bold block">{opt.label}</span>
                                  <span className="text-[10px] opacity-60 font-medium block mt-0.5">{opt.desc}</span>
                                </div>
                              </div>
                              {visibility === opt.id && (
                                <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center">
                                  <CheckIcon className="w-4 h-4 text-white stroke-[3]" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                {/* Footer */}
                <div className="mt-4 flex flex-col gap-3 ">
                  {/* Action row */}
                  <div className="flex items-center justify-between pt-1 gap-3">
                    <button onClick={goBack} className="px-4 py-2 rounded-full bg-slate-300 text-slate-800">
                      Back
                    </button>

                    <button
                      onClick={handlePost}
                      disabled={posting}
                      className="
          px-4 py-2
          rounded-full
          w-full
          bg-rose-500
          hover:bg-rose-500
          text-white
          active:scale-95
          transition
          disabled:opacity-60
        "
                    >
                      {posting ? "Posting..." : "Post"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
