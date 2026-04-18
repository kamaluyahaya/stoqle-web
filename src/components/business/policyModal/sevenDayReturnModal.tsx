"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { getNextZIndex } from "@/src/lib/utils/z-index";

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

  const [modalZIndex, setModalZIndex] = React.useState(() => getNextZIndex());
  React.useEffect(() => {
    if (open) {
      setModalZIndex(getNextZIndex());
    }
  }, [open]);

  const content = `<b><center>📄 7-Day No-Reason Return Service Description</center></b><br/><br/>

<b>1. Scope of Protection</b><br/>
After a buyer purchases a product with the “7-Day No-Reason Return” service label, within 7 days after the logistics shows the product has been signed for (calculated from the time of signing, 168 hours equals 7 days), for products that support “7-Day No-Reason Return” and meet the intact standard, a “7-Day No-Reason Return” application can be initiated.<br/><br/>

<b>2. Protection Period</b><br/>
Within 7 days after the logistics shows the product has been signed for (calculated from the time of signing, 168 hours equals 7 days).<br/><br/>

<b>3. Return Shipping Fee</b><br/>
(i) When the buyer performs a “7-Day No-Reason Return”, if the product seller provides free shipping, the buyer only bears the return shipping fee;<br/>
(ii) If the product is not free shipping, or is conditionally free shipping by the seller and partial return by the buyer causes the free shipping condition to no longer be met, the buyer shall bear all shipping costs;<br/>
(iii) For non-consumer reasons (such as product quality issues) or when the platform determines the merchant is responsible, the related return shipping fee shall be borne by the merchant;<br/>
(iv) If the merchant has other commitments, follow those commitments;<br/>
(v) If both parties have other agreements, follow the agreement.<br/><br/>

<b>4. Application Method</b><br/>
Initiate application: My Orders - Corresponding Order - Initiate Return & Refund - Select reason such as “Don’t want it anymore” and other subjective reasons (such as wrong purchase/multiple purchase/dislike/size not suitable).<br/><br/>

<b>5. Requirements for Returned Products</b><br/>
The product meets the intact standard. In addition, the platform encourages merchants to make seven-day no-reason return commitments that are more favorable to consumers than this specification.<br/><br/>

<b>6. General Intact Standard</b><br/>
(i) The returned product and related accessories (such as tags, manuals, warranty cards, etc.) are complete and maintain original quality and function, without damage, contamination, tampering with anti-counterfeiting marks, activation (authorization), or appearance usage traces that are difficult to restore, or unreasonable personal usage data traces.<br/><br/>
(ii) Consumers opening the product packaging for inspection needs, or conducting reasonable debugging to confirm product quality and function, does not affect the intact condition. If the product packaging objectively has anti-counterfeiting, uniqueness, collectible commemorative value, or other special added value, the merchant may propose specific packaging protection requirements within a reasonable scope. For reasonable and feasible packaging protection requirements, after the merchant clearly informs in advance, consumers should actively and cautiously protect them. If the damage degree of such packaging is sufficient to cause value depreciation or functional loss, it can be determined as value depreciation. If the merchant has special requirements for functional integrity, it is recommended that the merchant clearly indicate the specific stage or scenario causing the product to be not intact. However, if the merchant does not give clear notice or the product packaging does not have the above special characteristics, it shall be handled according to the general product packaging intact standard.<br/><br/>
(iii) How to make “clear notice”: the merchant must use prominent methods to remind consumers to pay attention to special product packaging protection requirements, such as clearly indicating the specific packaging layer that would cause the product packaging to be not intact. Specific methods include but are not limited to the following: providing reminders on the product detail page, informing consumers through BCIM chat channels before purchase, placing prominent reminders inside the product package. If there are special packaging protection requirements, the merchant shall explain them in advance, but the explanation content must not restrict the consumer’s basic inspection and examination rights of the product itself.<br/><br/>

<b>7. General Product Packaging Intact Standard</b><br/>
The original product packaging is not missing, and the overall packaging structure is complete. However, unavoidable form changes during packaging transportation or unpacking, such as moderate deformation, stains, partial damage, etc., are not considered to affect packaging integrity.<br/><br/>

<b>8. 📋 Specific Product Intact Standards</b><br/><br/>

<table style="width:100%; border-collapse: collapse; font-size:12px; border: 1px solid #e5e7eb;">
  <thead>
    <tr style="background-color: #f9fafb;">
      <th style="border:1px solid #e5e7eb; padding:10px; text-align:left;"><b>Product Category</b></th>
      <th style="border:1px solid #e5e7eb; padding:10px; text-align:left;"><b>Intact Standard</b></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Food (including health food), cosmetics, medical devices, family planning products, office consumables, automotive consumables</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">Necessary one-time sealed packaging has not been opened</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Electronic appliances</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">None of the following situations: 1. Unauthorized repair, modification, damage, or alteration of mandatory product certification marks, indicator labels, machine serial numbers, etc.; 2. Appearance usage traces that are difficult to restore, or activation, authorization information, unreasonable personal usage data traces</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Clothing, shoes, hats, underwear, bags, toys</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">1. If the product has trademarks, original sealed packaging/seals, anti-counterfeit or anti-theft or anti-damage tags/stickers that do not affect reasonable trial use, they cannot be removed, torn, or displaced and must remain intact, and the product has no obvious wearing, washing, contamination traces. 2. Underwear/swimwear categories must have intact protective stickers on relevant parts and must not be removed; once worn, 7-day no-reason return is not supported.</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Personal care, hair care, cosmetics, game software, pet food, health products, medicines, feed, animal health products, veterinary drugs, seeds, seedlings, pesticides, fertilizers</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">Products with one-time sealed packaging that is unopened, or with one-time sealed outer packaging and special labels not damaged (excluding seller-applied labels), support 7-day no-reason return</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Digital cameras, SLR cameras, camcorders</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">SLR camera shutter count does not exceed 20, no activation, authorization information, or unreasonable personal usage data traces; lens (if any) remains sealed</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>LCD TVs, air conditioners</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">Simple power-on debugging allowed, not wall-mounted for use</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Washing machines</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">Not used with water</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Other digital home appliances</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">Network access license not damaged, no liquid exposure; products already connected to network or activated do not support 7-day no-reason return</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>ZIPPO lighters</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">Cotton core must not be oiled, ignition wheel and flint show no obvious wear</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Models, figurines, action figures, BJD</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">Inner packaging intact, if sealed with tape/plastic wrap, not opened</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Electronic components</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">No soldering performed, integrated circuits not installed on IC base, consumables (thermal paste, adhesives, sealants, conductive glue, etc.) remain unopened</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Books</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">If sealed, packaging unopened, no folds, water stains, contamination, handwriting, or reading traces</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Luxury goods and metal products</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">Hardware protective film not removed</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Jewelry</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">Loss or incompleteness of certificates or price tags, or obvious contamination, does not support 7-day no-reason return</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Sports & outdoor, motorcycle equipment/parts, auto parts, electric vehicles/parts</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">1. Fitness/cycling products after installation, use or activation; outdoor instruments after real-name activation; surfing/diving products after actual use do not support return. 2. Auto/motorcycle/electric parts without usage/installation traces and batteries not powered support return</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Home textiles, home goods</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">Trademark removed or cut, product contaminated or damaged, original sealed packaging opened/damaged; deodorizing products, disposable towels, damaged sealed packaging, or scented candles with usage traces do not support return</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Furniture, home improvement</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">1. Assembled furniture after installation, mattresses with damaged protective film or usage traces, toilets, cabinets, smart locks, lighting after installation do not support return. 2. Non-custom products without installation or usage traces support return</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Mother & baby products</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">Diapers/wipes packaging damaged, or sealed packaging opened with damaged labels do not support return</td>
    </tr>
    <tr>
      <td style="border:1px solid #e5e7eb; padding:10px;"><b>Second-hand luxury goods (bags, watches, accessories)</b></td>
      <td style="border:1px solid #e5e7eb; padding:10px;">1. Anti-counterfeit tags, anti-theft buckles, original protective films intact; 2. No new wearing, usage, washing, contamination, scratches, wear; 3. Complete accessories (including gifts, invoices, certificates, warranty cards, manuals, original shipping documents, etc.)</td>
    </tr>
  </tbody>
</table><br/>

<b>Note:</b> Sealed means the product outer packaging is sealed by the manufacturer with seals or fully plastic-sealed.<br/><br/>

<b>9. Special Notes</b><br/>
• If gifts cannot be returned together, the merchant may require the consumer to pay for the gift at the pre-marked price.<br/>
• Loss or damage of gifts, or loss of invoices does not affect product return.<br/>
• Damaged or lost gifts shall be handled with depreciation, and invoice loss requires the consumer to bear corresponding taxes.<br/>
• 📄 Detailed rules can be found: Stoqle Rules Center
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
            className="relative bg-white w-full sm:max-w-sm h-[80vh] sm:h-auto sm:max-h-[85vh] rounded-t-[0.5rem] sm:rounded-[0.5rem] p-6 border-t sm:border border-slate-100 shadow-2xl flex flex-col justify-between"
          >
            <div className="flex-1 flex flex-col min-h-0 pt-2">
              <h2 className="text-base font-bold text-slate-900 mb-6 text-center">7-Day No-Reason Return Service</h2>

              <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar">
                <div
                  className="text-[13px] text-slate-600 leading-relaxed pb-10"
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
