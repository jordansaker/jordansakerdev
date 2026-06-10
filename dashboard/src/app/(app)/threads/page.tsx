import Link from "next/link";
import { LinkButton, PageHead } from "@/components/ui";
import { listThreads } from "@/lib/threading";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox · Studio" };

export default async function ThreadsPage() {
  const threads = await listThreads();

  return (
    <>
      <PageHead
        title="Inbox"
        subtitle="Email conversations — incoming replies thread to the original send."
        right={<LinkButton href="/email">+ New email</LinkButton>}
      />

      {threads.length === 0 ? (
        <div className="bg-surface border border-line-soft rounded-2xl p-10 text-center text-muted-2 text-[0.9rem]">
          No conversations yet. Send your first email from{" "}
          <Link href="/email" className="text-accent underline">
            /email
          </Link>{" "}
          — replies will land here automatically once you've configured the inbound MX.
        </div>
      ) : (
        <div className="bg-surface border border-line-soft rounded-2xl overflow-hidden">
          <ul>
            {threads.map((t) => (
              <li
                key={t.id}
                className="border-b border-line-soft last:border-b-0 hover:bg-surface-2 transition-colors"
              >
                <Link
                  href={`/threads/${t.id}`}
                  className="flex items-baseline justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[0.92rem] ${
                          t.unreadCount > 0
                            ? "font-semibold text-text"
                            : "text-text"
                        }`}
                      >
                        {t.participantEmail}
                      </span>
                      {t.unreadCount > 0 ? (
                        <span className="mono text-[0.62rem] uppercase tracking-wider text-accent bg-accent-soft px-1.5 py-0.5 rounded">
                          {t.unreadCount} new
                        </span>
                      ) : null}
                      <span className="text-muted-2 text-[0.78rem]">
                        · {t.messageCount}
                        {t.messageCount === 1 ? " message" : " messages"}
                      </span>
                    </div>
                    <div className="text-[0.85rem] text-muted truncate mt-0.5">
                      {t.subject}
                    </div>
                  </div>
                  <span className="text-[0.72rem] text-muted-2 shrink-0">
                    {timeAgo(t.lastMessageAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function timeAgo(d: Date | string): string {
  const t = typeof d === "string" ? new Date(d) : d;
  const s = Math.floor((Date.now() - t.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return t.toISOString().slice(0, 10);
}
