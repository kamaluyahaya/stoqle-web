// central types used across the UI and API layer
export type User = {
  id: number;
  name: string;
  avatar?: string;
};

export type Post = {
  id: number;
  apiId?: number;
  src?: string;
  isVideo?: boolean;
  caption?: string;
  note_caption?: string;
  user: User;
  liked: boolean;
  likeCount: number;
  coverType?: string;
  noteConfig?: any;
  rawCreatedAt?: string;
  allMedia?: string[];
  location?: string | null;
  category?: string;
};
