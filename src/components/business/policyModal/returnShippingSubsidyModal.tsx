"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { getNextZIndex } from "@/src/lib/utils/z-index";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ReturnShippingSubsidyModal({ open, onClose }: Props) {
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

  const content = `<b><center>🚚 Return Shipping Fee Coverage Service Description</center></b><br/><br/>

<b>1. Service Content</b><br/>
“Return Shipping Fee Coverage” is a return/exchange shipping subsidy service provided by the Stoqle platform for consumers (hereinafter also referred to as “you” or “user”). After purchasing products that support this service on the Stoqle e-commerce platform, if you initiate a return or exchange within the eligible return/exchange period, the platform will provide a shipping fee subsidy according to certain standards.<br/><br/>

<b>2. How is the return shipping fee subsidized?</b><br/><br/>

<b>Return Method 1: Schedule doorstep pickup, subsidy covers the first weight shipping fee (within 1 kg)</b><br/>
• Select doorstep pickup when applying for return/exchange<br/>
• The courier deducts the first weight shipping fee directly upon pickup<br/>
• If you choose doorstep pickup on the after-sales details page when initiating a return/exchange request, once the courier completes the pickup, the platform will subsidize the first weight shipping fee (i.e., the shipping fee within 1 kg, same below). You need to pay the return/exchange shipping fee online, and the system will instantly deduct the first weight shipping fee online. The subsidy will not be paid separately to you. You only need to pay the remaining shipping fee exceeding the first weight (if any), and you can receive the subsidy without waiting for the return/exchange to be completed.<br/><br/>

<b>Return Method 2: Self-send the product, subsidy based on first weight shipping fee standard (within 1 kg standard)</b><br/>
• Select self-send when applying for return/exchange<br/>
• The system automatically initiates the subsidy after the merchant confirms receipt<br/>
• If you choose to self-send, after the merchant confirms receipt, the platform will subsidize your return/exchange shipping fee based on the first weight shipping fee standard. The specific subsidy amount shall be subject to what is displayed on your corresponding “Order Details - Return Shipping Fee Coverage” page. You need to pay the return/exchange shipping fee in advance and upload the correct logistics tracking number on the after-sales details page. Within 72 hours after the merchant confirms receipt, the platform will provide the corresponding subsidy amount. You can check the credited amount in “Stoqle APP - Me - Wallet - Account Balance” or in the original payment channel account corresponding to your order.<br/><br/>

<b>Return Method 3: Drop off at service points, subsidy covers the first weight shipping fee (within 1 kg)</b><br/>
• Select courier locker or station drop-off when applying for return/exchange<br/>
• The courier deducts the first weight shipping fee directly upon pickup<br/>
• If you choose courier locker or station drop-off on the after-sales details page when initiating a return/exchange request, once the courier completes collection, the platform will subsidize the first weight shipping fee. You need to pay the return/exchange shipping fee online, and the system will instantly deduct the first weight shipping fee. The subsidy will not be paid separately to you. You only need to pay the remaining shipping fee exceeding the first weight (if any), and you can receive the subsidy without waiting for the return/exchange to be completed.<br/><br/>

<b>3. Applicable Regions</b><br/>
Click to view full coverage areas for doorstep pickup/service point drop-off<br/><br/>

<b>4. Applicable Users</b><br/>
Consumers who purchase products with the “Return Shipping Fee Coverage” service label.<br/><br/>

<b>5. Subsidy Frequency</b><br/>
Each order placed on the Stoqle platform is eligible for one shipping subsidy (i.e., if one order corresponds to multiple return shipments, only one subsidy will be provided). If multiple orders are combined into one return package, only one subsidy will be provided.<br/><br/>

<b>6. Effective Time and Service Period</b><br/>
The “Return Shipping Fee Coverage” service takes effect when the merchant ships the product you purchased. The service period is within 90 (inclusive) natural days from the date of shipment by the merchant. Returns or exchanges initiated after the service period will no longer be subsidized by the platform.<br/><br/>

<b>7. Subsidy Standards</b><br/>
• If you choose doorstep pickup/service point drop-off, the subsidy standard is the first weight shipping fee (within 1 kg). The first weight shipping fee may vary by region, and the specific subsidy amount is subject to what is displayed on the doorstep pickup/service point drop-off page.<br/><br/>
• Since the return shipping fee coverage service is a subsidy in nature and does not guarantee full coverage of your shipping fee, if the subsidy amount is lower than the actual shipping fee you need to pay, you will still need to pay the remaining shipping fee beyond the subsidy. If you and the merchant agree that the merchant will bear all return/exchange shipping costs, you may request the merchant to pay the difference.<br/><br/>
• If you choose self-send, the subsidy standard is based on the first weight shipping fee standard (within 1 kg standard). The first weight shipping fee standard may vary by region, and the specific subsidy amount is subject to what is displayed on your corresponding “Order Details - Return Shipping Fee Coverage” page.<br/><br/>

<b>8. Subsidy Process</b><br/>
If the product you purchased is eligible for the return shipping fee coverage service, after receiving the product and reaching an agreement with the merchant for return or exchange, you need to submit a corresponding request within the platform. After the merchant agrees, if you choose self-send, you need to fill in the corresponding logistics information in the system. After the merchant confirms receipt of the returned product and Stoqle determines that you meet all subsidy requirements, Stoqle will credit the subsidy amount to your Stoqle wallet or the original payment channel account corresponding to your order in one lump sum. If you choose doorstep pickup/service point drop-off, the subsidy will be instantly deducted online from your first weight shipping fee and will not be paid separately to you.<br/><br/>

<b>9. Other Notes</b><br/>
<b>9.1 Situations where you may not receive the subsidy:</b><br/>
① The merchant has not enabled the shipping insurance service.<br/>
② Only a refund occurred without an actual return/exchange shipment.<br/>
③ You did not fill in or incorrectly filled in the logistics company, tracking number, or did not use a qualified logistics service provider for return/exchange shipment.<br/>
④ Multiple orders are combined for return/exchange with only one tracking number; only one order will receive the subsidy, and other related orders will not be subsidized. If multiple return/exchange actions occur for products in the same order and multiple service requests are submitted, only one subsidy will be granted based on the logistics information you uploaded or automatically returned by the system, and other products will not be subsidized.<br/>
⑤ The return/exchange does not comply with platform policies, or you and the merchant did not reach an agreement on the return/exchange.<br/>
⑥ The merchant refuses to accept the goods, resulting in the goods being returned to the original sender.<br/>
⑦ The return/exchange occurs after the service period of the order’s return shipping fee coverage.<br/>
⑧ Other situations that do not meet the return shipping fee coverage subsidy rules.<br/><br/>

<b>9.2 Refusal of subsidy and legal pursuit:</b><br/>
① No actual return/exchange shipment occurred, and false logistics information was provided.<br/>
② You colluded with the merchant to fabricate return/exchange scenarios.<br/>
③ Malicious return/exchange operations to obtain platform subsidies.<br/>
④ Other malicious situations identified by the platform.<br/><br/>

<b>10. FAQs</b><br/>
<b>10.1 Difference between pickup/drop-off vs self-send:</b><br/>
① Pickup/drop-off: Subsidy is instantly deducted online. You only pay excess shipping. No waiting required.<br/>
② Self-send: You pay in advance, upload tracking, and receive subsidy after merchant confirms receipt.<br/><br/>

<b>10.2 Convenience of pickup/drop-off:</b><br/>
Instant subsidy deduction (1 kg) after pickup. No waiting for return completion.
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
              <h2 className="text-sm font-bold text-slate-900 mb-3 text-center">Return Shipping Subsidy</h2>

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
