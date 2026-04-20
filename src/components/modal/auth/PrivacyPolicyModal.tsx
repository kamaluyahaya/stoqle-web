"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { getNextZIndex } from "@/src/lib/utils/z-index";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function PrivacyPolicyModal({ open, onClose }: Props) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  const [modalZIndex, setModalZIndex] = React.useState(() => getNextZIndex());
  React.useEffect(() => {
    if (open) {
      setModalZIndex(getNextZIndex());
    }
  }, [open]);

  const content = `
    <b><center>🛡️ Stoqle Privacy Policy</center></b><br/><br/>
    
    At Stoqle, we take your privacy seriously. This Privacy Policy outlines how we collect, use, and protect your information when you use our platform.<br/><br/>

    <b>1. Information We Collect</b><br/>
    • <b>Personal Information:</b> We collect your full name, phone number, and email address to create and verify your account.<br/>
    • <b>Location Data:</b> We may collect your city and state to provide localized experiences and calculate delivery estimates.<br/>
    • <b>Usage Data:</b> We collect data on how you interact with reeels, products, and other users to personalize your feed.<br/>
    • <b>Device Information:</b> We collect browser type, IP address, and OS to ensure platform security and stability.<br/><br/>

    <b>2. How We Use Informstion</b><br/>
    • To facilitate account creation and authentication via WhatsApp or Email.<br/>
    • To process marketplace transactions and facilitate communication between buyers and sellers.<br/>
    • To improve our algorithms and provide you with personalized content recommendations.<br/>
    • To send you critical account updates and optional marketing communications.<br/><br/>

    <b>3. Data Sharing</b><br/>
    We do not sell your personal data to third parties. We only share information with:<br/>
    • <b>Service Providers:</b> Payment processors, delivery services, and cloud hosting providers necessary for platform operation.<br/>
    • <b>Sellers/Vendors:</b> Necessary contact and delivery info is shared only when you place an order.<br/>
    • <b>Legal Compliance:</b> We may disclose data if required by law or to protect the safety of our users.<br/><br/>

    <b>4. Data Security</b><br/>
    We implement industry-standard security measures, including encryption and secure socket layers (SSL), to protect your data from unauthorized access.<br/><br/>

    <b>5. Your Rights</b><br/>
    You have the right to access, correct, or request the deletion of your personal data. You can manage your profile settings or contact our support team for assistance.<br/><br/>

    <b>6. Cookies & Tracking</b><br/>
    We use cookies to maintain your login session and analyze platform performance. You can manage cookie preferences through your browser settings.<br/><br/>

    <b>7. Policy Updates</b><br/>
    We may update this policy occasionally. We will notify you of any significant changes through the platform or via email.<br/><br/>

    <i>By using Stoqle, you agree to the practices described in this Privacy Policy. We are committed to building a transparent and secure marketplace for all.</i>
  `;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ zIndex: modalZIndex }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-white w-full sm:max-w-md h-[80vh] sm:h-auto sm:max-h-[85vh] rounded-t-[0.5rem] sm:rounded-[0.2rem] p-8 border-t sm:border border-slate-100 shadow-2xl flex flex-col"
          >
            {/* Background Branding (Fixed) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 flex items-center justify-center">
              <span className="text-[120px] font-black  text-rose-400 opacity-[0.09] rotate-[-50deg] tracking-tighter">
                stoqle
              </span>
            </div>
            {/* Handle for mobile */}

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-black text-slate-800 tracking-tight">Privacy Policy</h2>
                <button
                  onClick={onClose}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-3 scrollbar-hide">

                <div
                  className="relative z-10 text-[14px] text-slate-600 font-medium leading-[1.8] pb-10"
                  dangerouslySetInnerHTML={{ __html: content }}
                />

                <div className="pb-10">
                  <button
                    onClick={onClose}
                    className="w-full py-4 bg-rose-500 text-white font-black text-sm  tracking-widest rounded-full shadow-lg shadow-rose-100 active:scale-[0.98] transition-all"
                  >
                    Agree & Continue
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
