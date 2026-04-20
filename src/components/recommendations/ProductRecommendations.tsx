"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { fetchPersonalizedFeed } from "@/src/lib/api/productApi";
import { useAuth } from "@/src/context/authContext";
import { formatUrl } from "@/src/lib/utils/media";
import { FaPlay } from "react-icons/fa";
import { VerifiedBadge } from "@/src/components/common/VerifiedBadge";
import { motion } from "framer-motion";

export default function ProductRecommendations({ title = "Recommended For You" }: { title?: string }) {
    const { token } = useAuth();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                // Fetch recommendations
                const feedData = await fetchPersonalizedFeed(20, 0, token);
                if (feedData?.data) setProducts(feedData.data);
            } catch (err) {
                console.error("ProductRecommendations error", err);
            } finally {
                setLoading(false);
            }
        };

        if (token) load();
        else setLoading(false);
    }, [token]);

    if (loading || products.length === 0) return null;

    return (
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 px-2">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {products.map((p, idx) => (
                    <motion.article
                        key={p.product_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (idx % 10) * 0.05 }}
                        className="group bg-white rounded-xl border border-slate-100 overflow-hidden hover:border-emerald-100 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-500"
                    >
                        <Link href={`/product/${p.slug || p.product_slug || p.product_id}`} className="block">
                            <div className="relative aspect-[4/5] bg-slate-50 overflow-hidden">
                                {p.product_video ? (
                                    <>
                                        <video
                                            src={formatUrl(p.product_video)}
                                            poster={formatUrl(p.first_image)}
                                            muted loop playsInline
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        />
                                        <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-white p-2 rounded-full z-10 flex items-center justify-center">
                                            <FaPlay size={8} />
                                        </div>
                                    </>
                                ) : (
                                    <img
                                        src={formatUrl(p.first_image)}
                                        alt={p.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        loading="lazy"
                                    />
                                )}

                                {(p.promo_discount || p.sale_discount) && (
                                    <div className="absolute bottom-3 left-3 flex flex-col gap-1">
                                        <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-sm uppercase tracking-tighter">
                                            -{p.promo_discount || p.sale_discount}% OFF
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="p-3.5 space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full overflow-hidden relative shrink-0 border border-slate-100">
                                        <Image
                                            src={p.logo ? formatUrl(p.logo) : (p.profile_pic ? formatUrl(p.profile_pic) : "/assets/images/favio.png")}
                                            fill sizes="16px" className="object-cover" alt="Vendor"
                                        />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide truncate">{p.business_name}</span>
                                    {p.trusted_partner === 1 && <VerifiedBadge size="xs" />}
                                </div>

                                <h3 className="text-xs font-bold text-slate-700 line-clamp-2 leading-snug group-hover:text-slate-900 transition-colors h-[2.8em]">{p.title}</h3>

                                <div className="pt-2 flex items-center justify-between border-t border-slate-50">
                                    <span className="text-slate-900 text-base font-black tracking-tight">₦{Number(p.price || 0).toLocaleString()}</span>
                                    {p.sold_count > 0 && (
                                        <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">{p.sold_count}+ Sold</span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    </motion.article>
                ))}
            </div>
        </section>
    );
}
