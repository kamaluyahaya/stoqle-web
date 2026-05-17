"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { FaChevronLeft, FaShieldAlt, FaHandshake, FaGlobe, FaRocket, FaLock, FaHeadset } from "react-icons/fa";
import { ShieldCheck, Zap, Globe, BarChart3, Lock, Headphones, BadgeCheck, FileText, Check } from "lucide-react";
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
      {/* Mobile Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100/50 sm:hidden">
        <div className="flex items-center justify-between h-14 px-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-slate-100 active:bg-slate-200 rounded-full transition-all flex items-center justify-center"
            aria-label="Go back"
          >
            <FaChevronLeft className="text-lg text-slate-900" />
          </button>

          <h1 className="absolute left-1/2 -translate-x-1/2 font-bold text-slate-900 text-[17px]">
            Open store
          </h1>

          <div className="w-10" /> {/* Balance spacer */}
        </div>
      </nav>

      <div className="min-h-screen bg-[linear-gradient(180deg,#fff0f0_0%,#e6e6e6_50%,#ffffff_100%)] pt-14 sm:pt-0">
        <div className="mx-auto px-4 py-6 sm:py-8">
          <main className="space-y-6">
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900 sm:text-left text-center">Grow with Stoqle</h2>
              <p className="mt-2 text-slate-500">Powerful tools to grow your business by more than 18% - reach more customers, manage inventory and sell everywhere.</p>

              <div className="mt-5">
                <div className="flex gap-3 overflow-x-auto">
                  <MetricCard value="18%+" label="Avg. Revenue Growth" />
                  <MetricCard value="x3" label="New Channels Reached" />
                  <MetricCard value="24/7" label="Support" />
                </div>
              </div>

              <div className="mt-6 gap-3">
                <button onClick={() => setModalOpen(true)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-rose-500 px-4 py-3 text-white shadow hover:brightness-95 focus:outline-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path d="M3 3h18v4H3zM5 11h14l-1 8H6z" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Get Started - It's Free
                </button>
                <div className="w-3" />
              </div>
            </motion.section>

            <section>
              <SectionTitle>Why Stoqle for Business?</SectionTitle>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <BenefitCard
                  icon={<FaRocket className="text-rose-500" />}
                  title="Instant Payouts"
                  description="Access your funds immediately after delivery confirmation. No more waiting weeks for your money."
                />
                <BenefitCard
                  icon={<FaGlobe className="text-blue-500" />}
                  title="Global Presence"
                  description="List your products once and reach customers across the country and beyond with our integrated logistics."
                />
                <BenefitCard
                  icon={<BarChart3 className="text-emerald-500 w-5 h-5" />}
                  title="Advanced Analytics"
                  description="Deep dive into customer behavior, seasonal trends, and sales performance with enterprise-grade tools."
                />
                <BenefitCard
                  icon={<Zap className="text-amber-500 w-5 h-5" />}
                  title="Automated Marketing"
                  description="Our AI-driven system promotes your products to the right audience, maximizing your ROI effortlessly."
                />
              </div>
            </section>

            <section className="bg-slate-900 rounded-2xl p-6 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldCheck size={120} />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <BadgeCheck className="text-rose-500" />
                  <h3 className="text-lg font-bold">Built for Trust</h3>
                </div>
                <h4 className="text-2xl font-semibold mb-4">Our Merchant Protection Policy</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="mt-1"><Lock size={18} className="text-rose-400" /></div>
                      <div>
                        <p className="font-bold text-sm">Secure Escrow</p>
                        <p className="text-xs text-slate-400">All payments are held in a secure escrow system, ensuring you get paid for every valid order.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="mt-1"><FaHandshake size={18} className="text-rose-400" /></div>
                      <div>
                        <p className="font-bold text-sm">Dispute Protection</p>
                        <p className="text-xs text-slate-400">Our dedicated resolution team protects you from fraudulent chargebacks and unfair claims.</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="mt-1"><FaHeadset size={18} className="text-rose-400" /></div>
                      <div>
                        <p className="font-bold text-sm">24/7 Support</p>
                        <p className="text-xs text-slate-400">As a Stoqle Merchant, you have a direct line to our business support team for any operational needs.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="mt-1"><FileText size={18} className="text-rose-400" /></div>
                      <div>
                        <p className="font-bold text-sm">Transparent Fees</p>
                        <p className="text-xs text-slate-400">No hidden charges. Clear, predictable fee structure that scales with your success.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

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
              <SectionTitle>Premium Service Guarantees</SectionTitle>
              <p className="text-sm text-slate-500 mt-1 mb-4">Adopting these policies builds ultimate trust with your customers and qualifies you for the "Trusted Merchant" badge.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <PolicyBadge
                  icon={<div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-xs">7D</div>}
                  title="7-Day Returns"
                  subtitle="No reason return"
                />
                <PolicyBadge
                  icon={<div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><FaRocket size={14} /></div>}
                  title="Rapid Refund"
                  subtitle="Instant processing"
                />
                <PolicyBadge
                  icon={<div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Check size={16} /></div>}
                  title="Shipping Subsidy"
                  subtitle="Return coverage"
                />
                <PolicyBadge
                  icon={<div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs">4X</div>}
                  title="Authenticity"
                  subtitle="Fake one pay four"
                />
                <PolicyBadge
                  icon={<div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600"><Zap size={14} /></div>}
                  title="On-Time Delivery"
                  subtitle="Late compensation"
                />
                <PolicyBadge
                  icon={<div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"><ShieldCheck size={14} /></div>}
                  title="Trust Badge"
                  subtitle="Verified merchant"
                />
              </div>
            </section>

            <section>
              <SectionTitle>Your Path to Success</SectionTitle>
              <p className="text-sm text-slate-500 mt-1 mb-6">Launch your professional storefront in three simple steps.</p>

              <div className="relative space-y-8 before:absolute before:left-[19px] before:top-2 before:h-[calc(100%-16px)] before:w-0.5 before:bg-gradient-to-b before:from-rose-500 before:via-rose-200 before:to-transparent">
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="relative flex gap-6"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border-2 border-rose-500 text-rose-600 font-bold shadow-sm z-10">
                    1
                  </div>
                  <div className="pt-1">
                    <h5 className="font-bold text-slate-900 text-lg">Create your business identity</h5>
                    <p className="mt-1.5 text-sm text-slate-500 leading-relaxed max-w-md">
                      Set up your profile in minutes. Tell us about your brand, select your categories, and get your verified merchant status.
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="relative flex gap-6"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border-2 border-rose-500 text-rose-600 font-bold shadow-sm z-10">
                    2
                  </div>
                  <div className="pt-1">
                    <h5 className="font-bold text-slate-900 text-lg">Upload your collection</h5>
                    <p className="mt-1.5 text-sm text-slate-500 leading-relaxed max-w-md">
                      Use our bulk-upload tools or mobile-first editor to list your products. Our AI will automatically optimize your descriptions for better search.
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="relative flex gap-6"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border-2 border-rose-500 text-rose-600 font-bold shadow-sm z-10">
                    3
                  </div>
                  <div className="pt-1">
                    <h5 className="font-bold text-slate-900 text-lg">Go live & Start earning</h5>
                    <p className="mt-1.5 text-sm text-slate-500 leading-relaxed max-w-md">
                      Open your doors to millions. Manage orders, track analytics, and receive instant payouts directly to your preferred method.
                    </p>
                  </div>
                </motion.div>
              </div>
            </section>

            <motion.section
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white shadow-xl"
            >
              <div className="absolute top-0 right-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl" />
              <div className="absolute bottom-0 left-0 -mb-12 -ml-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

              <div className="relative z-10 flex flex-col items-center text-center">
                <h3 className="text-3xl font-bold tracking-tight">Ready to grow your business?</h3>
                <p className="mt-4 text-slate-300 text-lg max-w-md leading-relaxed">
                  Start your professional Stoqle storefront today. No setup fees, no hidden costs.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                  <button
                    onClick={() => setModalOpen(true)}
                    className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-rose-500/30 transition-all hover:bg-rose-600 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Create My Store
                    <FaRocket className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                  </button>

                  <button
                    onClick={() => router.push("/profile/business/onboarding")}
                    className="inline-flex items-center justify-center rounded-xl bg-white/10 px-8 py-4 text-lg font-semibold backdrop-blur-md border border-white/20 transition-all hover:bg-white/20"
                  >
                    View Merchant Guide
                  </button>
                </div>
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
  return <h4 className="text-base font-bold text-slate-900">{children}</h4>;
}

function BenefitCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mb-4 text-xl">
        {icon}
      </div>
      <h5 className="font-bold text-slate-900 mb-2">{title}</h5>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

function PolicyBadge({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center p-4 rounded-2xl bg-white border border-slate-100 text-center shadow-sm hover:border-rose-100 transition-colors">
      <div className="mb-3">{icon}</div>
      <div className="font-bold text-slate-900 text-xs">{title}</div>
      <div className="text-[10px] text-slate-500 mt-0.5 font-medium uppercase tracking-wider">{subtitle}</div>
    </div>
  );
}
