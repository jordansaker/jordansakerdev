"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function MobileShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  // Close drawer on navigation
  useEffect(() => {
    setOpen(false);
  }, [path]);

  // Esc to close + body scroll lock while open (mobile)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <div className="lg:grid lg:grid-cols-[230px_1fr] lg:min-h-screen">
      {/* Mobile top bar with hamburger */}
      <div className="lg:hidden sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-line-soft flex items-center gap-3 px-4 h-14">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2.5 font-medium">
          <span className="w-7 h-7 rounded-md bg-accent text-bg grid place-items-center font-serif font-semibold text-[0.85rem] shadow-[0_4px_14px_rgba(232,116,59,0.3)]">
            JS
          </span>
          <span>Studio</span>
        </div>
      </div>

      {/* Backdrop */}
      {open ? (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      {/* Sidebar slot */}
      <div
        className={`lg:contents fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </div>

      <main className="px-4 sm:px-6 lg:px-10 pt-6 sm:pt-7 lg:pt-8 pb-12 lg:pb-16 min-w-0 max-w-[1180px]">
        {children}
      </main>
    </div>
  );
}
