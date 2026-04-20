"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Truck, ShoppingBag, Info } from "lucide-react";

type Props = {
    open: boolean;
    onClose: () => void;
    onConfirm: (data: { type: string; reason: string; explanation?: string }) => void;
    items: any[];
    shipmentIndex?: number;
    saleId: string | number;
    loading?: boolean;
};

const CancelReasons = [
    { id: 'OUT_OF_STOCK', label: 'Out of stock' },
    { id: 'INVENTORY_ERROR', label: 'Inventory error' },
    { id: 'DAMAGED_PRODUCT', label: 'Damaged product' },
    { id: 'QUALITY_ISSUE', label: 'Quality issue' },
    { id: 'CANNOT_SHIP', label: 'Cannot ship to location' },
    { id: 'LOGISTICS_ISSUE', label: 'Logistics issue' },
    { id: 'FRAUD_SUSPECTED', label: 'Fraud suspected' },
    { id: 'PAYMENT_ISSUE', label: 'Payment issue' },
    { id: 'OPERATIONAL_ISSUE', label: 'Operational issue' },
    { id: 'OTHER', label: 'Other' },
];

export default function CancelOrderModal({
    open,
    onClose,
    onConfirm,
    items,
    shipmentIndex,
    saleId,
    loading
}: Props) {
    const [step, setStep] = useState(1);
    const [cancelType, setCancelType] = useState<string>(shipmentIndex !== undefined ? 'shipment' : 'entire');
    const [reason, setReason] = useState("");
    const [explanation, setExplanation] = useState("");

    // Reset state on open
    React.useEffect(() => {
        if (open) {
            setStep(1);
            setCancelType(shipmentIndex !== undefined ? 'shipment' : 'entire');
            setReason("");
            setExplanation("");
        }
    }, [open, shipmentIndex]);

    const handleConfirm = () => {
        if (!reason) return;
        onConfirm({ type: cancelType, reason, explanation });
    };

    const isMultipleShipments = items && items.length > 1;

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, y: "100%" }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: "100%" }}
                        className="relative bg-white w-full sm:max-w-md rounded-t-[0.5rem] sm:rounded-[0.5rem] overflow-hidden border border-slate-100 "
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">Cancel Request</h3>
                                <p className="text-[10px] text-rose-500 font-bold tracking-widest  mt-0.5">Order #{saleId}</p>
                            </div>
                            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {step === 1 && (
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-slate-900">What do you want to cancel?</h4>
                                    <div className="grid gap-3">
                                        <button
                                            onClick={() => setCancelType('entire')}
                                            className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${cancelType === 'entire' ? 'border-rose-500 bg-rose-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                                        >
                                            <div className={`p-2 rounded-xl ${cancelType === 'entire' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                <ShoppingBag size={20} />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-xs font-black text-slate-900">Entire Order</p>
                                                <p className="text-[10px] text-slate-500 font-medium">All items in this order will be refunded.</p>
                                            </div>
                                        </button>

                                        {isMultipleShipments && (
                                            <button
                                                onClick={() => setCancelType('shipment')}
                                                className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${cancelType === 'shipment' ? 'border-rose-500 bg-rose-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                                            >
                                                <div className={`p-2 rounded-xl ${cancelType === 'shipment' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                    <Truck size={20} />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-xs font-black text-slate-900">Specific Shipment</p>
                                                    <p className="text-[10px] text-slate-500 font-medium tracking-tight">Only Shipment {shipmentIndex !== undefined ? shipmentIndex + 1 : ''} will be cancelled.</p>
                                                </div>
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setStep(2)}
                                        className="w-full py-3 bg-slate-900 text-white rounded-full text-[11px] font-black  tracking-widest hover:bg-slate-800 transition-all mt-4"
                                    >
                                        Continue
                                    </button>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold text-slate-900">Select a cancellation reason</h4>
                                        <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto px-1 custom-scrollbar">
                                            {CancelReasons.map((r) => (
                                                <button
                                                    key={r.id}
                                                    onClick={() => setReason(r.id)}
                                                    className={`py-3 px-4 rounded-xl border text-[10px] font-bold transition-all ${reason === r.id ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    {r.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {reason === 'OTHER' && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black  text-slate-400 tracking-wider">Provide details</label>
                                            <textarea
                                                value={explanation}
                                                onChange={(e) => setExplanation(e.target.value)}
                                                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-medium focus:ring-2 focus:ring-rose-500 transition-all outline-none"
                                                placeholder="Please explain why you are cancelling..."
                                                rows={3}
                                            />
                                        </div>
                                    )}

                                    <div className="p-4 bg-emerald-50 rounded-2xl flex items-start gap-3">
                                        <Info className="text-emerald-500 shrink-0 mt-0.5" size={16} />
                                        <p className="text-[10px] text-emerald-800 font-bold leading-relaxed">
                                            {cancelType === 'entire'
                                                ? "Full refund will be sent instantly to the customer's wallet upon confirmation."
                                                : `Shipment ${shipmentIndex !== undefined ? shipmentIndex + 1 : ''} will be cancelled. Other items will still be delivered.`}
                                        </p>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            disabled={loading}
                                            onClick={() => setStep(1)}
                                            className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-full text-[11px]  hover:bg-slate-200 transition-colors"
                                        >
                                            Back
                                        </button>
                                        <button
                                            disabled={loading || !reason || (reason === 'OTHER' && !explanation)}
                                            onClick={handleConfirm}
                                            className="flex-[2] py-2 bg-rose-500 text-white rounded-full text-[10px]  shadow-lg shadow-rose-200 hover:bg-rose-500 transition-all disabled:opacity-50"
                                        >
                                            {loading ? 'Processing...' : 'Confirm Cancellation'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
