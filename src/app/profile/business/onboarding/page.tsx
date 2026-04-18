"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  ShoppingBag,
  ShieldCheck,
  Tag,
  LayoutDashboard,
  ArrowRight,
  CheckCircle2,
  Info,
  Download,
  Share2,
  ChevronLeft,
  ChevronRight,
  Star,
  Truck,
  RotateCcw,
  Percent,
  Smartphone,
  Zap,
  Store,
  QrCode,
  Image as ImageIcon,
  Video,
  Clock
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { fetchBusinessMe } from "@/src/lib/api/productApi";
import { toast } from "sonner";

// Policy Modals
import SevenDayReturnModal from "@/src/components/business/policyModal/sevenDayReturnModal";
import ReturnShippingSubsidyModal from "@/src/components/business/policyModal/returnShippingSubsidyModal";
import LateShipmentCompensationModal from "@/src/components/business/policyModal/lateShipmentCompensationModal";

export default function VendorOnboardingPage() {
  const router = useRouter();
  const auth = useAuth();
  const [businessData, setBusinessData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("welcome");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Modal States
  const [modalOpen, setModalOpen] = useState({
    sevenDay: false,
    subsidy: false,
    lateShipment: false
  });

  useEffect(() => {
    const loadData = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;
      try {
        const biz = await fetchBusinessMe(token);

        // Fetch full profile manually to get accurate stats not isolated within business
        const profileRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/auth/profile/me`, {
          headers: { "Authorization": `Bearer ${token}` }
        }).catch(() => null);
        const profileJson = profileRes ? await profileRes.json().catch(() => null) : null;

        const businessParams = biz?.data?.business ?? biz?.business ?? biz;
        const bizStatsParams = biz?.data?.stats ?? biz?.stats ?? {};
        const profileStatsParams = profileJson?.data?.stats ?? profileJson?.stats ?? {};

        // Merge stats
        setBusinessData({
          ...businessParams,
          stats: { ...bizStatsParams, ...profileStatsParams }
        });
      } catch (e) {
        console.error("Failed to load business data", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);


  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setActiveSection(id);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50">
    <div className="animate-pulse flex flex-col items-center">
      <div className="w-12 h-12 bg-rose-200 rounded-full mb-4"></div>
      <div className="h-4 w-32 bg-slate-200 rounded"></div>
    </div>
  </div>;

  return (
    <div className=" bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-4 flex lg:hidden items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="lg:hidden p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors active:scale-90"
          >
            <ChevronLeft className="w-6 h-6 text-slate-800" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white shadow-lg shadow-slate-200 overflow-hidden border border-slate-100">
              {businessData?.logo ? (
                <img src={businessData.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Store className="w-5 h-5" />
              )}
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 leading-tight">
                {businessData?.business_name || "Merchant Dashboard"}
              </h1>
              <p className="text-[10px] text-slate-500 font-medium">Stoqle Vendor Onboarding</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push("/profile/business/inventory")}
          className="px-3 py-2 bg-slate-900 text-white rounded-[0.5rem] text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center shadow-lg"
          aria-label="Go to Inventory"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </header>

      <div className=" mx-auto py-8 pb-32">
        {/* Progress Nav */}


        {/* Hero Section */}
        <section id="welcome" className="mb-20 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >

            <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-6 leading-tight">
              Build your <span className="text-rose-600">Digital Empire</span> on Stoqle.
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
              <StatCard label="Smooth Listing" value="Instant" icon={ShoppingBag} color="rose" />
              <StatCard label="Trust Badges" value="Included" icon={ShieldCheck} color="blue" />
              <StatCard label="Smart Growth" value="Standard Policy" icon={Zap} color="amber" />
            </div>
          </motion.div>
        </section>

        {/* Organize Your Customers Animated Section */}
        <OrganizeCustomersSection />

        {/* Adding Products Section */}
        <section id="products" className="mb-24 scroll-mt-24 px-4 bg-slate-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-8">
              <TutorialStep
                num="01"
                title="The Foundation: Details"
                desc="Start with a punchy, SEO-friendly title and accurate category. Detailed descriptions help search filters find your items. Remember to set a competitive price and accurate stock levels."
                icon={LayoutDashboard}
              />
              <TutorialStep
                num="02"
                title="Visual Mastery: Media"
                desc="Upload at least 3 high-res photos. For maximum impact, add a video; our system automatically trims it to 90s and promotes it as a 'Reel' across the platform."
                icon={Video}
              />
              <TutorialStep
                num="03"
                title="Structured Data: Parameters"
                desc="Add specific attributes like Brand, Material, or Technical specs. These parameters help buyers filter your products precisely in the Market."
                icon={Info}
              />
              <TutorialStep
                num="04"
                title="Smarter Variants & SKUs"
                desc="If your product has multiple attributes like Size and Color, use our 'Combination' logic. It generates unique SKUs for every pair (e.g. rose-XL), allowing you to set specific stock and pricing for each."
                icon={Tag}
              />
              <TutorialStep
                num="05"
                title="Policy Overrides"
                desc="Specific products may need longer shipping Prep time or different return rules. You can override your global store settings for any individual product listing."
                icon={ShieldCheck}
              />
            </div>

            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-[0.5rem] opacity-20 blur-2xl group-hover:opacity-30 transition-opacity"></div>
              <div className="relative bg-white p-2 rounded-[0.5rem] border border-slate-100 shadow-2xl shadow-rose-100">
                <img
                  src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop"
                  className="rounded-[0.5rem] w-full aspect-[4/5] object-cover"
                  alt="Product Listing Preview"
                />
                <div className="absolute top-6 left-6 flex gap-2">
                  <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-[0.5rem] text-white text-[10px] font-bold flex items-center gap-1.5">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> Premium Seller
                  </div>
                </div>
                <div className="absolute bottom-6 left-6 right-6 p-4 bg-white/95 backdrop-blur-md rounded-[0.5rem] shadow-xl border border-slate-50">
                  <p className="text-[10px] font-black text-rose-600  mb-1">Live Preview</p>
                  <h4 className="font-bold text-slate-800 truncate">Professional Studio Camera</h4>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-black text-slate-900">₦250,000</span>
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-rose-500 border-2 border-white"></div>
                      <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white"></div>
                      <div className="w-6 h-6 rounded-full bg-slate-300 border-2 border-white flex items-center justify-center text-[8px] font-bold">+2</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Policies Section */}
        <section id="policies" className="mb-24 scroll-mt-24 px-4">
          <SectionHeader
            title="Building Bulletproof Trust"
            subtitle="Policies aren't just rules; they are your path to 5-star ratings."
            icon={ShieldCheck}
            color="emerald"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <PolicyCard
              title="7-Day No Reason Return"
              desc="Allow buyers to return items within 168 hours of delivery. This is the #1 trust factor for new shoppers on Stoqle."
              icon={RotateCcw}
              color="emerald"
              modal="sevenDay"
              onClick={() => setModalOpen(prev => ({ ...prev, sevenDay: true }))}
            />
            <PolicyCard
              title="Return Shipping Subsidy"
              desc="Cover the first 1kg of return shipping. You handle the logistics while offering buyers a more risk-free shopping experience."
              icon={Truck}
              color="blue"
              modal="subsidy"
              onClick={() => setModalOpen(prev => ({ ...prev, subsidy: true }))}
            />
            <PolicyCard
              title="Rapid Refund System"
              desc="Instant refunds for reputable buyers once they ship back your item. Greatly improves overall customer satisfaction."
              icon={Smartphone}
              color="rose"
            />
            <PolicyCard
              title="Late Shipment Compensation"
              desc="Compensate buyers if orders are not shipped within your stated handling time. Encourages timely fulfillment and builds strong customer trust."
              icon={Clock}
              color="violet"
              modal="lateShipment"
              onClick={() => setModalOpen(prev => ({ ...prev, lateShipment: true }))}
            />
            <PolicyCard
              title="Fake One, Pay Four"
              desc="A bold commitment to authenticity. Prove it's genuine, or compensate 4x. For premium brands only."
              icon={ShieldCheck}
              color="amber"
            />
          </div>

          <div className="mt-10 p-6 bg-slate-900 rounded-[0.5rem] text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-600/20 blur-[100px] rounded-full"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-3">Why utilize these policies?</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Statistics show that stores with '7-Day Return' and 'Shipping Subsidy' have
                  <span className="text-white font-bold"> 2.4x higher conversion rates</span>.
                  By offering these policies, you give customers more confidence to buy — while maintaining full control over your delivery and fulfillment process.
                </p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Boosts Trust
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Lower Bounce Rate
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Priority in Search
                  </div>
                </div>
              </div>
              <button
                onClick={() => scrollTo("products")}
                className="px-8 py-4 bg-white text-slate-900 rounded-[0.5rem] font-black text-sm hover:bg-slate-100 transition-all shadow-xl shadow-black/10"
              >
                Setup Policies Now
              </button>
            </div>
          </div>
        </section>

        {/* Promotions Section */}
        <section id="promotions" className="mb-24 scroll-mt-24 px-4">
          <SectionHeader
            title="Accelerate Your Sales"
            subtitle="Strategic discounts and seasonal campaigns to move inventory fast."
            icon={Percent}
            color="amber"
          />

          <div className="bg-white rounded-[0.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-100/50">
            <div className="flex flex-col md:flex-row gap-12">
              <div className="flex-1 space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-[0.5rem] flex items-center justify-center text-amber-600">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">Seasonal Campaigns</h4>
                      <p className="text-xs text-slate-500">Join 'Black Friday' or 'Back to School' with one click.</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Stoqle runs platform-wide campaigns. By joining, your products get featured on the homepage, in push notifications, and dedicated campaign categories.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rose-50 rounded-[0.5rem] flex items-center justify-center text-rose-600">
                      <Tag className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">Direct Flash Discounts</h4>
                      <p className="text-xs text-slate-500">Create urgency with limited-time price drops.</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Set a percentage discount (e.g. 20% OFF) that appears prominently on your product card across the app. High visibility drives high intent.
                  </p>
                </div>
              </div>

              <div className="w-full md:w-80 h-full">
                <div className="bg-slate-50 rounded-[0.5rem] p-6 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 mb-4">Current Promotion Trend</p>
                  <div className="space-y-3">
                    <PromoBar label="Black Friday" percent={85} />
                    <PromoBar label="New Customer" percent={60} />
                    <PromoBar label="Seasonal Sale" percent={40} />
                    <PromoBar label="Clearance" percent={25} />
                  </div>
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-slate-500">Target ROI</span>
                      <span className="text-sm font-black text-emerald-600">4.5x</span>
                    </div>
                    <button
                      onClick={() => router.push("/profile/business/inventory")}
                      className="w-full py-3 bg-rose-500 text-white rounded-[0.5rem] text-xs font-bold shadow-lg shadow-rose-100 hover:scale-[1.02] transition-transform"
                    >
                      Browse Inventory
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Flyer Section */}
        <section id="flyer" className="mb-24 scroll-mt-24 px-4">
          <SectionHeader
            title="Your Brand, Everywhere"
            subtitle="Generate a stunning flyer for your business to share on WhatsApp and Instagram."
            icon={ImageIcon}
            color="indigo"
          />

          <div className="flex flex-col lg:flex-row gap-12 items-start">
            {/* Live Preview */}
            <div className="flex-1 w-full flex justify-center sticky top-24">
              <FlyerPreview
                data={businessData}
                user={auth?.user}
                formatUrl={(url: string) => {
                  if (!url) return null;
                  if (url.startsWith("http")) return url;
                  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
                  return url.startsWith("/public") ? `${baseUrl}${url}` : `${baseUrl}/public/${url}`;
                }}
              />
            </div>

            {/* Controls */}
            <div className="w-full lg:w-80 space-y-6">
              <div className="bg-white p-6 rounded-[0.5rem] border border-slate-100 shadow-xl">
                <h4 className="font-bold text-slate-800 mb-4">Flyer Customization</h4>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-[0.5rem]">
                    <p className="text-[10px] font-bold text-slate-400  mb-2">Social Tagline</p>
                    <p className="text-xs font-medium text-slate-700 italic">"Explore our premium collections on Stoqle!"</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-[0.5rem]">
                    <p className="text-[10px] font-bold text-slate-400 mb-2">QR Link</p>
                    <p className="text-xs font-medium text-slate-700 truncate">stoqle.com/shop/{businessData?.business_name?.toLowerCase().replace(/\s/g, '-')}</p>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <button
                    onClick={() => toast.success("Flyer download started!")}
                    className="w-full py-4 bg-rose-600 text-white rounded-[0.5rem] font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-rose-100 hover:scale-[1.02] transition-all"
                  >
                    <Download className="w-5 h-5" /> Download Image
                  </button>
                  <button
                    onClick={() => toast("Link copied to clipboard!")}
                    className="w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-[0.5rem] font-black text-sm flex items-center justify-center gap-3 hover:bg-slate-50 transition-all"
                  >
                    <Share2 className="w-5 h-5" /> Share Store Link
                  </button>
                </div>
              </div>

              <div className="p-5 bg-indigo-50 rounded-[0.5rem] border border-indigo-100 border-dashed">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                  <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                    This flyer is dynamic. When you update your business logo or name, it updates here automatically. Perfect for status updates!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="text-center bg-white rounded-[0.5rem] p-12 py-20 border border-slate-100 shadow-2xl shadow-rose-100/50 px-4">
          <div className="w-16 h-16 bg-rose-100 rounded-[0.5rem] flex items-center justify-center text-rose-600 mx-auto mb-8">
            <Store className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-4">Ready to Launch?</h2>
          <p className="text-slate-500 mb-10 max-w-lg mx-auto leading-relaxed">
            Your journey as a top-tier vendor starts today. List your first product and let the Stoqle ecosystem do the rest.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push("/profile/business/inventory/add-product")}
              className="px-10 py-2 bg-rose-600 text-white rounded-full  shadow-xl shadow-rose-200 hover:scale-105 transition-transform flex items-center gap-3"
            >
              Start Listing Products <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </section>
      </div>

      {/* Policy Modals */}
      <SevenDayReturnModal
        open={modalOpen.sevenDay}
        onClose={() => setModalOpen(prev => ({ ...prev, sevenDay: false }))}
      />
      <ReturnShippingSubsidyModal
        open={modalOpen.subsidy}
        onClose={() => setModalOpen(prev => ({ ...prev, subsidy: false }))}
      />
      <LateShipmentCompensationModal
        open={modalOpen.lateShipment}
        onClose={() => setModalOpen(prev => ({ ...prev, lateShipment: false }))}
      />
    </div>
  );
}

// --- Internal Components ---

function StatCard({ label, value, icon: Icon, color }: { label: string, value: string, icon: any, color: string }) {
  const colors: Record<string, string> = {
    rose: "text-rose-600 bg-rose-50",
    blue: "text-blue-600 bg-blue-50",
    amber: "text-amber-600 bg-amber-50"
  };
  return (
    <div className="bg-white p-5 rounded-[0.5rem] border border-slate-100 shadow-sm flex flex-col items-center text-center">
      <div className={`w-10 h-10 rounded-[0.5rem] flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-[10px] font-bold text-slate-400  mb-1">{label}</p>
      <p className="text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function SectionHeader({ title, subtitle, icon: Icon, color }: { title: string, subtitle: string, icon: any, color: string }) {
  const colors: Record<string, string> = {
    rose: "bg-rose-100 text-rose-600",
    emerald: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600",
    indigo: "bg-indigo-100 text-indigo-600"
  };
  return (
    <div className="mb-10">

      <h3 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 text-sm md:text-md max-w-xl">{subtitle}</p>
    </div>
  );
}

function TutorialStep({ num, title, desc, icon: Icon }: { num: string, title: string, desc: string, icon: any }) {
  return (
    <div className="group flex gap-5">
      <div className="flex-shrink-0">
        <div className="text-[10px] font-black text-slate-300 mb-2 tracking-widest">{num}</div>
        <div className="w-10 h-10 bg-white border border-slate-100 rounded-[0.5rem] flex items-center justify-center text-slate-400 group-hover:border-rose-400 group-hover:text-rose-500 group-hover:bg-rose-50 transition-all ">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="pt-2">
        <h4 className="font-bold text-slate-800 mb-1.5 group-hover:text-rose-600 transition-colors  tracking-tight">{title}</h4>
        <p className="text-xs text-slate-500 leading-relaxed font-medium">{desc}</p>
      </div>
    </div>
  );
}

function PolicyCard({ title, desc, icon: Icon, color, modal, onClick }: { title: string, desc: string, icon: any, color: string, modal?: string, onClick?: () => void }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600"
  };
  return (
    <div className="group bg-white p-6 rounded-[0.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
      <div className={`w-12 h-12 rounded-[0.5rem] flex items-center justify-center mb-5 ${colors[color]} group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="font-black text-slate-800 mb-2">{title}</h4>
      <p className="text-xs text-slate-500 leading-relaxed mb-4">{desc}</p>
      {modal && (
        <button
          onClick={onClick}
          className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 group-hover:text-slate-900 transition-colors"
        >
          Learn More <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function PromoBar({ label, percent }: { label: string, percent: number }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10px] font-bold text-slate-600">{label}</span>
        <span className="text-[10px] font-black text-rose-600">{percent}%</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${percent}%` }}
          viewport={{ once: true }}
          className="h-full bg-rose-500"
        ></motion.div>
      </div>
    </div>
  );
}

function FlyerPreview({ data, user, formatUrl }: { data: any, user: any, formatUrl: (url: string) => string | null }) {
  const bgImage = formatUrl(data?.bg_photo_url || user?.bg_photo_url) || "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1000&auto=format&fit=crop";
  const logo = formatUrl(data?.business_logo || data?.logo || user?.profile_pic || user?.profile_photo_url || user?.avatar_url);
  const businessName = data?.business_name || user?.business_name || user?.username || "BUSINESS NAME";
  const stoqleId = data?.stoqle_id || user?.stoqle_id || data?.business_id || user?.id || "00000000001";

  // Safely attempt to extract followers count from various possible backend formats
  const followersCount =
    data?.followersCount ?? data?.follower_count ?? data?.followers ??
    user?.followersCount ?? user?.follower_count ?? user?.followers ??
    data?.stats?.followers ?? data?.stats?.follower_count ??
    user?.stats?.followers ?? user?.stats?.follower_count ?? 0;

  return (
    <div className="relative w-full max-w-sm aspect-[4/6] bg-slate-900 rounded-[0.5rem] shadow-2xl overflow-hidden transform hover:rotate-1 transition-transform duration-500 border-[6px] border-white">
      {/* Background Photo - Top portion only */}
      <div className="absolute top-0 left-0 right-0 h-[40%] z-0">
        <img src={bgImage} className="w-full h-full object-cover" alt="Background" />
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Bottom 75% - Solid Red Block with All Content */}
      <div className="absolute bottom-0 left-0 right-0 h-[70%] bg-gradient-to-br from-rose-900 via-rose-700 to-rose-500 rounded-t-[2rem] z-10 shadow-[0_-15px_40px_rgba(0,0,0,0.4)]">
        <div className="relative h-full flex flex-col p-8 justify-between text-white">
          {/* Main Content (Logo, Name, ID) */}
          <div className="flex flex-col items-start mt-2">
            <div className="w-16 h-16 rounded-full border border-white/80 mb-4 overflow-hidden ">
              {logo ? (
                <img src={logo} className="w-full h-full object-cover rounded-full" alt="Logo" />
              ) : (
                <div className="w-full h-full bg-rose-50 rounded-full flex items-center justify-center">
                  <Store className="w-8 h-8 text-rose-500" />
                </div>
              )}
            </div>
            <h2 className="text-xl font-medium leading-tight tracking-tighter mb-1 drop-shadow-lg">{businessName}</h2>
            <div className=" rounded-[0.5rem]">
              <p className="text-[10px] text-white ">Stoqle ID: {stoqleId}</p>
              <p className="text-[10px] text-white/80 mt-0.5">{Number(followersCount).toLocaleString()} Followers</p>
            </div>
          </div>

          {/* Divider Line */}
          <div className="w-full border-t border-white/15 my-1"></div>

          {/* Bottom Section: Info Left, QR Right */}
          <div className="relative flex items-end justify-between w-full">
            {/* Sun Flare Glow */}
            <div className="absolute -right-4 bottom-4 w-40 h-40 bg-white/20 blur-[60px] rounded-full pointer-events-none"></div>

            <div className="flex flex-col items-start gap-4">
              <div className="bg-white px-3 py-1 rounded-full shadow-lg">
                <span className="text-rose-600 font-black text-md tracking-tighter">stoqle</span>
              </div>
              <div className="space-y-0.5">
                <p className="text-[14px] text-white/70 leading-tight tracking-tight drop-shadow-md">Scan QR code</p>
                <p className="text-[14px] text-white/80  tracking-widest">Find me on stoqle</p>
              </div>
            </div>

            <div className="relative w-24 h-24 bg-white rounded-[1rem] p-2 shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform border-[3px] border-white overflow-hidden">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://stoqle.com/shop/${data?.business_slug || data?.slug || data?.business_id || "0"}`)}`}
                alt="QR Code"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Aesthetic Accents */}
      <div className="absolute top-0 right-0 p-4 z-0">
        <div className="w-8 h-8 border-t-2 border-r-2 border-white/20 rounded-tr-[0.5rem]"></div>
      </div>
    </div>
  );
}

