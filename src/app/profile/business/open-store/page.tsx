"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import OpenStoreModal from "@/src/components/business/open-store-modal"; // adjust path if your components folder is elsewhere

export default function OpenStorePage() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    // cleanup in case component unmounts while modal is open
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);


  return (
    <>
      <div className="min-h-screen bg-[linear-gradient(180deg,#fff0f0_0%,#e6e6e6_50%,#ffffff_100%)]">
        <div className="mx-auto px-4 py-8">
          <main className="space-y-6">
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-slate-900">Grow with Stoqle</h2>
              <p className="mt-2 text-slate-500">Powerful tools to grow your business by more than 18% - reach more customers, manage inventory and sell everywhere.</p>

              <div className="mt-5">
                <div className="flex gap-3 overflow-x-auto">
                  <MetricCard value="18%+" label="Avg. Revenue Growth" />
                  <MetricCard value="x3" label="New Channels Reached" />
                  <MetricCard value="24/7" label="Support" />
                </div>
              </div>

              <div className="mt-6 gap-3">
                <button onClick={() => setModalOpen(true)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-3 text-white font-semibold shadow hover:brightness-95 focus:outline-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path d="M3 3h18v4H3zM5 11h14l-1 8H6z" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Get Started - It's Free
                </button>
                <div className="w-3" />
              </div>
            </motion.section>

            <section>
              <SectionTitle>Features to expand your reach</SectionTitle>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FeatureCard title="Sell on Multiple Channels" description="List once and sell on web, social and marketplaces seamlessly." />
                <FeatureCard title="Smart Inventory" description="Track stock in real-time for all your stores and warehouses." />
                <FeatureCard title="Analytics & Insights" description="Understand customer behavior and product trends with clear dashboards." />
                <FeatureCard title="Payments & Checkout" description="Fast, secure checkout with multiple payment options." />
              </div>
            </section>

            <section>
              <SectionTitle>How it works</SectionTitle>
              <div className="mt-3 rounded-xl bg-white p-4 shadow-sm">
                <ol className="space-y-6">
                  {["Create your shop", "Upload products", "Start receiving orders", "Scale with insights"].map((s, i) => (
                    <li key={s} className="flex gap-4 items-start">
                      <div className="text-4xl font-extrabold text-rose-500">{String(i + 1).padStart(2, "0")}</div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{s}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-white p-4 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Ready to grow?</h3>
              <p className="mt-2 text-slate-600">Start your free Stoqle shop today and see measurable growth within months.</p>

              <div className="mt-4 flex gap-3">
                <button onClick={() => setModalOpen(true)} className="flex-1 rounded-lg bg-rose-500 px-4 py-3 text-white font-semibold">Create my shop</button>

                <button onClick={() => router.push("/merchant-guide")} className="flex-1 rounded-lg border border-slate-200 px-4 py-3 bg-white font-medium">Merchant Guide</button>
              </div>
            </motion.section>

            <footer className="mt-6 text-center text-sm text-slate-500">© {new Date().getFullYear()} Stoqle - Your business, amplified</footer>
          </main>
        </div>


      </div>
      <OpenStoreModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

/* ----- small shared subcomponents (keep in this file) ----- */

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-[170px] p-3 rounded-xl bg-[#f7f7f9] flex items-center gap-3">
      <div className="p-2 rounded-md bg-[rgba(228,92,82,0.12)]">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
          <path d="M3 12h18" stroke="#e45c52" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <div className="text-sm font-bold text-slate-900">{value}</div>
        <div className="text-xs text-slate-600">{label}</div>
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="p-2 rounded-md bg-[rgba(228,92,82,0.08)] inline-block mb-3">
        <svg className="w-5 h-5 text-rose-500" viewBox="0 0 24 24" fill="none">
          <path d="M12 2v20M2 12h20" stroke="#ef4444" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="font-semibold text-slate-900">{title}</div>
      <div className="text-sm text-slate-600 mt-1">{description}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-semibold text-slate-700">{children}</h4>;
}
