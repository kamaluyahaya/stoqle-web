"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function RapidRefundModal({ open, onClose }: Props) {
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

  const content = `<b><center>Rapid Refund</center></b><br/><br/>

<b>What Rapid Refund Means</b><br/>
Rapid Refund is a fast refund service that helps you get your money back quickly when your return or refund request meets the required conditions on Stoqle.<br/><br/>

<b>How It Works for You</b><br/>
• When you request a return or refund<br/>
• If your order meets the required return conditions<br/>
• The system processes your refund automatically as a Rapid Refund<br/>
• Your refund is sent instantly to your Stoqle wallet or original payment method<br/>
• You do not need to wait for a long manual review when all conditions are met<br/><br/>

<b>When You Can Get Rapid Refund</b><br/>
Rapid Refund is available when:<br/>
• Your return request is approved<br/>
• The product meets the return policy conditions<br/>
• There is no dispute or violation<br/>
• All required return steps are completed correctly<br/>
• Your order is still within the eligible service period<br/><br/>

<b>What You Should Know</b><br/>
• Rapid Refund is a fast refund option, not an automatic refund for every order<br/>
• If the conditions are not met, your refund may be delayed or reviewed manually<br/>
• Some products or orders may have special refund conditions based on the seller’s policy<br/><br/>

<b>Summary</b><br/>
• Fast refund when conditions are met<br/>
• Automatic processing for eligible orders<br/>
• Refund goes to your Stoqle wallet or original payment method<br/>
• Some orders may require extra review before refund is completed`;
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center p-0 sm:p-4">
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
            className="relative bg-white w-full sm:max-w-sm h-[80vh] sm:h-auto sm:max-h-[85vh] rounded-t-[0.5rem] sm:rounded-[0.5rem] p-6 border-t sm:border border-slate-100 shadow-2xl flex flex-col justify-between"
          >
            <div className="flex-1 flex flex-col min-h-0 pt-2">
              <h2 className="text-md font-bold text-slate-900 mb-3 text-center">Rapid Refund Service</h2>

              <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar">
                <div
                  className="text-[13px] text-slate-600 leading-relaxed"
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
