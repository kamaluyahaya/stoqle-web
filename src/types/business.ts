export type BusinessPolicy = {
  core: {
    id: number;
    business_id: number;
    delivery_notice: string;
    created_at: string;
    updated_at: string;
  };
  shipping: {
    id: number;
    business_policy_id: number;
    kind: "avg" | "promise";
    value: number;
    unit: "hours" | "days" | "weeks";
    created_at: string;
  }[];
  returns: {
    id: number;
    business_policy_id: number;
    return_shipping_subsidy: number;
    seven_day_no_reason: number;
    rapid_refund: number;
    additional_info?: string | null;
    created_at: string;
  };
  payments: {
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
    paystack_recipient_code: string;
    paystack_meta: {
      active: boolean;
      createdAt: string;
      currency: string;
      description: string;
      domain: string;
      email?: string | null;
      id: number;
      integration: number;
      metadata?: any;
      name: string;
      recipient_code: string;
      type: string;
      updatedAt: string;
      is_deleted: boolean;
      isDeleted: boolean;
      details: {
        authorization_code?: string | null;
        account_number: string;
        account_name: string;
        bank_code: string;
        bank_name: string;
      };
    };
    created_at: string;
    updated_at: string;
  }[];
  customer_service: {
    id: number;
    business_policy_id: number;
    reply_time: string;
    good_reviews_threshold: number;
    welcome_message: string;
    created_at: string;
  };
  address: {
    id: number;
    business_policy_id: number;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    created_at: string;
  };
  market_affiliation: {
    id: number;
    business_policy_id: number;
    market_name: string;
    note?: string;
    trusted_partner: number;
    created_at: string;
  };
  promotions: {
    id: number;
    business_policy_id: number;
    title: string;
    start_date: string;
    end_date: string;
    discount_percent: string;
    metadata?: any;
    created_at: string;
  }[];
  sales_discounts: {
    id: number;
    business_policy_id: number;
    discount_type: string;
    discount_percent: string;
    created_at: string;
  }[];
};

export type Business = {
  business_id: number;
  business_name: string;
  business_email: string | null;
  business_slug?: string | null;
  phone?: string | null;
  business_category?: string | null;
  referral?: number | null;
  logo?: string | null;
  profile_pic?: string | null;
  business_status: "pending" | "active" | "rejected" | string;
  business_address?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  policy?: BusinessPolicy | null;
};