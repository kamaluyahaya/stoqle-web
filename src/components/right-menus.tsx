"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

type MenuProps = {
  label: string;
  description?: string;
  items?: { id: string; label: string; onClick?: () => void }[];
  className?: string;
};

function HoverMenu({ label, description, items = [], className = "" }: MenuProps) {
  const [open, setOpen] = useState(false);
  // type-safe timeout ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  };
  const handleLeave = () => {
    timerRef.current = setTimeout(() => setOpen(false), 120);
  };

  const handleToggle = () => setOpen((s) => !s);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((s) => !s);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`relative ${className}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onTouchStart={handleEnter}
    >
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleToggle}
        onKeyDown={onKeyDown}
        className="text-sm font-medium text-gray-700 hover:text-black focus:outline-none rounded-full"
      >
        {label}
      </button>

      {/* Dropdown */}
      <div
        role="menu"
        aria-hidden={!open}
        className={`
          absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border-gray-200 bg-white shadow-lg shadow-black/10
          transform transition-all duration-150
          ${open ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none -translate-y-1"}
        `}
      >
        {description && <div className="px-4 py-3 text-sm text-gray-600">{description}</div>}
        {items && items.length > 0 && (
          <ul className="py-1 text-sm text-gray-700">
            {items.map((it) => (
              <li
                key={it.id}
                role="menuitem"
                tabIndex={0}
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpen(false);
                    it.onClick?.();
                  }
                }}
                className="px-4 py-2 hover:bg-gray-50 rounded-full cursor-pointer"
              >
                {it.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function RightMenus() {
  const router = useRouter();

  return (
    <div className="flex min-w-[200px] items-center justify-end gap-6">
      <HoverMenu
        label="Creative Center"
        items={[
          { id: "creative-1", label: "Portfolio", onClick: () => router.push("/creative/portfolio") },
          { id: "creative-2", label: "Contact creatives", onClick: () => router.push("/creative/contact") },
        ]}
      />

      <HoverMenu
        label="Business Cooperation"
        items={[
          { id: "biz-1", label: "Business account", onClick: () => router.push("/business/account") },
          { id: "biz-2", label: "Merchant onboarding", onClick: () => router.push("/business/onboarding") },
        ]}
      />
    </div>
  );
}
