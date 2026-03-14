"use client";

import React from "react";
import { PencilIcon, SparklesIcon, CursorArrowRaysIcon } from "@heroicons/react/24/outline";

export default function NoteTab({
  noteText,
  setNoteText,
  openCreateModal,
  submitNote,
}: {
  noteText: string;
  setNoteText: (s: string) => void;
  openCreateModal: () => void;
  submitNote: () => void;
}) {
  return (
    <div className="space-y-6">
      <div
        onClick={openCreateModal}
        className="group relative h-80 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 hover:border-red-400 hover:bg-red-50/20 transition-all duration-500 ease-out cursor-pointer flex flex-col items-center justify-center overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="relative mb-6">
          <div className="absolute inset-0 bg-red-400/20 blur-2xl rounded-xl scale-150 group-hover:scale-[2] transition-transform duration-700" />
          <div className="relative h-20 w-20 bg-white rounded-3xl shadow-xl shadow-slate-200/50 flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300">
            <PencilIcon className="w-10 h-10 text-red-500" />
          </div>
          <div className="absolute -top-2 -right-2 h-8 w-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white scale-0 group-hover:scale-100 transition-transform duration-500 delay-100">
            <SparklesIcon className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* <h3 className="text-xl font-black text-slate-900 mb-2">Write a Smart Note</h3> */}

        <div className="mt-8 flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-100 shadow-sm text-[10px] font-black text-slate-400  tracking-widest group-hover:text-red-500 transition-colors">
          <CursorArrowRaysIcon className="w-3 h-3" />
          Click to start writing
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">

      </div>
    </div>
  );
}
