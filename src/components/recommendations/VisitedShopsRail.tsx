"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { isOffline, safeFetch } from "@/src/lib/api/handler";
import { useAuth } from "@/src/context/authContext";
import { formatUrl } from "@/src/lib/utils/media";
import { FaChevronRight } from "react-icons/fa";
import { motion } from "framer-motion";

export default function VisitedShopsRail({ }) {
    const { token } = useAuth();
    const [shops, setShops] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (isOffline()) {
                setLoading(false);
                return;
            }
            try {
                const data = await safeFetch<any>("/api/business/visited/me", {
                    headers: token ? { "Authorization": `Bearer ${token}` } : {}
                });
                setShops(data.data || []);
            } catch (err) {
                // Silent
            } finally {
                setLoading(false);
            }
        };

        if (token) load();
        else setLoading(false);
    }, [token]);

    if (loading || shops.length === 0) return null;

    return (
        <section className=" animate-in fade-in slide-in-from-bottom-4 duration-700 bg-white px-2">
            <div className="flex items-center justify-between px-1 py-4">
                <p className="text-[13px] lg:text-lg text-slate-500">
                    Frequently Visited Shops
                </p>
                <Link href="/partners" className="flex items-center group transition-all">
                    <span className="text-[11px] text-slate-400 group-hover:text-rose-500 flex items-center gap-1">
                        Explore All
                        <FaChevronRight size={14} />
                    </span>
                </Link>
            </div>

            <div className="flex overflow-x-auto no-scrollbar pb-3 px-1  snap-x scroll-smooth">
                {shops.map((shop, idx) => (
                    <motion.div
                        key={shop.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="snap-start"
                    >
                        <Link
                            href={`/shop/${shop.business_slug || shop.id}`}
                            className="flex flex-col items-center w-[100px] group"
                        >
                            <div className="relative lg:w-16 lg:h-16 w-12 h-12">
                                <div className="absolute inset-[-4px] rounded-full group-hover:border-rose-500/10 transition-all duration-500 scale-90 group-hover:scale-110" />

                                <div className="w-full h-full rounded-full overflow-hidden bg-white border border-slate-100 relative z-10 p-0.5">
                                    <div className="w-full h-full rounded-full overflow-hidden relative">
                                        <Image
                                            src={shop.logo ? formatUrl(shop.logo) : (shop.profile_pic ? formatUrl(shop.profile_pic) : "/assets/images/favio.png")}
                                            alt={shop.business_name}
                                            fill
                                            sizes="30px"
                                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                    </div>
                                </div>

                            </div>

                            <p className="text-[10px] lg:text-[12px] font-bold text-slate-500 mt-2 line-clamp-1 group-hover:text-rose-500 transition-colors ">{shop.business_name}</p>
                        </Link>
                    </motion.div>
                ))}


            </div>
        </section>
    );
}
