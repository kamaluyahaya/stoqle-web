// src/types/product.ts
export type VariantEntry = {
  id: string;
  name: string;
  quantity: number;
  price?: number | null;
  images: File[]; // per-variant images (limit 0..1 in UI)
  imagePreviews: string[];
    options?: VariantOption[];
};

export type VariantOption = {
  id: string | number | null;
  name: string;
};

export type VariantGroup = {
  id: string;
  title: string;
  entries: VariantEntry[];
  allowImages?: boolean;
};


export type VariantGroupProps = {
  group: VariantGroup;
  groupIndex: number; // ✅ NEW
  onUpdateTitle: (id: string, title: string) => void;
  onSetAllowImages: (id: string) => void;
  onAddEntry: (groupId: string) => void;
  onRemoveGroup: (id: string) => void;
  children?: React.ReactNode;
};


export type VariantEntryCardProps = {
  entry: VariantEntry;
  samePriceForAll: boolean;
  sharedPrice?: number | null;
  onRemove: () => void;
  onEdit: () => void;
  allowImages?: boolean;
  showQuantity?: boolean; // ✅ NEW
};

export type ParamKV = { id: string; key: string; value: string };

export type VariantEntryModal = {
  open: boolean;
  initialData?: VariantEntry | null;
  onClose: () => void;
  onSubmit: (entry: Omit<VariantEntry, "id">) => void;
  samePriceForAll: boolean;
  sharedPrice?: number | null;
  allowImages?: boolean;
  showQuantity?: boolean;
  existingNames?: string[]; // NEW: names already in the group, normalized to lowercase
};



export type PreviewPayload = {
  title: string;
  description: string;
  category: string;
  hasVariants: boolean;
  price?: number | "";
  quantity?: number | "";
  samePriceForAll: boolean;
  sharedPrice: number | null;
  productImages: { file?: File; name?: string; url?: string }[]; // urls for previews
  productVideo?: { file?: File; name?: string; url?: string } | null;
  variantGroups: {
    id: string;
    title: string;
    allowImages?: boolean;
    entries: Array<{
      id: string;
      name: string;
      quantity?: number | "";
      price?: number | null;
      images?: { file?: File; name?: string; url?: string }[];
    }>;
  }[];
  params: { key: string; value: string }[];
};



// business-policy.types.ts

/* =========================
   ROOT RESPONSE
========================= */

export type BusinessPolicyResponse = {
  ok: boolean;
  isBusiness: boolean;
  data: {
    business: Business;
    staff?: Staff;
    documents?: any[];
    policy?: BusinessPolicy;
  };
};

/* =========================
   BUSINESS
========================= */

export type Business = {
  business_id: number;
  business_name: string;
  business_email?: string;
  business_slug?: string;
  phone?: string;
  business_category?: string;
  logo?: string | null;
  business_status?: string;
  business_address?: string;
  created_at?: string;
  full_name?: string;
  profile_pic?: string | null;
  bg_photo_url?: string | null;
};

/* =========================
   STAFF
========================= */

export type Staff = {
  role: "owner" | "admin" | "staff";
  status: "pending" | "active" | "suspended";
  last_login: string | null;
  last_logout: string | null;
};

/* =========================
   POLICY ROOT
========================= */

export type BusinessPolicy = {
  core?: PolicyCore;
  shipping?: ShippingPolicy[];
  returns?: ReturnPolicy;
  payments?: PaymentPolicy[];
  customer_service?: CustomerServicePolicy;
  address?: BusinessAddress;
  market_affiliation?: MarketAffiliation;
  promotions?: Promotion[];
  sales_discounts?: SalesDiscount[];
};

/* =========================
   CORE POLICY
========================= */

export type PolicyCore = {
  id: number;
  business_id: number;
  delivery_notice?: string | null;
  created_at?: string;
  updated_at?: string;
};

/* =========================
   SHIPPING
========================= */

export type ShippingPolicy = {
  id: number;
  business_policy_id: number;
  kind: "avg" | "promise";
  value: number;
  unit: string;
  created_at?: string;
};

/* =========================
   RETURNS
========================= */

export type ReturnPolicy = {
  id: number;
  business_policy_id: number;
  return_shipping_subsidy?: number;
  seven_day_no_reason?: number;
  rapid_refund?: number;
  additional_info?: string;
  created_at?: string;
};

/* =========================
   PAYMENTS
========================= */

export type PaymentPolicy = {
  id: number;
  business_policy_id: number;
  provider: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  bank_code: string;
  currency: string;
  cod_enabled: number;
  pod_enabled: number;
  support_available: number;
  paystack_recipient_code?: string;
  paystack_meta?: PaystackMeta;
  created_at?: string;
  updated_at?: string;
};

export type PaystackMeta = {
  active: boolean;
  createdAt: string;
  currency: string;
  description: string;
  domain: string;
  email: string | null;
  id: number;
  integration: number;
  metadata: any;
  name: string;
  recipient_code: string;
  type: string;
  updatedAt: string;
  is_deleted: boolean;
  isDeleted: boolean;
  details?: {
    authorization_code: string | null;
    account_number: string;
    account_name: string;
    bank_code: string;
    bank_name: string;
  };
};

/* =========================
   CUSTOMER SERVICE
========================= */

export type CustomerServicePolicy = {
  id: number;
  business_policy_id: number;
  reply_time: string;
  good_reviews_threshold: number;
  welcome_message: string;
  created_at?: string;
};

/* =========================
   ADDRESS
========================= */

export type BusinessAddress = {
  id: number;
  business_policy_id: number;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  created_at?: string;
};

/* =========================
   MARKET AFFILIATION
========================= */

export type MarketAffiliation = {
  id: number;
  business_policy_id: number;
  market_name: string;
  note?: string;
  trusted_partner?: number;
  created_at?: string;
};

/* =========================
   PROMOTIONS
========================= */

export type Promotion = {
  id: number;
  business_policy_id: number;
  title: string;
  start_date: string;
  end_date: string;
  discount_percent: number;
  metadata?: any;
  created_at?: string;
};

/* =========================
   SALES DISCOUNTS
========================= */

export type SalesDiscount = {
  id: number;
  business_policy_id: number;
  discount_type: string;
  discount_percent: string;
  created_at?: string;
};
