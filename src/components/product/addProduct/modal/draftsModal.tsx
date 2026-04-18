"use client";
import React from "react";
import { ProductDraft } from "@/src/types/product";

interface DraftsModalProps {
    open: boolean;
    drafts: ProductDraft[];
    onClose: () => void;
    onSelect: (draft: ProductDraft) => void;
    onDelete: (id: string) => void;
}

export default function DraftsModal({
    open,
    drafts,
    onClose,
    onSelect,
    onDelete,
}: DraftsModalProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white lg:rounded-2xl md:rounded-2xl rounded-t-2xl shadow-xl p-5 z-10 h-[70vh] sm:h-auto flex flex-col">
                <div className="flex items-center justify-between border-b pb-4 mb-4 border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900">Your Drafts ({drafts.length})</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {drafts.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <p>No drafts found.</p>
                        </div>
                    ) : (
                        drafts.map((draft) => (
                            <div
                                key={draft.id}
                                className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-rose-200 hover:bg-rose-50/30 transition-all cursor-pointer"
                                onClick={() => onSelect(draft)}
                            >
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-slate-900 truncate">
                                        {draft.title || "Untitled Product"}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                        <span>{draft.category || "No category"}</span>
                                        <span>•</span>
                                        <span>{new Date(draft.lastSaved).toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(draft.id);
                                        }}
                                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-100 rounded-lg transition-all"
                                        title="Delete draft"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-6 pt-4 ">
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-full border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
