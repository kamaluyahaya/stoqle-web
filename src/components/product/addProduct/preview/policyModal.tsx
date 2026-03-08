import React from "react";

export default function PolicyModal({ open, title, body, onClose }: { open: boolean; title: string | null; body: string | null; onClose: () => void; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div onMouseDown={(e) => e.stopPropagation()} className="z-10 max-w-xl w-full bg-white rounded-lg p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">{title}</div>
          <button onClick={onClose} className="text-sm text-slate-500">Close</button>
        </div>
        <div className="text-sm text-slate-700 whitespace-pre-wrap">{body}</div>
      </div>
    </div>
  );
}