function DirectDiscountIcon(props: any) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 2L5.5 13h13L13 22" />
    </svg>
  );
}

function OrganizeCustomersSection() {
  const customerSectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: customerSectionRef,
    offset: ["start end", "end start"]
  });

  const bgScaleFactor = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], [0.8, 1, 1, 0.8]);
  const bgBorderRadius = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], ["40px", "0px", "0px", "40px"]);
  const opacityFactor = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const yOffset = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], [100, 0, 0, -100]);

  return (
    <section ref={customerSectionRef} className="relative w-full h-[80vh] flex items-center justify-center mb-20 outline-none">
      <motion.div
        style={{
          scaleX: bgScaleFactor,
          borderRadius: bgBorderRadius,
        }}
        className="absolute inset-0 bg-slate-900 overflow-hidden shadow-2xl flex items-center justify-center"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />
      </motion.div>

      <motion.div
        style={{
          opacity: opacityFactor,
          y: yOffset
        }}
        className="relative z-10 max-w-4xl mx-auto px-8 text-center text-white"
      >

        <h2 className="lg:text-4xl text-[30px] font-black mb-8 leading-[1.1] tracking-tight">
          Organize your customers.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-amber-300">
            Stay engaged & alert.
          </span>
        </h2>

        <p className="lg:text-md text-[12px] text-slate-300 max-w-2xl mx-auto leading-relaxed font-medium">
          We've embedded powerful CRM tools directly into your dashboard. Group customers by buying habits, send targeted broadcast offers, and never miss an opportunity to turn a one-time buyer into a lifelong fan.
        </p>
      </motion.div>
    </section>
  );
}
