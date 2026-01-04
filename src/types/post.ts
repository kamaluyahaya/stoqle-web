export type Post = {
  id: string;
  type: "image" | "video";
  src: string;
  author?: string;
  caption?: string;
};
