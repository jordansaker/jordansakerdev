"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";

const items = [
  {
    href: "/",
    label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/services",
    label: "Services & Pricing",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M3 7h18M3 12h18M3 17h18" />
      </svg>
    ),
  },
  {
    href: "/clients",
    label: "Clients",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="9" cy="8" r="3.5" />
        <path d="M3 20c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" />
        <path d="M16 11.5a3 3 0 100-6" />
        <path d="M21 18.5c0-2.4-2-4.5-4.5-4.5" />
      </svg>
    ),
  },
  {
    href: "/quotes",
    label: "Quotes",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M9 13h6M9 17h4" />
      </svg>
    ),
  },
  {
    href: "/quote-pad",
    label: "Quote Pad",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8 7h8M8 12h2M12 12h4M8 16h2M12 16h4" />
      </svg>
    ),
  },
  {
    href: "/invoices",
    label: "Invoices",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    ),
  },
  {
    href: "/bas",
    label: "BAS",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 3 3 5-6" />
      </svg>
    ),
  },
  {
    href: "/mail",
    label: "Mail",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </svg>
    ),
  },
];

export function Sidebar({
  gstRegistered,
  toggleGstAction,
  logoutAction,
}: {
  gstRegistered: boolean;
  toggleGstAction: () => Promise<void>;
  logoutAction: () => Promise<void>;
}) {
  const path = usePathname();
  const [pending, startTransition] = useTransition();
  return (
    <aside className="bg-bg-2 border-r border-line-soft p-6 px-4 flex flex-col gap-1.5 sticky top-0 h-screen">
      <div className="flex items-center gap-3 font-semibold px-2 pt-1.5 pb-5">
        <span className="w-8 h-8 rounded-lg bg-accent text-bg grid place-items-center font-serif font-semibold shadow-[0_4px_14px_rgba(232,116,59,0.3)]">
          JS
        </span>
        <span>Studio</span>
      </div>
      <nav className="flex flex-col gap-1.5">
        {items.map((item) => {
          const isActive = item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] font-medium text-[0.93rem] transition-colors ${
                isActive
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface hover:text-text"
              }`}
            >
              <span className="w-[18px] h-[18px] inline-flex">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1" />
      <div className="mt-2 p-3 bg-surface border border-line-soft rounded-[10px] text-xs text-muted">
        Tax settings
        <div className="flex items-center justify-between mt-2">
          <span>GST registered</span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await toggleGstAction();
              })
            }
            aria-pressed={gstRegistered}
            aria-label="Toggle GST registration"
            className={`relative w-[38px] h-[21px] rounded-full border border-line transition-colors ${
              gstRegistered ? "bg-accent" : "bg-surface-2"
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-[2px] w-[15px] h-[15px] rounded-full transition-all ${
                gstRegistered ? "left-[19px] bg-bg" : "left-[2px] bg-text"
              }`}
            />
          </button>
        </div>
      </div>
      <form
        action={logoutAction}
        className="mt-2 px-2 pb-1"
      >
        <button
          type="submit"
          className="text-xs text-muted-2 hover:text-text transition-colors"
        >
          Sign out
        </button>
      </form>
    </aside>
  );
}
