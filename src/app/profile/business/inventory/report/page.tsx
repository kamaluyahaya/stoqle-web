"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
    FileText,
    Printer,
    Calendar,
    X,
    ArrowRight,
    Loader2,
    ChevronLeft
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { smartInventoryApi } from "@/src/lib/api/inventoryApi";
import { API_BASE_URL } from "@/src/lib/config";

const NO_IMAGE_PLACEHOLDER = "/assets/images/favio.png";

interface InventoryItem {
    product_id: number;
    business_id: number;
    inventory_id: number;
    name: string;
    category: string;
    base_price: string;
    has_variants: boolean;
    use_combinations: boolean;
    product_sku: string;
    prod_status: string;
    total_quantity: number;
    reserved: number;
    available: number;
    low_stock_alert: number;
    image_url: string;
    variants: VariantItem[];
}

interface VariantItem {
    id: number;
    name: string;
    sku: string;
    total_quantity: number;
    reserved: number;
    available: number;
    low_stock_alert: number;
    image_url?: string;
}

export default function InventoryReportPage() {
    const { token, user } = useAuth();
    const router = useRouter();
    const [products, setProducts] = useState<InventoryItem[]>([]);
    const [business, setBusiness] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const formatUrl = (url: string) => {
        if (!url) return NO_IMAGE_PLACEHOLDER;
        if (url.startsWith("http")) return url;
        return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    };

    const formatAddress = (addrJson?: string | null) => {
        if (!addrJson) return null;
        try {
            const parsed = typeof addrJson === 'string' ? JSON.parse(addrJson) : addrJson;
            const line1 = parsed.address_line_1 || parsed.line1 || "";
            const city = parsed.city || "";
            const state = parsed.state || "";
            return [line1, city, state].filter(Boolean).join(", ");
        } catch {
            return addrJson;
        }
    };

    const loadData = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const [inventoryData, businessRes] = await Promise.all([
                smartInventoryApi.getSmartInventory({ limit: 500 }),
                fetch(`${API_BASE_URL}/api/business/me`, {
                    headers: { "Authorization": `Bearer ${token}` }
                }).then(r => r.json())
            ]);

            setProducts(inventoryData.products || []);
            if (businessRes?.success || businessRes?.data) {
                setBusiness(businessRes.data?.business || businessRes.data);
            }
        } catch (err) {
            console.error("Failed to load inventory for report", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [token]);

    const stats = useMemo(() => {
        const totalItems = products.length;
        let lowStock = 0;
        let outOfStock = 0;
        let totalReserved = 0;
        let totalQuantity = 0;

        products.forEach(p => {
            totalReserved += p.reserved;
            totalQuantity += p.total_quantity;
            if (p.available <= 0) outOfStock++;
            else if (p.available <= (p.low_stock_alert || 5)) lowStock++;
        });

        return { totalItems, lowStock, outOfStock, totalReserved, totalQuantity };
    }, [products]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
                <p className="text-slate-400 font-bold  tracking-widest text-xs">Generating Report...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 md:p-10 print:p-0">
            {/* Nav / Tools - Hidden on Print */}
            <div className="max-w-5xl mx-auto mb-8 flex items-center justify-between no-print px-4 md:px-0 pt-[env(safe-area-inset-top,20px)]">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold text-sm"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Back to Inventory
                </button>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                >
                    <Printer className="w-5 h-5" />
                    PRINT / EXPORT PDF
                </button>
            </div>

            {/* Report Paper */}
            <div className="max-w-5xl mx-auto bg-white md:rounded-[2.5rem] overflow-hidden print:shadow-none print:rounded-none">
                <div className="p-8 md:p-16">
                    <div id="inventory-report" className="mx-auto text-slate-900">
                        {/* Business Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start gap-10 border-b-4 border-slate-900 pb-10 mb-10">
                            <div className="flex items-start gap-6 w-full">
                                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shrink-0 border-4 border-slate-100 no-print-shadow overflow-hidden shadow-lg shadow-slate-100">
                                    <img
                                        src={formatUrl(business?.business_logo || user?.profile_pic || "/assets/logo/logo.png")}
                                        alt="Business Logo"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = "/assets/logo/logo.png";
                                            target.className = "w-10 h-10 object-contain grayscale opacity-20";
                                        }}
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center justify-between gap-6 mb-4">
                                        <div className="space-y-1">
                                            <h1 className="text-3xl font-black tracking-tighter text-slate-900  leading-none">
                                                {business?.business_name || user?.business_name || user?.name || "Merchant Inventory"}
                                            </h1>
                                            <p className="text-[10px] font-black text-indigo-600 tracking-[0.3em]  opacity-80">Inventory Ledger • {business?.business_category || "Profile"}</p>
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-bold space-y-1.5  tracking-wide border-t border-slate-100 pt-4">
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <p className="max-w-xl leading-relaxed">{formatAddress(business?.business_address) || formatAddress(user?.business_address) || user?.address || "Registered Address Pending"}</p>
                                            <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl flex items-center gap-3 shadow-lg no-print-shadow shrink-0">
                                                <div className="flex items-center gap-1.5 border-r border-slate-700 pr-3">
                                                    <Calendar className="w-3 h-3 text-indigo-400" />
                                                    <span className="text-[10px]">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                                                </div>
                                                <span className="text-[10px] text-indigo-300">
                                                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span>{user?.email}</span>
                                            {(business?.phone || user?.phone) && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                    <span>{business?.phone || user?.phone}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summaries */}
                        <div className="mb-10 page-break-avoid">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-4 w-1 bg-indigo-600 rounded-full" />
                                <h3 className="text-xs font-black text-slate-400  tracking-[0.2em]">Live Summary</h3>
                            </div>
                            <div className="grid grid-cols-5 gap-0 border border-slate-200 rounded-2xl overflow-hidden divide-x divide-slate-100 shadow-sm shadow-slate-50">
                                <div className="p-4 bg-slate-50/30">
                                    <p className="text-[9px] font-black text-slate-400  tracking-widest mb-1.5 leading-none">Total Items</p>
                                    <p className="text-lg font-black text-slate-900 tracking-tight">{stats.totalItems}</p>
                                </div>
                                <div className="p-4">
                                    <p className="text-[9px] font-black text-slate-400  tracking-widest mb-1.5 leading-none">Total Stock</p>
                                    <p className="text-lg font-black text-slate-900 tracking-tight">{stats.totalQuantity}</p>
                                </div>
                                <div className="p-4 bg-slate-50/30">
                                    <p className="text-[9px] font-black text-slate-400  tracking-widest mb-1.5 leading-none">Reserved</p>
                                    <p className="text-lg font-black text-amber-600 tracking-tight">+{stats.totalReserved}</p>
                                </div>
                                <div className="p-4">
                                    <p className="text-[9px] font-black text-slate-400  tracking-widest mb-1.5 leading-none">Low Stock</p>
                                    <p className={`text-lg font-black tracking-tight ${stats.lowStock > 0 ? 'text-indigo-600' : 'text-slate-900'}`}>{stats.lowStock}</p>
                                </div>
                                <div className="p-4 bg-slate-50/30">
                                    <p className="text-[9px] font-black text-slate-400  tracking-widest mb-1.5 leading-none">Out Of Stock</p>
                                    <p className={`text-lg font-black tracking-tight ${stats.outOfStock > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{stats.outOfStock}</p>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="mb-12">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-4 w-1 bg-indigo-600 rounded-full" />
                                <h3 className="text-xs font-black text-slate-400  tracking-[0.2em]">Detailed Ledger</h3>
                            </div>
                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400  tracking-widest w-[40%]">Product / SKU</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400  tracking-widest">Category</th>
                                            <th className="px-2 py-4 text-left text-[10px] font-black text-slate-400  tracking-widest">Stock</th>
                                            <th className="px-2 py-4 text-left text-[10px] font-black text-slate-400  tracking-widest">Hold</th>
                                            <th className="px-2 py-4 text-left text-[10px] font-black text-slate-400  tracking-widest">Net</th>
                                            <th className="px-2 py-4 text-left text-[10px] font-black text-slate-400  tracking-widest">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {products.map((p) => (
                                            <React.Fragment key={p.product_id}>
                                                <tr className="bg-white hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-lg bg-slate-50 overflow-hidden border border-slate-100 shrink-0 flex items-center justify-center">
                                                                <img
                                                                    src={formatUrl(p.image_url)}
                                                                    alt={p.name}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <p className="text-[11px] font-black text-slate-900  leading-none tracking-tight">{p.name}</p>
                                                                <p className="text-[9px] font-bold text-slate-400 tracking-[0.1em] ">{p.product_sku || "NO SKU"}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className="text-[9px] font-black text-indigo-500 bg-indigo-50/50 px-2 py-1 rounded-md  tracking-wider">{p.category}</span>
                                                    </td>
                                                    <td className="px-2 py-4 text-left text-xs font-black text-slate-700">{p.total_quantity}</td>
                                                    <td className="px-2 py-4 text-left text-xs font-black text-amber-600">
                                                        {p.reserved > 0 ? `+${p.reserved}` : "0"}
                                                    </td>
                                                    <td className="px-2 py-4 text-left">
                                                        <span className={`text-xs font-black ${p.available <= 0 ? 'text-rose-600' : 'text-slate-900 underline decoration-indigo-200 underline-offset-4'}`}>
                                                            {p.available}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-4 text-left">
                                                        {p.available <= 0 ? (
                                                            <span className="text-[9px] font-black text-white bg-rose-600 px-2 py-0.5 rounded-full  tracking-widest">Critical</span>
                                                        ) : p.available <= (p.low_stock_alert || 5) ? (
                                                            <span className="text-[9px] font-black text-slate-900 bg-amber-400 px-2 py-0.5 rounded-full  tracking-widest">Low</span>
                                                        ) : (
                                                            <span className="text-[9px] font-black text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full  tracking-widest">Healthy</span>
                                                        )}
                                                    </td>
                                                </tr>
                                                {p.variants && p.variants.length > 0 && (
                                                    <tr className="bg-slate-50 border-l-2 border-indigo-500 print:bg-slate-50">
                                                        <td className="pl-12 py-2 text-[9px] font-black text-indigo-500  tracking-[0.15em]">Variant Ledger</td>
                                                        <td className="px-5 py-2 text-[8px] font-bold text-slate-400  tracking-widest">Reference</td>
                                                        <td className="px-2 py-2 text-left text-[8px] font-black text-slate-400  tracking-widest">Units</td>
                                                        <td className="px-2 py-2 text-left text-[8px] font-black text-slate-400  tracking-widest">Hold</td>
                                                        <td className="px-2 py-2 text-left text-[8px] font-black text-slate-400  tracking-widest">Net</td>
                                                        <td className="px-2 py-2 text-left"></td>
                                                    </tr>
                                                )}
                                                {p.variants && p.variants.length > 0 && p.variants.map((v) => (
                                                    <tr key={v.id} className="bg-slate-50/20 border-l-2 border-slate-200">
                                                        <td className="pl-12 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-6 h-6 rounded bg-white overflow-hidden border border-slate-100 shrink-0">
                                                                    <img
                                                                        src={formatUrl(v.image_url || p.image_url)}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-600  tracking-tight">{v.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <span className="text-[8px] font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded  tracking-widest">{v.sku || "VAR-SKU"}</span>
                                                        </td>
                                                        <td className="px-2 py-3 text-left text-[11px] font-bold text-slate-500">{v.total_quantity}</td>
                                                        <td className="px-2 py-3 text-left text-[11px] font-bold text-amber-500/70">
                                                            {v.reserved > 0 ? `+${v.reserved}` : "0"}
                                                        </td>
                                                        <td className="px-2 py-3 text-left text-[11px] font-black text-slate-600">{v.available}</td>
                                                        <td className="px-2 py-3 text-left">
                                                            <div className={`w-1.5 h-1.5 rounded-full inline-block ${v.available <= 0 ? 'bg-rose-500' :
                                                                v.available <= (v.low_stock_alert || 5) ? 'bg-amber-400' :
                                                                    'bg-emerald-300'
                                                                }`} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Footer (Web view) */}
                        <div className="border-t-2 border-slate-900 pt-8 mt-auto no-print">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-slate-400">
                                <div className="text-[9px] font-black  tracking-[0.2em] space-y-1">
                                    <p>Generated by <span className="text-indigo-600">Stoqle Dashboard</span></p>
                                    <p>© {new Date().getFullYear()} Stoqle Technology. All rights reserved.</p>
                                </div>
                                <div className="text-[9px] font-bold italic max-w-sm">
                                    Disclaimer: This report reflects stock values at the precise time of generation. Discrepancies may occur due to ongoing transactions or database lag.
                                </div>
                                <div className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-full  tracking-widest">
                                    Page 1 of 1
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Pagination Footer (Only visible on print) */}
            <div className="hidden print:block fixed bottom-0 left-0 right-0 p-8 bg-white border-t border-slate-100">
                <div className="flex justify-between items-center text-[8px] font-black text-slate-400  tracking-[0.3em]">
                    <div>
                        STOQLE INVENTORY AUDIT • {business?.business_name || user?.business_name || user?.name}
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="italic opacity-50">Reflects real-time parity at generation</span>
                        <div className="bg-slate-900 text-white px-4 py-1 rounded-full">
                            PAGE <span className="print-page-number"></span>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    /* Reset everything for printing */
                    body, html {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        overflow: visible !important;
                        visibility: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        counter-reset: page;
                    }

                    /* 🚨 CLEAN LAYOUT STRIPPING - Force hide all nav/shells */
                    nav, 
                    aside, 
                    header, 
                    footer,
                    [role="navigation"],
                    [class*="navbar"],
                    [class*="sidebar"],
                    .no-print {
                        display: none !important;
                        visibility: hidden !important;
                        opacity: 0 !important;
                        pointer-events: none !important;
                        height: 0 !important;
                        width: 0 !important;
                        overflow: hidden !important;
                    }

                    /* 🚨 LAYOUT NORMALIZATION - Reset main container instead of hiding it */
                    main, .min-h-screen, [class*="lg:ml-"] {
                        margin: 0 !important;
                        padding: 0 !important;
                        margin-left: 0 !important;
                        width: 100% !important;
                        max-width: none !important;
                        display: block !important;
                        visibility: visible !important;
                        position: relative !important;
                    }

                    @page {
                        size: A4;
                        margin: 10mm;
                    }

                    #inventory-report {
                        width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        visibility: visible !important;
                    }

                    /* Force layout containers to maintain their structure */
                    .flex { 
                        display: flex !important; 
                        flex-direction: row !important;
                    }
                    .flex-col {
                        flex-direction: column !important;
                    }
                    .grid { 
                        display: grid !important; 
                    }
                    .grid-cols-5 {
                        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
                    }

                    .break-before-page {
                        break-before: page !important;
                        padding-top: 2rem !important;
                    }

                    tr {
                        break-inside: avoid !important;
                    }

                    /* Ensure background colors and status indicators print */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    /* Color fidelity reinforcements */
                    .text-slate-400 { color: #94a3b8 !important; }
                    .text-slate-900 { color: #000000 !important; }
                    .bg-slate-900 { background-color: #000000 !important; }
                    .border-slate-900 { border-color: #000000 !important; }

                    /* Table Polish */
                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }

                    /* 📄 Pagination Logic - Robust Per-page Strategy */
                    .print-page-number {
                        counter-increment: page;
                    }
                    .print-page-number::after {
                        content: counter(page);
                    }
                }
            `}</style>
        </div>
    );
}
