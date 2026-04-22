"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Zap, ShieldCheck, X, Sparkles, MessageSquare, Info } from "lucide-react";

type BotProps = {
  /** Business context */
  vendorName: string;
  /** Whether bot mode is currently active */
  isBotActive: boolean;
  /** Callback for quick actions (Check Stock, etc) */
  onQuickAction: (text: string) => void;
  /** Callback to manualy deactivate */
  onDeactivate: () => void;
};

/**
 * Redesigned Stoqle Bot UI: Assistant Console.
 * This component acts as a high-visibility mode indicator and quick-action launcher.
 * It no longer manages its own messages; all messages flow through the main chat database.
 */
export default function StoqleBot({
  vendorName,
  isBotActive,
  onQuickAction,
  onDeactivate
}: BotProps) {
  if (!isBotActive) return null;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="mb-4 mx-auto w-full max-w-2xl bg-white/80 backdrop-blur-xl border border-rose-100 rounded-3xl shadow-xl shadow-rose-500/5 overflow-hidden ring-1 ring-rose-50/50"
    >
      {/* Header Bar */}
      <div className="px-4 py-2 bg-gradient-to-r from-rose-500 via-rose-600 to-rose-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-md">
            <Bot size={16} className="text-white animate-pulse" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-rose-100 uppercase tracking-[0.2em]">Assistant Mode</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <h3 className="text-xs font-bold text-white">Assistant for {vendorName}</h3>
          </div>
        </div>
        
        <button 
          onClick={onDeactivate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all group active:scale-95"
        >
          <X size={12} className="group-hover:rotate-90 transition-transform" />
          <span className="text-[9px] font-black uppercase tracking-wider">End Session</span>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Intro / Status */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-rose-50 text-rose-600">
            <Sparkles size={20} />
          </div>
          <div className="flex-1">
            <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
              I&apos;m assisting with your inquiry while the team is away. I have access to **inventory**, **policies**, and **catalog** details.
            </p>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: "Check Stock", icon: <Zap size={12} />, text: "Do you have this in stock?" },
            { label: "Track Order", icon: <Package size={12} />, text: "Where is my order? I'd like to track my shipment." },
            { label: "Delivery", icon: <Info size={12} />, text: "What is your delivery policy?" },
            { label: "Returns", icon: <Sparkles size={12} />, text: "What is your return policy?" },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => onQuickAction(action.text)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-rose-200 hover:bg-rose-50 text-slate-700 hover:text-rose-600 transition-all group active:scale-95"
            >
              <span className="p-1 rounded-md bg-white border border-slate-100 group-hover:border-rose-100 text-slate-400 group-hover:text-rose-500 shadow-sm transition-colors">
                {action.icon}
              </span>
              <span className="text-[10px] font-bold whitespace-nowrap">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Footer Meta */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
          <div className="flex items-center gap-2 opacity-50 px-1">
            <ShieldCheck size={10} className="text-slate-400" />
            <span className="text-[8px] font-bold text-slate-400 tracking-wider uppercase">Grounding Verified • Catalog Sensitive</span>
          </div>
          <div className="px-2 py-1 rounded bg-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-tighter">
            AI Enhanced
          </div>
        </div>
      </div>
    </motion.div>
  );
}
