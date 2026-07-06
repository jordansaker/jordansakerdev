"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { label: string; href: string };

export function SectionTabs({ tabs }: { tabs: Tab[] }) {
  const path = usePathname();
  const active = tabs.reduce<Tab | null>((best, t) => {
    if (path === t.href || path.startsWith(`${t.href}/`)) {
      if (!best || t.href.length > best.href.length) return t;
    }
    return best;
  }, null);

  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-1 bg-surface border border-line-soft rounded-full p-1 mb-6"
    >
      {tabs.map((t) => {
        const isActive = active?.href === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={isActive}
            className={`px-4 py-1.5 rounded-full text-[0.85rem] font-medium transition-colors ${
              isActive
                ? "bg-accent text-bg shadow-[0_4px_14px_rgba(232,116,59,0.25)]"
                : "text-muted hover:text-text"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
