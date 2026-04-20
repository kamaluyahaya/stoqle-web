"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import {
  Shield,
  Heart,
  ShoppingBag,
  AlertTriangle,
  Lock,
  Zap,
  Package,
  RefreshCcw,
  UserCheck,
  Gavel,
  Flag,
  ChevronDown,
  ChevronLeft,
  ThumbsUp,
  ThumbsDown,
  Download,
  Share2,
  Bookmark,
  MessageSquare,
  HelpCircle,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// --- Data ---
const guidelines = [
  {
    id: "purpose",
    icon: <Zap className="w-6 h-6 text-blue-500" />,
    title: "Purpose",
    short: "Our mission to build a trusted global marketplace.",
    content: "Stoqle was built on the foundation of trust and transparency. Our goal is to empower small businesses and individuals to trade safely across borders. These guidelines ensure that every interaction on Stoqle remains professional, secure, and beneficial for all parties involved."
  },
  {
    id: "respect",
    icon: <Heart className="w-6 h-6 text-pink-500" />,
    title: "Respect Everyone",
    short: "Foster a kind and inclusive environment.",
    content: "We have zero tolerance for harassment, hate speech, or discrimination of any kind. This includes comments, private messages, and product descriptions. Treat fellow buyers and sellers as partners in our ecosystem."
  },
  {
    id: "honesty",
    icon: <UserCheck className="w-6 h-6 text-indigo-500" />,
    title: "Honest Selling & Buying",
    short: "Integrity is the bedrock of our marketplace.",
    content: "Sellers must provide accurate descriptions, high-quality images, and honest pricing. Buyers must honor their commitments. Misrepresentation of products, including selling counterfeits as genuine, is strictly prohibited."
  },
  {
    id: "prohibited",
    icon: <AlertTriangle className="w-6 h-6 text-rose-500" />,
    title: "Prohibited Items",
    short: "What you cannot sell on Stoqle.",
    content: "To maintain safety, we prohibit the sale of illegal drugs, weapons, hazardous materials, and regulated items. We also restrict items that violate intellectual property rights. Please refer to our Full Prohibited List for details."
  },
  {
    id: "safety",
    icon: <Lock className="w-6 h-6 text-amber-500" />,
    title: "Safe Transactions",
    short: "Protections for your payments and data.",
    content: "All payments must be processed through Stoqle's secure checkout. Offline transactions bypass our safety protocols and are not protected. Never share your password or sensitive financial details outside of authorized fields."
  },
  {
    id: "fair-use",
    icon: <Shield className="w-6 h-6 text-green-500" />,
    title: "Fair Use",
    short: "Zero tolerance for spam or platform manipulation.",
    content: "Do not use automated tools to scrape data, create fake accounts, or manipulate search rankings. Spamming other users or creating misleading listings to capture traffic is grounds for account termination."
  },
  {
    id: "delivery",
    icon: <Package className="w-6 h-6 text-cyan-500" />,
    title: "Orders & Delivery",
    short: "Standards for fulfillment and shipping.",
    content: "Sellers must ship items within the specified timeframe. Use reliable carriers and provide tracking numbers whenever possible. Delays should be communicated to the buyer immediately to maintain high service levels."
  },
  {
    id: "returns",
    icon: <RefreshCcw className="w-6 h-6 text-orange-500" />,
    title: "Returns & Refunds",
    short: "Transparent policies for dispute resolution.",
    content: "While individual shops may have their own policies, Stoqle mandates basic return rights for items that are 'not as described'. Refunds must be processed promptly through the Stoqle Dashboard."
  },
  {
    id: "account",
    icon: <UserCheck className="w-6 h-6 text-purple-500" />,
    title: "Account Integrity",
    short: "Managing your business identity.",
    content: "Each business should maintain a single primary account. Multiple accounts used to circumvent bans or manipulate pricing are prohibited. Profile information must be kept up to date and accurate."
  },
  {
    id: "enforcement",
    icon: <Gavel className="w-6 h-6 text-slate-700 dark:text-slate-300" />,
    title: "Enforcement",
    short: "Consequences for violating guidelines.",
    content: "Violations can result in warnings, temporary suspensions, or permanent permanent bans. The severity of the action depends on the nature of the violation and previous history. We reserve the right to remove any content at our discretion."
  },
  {
    id: "reporting",
    icon: <Flag className="w-6 h-6 text-rose-500" />,
    title: "Reporting",
    short: "How to flag suspicious or harmful activity.",
    content: "Community policing is vital. Use the 'Report' button on any post, profile, or listing to alert our safety team. All reports are reviewed by humans within 24–48 hours."
  }
];

// --- Sub-components ---

