"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Info } from "lucide-react";

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

  const content = `<b><center>🚚 Return Shipping Fee Protection Service Description</center></b><br/><br/>

<b>Service Content</b><br/>
“Return Shipping Fee Protection” is a service provided by the Stoqle platform to consumers (hereinafter referred to as “you” or “user”), offering shipping subsidies for returns and exchanges. After purchasing products that support this service on the Stoqle e-commerce platform, if you initiate a return or exchange within the required return/exchange period, the platform will provide a shipping subsidy according to certain standards.<br/><br/>

<b>How is the return shipping subsidized?</b><br/><br/>

<b>Method 1: Door-to-door pickup — subsidy for the first weight tier (within 1 kg)</b><br/><br/>
• When applying for return/exchange, select door-to-door pickup<br/>
• When the courier picks up the item, the first weight shipping fee is directly deducted<br/>
• If you choose door-to-door pickup in the after-sales page, once the courier completes pickup, the platform will subsidize the first weight shipping fee (i.e., within 1 kg)<br/>
• You need to pay the return shipping fee online, and the system will immediately deduct the first weight subsidy<br/>
• The subsidy will not be paid to you separately<br/>
• You only pay the excess shipping fee beyond the first weight (if any)<br/>
• You do not need to wait for the return process to be completed to receive the subsidy<br/><br/>

<b>Method 2: Self-return — subsidy based on first weight shipping standard (within 1 kg)</b><br/><br/>
• When applying for return/exchange, select self-return<br/>
• After the merchant confirms receipt, the system will automatically issue the subsidy<br/>
• If you choose self-return, the platform will provide a subsidy based on the first weight shipping standard after the merchant confirms receipt<br/>
• The specific subsidy amount is shown in your “Order Details - Return Shipping Fee Protection” page<br/>
• You must first pay the return shipping fee and upload the correct tracking number in the after-sales page<br/>
• After the merchant confirms receipt, and 72 hours later, the platform will issue the subsidy to your Stoqle wallet or original payment account<br/>
• You can check the refund in: Stoqle App → Me → Wallet → Balance<br/><br/>

<b>Method 3: Service point drop-off — subsidy for first weight (within 1 kg)</b><br/><br/>
• When applying for return/exchange, select lockers or service points for shipping<br/>
• When the courier completes pickup, the first weight shipping fee is directly deducted<br/>
• You must pay the return shipping fee online<br/>
• The system will immediately deduct the first weight subsidy<br/>
• The subsidy will not be paid separately<br/>
• You only pay the excess shipping fee beyond the first weight (if any)<br/>
• You do not need to wait for the return process to be completed to receive the subsidy<br/><br/>

<b>Applicable Regions</b><br/>
Click to view full coverage areas for door-to-door pickup/service point shipping<br/><br/>

<b>Eligible Users</b><br/>
Consumers who purchase products marked with the “Return Shipping Fee Protection” service label<br/><br/>

<b>Subsidy Frequency</b><br/>
• One order can receive one shipping subsidy<br/>
• If multiple return shipments are generated from one order, only one subsidy is provided<br/>
• If multiple orders are returned in one package, only one subsidy is provided<br/><br/>

<b>Effective Time & Service Period</b><br/>
• The service takes effect when the seller ships the product<br/>
• The service period is 90 calendar days from the shipping date (inclusive)<br/>
• After this period, returns/exchanges will not be subsidized<br/><br/>

<b>Subsidy Standards</b><br/>
• For door-to-door pickup/service point shipping, the subsidy is based on first weight (within 1 kg)<br/>
• The first weight shipping fee varies by region<br/>
• The exact subsidy amount depends on what is displayed on the shipping page<br/>
• The service is a subsidy, not full reimbursement<br/>
• If the subsidy is less than the actual shipping cost, you pay the remaining amount<br/>
• If agreed with the seller, the seller may cover the difference<br/><br/>
• For self-return, the subsidy follows the first weight standard (within 1 kg), and varies by region<br/><br/>

<b>Subsidy Process</b><br/>
• After receiving the product, if you and the seller agree to return or exchange, you must submit a request on the platform<br/>
• After seller approval:<br/>
- For self-return → you must upload logistics tracking info<br/>
- Once the seller confirms receipt and requirements are met, Stoqle will transfer the subsidy to your wallet or original payment method<br/>
- For door-to-door/service point → subsidy is directly deducted instantly from shipping fee<br/><br/>

<b>Other Notes</b><br/><br/>

<b>8.1 Situations where you may not receive subsidy:</b><br/>
1. Seller has not enabled the service<br/>
2. Only refund occurred, no actual return shipment<br/>
3. Missing or incorrect shipping details or not using a valid logistics provider<br/>
4. Multiple orders combined into one shipment → only one subsidy<br/>
5. Return not compliant with platform policy or not agreed with seller<br/>
6. Seller refused delivery<br/>
7. Return outside the service period<br/>
8. Other non-compliant cases<br/><br/>

<b>8.2 Platform may reject subsidy or request repayment if:</b><br/>
1. Fake shipping information is provided<br/>
2. Seller and user collude to fake returns<br/>
3. Malicious return behavior to exploit subsidies<br/>
4. Other malicious activities determined by platform<br/><br/>

<b>8.3 The applicable service for your order depends on what is shown in your “Order Details - Return Shipping Fee Protection” page</b><br/><br/>

<b>FAQs</b><br/><br/>

<b>9.1 Difference between door-to-door/service point vs self-return:</b><br/><br/>
① <b>Door-to-door / service point</b><br/>
• Subsidy is applied immediately when pickup is completed<br/>
• First weight is deducted instantly<br/>
• You pay only excess shipping<br/>
• No need to wait for return completion<br/><br/>

② <b>Self-return</b><br/>
• You must input tracking info<br/>
• Subsidy is given after merchant confirms receipt<br/>
• Subsidy may differ from actual shipping cost<br/><br/>

<b>9.2 What convenience does pickup/service point provide?</b><br/><br/>
• Instant subsidy deduction after pickup<br/>
• You only pay extra shipping cost<br/>
• No waiting required for subsidy<br/><br/>

<b>9.3 What is the subsidy standard?</b><br/><br/>
• Varies by region<br/>
• Based on first weight (1 kg)<br/>
• Exact amount shown on product page<br/><br/>

<b>9.4 Why didn’t I receive instant subsidy?</b><br/><br/>
Possible reasons:<br/><br/>
1. Seller has not enabled the service<br/>
2. You didn’t select pickup/service point or not supported in your area<br/>
3. Other conditions listed in 8.1<br/><br/>
If none apply, contact support with:<br/>
• Order number<br/>
• Shipping proof<br/>
• Contact number`;
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4">
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
            className="relative bg-white w-full sm:max-w-sm h-[80vh] sm:h-auto sm:max-h-[85vh] rounded-t-[0.5rem] sm:rounded-[0.5rem] p-6 border-t sm:border border-slate-100  flex flex-col justify-between"
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
