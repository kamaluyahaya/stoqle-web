import React, { useState, useEffect } from "react";
import { Users, TrendingUp, Eye, ShoppingCart, ArrowUpRight, ArrowDownRight, Package, Loader2, Star, MessageCircle, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_BASE_URL } from "@/src/lib/config";
import { useRouter } from "next/navigation";


export default function InsightsTab({
    products,
    onProductClick,
    onInsightClick,
    loadingPreview,
    totalCustomers
}: {
    products: any[],
    onProductClick?: (id: number) => void,
    onInsightClick?: (product: any) => void,
    loadingPreview?: number | string | null,
    totalCustomers?: number
}) {
    const [loading, setLoading] = useState(true);
    const [insights, setInsights] = useState<any>(null);
    const [shopVisitors, setShopVisitors] = useState<any[]>([]);
    const router = useRouter();


    useEffect(() => {
        const fetchInsights = async () => {
            try {
                const cachedHtml = sessionStorage.getItem('vendor_insights_cache');
                if (cachedHtml) {
                    const parsed = JSON.parse(cachedHtml);
                    if (parsed.insights) setInsights(parsed.insights);
                    if (parsed.shopVisitors) setShopVisitors(parsed.shopVisitors);
                    setLoading(false);
                }

                const token = localStorage.getItem("token");
                const [resInsights, resVisitors] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/insights`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API_BASE_URL}/api/insights/shop-visitors`, { headers: { 'Authorization': `Bearer ${token}` } })
                ]);
                
                const dataInsights = await resInsights.json();
                const dataVisitors = await resVisitors.json();
                
                if (dataInsights.ok) {
                    setInsights(dataInsights.data);
                }
                if (dataVisitors.ok) {
                    setShopVisitors(dataVisitors.data);
                }

                sessionStorage.setItem('vendor_insights_cache', JSON.stringify({
                    insights: dataInsights.ok ? dataInsights.data : null,
                    shopVisitors: dataVisitors.ok ? dataVisitors.data : []
                }));
            } catch (err) {
                console.error("Failed to load insights:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchInsights();
    }, []);

    // Grouping logic for visitors
    const groupedVisitors = React.useMemo(() => {
        if (!shopVisitors || shopVisitors.length === 0) return {};
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());

        const startOfLastWeek = new Date(startOfWeek);
        startOfLastWeek.setDate(startOfWeek.getDate() - 7);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const groups: Record<string, any[]> = {
            "Today": [],
            "This Week": [],
            "Last Week": [],
            "Last Month": [],
            "Earlier": []
        };

        shopVisitors.forEach(v => {
            const vDate = new Date(v.last_visited_at || v.first_visited_at);
            if (vDate >= today) groups["Today"].push(v);
            else if (vDate >= startOfWeek) groups["This Week"].push(v);
            else if (vDate >= startOfLastWeek) groups["Last Week"].push(v);
            else if (vDate >= startOfLastMonth) groups["Last Month"].push(v);
            else groups["Earlier"].push(v);
        });

        // Filter out empty groups
        return Object.fromEntries(Object.entries(groups).filter(([_, items]) => items.length > 0));
    }, [shopVisitors]);


    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <Loader2 className="w-10 h-10 animate-spin text-rose-500 mb-4" />
                <p className="text-sm font-bold text-slate-500">Compiling shop insights...</p>
            </div>
        );
    }

    if (!insights) return null;

    // Formatting API data for UI charts
    const chartData = (insights.salesOverTime || []).map((s: any) => ({
        name: new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' }),
        sales: parseFloat(s.sales || 0)
    }));

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top Level KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <InsightCard title="Total Customers" value={totalCustomers || insights.customerMix?.total || 0} trend={`+${insights.customerMix?.new || 0} recent`} isUp={true} icon={<Users />} />
                <InsightCard title="Low Stock Items" value={insights.lowStock?.length || 0} trend="Action Needed" isUp={false} icon={<Package />} />
                <InsightCard title="Recent Orders" value={insights.recentOrders?.length || 0} trend="This Week" isUp={true} icon={<ShoppingCart />} />
                <InsightCard title="Top Earner" value={insights.revenueByCategory?.[0]?.category_id || 'N/A'} trend="Category" isUp={true} icon={<TrendingUp />} />
            </div>

            {/* Shop Visitors Section */}
            <div className="bg-white p-6 rounded-[0.5rem] border border-slate-200 mt-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-md font-bold text-slate-900 flex items-center gap-2">
                        <Eye className="w-5 h-5 text-indigo-500" />
                        Recent Shop Visitors
                    </h3>
                    <span className="bg-indigo-50 text-indigo-600 text-xs font-bold px-2.5 py-1 rounded-full">
                        {shopVisitors.length} Total Tracking
                    </span>
                </div>

                {shopVisitors.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-slate-400 py-12 border-2 border-dashed border-slate-100 rounded-xl">
                        <Users className="w-12 h-12 mb-3 text-slate-200" />
                        <p className="font-medium">No visitors recorded yet.</p>
                        <p className="text-xs mt-1">Share your shop link to start gathering traffic!</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(groupedVisitors).map(([groupName, visitors]) => (
                            <div key={groupName} className="space-y-3">
                                <h4 className="text-xs font-black text-slate-400 tracking-wider uppercase border-b border-slate-100 pb-2">
                                    {groupName} <span className="text-slate-300 ml-1">({visitors.length})</span>
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {visitors.map((v) => (
                                        <div 
                                            key={v.id} 
                                            onClick={() => v.visitor_user_id && router.push(`/${v.username || v.visitor_user_id}`)}
                                            className={`flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:border-slate-200 transition-colors bg-slate-50/50 ${v.visitor_user_id ? 'cursor-pointer hover:bg-slate-100 active:scale-[0.98]' : ''}`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                    {v.visitor_user_id && v.profile_pic ? (
                                                        <img src={v.profile_pic} alt={v.full_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <UserAvatarPlaceholder />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-slate-900 truncate">
                                                        {v.visitor_user_id ? (v.full_name || `@${v.username || 'user'}`) : 'Guest Visitor'}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(v.last_visited_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {v.visit_count} visit(s)
                                                    </p>
                                                </div>
                                            </div>
                                            {v.visitor_user_id && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/messages?user=${v.visitor_user_id}`)
                                                    }}
                                                    className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors"
                                                    title="Send Direct Message"
                                                >
                                                    <MessageCircle className="w-[18px] h-[18px]" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                {/* Main Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-[0.5rem] border border-slate-200 flex flex-col min-h-[420px]">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Sales Volume</h3>
                            <p className="text-xs text-slate-500 font-medium">Recorded across dates</p>
                        </div>
                    </div>

                    {chartData.length > 0 ? (
                        <div className="h-[320px] w-full mt-auto">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₦${val.toLocaleString()}`} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                                        formatter={(value: any) => [`₦${value.toLocaleString()}`, "Sales"]}
                                    />
                                    <Area type="monotone" dataKey="sales" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
                            <TrendingUp className="w-12 h-12 mb-3 text-slate-200" />
                            <p>No sales activity recorded recently.</p>
                        </div>
                    )}
                </div>

                {/* Top Products List */}
                <div className="bg-white p-6 rounded-[0.5rem] border border-slate-200  flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-md font-bold text-slate-900 flex items-center gap-2">
                            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                            Best Selling Products
                        </h3>
                    </div>
                    <div className="flex-1 space-y-4">
                        {insights.bestSellers && insights.bestSellers.length > 0 ? (
                            insights.bestSellers.map((product: any, idx: number) => (
                                <div
                                    key={product.product_id}
                                    onClick={() => onProductClick?.(product.product_id)}
                                    className="flex items-center gap-4 group cursor-pointer hover:bg-slate-50/80 p-1.5 -mx-1.5 rounded-2xl transition-all active:scale-[0.98]"
                                >
                                    <div className="relative shrink-0">
                                        <div className="w-11 h-11 rounded-[0.5rem] bg-slate-100 border border-slate-200 overflow-hidden ">
                                            <img
                                                src={product.image_url || "/placeholder.png"}
                                                alt=""
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                        </div>
                                        <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white ">
                                            {idx + 1}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-rose-500 transition-colors flex items-center gap-2">
                                            {product.product_name || product.name || 'Common Item'}
                                            {Number(loadingPreview) === Number(product.product_id) && <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />}
                                        </h4>
                                        <p className="text-[11px] font-medium text-slate-500">{product.sold} units sold</p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onInsightClick?.({
                                                product_id: product.product_id,
                                                name: product.product_name || product.name,
                                                image_url: product.image_url
                                            });
                                        }}
                                        className="p-2 opacity-0 group-hover:opacity-100 bg-amber-50 text-amber-600 rounded-[0.5rem] hover:bg-amber-100 transition-all "
                                        title="View Performance Insights"
                                    >
                                        <TrendingUp className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-slate-400 text-center py-10 border-2 border-dashed border-slate-100 rounded-xl">Not enough data to display best sellers.</p>
                        )}
                    </div>
                </div>
            </div>


        </div>
    );
}

function UserAvatarPlaceholder() {
    return <Users className="w-5 h-5 text-indigo-400" />;
}


function InsightCard({ title, value, trend, isUp, icon }: any) {
    return (
        <div className="bg-white p-5 rounded-[0.5rem] border border-slate-200  hover:shadow-md transition-shadow cursor-default">
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-rose-50 text-rose-500 rounded-[0.5rem]">
                    {icon}
                </div>
                <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                    {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trend}
                </div>
            </div>
            <div>
                <h4 className="text-xl font-black text-slate-900 tracking-tight line-clamp-1">{value}</h4>
                <p className="text-xs font-bold text-slate-400  mt-1">{title}</p>
            </div>
        </div>
    );
}
