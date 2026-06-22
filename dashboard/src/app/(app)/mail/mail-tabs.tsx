import Link from "next/link";

export function MailTabs({ current }: { current: "compose" | "inbox" }) {
  const tabs = [
    { key: "compose", label: "Compose", href: "/mail?tab=compose" },
    { key: "inbox", label: "Inbox", href: "/mail?tab=inbox" },
  ] as const;
  return (
    <div className="flex gap-1 border-b border-line-soft mb-6 -mt-2">
      {tabs.map((t) => {
        const active = current === t.key;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`px-4 py-2.5 text-[0.92rem] font-medium border-b-2 -mb-px transition-colors ${
              active
                ? "border-accent text-text"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
