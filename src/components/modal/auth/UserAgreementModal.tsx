"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { getNextZIndex } from "@/src/lib/utils/z-index";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function UserAgreementModal({ open, onClose }: Props) {
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
    <b><center>📜 Stoqle User Service Agreement</center></b><br/><br/>
    
    Welcome to Stoqle! This User Service Agreement (“Agreement”) governs your access to and use of the Stoqle platform. By creating an account or using our services, you agree to be bound by these terms.<br/><br/>

    <b>1. Account Eligibility & Registration</b><br/>
    • <b>Real Name Requirement:</b> To maintain a trusted community, users are required to provide their authentic full names during profile setup. Emojis can be used to personalize your display name.<br/>
    • <b>Account Security:</b> You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.<br/><br/>

    <b>2. Business Accounts (Merchants)</b><br/>
    By upgrading to a Business Account, you agree to additional commercial terms:<br/>
    • <b>Authenticity:</b> Merchants must only list genuine products. Selling replicas or counterfeit items is a severe violation.<br/>
    • <b>Inventory Accuracy:</b> Merchants must maintain accurate stock levels and fulfill orders within the platform's specified timelines.<br/>
    • <b>Business Verification:</b> Businesses may be required to provide valid documentation (ID, business registration) to activate payment withdrawals.<br/><br/>

    <b>3. Trusted Partner Program</b><br/>
    The "Trusted Partner" badge is awarded to high-performing merchants who consistently maintain:<br/>
    • A trust score of 95% or higher.<br/>
    • Exceptional delivery speed (under 48 hours ship-time).<br/>
    • Low dispute rates and high customer satisfaction.<br/>
    <i>Violation of these standards will result in immediate removal of the Trusted Partner status.</i><br/><br/>

    <b>4. ⚖️ Violation & Consequence Table</b><br/>
    Stoqle enforces a strict safety policy. Below is a detailed summary of prohibited actions and their platform-wide penalties:<br/><br/>

    <table style="width:100%; border-collapse: collapse; font-size:11px; border: 1px solid #e5e7eb;">
      <thead>
        <tr style="background-color: #f9fafb;">
          <th style="border:1px solid #e5e7eb; padding:8px; text-align:left; width: 25%;"><b>Category</b></th>
          <th style="border:1px solid #e5e7eb; padding:8px; text-align:left; width: 45%;"><b>Prohibited Action</b></th>
          <th style="border:1px solid #e5e7eb; padding:8px; text-align:left; width: 30%;"><b>Penalty</b></th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="border:1px solid #e5e7eb; padding:8px;"><b>Authenticity</b></td>
          <td style="border:1px solid #e5e7eb; padding:8px;">Listing or selling counterfeit, replicas, clones, or unauthorized branded goods.</td>
          <td style="border:1px solid #e5e7eb; padding:8px; color: #e11d48;"><b>Permanent BAN</b> + Forfeiture of all pending withdrawals.</td>
        </tr>
        <tr>
          <td style="border:1px solid #e5e7eb; padding:8px;"><b>Social Conduct</b></td>
          <td style="border:1px solid #e5e7eb; padding:8px;">Harassment in DMs, hate speech, or spamming unrelated solicitations to public feeds.</td>
          <td style="border:1px solid #e5e7eb; padding:8px;"><b>7-Day Shadow Ban</b> (3rd strike results in Permanent Ban).</td>
        </tr>
        <tr>
          <td style="border:1px solid #e5e7eb; padding:8px;"><b>Transaction Safety</b></td>
          <td style="border:1px solid #e5e7eb; padding:8px;">Directing users to pay outside Stoqle, deceptive pricing, or using fake reviews/orders.</td>
          <td style="border:1px solid #e5e7eb; padding:8px; color: #e11d48;"><b>Account Termination</b> and blacklisting of associated identity.</td>
        </tr>
        <tr>
          <td style="border:1px solid #e5e7eb; padding:8px;"><b>Trust Standards</b></td>
          <td style="border:1px solid #e5e7eb; padding:8px;">High dispute rates, deliberate shipment delays, or providing invalid tracking info.</td>
          <td style="border:1px solid #e5e7eb; padding:8px;"><b>Badge Revocation</b> and required 30-day platform probation.</td>
        </tr>
      </tbody>
    </table><br/>

    <b>5. 🛡️ Core Platform Policies</b><br/>
    Stoqle provides the following protection services to ensure a premium shopping experience:<br/><br/>

    <table style="width:100%; border-collapse: collapse; font-size:11px; border: 1px solid #e5e7eb;">
      <thead>
        <tr style="background-color: #f9fafb;">
          <th style="border:1px solid #e5e7eb; padding:8px; text-align:left; width: 25%;"><b>Service</b></th>
          <th style="border:1px solid #e5e7eb; padding:8px; text-align:left;"><b>Detailed Explanation</b></th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="border:1px solid #e5e7eb; padding:8px;"><b>7-Day Return</b></td>
          <td style="border:1px solid #e5e7eb; padding:8px;">You may return any item for subjective reasons (e.g., "dislike") within 168 hours of signing, provided the tags are intact and there are no signs of wear/usage.</td>
        </tr>
        <tr>
          <td style="border:1px solid #e5e7eb; padding:8px;"><b>Shipping Subsidy</b></td>
          <td style="border:1px solid #e5e7eb; padding:8px;">For items with the "subsidy" label, the platform covers return shipping costs (up to a standard capped rate), credited directly to your Stoqle Wallet.</td>
        </tr>
        <tr>
          <td style="border:1px solid #e5e7eb; padding:8px;"><b>Rapid Refund</b></td>
          <td style="border:1px solid #e5e7eb; padding:8px;">Skip the wait! For users with high trust scores, the refund is released as soon as the logistics company scans the returned package into their system.</td>
        </tr>
        <tr>
          <td style="border:1px solid #e5e7eb; padding:8px;"><b>Fake One Pay Four</b></td>
          <td style="border:1px solid #e5e7eb; padding:8px;">If an app-certified product is proven fake through professional appraisal, the merchant is mandated to compensate you 4 times the transaction value.</td>
        </tr>
        <tr>
          <td style="border:1px solid #e5e7eb; padding:8px;"><b>Late Shipment</b></td>
          <td style="border:1px solid #e5e7eb; padding:8px;">If a merchant fails to hand over the package to logistics within the promised timeline (usually 48h), a compensation coupon is automatically issued to the buyer.</td>
        </tr>
      </tbody>
    </table><br/>

    <b>6. 💰 Wallet & Payment Policy</b><br/>
    Stoqle utilizes an integrated wallet system to ensure fast and secure transactions for all members:<br/>
    • <b>Vendor Earnings:</b> All sales proceeds are credited to your <b>Stoqle Wallet</b>. You have the freedom to withdraw your earnings to your linked bank account at any time you wish.<br/>
    • <b>Buyer Refunds:</b> In cases of successful returns or order cancellations, funds are credited back to your <b>Stoqle Wallet</b>, ensuring you can immediately reuse the balance for new discoveries or withdraw it.<br/>
    • <b>Security & Verification:</b> For your protection, high-value withdrawals may require a secondary identity verification (OTP) as per our security protocol.<br/><br/>

    <b>7. Limitation of Liability</b><br/>
    To the maximum extent permitted by law, Stoqle shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform.<br/><br/>

    <b>8. Governing Law</b><br/>
    This Agreement shall be governed by the laws of the jurisdiction in which Stoqle operates.<br/><br/>

    <i>Thank you for being part of the Stoqle journey. Together, we build a seamless, high-trust experience for everyone.</i>
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
            className="relative bg-white w-full sm:max-w-md h-[80vh] sm:h-auto sm:max-h-[85vh] rounded-t-[0.5rem] sm:rounded-[0.2rem] p-4 border-t sm:border border-slate-100 shadow-2xl flex flex-col"
          >
            {/* Background Branding (Fixed) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 flex items-center justify-center">
              <span className="text-[130px] font-black  text-rose-400 opacity-[0.09] rotate-[-50deg] tracking-tighter">
                stoqle
              </span>
            </div>
            {/* Handle for mobile */}

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-black text-slate-800 tracking-tight">User Agreement</h2>
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
                    className="w-full py-4 bg-rose-500 text-white font-black text-sm rounded-full shadow-lg shadow-rose-100 active:scale-[0.98] transition-all"
                  >
                    I Understand
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
