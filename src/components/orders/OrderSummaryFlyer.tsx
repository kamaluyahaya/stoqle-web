"use client";

import React from "react";
import { Package, MapPin, Phone, User, Calendar, ShoppingBag, Globe } from "lucide-react";
import { getDistance } from "geolib";

interface OrderItem {
  order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_item_price: number;
  variant_info?: string | null;
  product_image?: string | null;
}

interface MasterOrder {
  sale_id: number | null;
  payment_ref: string | null;
  full_name: string;
  email: string;
  phone: string;
  delivery_address: string;
  delivery_latitude?: number | string | null;
  delivery_longitude?: number | string | null;
  status: string;
  created_at: string;
  customer_profile_pic?: string | null;
  combined_total: number;
  items: OrderItem[];
  vendor_info?: {
    name: string;
    logo?: string;
    phone?: string;
    address?: string;
    promo?: string;
  };
  business?: any;
  policies?: any;
}

const OrderSummaryFlyer = React.forwardRef<HTMLDivElement, { order: MasterOrder }>(({ order }, ref) => {
  const dateStr = new Date(order.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatUrl = (url?: string | null) => {
    if (!url) return "/assets/images/logo.png";
    if (url.startsWith("http")) return url;
    return url.startsWith("/public") ? `https://stoqle.com${url}` : `https://stoqle.com/public/${url}`;
  };

  // Vendor Information from backend
  const business = order.business || {};
  const policies = order.policies || {};

  const vendorName = business.business_name || business.name || "Stoqle Merchant";
  const vendorLogo = formatUrl(business.logo || business.business_logo);
  const vendorPhone = business.phone_no || business.phone || "+234 (0) ---";

  const formatAddress = (raw?: string) => {
    if (!raw) return "Online Store on Stoqle";
    if (!raw.startsWith("{")) return raw;
    try {
      const p = JSON.parse(raw);
      const parts = [p.address_line_1, p.address_line_2, p.city, p.state, p.country].filter(Boolean);
      return parts.join(", ");
    } catch (e) {
      return raw;
    }
  };

  const vendorAddress = formatAddress(business.business_address || business.address);

  // Active Promo
  const activePromoObj = policies.promotions?.find((p: any) => {
    const now = new Date();
    const start = new Date(p.start_date);
    const end = new Date(p.end_date);
    return now >= start && now <= end;
  }) || policies.promotions?.[0];

  const activePromo = activePromoObj ? (
    activePromoObj.discount_percent
      ? `${activePromoObj.title} (${activePromoObj.discount_percent}% Off)`
      : activePromoObj.title
  ) : null;

  // Shipping Promise & Distance Calculation
  const getDeliveryEstimate = () => {
    const shippingPolicies = policies.shipping || [];
    // Find merchant's processing/standard duration
    const pPolicy = shippingPolicies.find((s: any) =>
      s.kind?.toLowerCase().includes("standard") ||
      s.kind?.toLowerCase().includes("process") ||
      s.kind?.toLowerCase().includes("handling")
    ) || shippingPolicies[0];

    const pValue = Number(pPolicy?.value) || 24;
    const pUnit = pPolicy?.unit || "hours";

    let distanceKm = 0;
    let transitMins = 0;

    if (business.latitude && business.longitude && order.delivery_latitude && order.delivery_longitude) {
      const dist = getDistance(
        { latitude: Number(business.latitude), longitude: Number(business.longitude) },
        { latitude: Number(order.delivery_latitude), longitude: Number(order.delivery_longitude) }
      );
      distanceKm = Number((dist / 1000).toFixed(1));
      transitMins = Math.round(distanceKm * 5); // 1KM = 5 Mins rule
    }

    let promiseText = `${pValue} ${pUnit}`;
    if (distanceKm > 0) {
      if (pUnit.toLowerCase().includes("hour")) {
        const totalMinutes = (pValue * 60) + transitMins;
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        promiseText = `${h} ${h > 1 ? 'hours' : 'hour'}${m > 0 ? ` and ${m} mins` : ''} Total`;
      } else {
        promiseText = `${pValue} ${pUnit} + ${transitMins}m Transit`;
      }
    }

    return { promise: promiseText, distance: distanceKm };
  };

  const deliveryData = getDeliveryEstimate();

  // QR link (in real scenario this should be dynamic)
  const qrData = `https://stoqle.com/orders/${order.sale_id || order.payment_ref}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;

  // Parse delivery address if JSON
  let delivery = { name: order.full_name, phone: order.phone, address: order.delivery_address, region: "" };
  try {
    const parsed = JSON.parse(order.delivery_address);
    delivery = {
      name: parsed.recipientName || order.full_name,
      phone: parsed.contactNo || order.phone,
      address: parsed.address || order.delivery_address,
      region: parsed.region || ""
    };
  } catch (e) { }

  return (
    <div
      ref={ref}
      className="bg-white text-slate-900 overflow-hidden print:p-0 relative"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "20mm",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
      }}
    >
      {/* WATERMARK SECTION */}
      <div className="absolute print:fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.05] pointer-events-none -rotate-45 select-none z-0 whitespace-nowrap">
        <span className="text-[250px] font-black tracking-[0.1em] text-red-500">stoqle</span>
      </div>

      {/* VERTICAL VERIFICATION SLIP (RIGHT EDGE) */}
      <div className="fixed right-3 top-0 bottom-0 flex items-center justify-center pointer-events-none opacity-[0.2] select-none z-50">
        <div
          className="text-[12px] font-black tracking-[0.5em]  text-slate-600"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          ——  Stoqle Order Verification Slip — ID: #{order.sale_id} — Validated by Anti-Tamper System —
        </div>
      </div>

      <div className="max-w-full mx-auto relative z-10">

        {/* HEADER SECTION */}
        <header className="flex justify-between items-start mb-2 pb-2">
          <div className="space-y-4">
            <img src={vendorLogo} alt={vendorName} className="h-16 max-w-[250px] object-contain" />
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Order Summary</h1>
          </div>
          <div className="text-right">
            <div className="inline-block bg-slate-100 text-slate-800 text-[10px] font-black px-3 py-1.5 rounded-lg tracking-widest  mb-3">
              {order.status.replace(/_/g, ' ')}
            </div>
            <div className="text-sm font-bold text-slate-950 mb-1">Order ID: #{order.sale_id}</div>
            <div className="text-xs text-slate-500 font-medium tracking-tight">Placed on {dateStr} at {timeStr}</div>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-12 mb-2">
          {/* VENDOR SECTION */}
          <section className="p-4 rounded-lg border border-slate-100 mb-0" style={{ pageBreakAfter: 'avoid' }}>
            <h2 className="text-[10px] font-black text-slate-400  tracking-[0.2em] mb-3 flex items-center gap-2">
              <ShoppingBag size={12} /> Merchant Details
            </h2>
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 bg-white rounded-lg border border-slate-100 p-1 flex items-center justify-center">
                <img src={vendorLogo} className="w-full h-full object-contain rounded-lg" alt="Business Logo" />
              </div>
              <div>
                <div className="font-extrabold text-slate-900 text-sm tracking-tight">{vendorName}</div>
                <div className="text-xs text-slate-500 font-medium">{vendorPhone}</div>
              </div>
            </div>
            <div className="space-y-2 mt-2 pt-2 border-t border-slate-200/50">
              <div className="flex gap-2">
                <MapPin className="text-slate-400 shrink-0" size={14} />
                <span className="text-xs text-slate-600 font-medium leading-tight">{vendorAddress}</span>
              </div>
              {activePromo && (
                <div className="inline-block bg-emerald-50 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded">
                  OFFER: {activePromo}
                </div>
              )}
            </div>
          </section>

          {/* CUSTOMER SECTION */}
          <section className="p-4 mb-0" style={{ pageBreakAfter: 'avoid' }}>
            <h2 className="text-[10px] font-black text-slate-400  tracking-[0.2em] mb-4 flex items-center gap-2">
              <User size={12} /> Delivery Destination
            </h2>
            <div className="font-extrabold text-slate-900 text-sm mb-1 tracking-tight">{delivery.name}</div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-3">
              <Phone size={12} />
              {delivery.phone !== 'null' ? delivery.phone : 'Not provided'}
            </div>
            <div className="flex gap-3 text-xs text-slate-600 font-medium leading-tight">
              <MapPin className="text-rose-500 shrink-0 mt-0.5" size={14} />
              <div>
                <p className="text-slate-900 font-bold mb-0.5">{delivery.address}</p>
                <p className="text-[10px] text-slate-500">{delivery.region}</p>
              </div>
            </div>
          </section>
        </div>

        {/* ORDER ITEMS TABLE */}
        <section className="mb-4">
          <h2 className="text-[10px] font-black text-slate-400  tracking-[0.2em] px-2">Order Contents</h2>
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-500  tracking-widest">Product</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-500  tracking-widest">Item Details</th>
                  <th className="text-center px-6 py-4 text-[10px] font-black text-slate-500  tracking-widest">Qty</th>
                  <th className="text-right px-6 py-4 text-[10px] font-black text-slate-500  tracking-widest">Unit Price</th>
                  <th className="text-right px-6 py-4 text-[10px] font-black text-slate-500  tracking-widest">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item, idx) => (
                  <tr key={idx} className="group">
                    <td className="px-6 py-5">
                      <div className="w-12 h-12 bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                        <img src={formatUrl(item.product_image)} className="w-full h-full object-cover" alt={item.product_name} />
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-extrabold text-slate-900 text-sm leading-tight">{item.product_name}</div>
                      {item.variant_info && (
                        <div className="text-[10px] font-black text-rose-500  mt-1 tracking-wider">{item.variant_info}</div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center text-sm font-bold text-slate-950">{item.quantity}</td>
                    <td className="px-6 py-5 text-right text-sm font-bold text-slate-600">₦{Number(item.unit_price || 0).toLocaleString()}</td>
                    <td className="px-6 py-5 text-right text-sm font-black text-slate-950">₦{Number(item.total_item_price || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-end">
            <div className="w-64 space-y-3">
              <div className="flex justify-between items-center text-sm text-slate-500 font-medium px-2">
                <span>Subtotal</span>
                <span className="font-bold text-slate-900">₦{Number(order.combined_total || 0).toLocaleString()}</span>
              </div>

              {activePromoObj && activePromoObj.discount_percent && (
                <>
                  <div className="flex justify-between items-center text-sm text-emerald-600 font-bold px-2">
                    <span>{activePromoObj.title} ({activePromoObj.discount_percent}%)</span>
                    <span>-₦{Number((order.combined_total * activePromoObj.discount_percent) / 100).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-emerald-500 font-black  tracking-widest px-2 pt-1 border-t border-emerald-50">
                    <span>Total Amount Savings</span>
                    <span>₦{Number((order.combined_total * activePromoObj.discount_percent) / 100).toLocaleString()}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between items-center text-sm text-slate-500 font-medium px-2">
                <span>Tax / Service</span>
                <span className="font-bold text-slate-900">₦0</span>
              </div>
              <div className="h-px my-2" />
              <div className="flex justify-between items-center px-4 py-2">
                <span className="text-xs font-black  tracking-widest opacity-70">Final Total</span>
                <span className="text-xl font-black">₦{Number(order.combined_total || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </section>

        {/* DELIVERY INFORMATION */}
        <section className="grid grid-cols-2 gap-2">
          <div className="space-y-4">
            <h2 className="text-[10px] font-black text-slate-400  tracking-[0.2em] mb-4 flex items-center gap-2">
              <Calendar size={12} /> Delivery Time
            </h2>
            <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-emerald-600 shrink-0 shadow-sm shadow-emerald-200/50">
                <Package size={20} />
              </div>
              <div>
                <div className="text-xs font-extrabold text-emerald-900">Standard Delivery</div>
                <div className="text-[10px] text-emerald-700 font-bold mb-1">Within State ({deliveryData.distance > 0 ? `${deliveryData.distance} KM Distance` : "Local Area"})</div>
                <div className="text-sm font-black text-emerald-950">Estimated ships within {deliveryData.promise}</div>
              </div>
            </div>
          </div>

          {/* QR CODE SECTION */}
          <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-50/30 rounded-lg border border-dashed border-slate-200">
            <img src={qrUrl} alt="Order QR" className="w-24 h-24 mb-3 border-4 border-white shadow-lg rounded-lg" />
            <div className="text-[9px] font-black text-slate-400  tracking-widest">Order Verification Tag</div>
            <p className="text-[8px] text-slate-400 mt-1 max-w-[120px]">Scan to view real-time tracking and delivery status history.</p>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="text-center pt-4 space-y-2">
          <div className="flex items-center justify-center gap-2 opacity-30 grayscale hover:grayscale-0 transition duration-500">
            <span className="text-xs font-black tracking-[0.3em] ">Powered by</span>
            <img src="/assets/images/logo.png" className="h-4 object-contain" alt="Stoqle" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 tracking-wider">Built for sellers. Loved by buyers.</p>

          <div className="flex justify-center gap-6 pt-2">
            <div className="flex items-center gap-1.5 opacity-40">
              <Globe size={11} className="text-slate-900" />
              <span className="text-[10px] font-bold">stoqle.com</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-40">
              <User size={11} className="text-slate-900" />
              <span className="text-[10px] font-bold">@stoqle_ng</span>
            </div>
          </div>
        </footer>

      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-flyer, #printable-flyer * {
            visibility: visible;
          }
          #printable-flyer {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
          }
          @page {
            size: A4;
            margin: 0;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          section, .w-64, footer {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
});

OrderSummaryFlyer.displayName = "OrderSummaryFlyer";

export default OrderSummaryFlyer;
