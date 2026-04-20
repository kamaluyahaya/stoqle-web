"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, HelpCircle, Shield, Zap, UserPlus, Lock, ChevronDown, Clock, CheckCircle2, ShieldCheck, PlusSquare, Users, ShoppingBag, Truck, Store, RotateCcw } from "lucide-react";

interface LoginFAQModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCloseAll?: () => void;
}

const LoginFAQModal: React.FC<LoginFAQModalProps> = ({ isOpen, onClose, onCloseAll }) => {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(0);

  const faqs = [
    // --- Login & Account ---
    {
      title: "How do I log in or register?",
      icon: <Zap className="w-5 h-5 text-rose-500" />,
      content: "Simply enter your phone number or email address. We will send you an OTP (One-Time Password) via WhatsApp or Email. Enter that code to access your account instantly. New users are automatically registered."
    },
    {
      title: "Why don't you use passwords?",
      icon: <Lock className="w-5 h-5 text-emerald-500" />,
      content: "OTPs are more secure than traditional passwords. You don't have to worry about forgetting a password or account breaches. Your access is tied directly to your verified devices."
    },
    // --- Social & Posting ---
    {
      title: "How do I create a social post?",
      icon: <PlusSquare className="w-5 h-5 text-blue-500" />,
      content: "Tap the '+' icon on the navigation bar. You can post 'Notes' (text-based) or 'Albums' (images/videos). Share your thoughts, reviews, or your latest lifestyle finds with the Stoqle community."
    },
    {
      title: "Can I link products to my posts?",
      icon: <Users className="w-5 h-5 text-purple-500" />,
      content: "Yes! When creating a post, you can search for and tag specific products. This helps your followers shop the items you recommend directly from your post."
    },
    // --- Ordering & Payments ---
    {
      title: "How do I place an order?",
      icon: <ShoppingBag className="w-5 h-5 text-rose-500" />,
      content: "Find a product you love, select your options (size, color, etc.), and tap 'Buy Now' or 'Add to Cart'. You can pay using your Stoqle Wallet or other available payment methods during checkout."
    },
    {
      title: "How can I track my order?",
      icon: <Truck className="w-5 h-5 text-amber-500" />,
      content: "Go to your Profile -> Orders. You'll see a real-time status of your purchase, including 'Awaiting Shipment', 'Shipped', and 'Delivered'."
    },
    // --- Vendor & Products ---
    {
      title: "How do I become a vendor?",
      icon: <Store className="w-5 h-5 text-indigo-500" />,
      content: "Go to your Profile and tap 'Business Settings' or 'Become a Vendor'. Follow the onboarding walkthrough to set up your shop name, logo, and identity verification."
    },
    {
      title: "How do I add new products to my shop?",
      icon: <PlusSquare className="w-5 h-5 text-emerald-500" />,
      content: "As a vendor, go to your 'Inventory' and tap 'Add Product'. Upload clear photos, set your price, quantity, and description. Once saved, it will be visible on the Market and your Shop page."
    },
    // --- Returns & Refunds ---
    {
      title: "What is the 7-Day Return Policy?",
      icon: <RotateCcw className="w-5 h-5 text-rose-500" />,
      content: "The '7-Day No Reason Return' is an optional policy offered by the seller when they wish to provide this guarantee for their product or business. Look for the '7-Day Return' label on the product page to see if your purchase is eligible."
    },
    {
      title: "How do I request a refund?",
      icon: <Zap className="w-5 h-5 text-amber-500" />,
      content: "Go to the specific order in your 'Orders' list and select 'Request Refund'. Provide the reason and any supporting photos. The vendor will review it, and Stoqle mediates to ensure a fair outcome."
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000004] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onMouseDown={(e) => e.stopPropagation()}
            className="relative bg-white w-full sm:max-w-md rounded-t-[0.5rem] sm:rounded-[0.5rem] overflow-hidden flex flex-col max-h-[85vh] z-10"
          >
            {/* Mobile Pull Handle */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-2 sm:hidden" />

            {/* Header */}
            <div className="p-2 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 tracking-tight ml-4">Frequently Asked Questions</h2>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-900 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content (Accordion Style) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="bg-white rounded-[0.5rem] border border-slate-100 overflow-hidden transition-all"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedIndex(expandedIndex === index ? null : index);
                    }}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {faq.icon}
                      <h3 className="text-[13px] font-bold text-slate-700">{faq.title}</h3>
                    </div>
                    <motion.div
                      animate={{ rotate: expandedIndex === index ? 180 : 0 }}
                      className="text-slate-300"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {expandedIndex === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                      >
                        <div className="px-12 pb-4 pt-1">
                          <p className="text-xs font-medium text-slate-500 leading-relaxed">
                            {faq.content}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}

              <div className="mt-6 p-4 bg-white rounded-2xl border border-slate-100">
                <p className="text-center text-[10px] text-slate-400 font-medium italic">
                  Still need help? Please reach out to <span className="text-rose-500 font-bold">support@stoqle.com</span> on the platform.
                </p>
              </div>

              <div className="p-6 bg-white border-t border-slate-50">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="w-full py-3 bg-rose-500 text-white font-bold text-sm  rounded-full shadow-rose-100 active:scale-[0.98] transition-all"
                >
                  Got it, thanks!
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

  );
};

export default LoginFAQModal;
