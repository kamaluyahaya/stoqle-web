// src/components/product/ParamsEditor.tsx
"use client";
import React from "react";
import type { ParamKV } from "@/src/types/product";

type Props = {
  params: ParamKV[];
  onAdd: () => void;
  onEdit: (param: ParamKV) => void;
  onRemove: (id: string) => void;
};

export default function ParamsEditor({ params, onAdd, onEdit, onRemove }: Props) {
  return (
    <div className="border-t pt-4 border-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">Product parameters</label>
          <div className="text-xs text-slate-500">
            Add custom attributes like material, weight, warranty, etc.
          </div>
        </div>

        {params.length !== 0 ? (<button
          onClick={onAdd}
          className="px-3 py-1 rounded-lg bg-slate-100 text-sm"
        >
          + Add parameter
        </button>
        ) : (<></>)}
      </div>

      {params.length === 0 ? (
        <div className="mt-3 text-slate-400 text-sm text-center">
          No parameters added yet.
          <br />
          <button
            onClick={onAdd}
            className="px-3 py-1 rounded-lg bg-rose-400 text-white text-sm"
          >
            + Add parameter
          </button>
        </div>
      ) : (
        <div className="mt-4 grid-cols-1 border-slate-200 border sm:grid-cols-2 gap-3">
          {params.map((p) => (
            <div
              key={p.id}
              className="relative border-b border-slate-200 bg-white p-3 "
            >
              <div className="flex justify-between items-center">
                <div className="flex gap-2 items-center">
                  <div className="text-xs text-slate-400">{p.key}:</div>
                  <div className="font-medium text-sm">{p.value}</div>
                </div>

                <div className="flex gap-4 px-8">
                  <button
                    onClick={() => onEdit(p)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onRemove(p.id)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center shadow"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

          ))}
        </div>
      )}
    </div>
  );
}
