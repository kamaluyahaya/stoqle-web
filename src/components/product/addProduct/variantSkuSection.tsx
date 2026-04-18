"use client";
import React from "react";
import { API_BASE_URL } from "@/src/lib/config";
import { ProductSku } from "@/src/types/product";
import NumberInput from "@/src/components/input/defaultNumberInput";
import { Package } from "lucide-react";

interface VariantSkuSectionProps {
    skus: ProductSku[];
    setSkus: React.Dispatch<React.SetStateAction<ProductSku[]>>;
    samePriceForAll: boolean;
    sharedPrice: number | null;
    readOnlyStock?: boolean;
    variantGroups?: any[]; // Added to find entry images
}

export default function VariantSkuSection({
    skus,
    setSkus,
    samePriceForAll,
    sharedPrice,
    readOnlyStock = false,
    variantGroups = [],
}: VariantSkuSectionProps) {
    if (skus.length === 0) {
        return (
            <div className="p-12 text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 mt-6 flex flex-col items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-300">
                    <Package className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-600 tracking-tight">No Combinations Generated Yet</p>
                    <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto leading-relaxed">Add at least one variant option to your groups above to start managing combined SKU pricing and stock.</p>
                </div>
            </div>
        );
    }

    const updateSku = (id: string, patch: Partial<ProductSku>) => {
        setSkus((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    };

    const formatImageUrl = (url: string | null | undefined) => {
        if (!url) return null;
        if (typeof url !== "string") return null;
        if (url.startsWith("http") || url.startsWith("blob:") || url.startsWith("data:")) return url;
        const apiBase = API_BASE_URL || "https://api.stoqle.com";
        return url.startsWith("/public") ? `${apiBase}${url}` : `${apiBase}/public/${url}`;
    };

    const getSkuImageParts = (sku: ProductSku) => {
        return sku.variantOptionIds.map((optionId) => {
            const group = variantGroups.find((g: any) => g.entries.some((e: any) => e.id === optionId));
            const entry = group?.entries.find((e: any) => e.id === optionId);

            let rawImage: string | null = null;
            if (entry?.imagePreviews && entry.imagePreviews.length > 0) {
                rawImage = entry.imagePreviews[0];
            } else if (entry?.images && entry.images.length > 0) {
                const first = entry.images[0];
                if (typeof first === "string") {
                    rawImage = first;
                } else if (first instanceof File || first instanceof Blob) {
                    rawImage = URL.createObjectURL(first);
                }
            }

            return {
                name: entry?.name || "Unknown",
                image: formatImageUrl(rawImage),
            };
        });
    };

    return (
        <div className="mt-8 space-y-4">
            <div className="sm:flex items-center justify-between">
                <h3 className="text-[12px] font-semibold text-slate-600 ">
                    Combo Combinations ({skus.length})
                </h3>
                <span className="text-xs text-slate-500">
                    Set specific price and stock for each variant pairing.
                </span>
            </div>

            {/* Mobile Card View (shown only on small screens) */}
            <div className="grid grid-cols-1 gap-3 sm:hidden">
                {skus.map((sku) => {
                    const priceOrPlaceholder = sku.price != null ? `₦${Number(sku.price).toLocaleString()}` : "Price";
                    const imageParts = getSkuImageParts(sku);

                    return (
                        <div key={sku.id} className={`bg-white rounded border border-slate-100 overflow-hidden transition-all ${sku.enabled ? "" : "opacity-60 grayscale"}`}>
                            <div className="p-2 space-y-4">
                                {/* Header: Toggle + Combination (Inline Image/Name) */}
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center flex-wrap gap-y-2 gap-x-1.5 pt-1">
                                        {imageParts.map((part, idx) => (
                                            <React.Fragment key={idx}>
                                                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">
                                                    {part.image && (
                                                        <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden border border-slate-300 flex-shrink-0">
                                                            <img src={part.image} alt={part.name} className="w-full h-full object-cover" />
                                                        </div>
                                                    )}
                                                    <span className="text-xs font-bold text-slate-800 break-words leading-tight max-w-[120px]">
                                                        {part.name}
                                                    </span>
                                                </div>
                                                {idx < imageParts.length - 1 && (
                                                    <span className="text-slate-400 text-[10px] font-bold">/</span>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={sku.enabled}
                                            onChange={(e) => updateSku(sku.id, { enabled: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                                    </label>
                                </div>                                {/* Inline Inputs Row */}
                                <div className="flex items-center gap-2 pt-2">
                                    {!samePriceForAll && (
                                        <div className="flex-1 relative group">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 z-10">₦</span>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                value={sku.price}
                                                onChange={(e) => updateSku(sku.id, { price: e.target.value === "" ? "" : Number(e.target.value) })}
                                                placeholder="Price"
                                                className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-rose-400 outline-none transition-all placeholder:text-slate-300 placeholder:font-normal"
                                            />
                                            <div className="absolute top-0 right-0 -translate-y-full pb-1">
                                                <span className="text-[9px] font-bold text-slate-400  tracking-tighter px-1">Price</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="w-[66px] flex-shrink-0 relative">
                                        {readOnlyStock ? (
                                            <div className="w-full h-8.5 py-1.5 bg-slate-100/50 border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 font-bold text-xs">
                                                {sku.quantity || 0}
                                            </div>
                                        ) : (
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                value={sku.quantity}
                                                onChange={(e) => updateSku(sku.id, { quantity: e.target.value === "" ? "" : Number(e.target.value) })}
                                                placeholder="0"
                                                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-rose-400 outline-none text-center transition-all"
                                            />
                                        )}
                                        <div className="absolute top-0 right-0 -translate-y-full pb-1 pr-1 truncate">
                                            <span className={`text-[9px] font-bold ${readOnlyStock ? 'text-rose-400' : 'text-slate-400'}  tracking-tighter`}>
                                                {readOnlyStock ? 'Inv' : 'Qty'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop Table View (hidden on small screens) */}
            <div className="hidden sm:block overflow-x-auto rounded border border-slate-100">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 font-medium text-slate-700">Combination</th>
                            {!samePriceForAll && (
                                <th className="px-4 py-3 font-medium text-slate-700 w-32">Price (₦)</th>
                            )}
                            <th className="px-4 py-3 font-medium text-slate-700 w-32">
                                <div className="flex flex-col gap-0.5">
                                    <span>Quantity</span>
                                    {readOnlyStock && (
                                        <span className="text-[8px] text-rose-500 font-bold  tracking-tighter leading-none whitespace-nowrap animate-pulse">
                                            Stock Managed In inventory
                                        </span>
                                    )}
                                </div>
                            </th>
                            <th className="px-4 py-3 font-medium text-slate-700 w-20 text-center">Active</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {skus.map((sku) => (
                            <tr key={sku.id} className={sku.enabled ? "" : "opacity-50 grayscale"}>
                                <td className="px-4 py-4">
                                    <div className="flex items-center flex-wrap gap-2">
                                        {getSkuImageParts(sku).map((part, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">
                                                {part.image && (
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                                                        <img src={part.image} alt={part.name} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <span className="font-medium text-slate-700 text-xs">{part.name}</span>
                                                {idx < getSkuImageParts(sku).length - 1 && (
                                                    <span className="text-slate-300 ml-1">/</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </td>

                                {!samePriceForAll && (
                                    <td className="px-4 py-4">
                                        <NumberInput
                                            label="Price"
                                            value={sku.price}
                                            onChange={(val) => updateSku(sku.id, { price: val })}
                                            placeholder="0.00"
                                            min={0}
                                            variant="compact"
                                        />
                                    </td>
                                )}

                                <td className="px-4 py-4">
                                    {readOnlyStock ? (
                                        <div className="w-full h-8 bg-slate-50 border border-slate-100 rounded flex items-center px-2 text-slate-500 font-bold text-xs ring-1 ring-slate-100">
                                            {sku.quantity || 0}
                                        </div>
                                    ) : (
                                        <NumberInput
                                            label="Stock"
                                            value={sku.quantity}
                                            onChange={(val) => updateSku(sku.id, { quantity: val })}
                                            placeholder="0"
                                            min={0}
                                            variant="compact"
                                        />
                                    )}
                                </td>

                                <td className="px-4 py-4 text-center">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={sku.enabled}
                                            onChange={(e) => updateSku(sku.id, { enabled: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                                    </label>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {samePriceForAll && (
                <p className="text-[11px] text-slate-400 italic">
                    * Pricing is currently shared across all variants ({sharedPrice ? `₦${sharedPrice.toLocaleString()}` : "Not set"}).
                    Toggle "Different prices per variant" above to set individual combination prices.
                </p>
            )}
        </div>
    );
}
