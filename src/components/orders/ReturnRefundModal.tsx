"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, ShieldCheck, ChevronRight, HelpCircle } from "lucide-react";

type Props = {
    open: boolean;
    onClose: () => void;
    onConfirm: (data: { category: string; reason: string; explanation?: string }) => void;
    saleId: string | number;
    returnPolicy: any;
    loading?: boolean;
};

const CATEGORIES_FULL = [
    {
        id: 'no_reason',
        label: 'No-Reason',
        icon: '🟢',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-100',
        reasons: [
            'No longer needed',
            'Ordered by mistake',
            'Changed my mind',
            'Size/fit not suitable',
            'Don’t like the product'
        ]
    },
    {
        id: 'product_issues',
        label: 'Product Issues',
        icon: '🔴',
        color: 'text-rose-600',
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-100',
        reasons: [
            'Item damaged or defective',
            'Item not working properly',
            'Poor quality'
        ]
    },
    {
        id: 'wrong_missing',
        label: 'Wrong / Missing',
        icon: '🟡',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-100',
        reasons: [
            'Wrong item received',
            'Missing parts/accessories'
        ]
    },
    {
        id: 'not_as_described',
        label: 'Not as Described',
        icon: '🔵',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-100',
        reasons: [
            'Product differs from description/images',
            'Incorrect specifications'
        ]
    },
    {
        id: 'delivery_issues',
        label: 'Delivery Issues',
        icon: '🟣',
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-100',
        reasons: [
            'Arrived too late',
            'Package damaged during delivery'
        ]
    },
    {
        id: 'other',
        label: 'Other',
        icon: '⚫',
        color: 'text-slate-600',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-100',
        reasons: [
            'Other (requires explanation)'
        ]
    }
];

const CATEGORIES_RESTRICTED = [
    {
        id: 'product_issues',
        label: 'Product Issues',
        icon: '🔴',
        color: 'text-rose-600',
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-100',
        reasons: [
            'Item damaged or defective',
            'Item not working properly'
        ]
    },
    {
        id: 'wrong_missing',
        label: 'Wrong / Missing',
        icon: '🟡',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-100',
        reasons: [
            'Wrong item received',
            'Missing parts/accessories'
        ]
    },
    {
        id: 'not_as_described',
        label: 'Not as Described',
        icon: '🔵',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-100',
        reasons: [
            'Product differs from description/images',
            'Incorrect specifications'
        ]
    },
    {
        id: 'delivery_issues',
        label: 'Delivery Issues',
        icon: '🟣',
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-100',
        reasons: [
            'Package damaged during delivery'
        ]
    },
    {
        id: 'other',
        label: 'Other',
        icon: '⚫',
        color: 'text-slate-600',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-100',
        reasons: [
            'Other (requires explanation + review)'
        ]
    }
];

export default function ReturnRefundModal({
    open,
    onClose,
    onConfirm,
    saleId,
    returnPolicy,
    loading
}: Props) {
    const [step, setStep] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);
    const [selectedReason, setSelectedReason] = useState("");
    const [explanation, setExplanation] = useState("");

    const isSevenDay = returnPolicy?.seven_day_no_reason === true || String(returnPolicy?.seven_day_no_reason) === "1";
    const categories = isSevenDay ? CATEGORIES_FULL : CATEGORIES_RESTRICTED;

    useEffect(() => {
        if (open) {
            setStep(1);
            setSelectedCategory(null);
            setSelectedReason("");
            setExplanation("");
        }
    }, [open]);

    const handleCategorySelect = (cat: any) => {
        setSelectedCategory(cat);
        setStep(2);
    };

    const handleReasonSelect = (reason: string) => {
        setSelectedReason(reason);
        if (selectedCategory.id !== 'other') {
            // If not 'other', we could theoretically proceed, but let's allow optional explanation
        }
    };

    const handleConfirm = () => {
        if (!selectedCategory || !selectedReason) return;
        onConfirm({
            category: selectedCategory.label,
            reason: selectedReason,
            explanation: explanation
        });
    };

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, y: "100%" }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: "100%" }}
                        className="relative bg-white w-full sm:max-w-md rounded-t-[1.5rem] sm:rounded-3xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">Return & Refund</h3>
                                <p className="text-[10px] text-rose-500 font-bold tracking-widest uppercase mt-0.5">Order #{saleId}</p>
                            </div>
                            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Banner */}
                        <div className={`px-6 py-3 shrink-0 flex items-center gap-3 ${isSevenDay ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {isSevenDay ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
                            <p className="text-[10px] font-black uppercase tracking-wider">
                                {isSevenDay ? "🎯 7-Day No-Reason Return Supported" : "⚠️ Issue-based Return Window Only"}
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {step === 1 ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-bold text-slate-900">Why are you returning?</h4>
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">Step 1 of 2</span>
                                    </div>
                                    <div className="grid gap-3">
                                        {categories.map((cat) => (
                                            <button
                                                key={cat.id}
                                                onClick={() => handleCategorySelect(cat)}
                                                className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${cat.borderColor} ${cat.bgColor} hover:scale-[1.01] active:scale-[0.98]`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xl">{cat.icon}</span>
                                                    <div className="text-left">
                                                        <p className={`text-xs font-black sm:text-sm ${cat.color}`}>{cat.label}</p>
                                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">{cat.reasons.length} options available</p>
                                                    </div>
                                                </div>
                                                <ChevronRight size={16} className={cat.color} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <button 
                                                onClick={() => setStep(1)}
                                                className="text-[10px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1"
                                            >
                                                Back to Categories
                                            </button>
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">Step 2 of 2</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                            <span className="text-xl">{selectedCategory?.icon}</span>
                                            <div>
                                                <p className={`text-[10px] font-black uppercase tracking-widest ${selectedCategory?.color}`}>{selectedCategory?.label}</p>
                                                <p className="text-[11px] font-bold text-slate-900 mt-0.5">Select specific reason below</p>
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            {selectedCategory?.reasons.map((r: string) => (
                                                <button
                                                    key={r}
                                                    onClick={() => handleReasonSelect(r)}
                                                    className={`py-4 px-5 rounded-2xl border text-[11px] font-bold text-left transition-all ${selectedReason === r ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    {r}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {(selectedReason || selectedCategory?.id === 'other') && (
                                        <div className="space-y-3 pt-2">
                                            <div className="flex items-center justify-between px-1">
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Additional Explanation</label>
                                                <span className="text-[9px] text-slate-300 font-bold italic">{selectedCategory?.id === 'other' ? 'Required' : 'Optional'}</span>
                                            </div>
                                            <textarea
                                                value={explanation}
                                                onChange={(e) => setExplanation(e.target.value)}
                                                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-medium focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all outline-none resize-none"
                                                placeholder="Please provide more details for management review..."
                                                rows={4}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-50 shrink-0 bg-white">
                            <div className="flex items-start gap-3 p-4 bg-rose-50 rounded-2xl mb-4">
                                <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                                <p className="text-[10px] text-rose-800 font-bold leading-relaxed">
                                    This request will be reviewed by administrators. Payment will remain on hold until resolved.
                                </p>
                            </div>

                            <button
                                disabled={loading || step === 1 || !selectedReason || (selectedCategory?.id === 'other' && !explanation)}
                                onClick={handleConfirm}
                                className="w-full py-4 bg-slate-900 text-white rounded-full text-[11px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all disabled:opacity-30 disabled:grayscale"
                            >
                                {loading ? 'Processing Request...' : 'Submit Request'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
