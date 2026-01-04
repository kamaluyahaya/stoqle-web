"use client";

type PolicyModalProps = {
  open: boolean;
  title?: string | null;
  body?: string | null;
  onClose: () => void;
};

export default function PolicyModal({
  open,
  title,
  body,
  onClose,
}: PolicyModalProps) {
  if (!open) return null;

  return (
   <div className="fixed inset-0 z-75 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
  {/* Backdrop */}
  <div className="absolute inset-0 bg-black/40" onClick={() => onClose()} />

  <div className="relative w-full max-w-2xl bg-slate-100 lg:rounded-2xl md:rounded-2xl rounded-t-2xl shadow-xl z-10
                  h-[75vh] sm:h-auto flex flex-col">

      {/* Modal */}
    <div className="bg-white pb-5 lg:rounded-2xl md:rounded-2xl rounded-t-2xl">
        <div className="relative flex items-center ">
        {/* Left spacer (same width as close button) */}
        <div className="w-9 h-9" />
        {/* Centered title */}
        <div>
        <h3 className="absolute left-1/2 -translate-x-1/2 text-lg font-medium text-slate-800 truncate max-w-[70%] text-center">
            {title}
        </h3>
        {/* <div className="text-xs truncate text-slate-500">
                From Kaduna North Central market
                </div> */}
        </div>
         


  {/* Close button */}
  <button
    onClick={onClose}
    className="ml-auto pt-4 pr-5 rounded-md hover:bg-slate-100"
    aria-label="Close"
  >
    <svg
      className="w-5 h-5 text-slate-600"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M6 6L18 18M6 18L18 6"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
</div>
    <div className="text-sm text-slate-700 whitespace-pre-wrap p-5">
        Promise to ship within 48 hours, delay Compensation guaranteed
    </div>
</div>

<div className="bg-white mt-2">
<div className="text-sm text-slate-700 p-5 whitespace-pre-wrap">
    <p>Select delivery address</p>
    
    <div className="text-center justify-center mt-2">
        <div className="text-slate-400 py-4">
        No address yet, please add an address first
        </div>
        <button className=" border border-red-500 px-5 py-2 rounded-full text-red-500">Add delivery address</button>
    </div>
         

        </div>
</div>

        <div className="bg-white mt-2">
<div className="text-sm text-slate-700 p-5 whitespace-pre-wrap">
    <p>Delivery Notice</p>
    
     <div className="text-md font-semibold py-3 text-slate-700 whitespace-pre-wrap">
        Promise to ship within 48 hours, delay Compensation guaranteed
    </div>

    <div>
        If you make the payment now, we promise to ship the product within 48 hours. If we fail to ship it within the promised time, we will compensate you with a discount coupon of at least 3 yuan with no minimum purchase requirement (except for special items and force majeure factors).
    </div>
         

        </div>
</div>
        
       
      </div>
    </div>
  );
}
