"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, Truck, RefreshCcw, Zap, HelpCircle } from "lucide-react";

type Props = {
    open: boolean;
    onClose: () => void;
    item: any;
};

export default function OrderSnapshotModal({ open, onClose, item }: Props) {
    React.useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [open]);

    // Move data processing above early return if possible, but we need item
    if (!item) return null;

    const safeParse = (data: any) => {
        if (!data) return null;
        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                if (typeof parsed === 'string') return JSON.parse(parsed);
                return parsed;
            } catch (e) { return null; }
        }
        return data;
    };

    // Prefer processed snapshot data if available
    const snap = item.snapshot_data || safeParse(item.product_snapshot);

    const returnPolicy = safeParse(snap?.policies?.return || item.return_policy);
    const rawPromos = safeParse(snap?.policies?.promotions || item.promotions_snapshot || item.promotion_snapshot || item.promotions_snapshort);
    const rawDiscounts = safeParse(snap?.policies?.discounts || item.discounts_snapshot || item.discount_snapshot || item.discounts_snapshort);

    const promotions = Array.isArray(rawPromos) ? rawPromos : (rawPromos ? [rawPromos] : []);
    const discounts = Array.isArray(rawDiscounts) ? rawDiscounts : (rawDiscounts ? [rawDiscounts] : []);

    const finalUnitPrice = snap?.pricing?.resolved || item.unit_price;
    const originalPrice = snap?.pricing?.original || item.original_unit_price || item.unit_price;

    const hasPromos = promotions.length > 0;
    const hasDiscounts = discounts.length > 0 && (discounts[0]?.type || discounts[0]?.discount);

    return (
        <AnimatePresence mode="wait">
            {open && (
                <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-0 sm:p-4">
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
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative bg-white w-full sm:max-w-md h-[85vh] sm:h-auto sm:max-h-[90vh] rounded-t-[0.5rem] sm:rounded-[0.5rem] flex flex-col overflow-hidden border border-slate-100 shadow-2xl"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-gradient-to-r from-rose-50/50 to-white">
                            <div>
                                <h2 className="text-lg font-black text-slate-900 tracking-tight">Order Snapshot</h2>
                                <p className="text-[10px] text-rose-500 font-bold tracking-widest uppercase mt-0.5">Purchased Terms & Policies</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            {/* Product Info */}
                            <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="w-16 h-16 bg-white rounded-xl overflow-hidden border border-slate-200 flex-shrink-0">
                                    {item.product_image ? (
                                        <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-50">
                                            <ShieldCheck className="text-slate-300" size={24} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 py-1">
                                    <h3 className="font-bold text-slate-900 text-sm truncate">{item.product_name}</h3>
                                    <p className="text-[11px] text-slate-500 font-medium mt-1">Snapshot of terms at purchase.</p>
                                    <div className="mt-2 text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full w-fit">
                                        ID #{item.order_id}
                                    </div>
                                </div>
                            </div>

                            {/* Pricing Summary */}
                            <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl text-white">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 opacity-60">Purchased Price Summary</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="opacity-70">Original Unit Price</span>
                                        <span className="font-bold line-through opacity-50">₦{Number(originalPrice).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="opacity-70">Quantity</span>
                                        <span className="font-bold text-rose-400">{item.quantity || 1} UNIT(S)</span>
                                    </div>
                                    {(originalPrice - finalUnitPrice) > 0 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="opacity-70">Total Savings (per item)</span>
                                            <span className="font-bold text-emerald-400">- ₦{Number(originalPrice - finalUnitPrice).toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="h-px bg-white/10 my-2" />
                                    <div className="flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-black uppercase tracking-widest">Total Transaction</span>
                                            <span className="text-[9px] opacity-40 font-bold uppercase tracking-tighter">Unit Price: ₦{Number(finalUnitPrice).toLocaleString()}</span>
                                        </div>
                                        <span className="text-xl font-black text-rose-400">₦{Number(finalUnitPrice * (item.quantity || 1)).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Shipping Policy */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                        <Truck size={16} />
                                    </div>
                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Shipping Commitment</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 text-center">Promise</p>
                                        <p className="text-sm font-bold text-slate-900 text-center">{snap?.policies?.shipping?.promise || item.shipping_promise || 'Standard'}</p>
                                    </div>
                                    <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 text-center">Avg. Duration</p>
                                        <p className="text-sm font-bold text-slate-900 text-center">{snap?.policies?.shipping?.avg || item.shipping_avg || 'Standard'}</p>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed px-1">
                                    The vendor committed to handing this over within the average timeframe. Snapshot terms preserved from purchase.
                                </p>
                            </div>

                            {/* Promotions & Discounts */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                                        <Zap size={16} />
                                    </div>
                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Active Discounts</h4>
                                </div>

                                <div className="space-y-3">
                                    {hasPromos ? (
                                        promotions.filter(Boolean).map((p: any, i: number) => (
                                            <div key={`promo-${i}`} className="p-4 bg-rose-50/30 border border-rose-100 rounded-2xl">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[12px] font-bold text-slate-900">{p.occasion || p.title || p.name || 'Promotion'}</span>
                                                    <span className="text-[10px] font-black text-rose-600">{(p.discount || p.discount_percent || 0)}% OFF</span>
                                                </div>
                                                <p className="text-[11px] text-slate-500">Store-wide or item-specific campaign active during checkout.</p>
                                                {p.time_remaining_at_purchase && (
                                                    <p className="text-[9px] font-black text-rose-400 uppercase mt-2">
                                                        Purchased {p.time_remaining_at_purchase} before expiration
                                                    </p>
                                                )}
                                            </div>
                                        ))
                                    ) : hasDiscounts ? (
                                        discounts.filter(Boolean).map((d: any, i: number) => (
                                            <div key={`disc-${i}`} className="p-4 bg-rose-50/30 border border-rose-100 rounded-2xl">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[12px] font-bold text-slate-900">{d.type || d.name || d.title || 'Sale Discount'}</span>
                                                    <span className="text-[10px] font-black text-rose-600">{(d.discount || d.discount_percent || 0)}% OFF</span>
                                                </div>
                                                <p className="text-[11px] text-slate-500">Categorical or conditional sale discount active during checkout.</p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-5 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center text-center">
                                            <ShieldCheck className="text-slate-200 mb-2" size={24} />
                                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Price Snapshot</p>
                                            <p className="text-xs text-slate-500 leading-relaxed font-medium">This product has no discount apply to it.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Return Policy */}
                            <div className="space-y-4 pb-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                        <RefreshCcw size={16} />
                                    </div>
                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Return Terms</h4>
                                </div>

                                <div className="space-y-3">
                                    {!returnPolicy?.seven_day_no_reason && (
                                        <PolicyItem
                                            icon={<ShieldCheck size={14} className="text-emerald-500" />}
                                            title="Return Window"
                                            status={returnPolicy?.return_window ? `${returnPolicy.return_window} Days` : '3 Days'}
                                            active={true}
                                            description="Number of days the customer has to initiate a return after receiving the item."
                                        />
                                    )}
                                    <PolicyItem
                                        icon={<Zap size={14} className="text-amber-500" />}
                                        title="Rapid Refund"
                                        status={returnPolicy?.rapid_refund ? 'Yes' : 'No'}
                                        active={!!returnPolicy?.rapid_refund}
                                        description="Instant credit upon return approval."
                                    />
                                    <PolicyItem
                                        icon={<ShieldCheck size={14} className="text-emerald-500" />}
                                        title="7-Day No Reason"
                                        status={returnPolicy?.seven_day_no_reason ? 'Active' : 'Inactive'}
                                        active={!!returnPolicy?.seven_day_no_reason}
                                        description="Item can be returned for any reason within 7 days."
                                    />
                                    <PolicyItem
                                        icon={<HelpCircle size={14} className="text-blue-500" />}
                                        title="Shipping Subsidy"
                                        status={returnPolicy?.return_shipping_subsidy ? 'Active' : 'Inactive'}
                                        active={!!returnPolicy?.return_shipping_subsidy}
                                        description="Vendor specified they would contribute to return shipping costs."
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

function PolicyItem({ icon, title, status, active, description }: { icon: React.ReactNode, title: string, status: string, active: boolean, description: string }) {
    return (
        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-[12px] font-bold text-slate-900">{title}</span>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                    {status}
                </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{description}</p>
        </div>
    );
}
