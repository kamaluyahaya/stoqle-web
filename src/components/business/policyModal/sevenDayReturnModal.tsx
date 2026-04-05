"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SevenDayReturnModal({ open, onClose }: Props) {
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

  const content = `
<br/><br/>
<b><center>📄 7-Day No-Reason Return Policy</center></b><br/><br/>

<b>1. Coverage</b><br/>

Products marked with <b>“7-Day No-Reason Return”</b> are eligible for return.<br/><br/>

Buyers may request a return:<br/><br/>

Within 7 days after delivery<br/>
Without providing a specific reason (e.g. no longer needed, wrong size, not satisfied)<br/><br/>

<b>2. Return Period</b><br/><br/>

The return window is:<br/><br/>

7 days (168 hours) starting from the time the order is marked as delivered.<br/><br/>

<b>3. Return Shipping Fees</b><br/><br/>

Shipping responsibility depends on the situation:<br/><br/>

Free Shipping Orders<br/>
→ Buyer pays only the return shipping fee<br/><br/>

Non-Free Shipping Orders<br/>
→ Buyer pays all shipping costs<br/><br/>

Conditional Free Shipping (e.g. minimum order value)<br/>
→ If return breaks the condition, buyer pays all shipping<br/><br/>

Seller Fault (e.g. defective or wrong item)<br/>
→ Seller pays all return shipping costs<br/><br/>

Special Seller Promises or Agreements<br/>
→ Follow the seller’s stated policy<br/><br/>

<b>4. How to Request a Return</b><br/><br/>

Buyers can initiate a return by:<br/><br/>

My Orders → Select Order → Request Return/Refund → Choose reason (e.g. “No longer needed”)<br/><br/>

<b>5. Return Conditions (Important)</b><br/><br/>

To qualify for a return, items must be:<br/><br/>

In original condition<br/>
Unused or minimally tested<br/>
With all original packaging, tags, and accessories included<br/><br/>

<b>6. General Condition Requirements</b><br/><br/>

Returned items must:<br/><br/>

Be free from damage, stains, or heavy use<br/>
Not be activated (for digital/electronic products)<br/>
Not contain personal data or usage records<br/>
Include all accessories (manuals, tags, warranty cards, etc.)<br/><br/>

<b>7. Packaging Requirements</b><br/><br/>

Original packaging must be intact<br/>
Minor changes (e.g. slight deformation from shipping) are acceptable<br/><br/>

If packaging has special value (sealed, collectible, anti-counterfeit):<br/><br/>

Buyer must handle it carefully<br/>
Damage may reduce refund value


<br/><br/>
<b>8. 📋 Return Conditions by Product Category</b><br/><br/>

<table style="width:100%; border-collapse: collapse; font-size:13px;">
  <thead>
    <tr>
      <th style="border:1px solid #e5e7eb; padding:8px; text-align:left;"><b>Product Category</b></th>
      <th style="border:1px solid #e5e7eb; padding:8px; text-align:left;"><b>Return Condition (Must Meet All)</b></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Food, Cosmetics, Medical, Consumables</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">Must remain <b>sealed and unopened</b></td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Electronics</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">No repairs, no modifications, no scratches, no activation or personal data</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Clothing, Shoes, Bags, Toys</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">Must be unused, unwashed, with tags/seals intact. Underwear/swimwear cannot be returned after wearing</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Personal Care, Beauty, Pet Products, Agricultural Products</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">Must be sealed and unopened (including outer packaging and labels)</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Cameras / DSLR / Video Cameras</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">Limited use only (e.g. shutter count ≤ 20), no activation, lens must remain sealed</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>TVs, Air Conditioners</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">Can be tested (powered on), but not installed or mounted</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Washing Machines</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">Must not be used (no water usage)</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Other Electronics / Appliances</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">Must not be activated, connected to network, or exposed to liquid</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Lighters (e.g. Zippo)</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">No fuel added, no wear on ignition parts</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Collectibles / Models / Figures</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">Internal packaging must remain sealed (no opened plastic or seals)</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Electronic Components</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">No soldering, no installation, sealed consumables must remain unopened</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Books</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">No marks, folds, stains, or reading signs. If sealed, must remain sealed</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Luxury & Metal Products</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">Protective films must not be removed</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Jewelry</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">Certificates and tags must be complete and intact</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Sports, Auto Parts, Equipment</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">Must not be installed, used, or activated</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Home Textiles & Household Items</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">No damage, stains, or removed tags/seals</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Furniture & Home Installation Items</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">Not eligible after installation or use</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Baby Products</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">Sealed packaging must not be opened or damaged</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:8px;"><b>Second-hand Luxury Items</b></td>
      <td style="border:1px solid #e5e7eb; padding:8px;">Must have original tags, no new wear, all accessories included</td>
    </tr>
  </tbody>
</table>




<br/><br/>
<b>9. Gifts & Promotional Items</b><br/><br/>

Any free gifts or promotional items must be returned together with the product<br/>
If not returned, the value of the gift may be deducted from the refund<br/><br/>

<b>10. Exceptions</b><br/><br/>

Returns may not be accepted if:<br/><br/>

Items are used, damaged, or incomplete<br/>
Packaging or seals are broken (for required sealed items)<br/>
Product falls under restricted categories after use<br/><br/>

<b>11. Additional Notes</b><br/><br/>

Sellers may offer more flexible return policies (e.g. longer return period)<br/>
Platform encourages sellers to provide better customer-friendly policies
`;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
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
              <h2 className="text-sm font-bold text-slate-900 mb-3 text-center">7-Day No-Reason Return</h2>

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
