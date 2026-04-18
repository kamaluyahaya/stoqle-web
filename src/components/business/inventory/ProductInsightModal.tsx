import React, { useState, useEffect } from "react";
import { X, TrendingUp, TrendingDown, ShoppingCart, Eye, MousePointerClick, AlertCircle, Lightbulb, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "@/src/lib/config";

interface ProductInsightModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: any;
}

export default function ProductInsightModal({ isOpen, onClose, product }: ProductInsightModalProps) {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !product?.product_id) return;

        const fetchInsights = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_BASE_URL}/api/insights/product/${product.product_id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const json = await res.json();
                if (json.ok) {
                    setStats(json.data);
                }
            } catch (err) {
                console.error("Failed to load product insights", err);
            } finally {
                setLoading(false);
            }
        };

        fetchInsights();
    }, [isOpen, product]);

    if (!isOpen || !product) return null;

    const views = stats?.views || 0;
    const clicks = stats?.clicks || 0;
    const addToCart = stats?.addToCart || 0;
    const sales = stats?.sales || 0;

    const conversionRate = views > 0 ? ((sales / views) * 100).toFixed(1) : 0;
    const isUnderperforming = views > 20 && Number(conversionRate) < 2.0;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center p-0 md:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, y: "100%" }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="relative bg-white rounded-t-[0.5rem] md:rounded-[0.5rem] w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col sm:max-h-[90vh] max-h-[85vh]"
                    >
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />

                        {/* Header */}
                        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-start gap-4 shrink-0">
                            <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0">
                                <img src={product.image_url || "/placeholder.png"} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0 pt-1">
                                <h3 className="text-md font-bold text-slate-900 line-clamp-1">{product.name}</h3>
                                <p className="text-[12px] font-medium text-slate-500 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                                    Product Insights & Performance
                                </p>
                            </div>
                            <button onClick={onClose} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors shrink-0">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 bg-slate-50/50 flex-1">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <Loader2 className="w-8 h-8 animate-spin text-rose-500 mb-3" />
                                    <p className="text-sm font-bold text-slate-400">Loading product data...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Key Metrics */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <MetricCard title="Total Views" value={views} icon={<Eye className="w-4 h-4" />} color="text-rose-500" bg="bg-rose-50" />
                                        <MetricCard title="Clicks" value={clicks} icon={<MousePointerClick className="w-4 h-4" />} color="text-orange-500" bg="bg-orange-50" />
                                        <MetricCard title="Adds to Cart" value={addToCart} icon={<ShoppingCart className="w-4 h-4" />} color="text-emerald-500" bg="bg-emerald-50" />
                                        <MetricCard title="Conversion" value={`${conversionRate}%`} icon={isUnderperforming ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />} color={isUnderperforming ? "text-amber-500" : "text-emerald-500"} bg={isUnderperforming ? "bg-amber-50" : "bg-emerald-50"} />
                                    </div>

                                    {/* Performance Status Bar */}
                                    <div className="bg-white rounded-[0.5rem] p-5 border border-slate-200 ">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-sm font-bold text-slate-900">Sales Performance Status</h4>
                                            <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${isUnderperforming ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {isUnderperforming ? 'Needs Attention' : views === 0 ? 'No Data' : 'Good Growth'}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                                            <div className={`h-2 rounded-full ${isUnderperforming ? 'bg-amber-500 w-1/3' : views === 0 ? 'bg-slate-300 w-0' : 'bg-emerald-500 w-4/5'}`}></div>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                            {isUnderperforming
                                                ? 'This product receives views but has a lower-than-average conversion right now.'
                                                : views > 0
                                                    ? 'This product is generating interest and converting stably.'
                                                    : 'Not enough views specifically recorded to calculate performance yet.'}
                                        </p>
                                    </div>

                                    {/* Smart Recommendations */}
                                    <div className="bg-gradient-to-br from-rose-500 to-rose-500 rounded-[0.5rem] p-6 text-white shadow-lg">
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                                <Lightbulb className="w-5 h-5 text-yellow-300" />
                                            </div>
                                            <h4 className="text-lg font-bold">Smart Recommendations</h4>
                                        </div>

                                        <div className="space-y-3">
                                            {(() => {
                                                const recommendations = [];

                                                // High drop off: Views but no Add to Cart
                                                if (views > 0 && addToCart === 0) {
                                                    recommendations.push({
                                                        title: "Desire Gap Detected",
                                                        desc: "People are looking but not saving. Refine your product images and ensure your 'Discount & Promotional' policy is active."
                                                    });
                                                    recommendations.push({
                                                        title: "Content Optimization",
                                                        desc: "Add a short product video. Items with Stoqle video highlights see 30% higher cart addition."
                                                    });
                                                }

                                                // Abandonment: Add to Cart but no Sales
                                                if (addToCart > 0 && sales === 0) {
                                                    recommendations.push({
                                                        title: "Checkout Friction",
                                                        desc: "Items are being saved but not bought. Update your 'Return & Refund' policy to build buyer confidence."
                                                    });
                                                    recommendations.push({
                                                        title: "Flash Sales Trigger",
                                                        desc: "Apply a limited-time 5% discount to cart-abandoners to close the sale immediately."
                                                    });
                                                }

                                                // Discovery issue: Low/No Views
                                                if (views < 10) {
                                                    recommendations.push({
                                                        title: "Visibility Boost",
                                                        desc: "Discovery is low. Use the 'Product Highlight' feature on your Stoqle profile to push this to the top."
                                                    });
                                                    recommendations.push({
                                                        title: "Social Integration",
                                                        desc: "Share this product directly to your Instagram/WhatsApp from the Stoqle share button."
                                                    });
                                                }

                                                // High Performance: Good Views and Sales
                                                if (views > 20 && sales > 0) {
                                                    recommendations.push({
                                                        title: "Upsell Strategy",
                                                        desc: "This is a winner! Create a bundle with a lower-performing item to increase your average order value."
                                                    });
                                                    recommendations.push({
                                                        title: "Inventory Alert",
                                                        desc: "Consistent sales detected. Ensure your stock levels are healthy for the new month."
                                                    });
                                                }

                                                // Default if data is very low
                                                if (recommendations.length === 0) {
                                                    recommendations.push({
                                                        title: "Building Data",
                                                        desc: "We are gathering more performance data. Check back after 10 more views for detailed insights."
                                                    });
                                                }

                                                return recommendations.slice(0, 3).map((rec, idx) => (
                                                    <RecommendationItem
                                                        key={idx}
                                                        title={rec.title}
                                                        desc={rec.desc}
                                                    />
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

function MetricCard({ title, value, icon, color, bg }: any) {
    return (
        <div className="group bg-white rounded-[0.5rem] p-4 border border-slate-100 hover:border-rose-100 transition-all duration-300 relative overflow-hidden">
            {/* Minimal background glow */}
            <div className={`absolute -top-4 -right-4 w-12 h-12 ${bg} opacity-10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500`} />

            <div className="flex items-center justify-between mb-3 relative z-10">
                <p className="text-[10px] text-slate-400 = truncate pr-2">
                    {title}
                </p>
                <div className={`p-1.5 rounded-[0.4rem] ${bg} ${color} shadow-sm group-hover:rotate-6 transition-transform flex shrink-0 items-center justify-center`}>
                    {cloneElement(icon, { className: "w-3.5 h-3.5" })}
                </div>
            </div>

            <div className="relative z-10">
                <h4 className="text-xl font-black text-slate-900 tracking-tight leading-none group-hover:text-rose-500 transition-colors">
                    {value}
                </h4>
            </div>
        </div>
    );
}

function cloneElement(element: any, props: any) {
    return React.cloneElement(element, props);
}

function RecommendationItem({ title, desc }: { title: string; desc: string }) {
    return (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors border border-white/10">
            <AlertCircle className="w-5 h-5 text-rose-200 shrink-0 mt-0.5" />
            <div>
                <h5 className="font-bold text-sm text-white">{title}</h5>
                <p className="text-xs text-rose-100 font-medium leading-relaxed mt-1">{desc}</p>
            </div>
        </div>
    );
}
