"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Home, ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-800">
      {/* Animated 404 Illustration Background */}
      <div className="relative mb-12">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-[120px] md:text-[180px] font-black text-slate-200 select-none leading-none"
        >
          404
        </motion.div>

        {/* Floating elements */}
        <motion.div
          animate={{
            y: [0, -20, 0],
            rotate: [0, 5, 0]
          }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="w-24 h-24 md:w-32 md:h-32 bg-rose-500 rounded-3xl shadow-2xl shadow-rose-200 flex items-center justify-center rotate-12">
            <Search className="w-12 h-12 md:w-16 md:h-16 text-white" />
          </div>
        </motion.div>
      </div>

      {/* Text Content */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="max-w-md"
      >
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight">
          Page not found
        </h1>
        <p className="text-slate-500 text-lg mb-10 leading-relaxed font-medium">
          Oops! The page you're looking for has moved or no longer exists. Let's get you back on track.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-full font-bold hover:bg-slate-50 transition-all active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>
      </motion.div>

      {/* Brand Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-20 flex flex-col items-center gap-4"
      >
        <div className="px-4 py-1.5 bg-rose-500 rounded-full text-white text-xs font-bold">
          stoqle
        </div>
        <p className="text-slate-400 text-xs font-medium">
          Trusted Social Commerce Platform
        </p>
      </motion.div>
    </div>
  );
}
