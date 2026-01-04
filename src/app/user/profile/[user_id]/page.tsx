"use client";
import { useParams } from "next/navigation";
import ProfileHeader from "../../../../components/feed/profile/userHeader";

export default function UserProfilePage() {
  const params = useParams();

  // Make sure userId is string | number | undefined
  const userId = Array.isArray(params.user_id) ? params.user_id[0] : params.user_id;

  return <ProfileHeader userId={userId} />;
}