const GuidelineCard = ({ item }: { item: typeof guidelines[0] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reaction, setReaction] = useState<"up" | "down" | null>(null);

  return (
    <motion.div
      id={item.id}
      layout
      className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden mb-6"
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="p-6 cursor-pointer flex items-start gap-4"
      >
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl shrink-0">
          {item.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{item.title}</h3>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronDown className="w-5 h-5 text-slate-400" />
            </motion.div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{item.short}</p>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-2 border-t border-slate-50 dark:border-slate-800">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm lg:text-base">
                {item.content}
              </p>

              <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Was this helpful?</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setReaction("up"); }}
                      className={`p-2 rounded-full transition-colors ${reaction === "up" ? "bg-green-100 text-green-600" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"}`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setReaction("down"); }}
                      className={`p-2 rounded-full transition-colors ${reaction === "down" ? "bg-rose-100 text-rose-500" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"}`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-500 transition-colors">
                    <Bookmark className="w-4 h-4" /> Save
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function CommunityGuidelinesPage() {
  const router = useRouter();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const [activeSection, setActiveSection] = useState("purpose");

  // Handle active section change on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = guidelines.map(g => document.getElementById(g.id));
      const scrollPosition = window.scrollY + 100;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(guidelines[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white font-sans">
      {/* Back Button (Fixed) */}
      <div className="fixed top-6 left-6 z-[200]">
        <button
          onClick={() => router.back()}
          className="p-2.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-full shadow-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group"
        >
          <ChevronLeft className="w-5 h-5 text-slate-800 dark:text-white transition-transform group-hover:-translate-x-0.5" />
        </button>
      </div>
      {/* Scroll Progress Indicator */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-rose-500 z-[101] origin-left"
        style={{ scaleX }}
      />

      {/* Hero Section */}
      <section className="relative pt-24 pb-12 lg:pt-32 lg:pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-rose-50/50 to-transparent dark:from-rose-950/20 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400 text-xs font-bold mb-6"
          >
            <Shield className="w-3.5 h-3.5" />
            Last updated: April 10, 2026
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl lg:text-6xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-500"
          >
            Stoqle Community Guidelines
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            Building a safe, trusted, and inclusive marketplace for businesses and individuals worldwide.
            Our guidelines help us grow together.
          </motion.p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 pb-24">
        {/* Sticky Side Nav (Desktop) */}
        <aside className="hidden lg:block lg:col-span-3">
          <div className="sticky top-24 p-2 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl">
            <nav className="space-y-1">
              {guidelines.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSection === item.id
                    ? "bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                    }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full transition-all ${activeSection === item.id ? "bg-rose-500 scale-100" : "bg-transparent scale-0"}`} />
                  {item.title}
                </a>
              ))}
            </nav>

            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 px-4 pb-2">
              <button className="w-full flex items-center justify-between text-xs font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                <span>Download PDF</span>
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="col-span-1 lg:col-span-9">
          {guidelines.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + (idx * 0.05) }}
            >
              <GuidelineCard item={item} />
            </motion.div>
          ))}

          {/* Trust Elements Section */}
          <section className="mt-12 p-8 lg:p-12 bg-rose-500 rounded-3xl text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
              <Shield className="w-64 h-64" />
            </div>
            <div className="relative z-10 max-w-xl">
              <h2 className="text-2xl font-bold mb-4">Agreement & Enforcement</h2>
              <p className="text-rose-50 leading-relaxed mb-8">
                By using Stoqle, you agree to follow these guidelines. Violating these rules affects the safety of our entire community and may result in the permanent termination of your account.
              </p>

              <div className="flex flex-wrap gap-4">
                <button className="px-8 py-3 bg-white text-rose-500 rounded-full font-bold shadow-xl hover:bg-rose-50 transition-colors flex items-center gap-2">
                  Agree & Continue <ArrowRight className="w-4 h-4" />
                </button>
                <button className="px-8 py-3 bg-rose-700/50 backdrop-blur-sm border border-rose-500/30 text-white rounded-full font-bold hover:bg-rose-700 transition-colors flex items-center gap-2">
                  Report a Violation
                </button>
              </div>
            </div>
          </section>

          {/* User Feedback / Interaction Section */}
          <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20 rounded-3xl">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl w-fit mb-4">
                <MessageSquare className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Share Feedback</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                Have suggestions on how to make our guidelines clearer? We'd love to hear from our community members.
              </p>
              <button className="text-indigo-600 dark:text-indigo-400 font-bold text-sm flex items-center gap-1.5 hover:underline">
                Open Feedback Modal <Share2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-8 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
              <div className="p-3 bg-slate-200 dark:bg-slate-800 rounded-2xl w-fit mb-4">
                <HelpCircle className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Need Help?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                Our support team is available 24/7 to help you understand these rules or assist with disputes.
              </p>
              <Link href="/help" className="text-slate-600 dark:text-slate-400 font-bold text-sm flex items-center gap-1.5 hover:underline">
                Visit Support Center <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-16 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start justify-between gap-12">
          <div className="max-w-xs">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4">Stoqle.</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              Your Vision, Our Innovation. Building the future of commerce through community and trust.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-12">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Navigate</h4>
              <ul className="space-y-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                <li><Link href="/" className="hover:text-rose-500 transition-colors">Home</Link></li>
                <li><Link href="/shop" className="hover:text-rose-500 transition-colors">Marketplace</Link></li>
                <li><Link href="/discover" className="hover:text-rose-500 transition-colors">Discover</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Legal</h4>
              <ul className="space-y-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                <li><Link href="/privacy" className="hover:text-rose-500 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-rose-500 transition-colors">Terms of Service</Link></li>
                <li><Link href="/help" className="hover:text-rose-500 transition-colors">Support</Link></li>
              </ul>
            </div>
            <div className="col-span-2 lg:col-span-1">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Contact</h4>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">support@stoqle.com</p>
              <div className="flex items-center gap-4 mt-6">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-100 dark:border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400 font-medium">© 2026 Stoqle Inc. All rights reserved.</p>
          <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">Global Verified Marketplace</p>
        </div>
      </footer>

      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
        ::selection {
          background: #ef4444;
          color: white;
        }
      `}</style>
    </div>
  );
}
