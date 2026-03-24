import { API_BASE_URL } from "../config";

export interface Review {
  review_id: number;
  user_id: number;
  business_id: number;
  order_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  full_name: string;
  profile_pic: string | null;
  likes_count?: number;
  liked_by_user?: boolean;
  replies?: ReviewReply[];
}

export interface ReviewReply {
  reply_id: number;
  review_id: number;
  user_id: number;
  reply_content: string;
  created_at: string;
  author_name: string;
  author_pic: string | null;
}

export const fetchProductReviews = async (productId: number | string): Promise<{ reviews: Review[] }> => {
  const response = await fetch(`${API_BASE_URL}/api/reviews/product/${productId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch reviews");
  }
  return response.json();
};

export const fetchBusinessReviews = async (businessId: number | string): Promise<{ reviews: Review[] }> => {
  const response = await fetch(`${API_BASE_URL}/api/reviews/business/${businessId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch reviews");
  }
  return response.json();
};
