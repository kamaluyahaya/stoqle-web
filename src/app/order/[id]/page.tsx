"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { API_BASE_URL } from "@/src/lib/config";
import { useAuth } from "@/src/context/authContext";
import {
    ChevronLeft,
    Package,
    MapPin,
    Truck,
    CheckCircle2,
    Clock,
    Phone,
    MessageCircle,
    HelpCircle,
    Hash,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/src/components/header";

interface TrackingEvent {
    history_id: number;
    status: string;
    message: string;
    created_at: string;
}

interface OrderDetail {
    order_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    status: string;
    created_at: string;
    business_name: string;
    business_id: number;
    delivery_address: string;
    product_image: string | null;
    owner_id: number | null;
    variant_info: string | null;
}

export default function TrackOrderPage() {
    const { id } = useParams();
    const router = useRouter();
    const { token } = useAuth();
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [history, setHistory] = useState<TrackingEvent[]>([]);
    const [loading, setLoading] = useState(true);

    const getStatusInfo = (status: string) => {
        switch (status?.toLowerCase()) {
            case "order_placed": return { label: "Order Placed", desc: "We've received your request", icon: Clock, color: "text-orange-500", bg: "bg-orange-500" };
            case "confirmed": return { label: "Confirmed", desc: "Vendor has confirmed availability", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500" };
            case "shipped": return { label: "Shipped", desc: "Your package is on its way", icon: Truck, color: "text-indigo-500", bg: "bg-indigo-500" };
            case "out_for_delivery": return { label: "Out for Delivery", desc: "Couriers are arriving today", icon: Truck, color: "text-blue-500", bg: "bg-blue-500" };
            case "delivered": return { label: "Delivered", desc: "Enjoy your purchase!", icon: CheckCircle2, color: "text-rose-500", bg: "bg-rose-500" };
            default: return { label: status || "Processing", desc: "Updating status...", icon: Package, color: "text-slate-500", bg: "bg-slate-500" };
        }
    };

    const steps = ["order_placed", "confirmed", "shipped", "out_for_delivery", "delivered"];

    useEffect(() => {
        if (!token || !id) return;

        const fetchData = async () => {
            try {
                setLoading(true);
                // Fetch Order Details
                const orderRes = await fetch(`${API_BASE_URL}/api/orders/orders/${id}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const orderData = await orderRes.json();
                if (orderData.success) {
                    setOrder(orderData.data);
                }

                // Fetch Tracking History
                const trackRes = await fetch(`${API_BASE_URL}/api/orders/${id}/tracking`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const trackData = await trackRes.json();
                if (trackData.success) {
                    setHistory(trackData.data);
                }
            } catch (err) {
                toast.error("Failed to load tracking data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, token]);

    if (loading) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full" />
        </div>
    );

    if (!order) return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle size={48} className="text-slate-300 mb-4" />
            <h2 className="text-xl font-bold text-slate-900">Order not found</h2>
            <p className="text-slate-500 mb-6 max-w-xs">We couldn't retrieve the details for this request. It might have been deleted.</p>
            <button onClick={() => router.push('/profile/orders')} className="px-6 py-2.5 bg-black text-white rounded-full font-bold">Back to Orders</button>
        </div>
    );

    const currentStatusIndex = steps.indexOf(order.status?.toLowerCase());

    return (
        <div className="min-h-screen bg-[#F5F5F7]">
            <div className="h-[60px] md:h-0"></div>

            <main className="max-w-3xl mx-auto p-4 md:p-8 pb-32">
                <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-900 transition font-bold text-sm">
                    <ChevronLeft size={18} /> Back
                </button>

                <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                    {/* Header Status */}
                    <div className="p-8 bg-black text-white relative">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold   mb-2">
                                    <Truck size={12} /> Live tracking
                                </div>
                                <h1 className="text-3xl font-bold">{getStatusInfo(order.status).label}</h1>
                                <p className="text-white/60 font-bold  tracking-[0.2em] text-[10px] mt-2 border-l-2 border-rose-500 pl-3">
                                    {order.product_name}
                                    {order.variant_info && <span className="text-rose-400"> • {order.variant_info}</span>}
                                </p>
                                <p className="text-slate-400 text-xs mt-3">{getStatusInfo(order.status).desc}</p>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="text-[10px] font-bold text-slate-400   mb-1.5">Request Ref</div>
                                <div className="px-3 py-1.5 bg-white/10 rounded-lg border border-white/10 font-mono text-sm font-bold">#{order.order_id}</div>
                            </div>
                        </div>

                        {/* Tracking Progress Bar */}
                        <div className="mt-10 flex justify-between items-center relative gap-2">
                            <div className="absolute top-[11px] left-0 w-full h-0.5 bg-white/10"></div>
                            <div className="absolute top-[11px] left-0 h-0.5 bg-rose-500 transition-all duration-1000" style={{ width: `${(currentStatusIndex / (steps.length - 1)) * 100}%` }}></div>

                            {steps.map((s, idx) => (
                                <div key={s} className="relative z-10 flex flex-col items-center group">
                                    <div className={`w-6 h-6 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${idx <= currentStatusIndex ? 'bg-rose-500 border-black ring-4 ring-rose-500/20' : 'bg-slate-900 border-white/10'}`}>
                                        {idx < currentStatusIndex ? <CheckCircle2 size={12} className="text-black" /> : <div className={`w-1 h-1 rounded-full ${idx === currentStatusIndex ? 'bg-black animate-pulse' : 'bg-white/20'}`} />}
                                    </div>
                                    <span className={`absolute -bottom-8 whitespace-nowrap text-[9px] font-bold  transition-all duration-500 ${idx <= currentStatusIndex ? 'text-white' : 'text-slate-500'}`}>
                                        {s.replace(/_/g, ' ')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-6 md:p-8 space-y-12 mt-4">
                        {/* Timeline History */}
                        <section>
                            <h3 className="text-[10px] font-bold text-slate-400   mb-6">Activity Logistics</h3>
                            <div className="space-y-8 relative">
                                {/* Timeline vertical line */}
                                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-50"></div>

                                {history.slice().reverse().map((h, idx) => (
                                    <div key={h.history_id} className="relative pl-10 flex flex-col">
                                        {/* dot */}
                                        <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 shadow-sm z-10 flex items-center justify-center ${idx === 0 ? 'bg-rose-500 border-white' : 'bg-slate-50 border-white'}`}>
                                            {idx === 0 ? <Clock size={12} className="text-white" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                                        </div>

                                        <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className={`text-[10px] font-bold   ${idx === 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                                                    {h.status.replace(/_/g, ' ')}
                                                </p>
                                                <span className="text-[10px] text-slate-400 font-bold">
                                                    {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-sm font-bold text-slate-800 mb-1">{h.message}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">
                                                {new Date(h.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <div className="h-px bg-slate-100"></div>

                        {/* Summary & Destination */}
                        <div className="grid md:grid-cols-2 gap-8">
                            <section>
                                <h3 className="text-[10px] font-bold text-slate-400   mb-4">Destination</h3>
                                <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                                    <div className="p-3 bg-white rounded-xl border shadow-sm h-fit">
                                        <MapPin size={20} className="text-rose-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-400   mb-1">Shipping to</h4>
                                        <p className="text-sm font-bold text-slate-900 leading-relaxed">
                                            {order.delivery_address}
                                        </p>
                                    </div>
                                </div>
                            </section>
                            <section>
                                <h3 className="text-[10px] font-bold text-slate-400   mb-4">Vendor details</h3>
                                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                                    <div className="w-12 h-12 bg-white rounded-xl border flex items-center justify-center text-lg font-bold text-slate-900 shadow-sm">
                                        {order.business_name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-900">{order.business_name}</h4>
                                        <p className="text-xs text-slate-500 font-medium mb-2">Processed by partner</p>
                                        <button
                                            onClick={() => order.owner_id && router.push(`/messages?user=${order.owner_id}`)}
                                            className="flex items-center gap-1.5 text-[10px] font-bold  text-rose-500 hover:text-rose-500 transition"
                                        >
                                            <MessageCircle size={12} /> Contact merchant
                                        </button>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* Support footer */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-4">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                            <HelpCircle size={14} /> Need help?
                        </div>
                        <button className="text-[10px] font-bold   text-slate-900 hover:opacity-70 transition">Support Hub</button>
                        <span className="text-slate-200">|</span>
                        <button className="text-[10px] font-bold   text-slate-900 hover:opacity-70 transition">Logistics Policy</button>
                    </div>
                </div>
            </main>
        </div>
    );
}
