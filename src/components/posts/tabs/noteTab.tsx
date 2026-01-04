"use client";

import React from "react";

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
    <>
      <label className="sr-only">Write a note</label>

      <div
        className="h-64 rounded-2xl border border-dashed border-slate-300 bg-slate-50 
        flex flex-col items-center justify-center gap-4
        hover:border-dotted hover:border-blue-500 hover:bg-blue-50
        transition-all duration-200 cursor-pointer"
      >
        <img src="/assets/images/post.png" alt="Write a note" className="h-30 w-34 opacity-80" />

        <p className="text-sm text-slate-500 font-medium">Write text to generate an image</p>

        <button
          onClick={openCreateModal}
          className="mt-2 rounded-full bg-red-500 px-6 py-2 text-sm font-medium text-white shadow hover:bg-red-600 active:scale-95 transition"
        >
          Write a note
        </button>
      </div>

    </>
  );
}
