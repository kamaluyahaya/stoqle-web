"use client";
import { useParams, useSearchParams } from "next/navigation";
import ProfileHeader from "@/src/components/feed/profile/userHeader";

export default function UserProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();

  // Support both /slug and /?stoqle_id=...
  const username = Array.isArray(params.username) ? params.username[0] : params.username;
  const stoqleId = searchParams.get("stoqle_id") || searchParams.get("sid");

  const identifier = stoqleId || username;
  const isNumeric = /^\d+$/.test(identifier || "");
  // If it's explicitly from query param stoqle_id, or it's numeric and long enough
  const type = stoqleId || (isNumeric && identifier && identifier.length >= 8) ? 'stoqle_id' : 'slug';

  return <ProfileHeader userId={identifier} identifierType={type as any} />;
}
