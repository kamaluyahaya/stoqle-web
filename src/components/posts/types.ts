export type SubmitPayload = {
  type: "note" | "images" | "video";
  text?: string;
  images?: File[];
  video?: File | null;
};
