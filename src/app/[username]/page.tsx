"use client";
import { useParams } from "next/navigation";
import ProfileHeader from "@/src/components/feed/profile/userHeader";

export default function UserProfilePage() {
  const params = useParams();

  // Make sure username is string | undefined
  const username = Array.isArray(params.username) ? params.username[0] : params.username;

  return <ProfileHeader userId={username} />;
}
