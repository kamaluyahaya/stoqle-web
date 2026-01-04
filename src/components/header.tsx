"use client";

import { useRouter } from "next/navigation";

type ProfileApi = any;

type Props = {
  profileApi?: ProfileApi;
  displayName?: string;
  onEdit?: () => void;
  onSettings?: () => void;
  onBecomeVendor?: () => void;
  onShop?: () => void;
  onLogout?: () => void;
};

// Defaults that live in your public/ folder: /favio.png and /background.png
const DEFAULT_AVATAR = "/favio.png";
const DEFAULT_BG = "/background.png";

export default function ProfileHeader({
  profileApi,
  displayName,
  onEdit,
  onSettings,
  onBecomeVendor,
  onShop,
  onLogout,
}: Props) {
  const router = useRouter();

  const avatarSrc =
    profileApi?.user?.profile_pic ||
    profileApi?.user?.avatar ||
    profileApi?.business?.logo ||
    DEFAULT_AVATAR;

  const bgSrc = profileApi?.cover_image || profileApi?.business?.cover || DEFAULT_BG;

  const isBusiness = Boolean(profileApi?.business || profileApi?.user?.account_type === "business");

  const followers =
    profileApi?.stats?.followers ?? profileApi?.stats?.followers_count ?? 0;
  const following =
    profileApi?.stats?.following ?? profileApi?.stats?.following_count ?? 0;
  const posts = profileApi?.stats?.posts ?? profileApi?.stats?.posts_count ?? 0;
  const likes = profileApi?.stats?.likes ?? profileApi?.stats?.likes_count ?? 0;

  return (
    <header className="relative overflow-hidden rounded-2xl shadow-sm bg-white">
      {/* Background image */}
      <div className="relative h-36 w-full">
        <img
          src={bgSrc}
          alt="cover"
          className="object-cover w-full h-full brightness-90"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/80" />
      </div>

      <div className="-mt-12 px-5 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
          {/* Avatar */}
          <div className="relative mx-auto sm:mx-0">
            <div className="relative">
              <img
                src={avatarSrc}
                alt={displayName ?? "Profile"}
                className="h-28 w-28 rounded-full object-cover ring-4 ring-white shadow bg-white"
              />

              {/* Edit avatar icon */}
              <button
                aria-label="Edit profile picture"
                onClick={onEdit}
                className="absolute right-0 bottom-0 -translate-y-1/4 translate-x-1/4 bg-white rounded-full p-1.5 shadow hover:scale-105 transition-transform"
              >
                {/* pencil icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5h6M4 7v6a2 2 0 002 2h6" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.5 3.5l4 4L12 16l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 w-full">
            {/* Name + Actions */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {displayName ?? profileApi?.user?.name ?? profileApi?.business?.name ?? "Unnamed"}
                </h2>
                <p className="text-sm text-slate-500 mt-1 max-w-xl mx-auto sm:mx-0">
                  {profileApi?.user?.bio ?? profileApi?.business?.business_category ?? profileApi?.business?.tagline ?? ""}
                </p>
              </div>

              {/* Buttons: Settings, Edit, Logout */}
              <div className="flex justify-center sm:justify-end gap-2 items-center">
                <button
                  aria-label="Settings"
                  onClick={onSettings}
                  className="rounded-lg px-3 py-1.5 border text-sm font-medium bg-white shadow-sm hover:shadow-md"
                >
                  {/* gear icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09c.66 0 1.2-.39 1.51-1a1.65 1.65 0 00-.33-1.82L4.3 4.3a2 2 0 012.83-2.83l.06.06c.5.5 1.18.7 1.82.33.4-.25.86-.39 1.34-.39H12c.47 0 .93.14 1.34.39.64.37 1.32.17 1.82-.33l.06-.06A2 2 0 0119.4 4.3l-.06.06c-.25.4-.39.86-.39 1.34V8c0 .47.14.93.39 1.34.37.64.17 1.32-.33 1.82l-.06.06c-.5.5-.7 1.18-.33 1.82z" />
                  </svg>
                  Settings
                </button>

                <button
                  onClick={onEdit}
                  className="rounded-lg px-3 py-1.5 border text-sm font-medium bg-white shadow-sm hover:shadow-md"
                >
                  Edit profile
                </button>

                <button
                  onClick={() => {
                    if (onLogout) onLogout();
                    else router.push("/discover");
                  }}
                  className="rounded-lg px-3 py-1.5 border text-sm font-medium bg-white shadow-sm hover:shadow-md"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-6 items-center">
              <div className="text-center sm:text-left">
                <div className="text-sm font-bold">{followers}</div>
                <div className="text-xs text-slate-500">Followers</div>
              </div>

              <div className="text-center sm:text-left">
                <div className="text-sm font-bold">{following}</div>
                <div className="text-xs text-slate-500">Following</div>
              </div>

              <div className="text-center sm:text-left">
                <div className="text-sm font-bold">{posts}</div>
                <div className="text-xs text-slate-500">Posts</div>
              </div>

              <div className="text-center sm:text-left">
                <div className="text-sm font-bold">{likes}</div>
                <div className="text-xs text-slate-500">Likes</div>
              </div>

              {/* Action CTAs */}
              <div className="ml-0 sm:ml-4 flex gap-3 mt-3 sm:mt-0">
                <button
                  onClick={onShop}
                  className="rounded-md px-4 py-2 border text-sm font-medium shadow-sm hover:shadow-md bg-white"
                >
                  Shopping
                </button>

                <button
                  onClick={onBecomeVendor}
                  className="rounded-md px-4 py-2 bg-slate-900 text-white text-sm font-medium shadow-md hover:opacity-95"
                >
                  Become a vendor
                </button>
              </div>
            </div>

            {/* Nav Tabs */}
            <nav className="mt-4 border-t pt-4">
              <ul className="flex gap-4 text-sm font-medium justify-center sm:justify-start">
                <li className="py-1 px-2 rounded-md hover:bg-slate-50 cursor-pointer">Notes</li>
                <li className="py-1 px-2 rounded-md hover:bg-slate-50 cursor-pointer">Posts</li>
                {isBusiness && (
                  <li className="py-1 px-2 rounded-md hover:bg-slate-50 cursor-pointer">Products</li>
                )}
                <li className="py-1 px-2 rounded-md hover:bg-slate-50 cursor-pointer">About</li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
