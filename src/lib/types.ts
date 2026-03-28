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
  allMedia?: { url: string; id: any }[];
  location?: string | null;
  category?: string;
  isPinned?: boolean;
  pinnedAt?: string;
  status?: string;
  thumbnail?: string;
};
