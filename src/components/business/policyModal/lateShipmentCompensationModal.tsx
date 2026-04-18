"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock } from "lucide-react";
import { getNextZIndex } from "@/src/lib/utils/z-index";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function LateShipmentCompensationModal({ open, onClose }: Props) {
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

  const content = `<b><center>⏰ Late Shipment Compensation Service Description</center></b><br/><br/>

<b>1. Service Definition</b><br/>
“Late Shipment Compensation” is a commitment by the merchant to ship the product within the promised handling time. If the merchant fails to fulfill the order within this period, the platform will facilitate a compensation to the buyer to maintain trust and satisfaction.<br/><br/>

<b>2. Compensation Eligibility</b><br/>
A shipment is considered late if the logistics tracking status does not show "Picked Up", "In Transit", or the first logistics scan within the handling time specified on the product detail page (e.g., 24 hours, 48 hours, or 72 hours).<br/><br/>

<b>3. Compensation Standards</b><br/>
• The compensation amount is typically set at ₦500 or 5% of the product price (whichever is higher), up to a maximum of ₦2,000 per order.<br/>
• The compensation is issued in the form of Stoqle Balance or a platform coupon, credited directly to the buyer's account upon verification of the delay.<br/><br/>

<b>4. How to Claim</b><br/>
• The system automatically detects most late shipments and triggers the compensation process once the handling period is exceeded.<br/>
• Buyers can also manually "Apply for Compensation" via the Order Details page if the handling time has been exceeded and the order status hasn't updated.<br/><br/>

<b>5. Merchant Responsibility</b><br/>
• Merchants who enable this service are expected to process orders daily and ensure logistics partners scan the items promptly.<br/>
• Repeated late shipments may affect the merchant's store rating, search visibility, and eligibility for platform-wide campaigns.<br/><br/>

<b>6. Exclusions</b><br/>
The compensation does not apply in the following cases:<br/>
• Force majeure events (natural disasters, extreme weather, strikes, etc.) affecting regional logistics.<br/>
• Delays caused by the buyer (e.g., providing an incorrect address, contact number, or requesting a later delivery date).<br/>
• Pre-sale products where the shipping window is clearly defined as longer in the product description.<br/><br/>

<b>7. Terms of Use</b><br/>
• Compensation can only be claimed once per order.<br/>
• If an order is canceled by the buyer before the handling time expires, no compensation is due.<br/>
• Stoqle reserves the right of final interpretation of these rules to prevent system abuse.<br/>
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
            className="relative bg-white w-full sm:max-w-sm h-[80vh] sm:h-auto sm:max-h-[85vh] rounded-t-[0.5rem] sm:rounded-[0.5rem] p-6 sm:border border-slate-100 shadow-2xl flex flex-col justify-between"
          >
            <div className="flex-1 flex flex-col min-h-0 pt-2">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 bg-violet-50 rounded-full flex items-center justify-center text-violet-600">
                  <Clock className="w-6 h-6" />
                </div>
              </div>
              <h2 className="text-sm font-bold text-slate-900 mb-3 text-center">Late Shipment Compensation</h2>

              <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar">
                <div
                  className="text-[13px] text-slate-600 leading-relaxed pb-6"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              </div>
            </div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
