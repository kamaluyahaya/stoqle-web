"use client";
import { useParams } from "next/navigation";
import ProfileHeader from "@/src/components/feed/profile/userHeader";

export default function UserPostPage() {
  const params = useParams();
  
  const username = Array.isArray(params.username) ? params.username[0] : params.username;
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;

  // identifier for the profile background
  const type = (username && /^\d+$/.test(username) && username.length >= 8) ? 'stoqle_id' : 'slug';

  // We pass the postId to the ProfileHeader (or wherever handles the post opening)
  // Or we can just let ProfileHeader handle it if we update its logic.
  return <ProfileHeader userId={username} identifierType={type as any} initialPostId={postId} />;
}
