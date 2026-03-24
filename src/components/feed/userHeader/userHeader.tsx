// components/profile/Header.tsx (modified props)
type HeaderProps = {
  profileApi: any | null;
  displayName: string;
  onLogout?: () => void;
  isOwner?: boolean;
  isFollowing?: boolean | null;
  followLoading?: boolean;
  onToggleFollow?: () => Promise<void>;
};

export default function Header({ profileApi, displayName, onLogout, isOwner, isFollowing, followLoading, onToggleFollow }: HeaderProps) {

  // Actions for VIEWING OTHER PEOPLE
  const OtherActions = () => (
    <div className="flex items-center gap-2">
      <button
        className={`rounded-full px-4 py-2 text-sm font-medium shadow ${isFollowing ? "bg-white border" : "bg-rose-500 text-white"}`}
        onClick={async () => {
          if (onToggleFollow) await onToggleFollow();
        }}
        disabled={followLoading}
      >
        {followLoading ? "..." : isFollowing ? "Unfollow" : "Follow"}
      </button>

      <button
        className="bg-white border rounded-full px-3 py-2 text-sm font-medium shadow "
        onClick={() => {
          // open message/DM route
          const uid = profileApi?.user?.user_id ?? profileApi?.user?.id ?? "";
          if (!uid) return;
          // adapt route to your app's DM
          window.location.href = `/messages/new?to=${uid}`;
        }}
      >
        Message
      </button>

      <div className="relative inline-block text-left">
        <button className="p-2 rounded-full hover:bg-slate-100">
          {/* 3 dots */}
          <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
        {/* optionally: small menu with Report / Block */}
      </div>
    </div>
  );

}
