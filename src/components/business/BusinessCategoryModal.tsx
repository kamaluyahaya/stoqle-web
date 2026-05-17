"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shirt,
  Trophy,
  Home,
  Sparkles,
  Utensils,
  Laptop,
  Palette,
  Leaf,
  Gamepad2,
  Baby,
  X,
  Check,
  ChevronRight,
  Info
} from "lucide-react";
import { fetchCategoryPresets } from "@/src/lib/api/categoryApi";

type CategoryOption = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
};

const CATEGORIES: CategoryOption[] = [
  { id: "Fashions", label: "Fashions", description: "Clothing, apparel, and fashion accessories for all styles.", icon: <Shirt className="w-5 h-5" />, color: "bg-pink-50 text-pink-500 border-pink-100" },
  { id: "Sports", label: "Sports", description: "Equipment, gear, and sportswear for active lifestyles.", icon: <Trophy className="w-5 h-5" />, color: "bg-blue-50 text-blue-500 border-blue-100" },
  { id: "Home", label: "Home", description: "Furniture, decor, and home improvement essentials.", icon: <Home className="w-5 h-5" />, color: "bg-orange-50 text-orange-500 border-orange-100" },
  { id: "Beauty", label: "Beauty", description: "Skincare, makeup, and premium personal care products.", icon: <Sparkles className="w-5 h-5" />, color: "bg-purple-50 text-purple-500 border-purple-100" },
  { id: "Food", label: "Food", description: "Restaurants, groceries, and delicious edible delights.", icon: <Utensils className="w-5 h-5" />, color: "bg-red-50 text-red-500 border-red-100" },
  { id: "Tech", label: "Tech", description: "Gadgets, electronics, and innovative digital solutions.", icon: <Laptop className="w-5 h-5" />, color: "bg-slate-50 text-slate-500 border-slate-100" },
  { id: "Craft", label: "Craft", description: "Handmade goods, art supplies, and unique DIY kits.", icon: <Palette className="w-5 h-5" />, color: "bg-indigo-50 text-indigo-500 border-indigo-100" },
  { id: "Fresh", label: "Fresh", description: "Organic produce and farm-to-table perishable items.", icon: <Leaf className="w-5 h-5" />, color: "bg-green-50 text-green-500 border-green-100" },
  { id: "Toys", label: "Toys", description: "Games, puzzles, and entertainment for all age groups.", icon: <Gamepad2 className="w-5 h-5" />, color: "bg-cyan-50 text-cyan-500 border-cyan-100" },
  { id: "Kids", label: "Kids", description: "Baby gear, children's apparel, and nursery essentials.", icon: <Baby className="w-5 h-5" />, color: "bg-rose-50 text-rose-500 border-rose-100" },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onSelected: (val: string) => void;
  title?: string;
};

const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 40,
  mass: 1
} as const;

export default function BusinessCategoryModal({
  isOpen,
  onClose,
  value,
  onSelected,
  title = "Select Business Category"
}: Props) {
  const [selected, setSelected] = useState(value);
  const [presets, setPresets] = useState<Record<string, string[]>>({});
  const [loadingPresets, setLoadingPresets] = useState(false);

  useEffect(() => {
    setSelected(value);
  }, [value, isOpen]);

  useEffect(() => {
    async function load() {
      try {
        setLoadingPresets(true);
        const res = await fetchCategoryPresets();
        if (res?.data) {
          setPresets(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch category presets", err);
      } finally {
        setLoadingPresets(false);
      }
    }
    if (isOpen) load();
  }, [isOpen]);

  const handleConfirm = () => {
    if (selected) {
      onSelected(selected);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 40 }}
            transition={springTransition}
            className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[85dvh] sm:max-w-xl bg-white rounded-none sm:rounded-[0.5rem] shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-6 sm:px-8 pt-8 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-lg font-bold text-slate-900">{title}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            {/* List */}
            <motion.div
              layout
              className="px-4 sm:px-8 py-4 overflow-y-auto flex-1 no-scrollbar space-y-3"
            >
              {CATEGORIES.map((cat) => {
                const isSelected = selected === cat.id;
                const subcategories = presets[cat.id.toLowerCase()] || [];

                return (
                  <motion.div
                    key={cat.id}
                    layout
                    transition={springTransition}
                    className={`rounded-[0.5rem] border-1 transition-colors duration-300 overflow-hidden
                      ${isSelected
                        ? "border-rose-500 bg-rose-50/50 shadow-rose-100"
                        : "border-slate-100 bg-slate-50/30 hover:border-slate-200"
                      }
                    `}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(cat.id)}
                      className="w-full flex items-center gap-4 p-2 text-left focus:outline-none"
                    >
                      <motion.div
                        layout
                        className={`flex-shrink-0 w-12 h-12 rounded-[0.5rem] flex items-center justify-center transition-transform duration-200 ${isSelected ? 'scale-110 shadow-sm' : ''} ${cat.color}`}
                      >
                        {cat.icon}
                      </motion.div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <motion.span
                            layout
                            className={`text-sm font-bold ${isSelected ? "text-rose-600" : "text-slate-900"}`}
                          >
                            {cat.label}
                          </motion.span>
                          {isSelected && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                              <Check className="w-4 h-4 text-rose-500" strokeWidth={3} />
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {!isSelected && (
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      )}
                    </button>

                    <AnimatePresence initial={false}>
                      {isSelected && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={springTransition}
                          className="px-4 pb-4 border-t border-rose-100/50 pt-3"
                        >
                          <p className="text-xs leading-relaxed font-medium mb-3">
                            {cat.description}
                          </p>

                          {subcategories.length > 0 && (
                            <div className="bg-white/60 rounded-xl p-3 border border-rose-100/30">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-400  mb-2">
                                <Info className="w-3 h-3" />
                                Sub-categories included
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {subcategories.map((sub, i) => (
                                  <motion.span
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.03 }}
                                    className="px-2 py-1 bg-rose-50 border border-rose-100 rounded-md text-[10px] font-medium text-rose-600"
                                  >
                                    {sub}
                                  </motion.span>
                                ))}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-2 italic">
                                These will be automatically added to your store to help you get started.
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Footer */}
            <div className="p-6 sm:p-8 bg-white border-t border-slate-50">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selected}
                className={`w-full py-3 rounded-full font-bold transition-all shadow-xl
                  ${selected
                    ? "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-100"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                  }
                `}
              >
                Confirm Selection
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
