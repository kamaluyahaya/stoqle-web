"use client";
import React from "react";
import { ProductSku } from "@/src/types/product";
import NumberInput from "@/src/components/input/defaultNumberInput";

interface VariantSkuSectionProps {
    skus: ProductSku[];
    setSkus: React.Dispatch<React.SetStateAction<ProductSku[]>>;
    samePriceForAll: boolean;
    sharedPrice: number | null;
}

export default function VariantSkuSection({
    skus,
    setSkus,
    samePriceForAll,
    sharedPrice,
}: VariantSkuSectionProps) {
    if (skus.length === 0) return null;

    const updateSku = (id: string, patch: Partial<ProductSku>) => {
        setSkus((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    };

    return (
        <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    SKU Combinations ({skus.length})
                </h3>
                <span className="text-xs text-slate-500">
                    Set specific price and stock for each variant pairing.
                </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 font-medium text-slate-700">Combination</th>
                            {!samePriceForAll && (
                                <th className="px-4 py-3 font-medium text-slate-700 w-32">Price (₦)</th>
                            )}
                            <th className="px-4 py-3 font-medium text-slate-700 w-32">Quantity</th>
                            <th className="px-4 py-3 font-medium text-slate-700 w-20 text-center">Active</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {skus.map((sku) => (
                            <tr key={sku.id} className={sku.enabled ? "" : "opacity-50 grayscale"}>
                                <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                        {/* SKU Image Placeholder / Logic could go here */}
                                        <span className="font-medium text-slate-800">{sku.name}</span>
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
                                    <NumberInput
                                        label="Stock"
                                        value={sku.quantity}
                                        onChange={(val) => updateSku(sku.id, { quantity: val })}
                                        placeholder="0"
                                        min={0}
                                        variant="compact"
                                    />
                                </td>

                                <td className="px-4 py-4 text-center">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={sku.enabled}
                                            onChange={(e) => updateSku(sku.id, { enabled: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
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
