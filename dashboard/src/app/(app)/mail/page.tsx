import Link from "next/link";
import { LinkButton, PageHead } from "@/components/ui";
import { listClients } from "@/lib/queries";
import { listThreads } from "@/lib/threading";
import { recentSentEmails, sendEmailAction } from "./actions";
import { EmailComposer } from "./composer";
import { MailTabs } from "./mail-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mail · Studio" };

type SP = Promise<{ tab?: string }>;

export default async function MailPage({ searchParams }: { searchParams: SP }) {
  const { tab: tabParam } = await searchParams;
  const tab: "compose" | "inbox" = tabParam === "inbox" ? "inbox" : "compose";

  const from = process.env.RESEND_FROM || "jordan@jordansakerdev.com";

  const [clients, recent, threads] = await Promise.all([
    tab === "compose" ? listClients() : Promise.resolve([]),
    tab === "compose" ? recentSentEmails() : Promise.resolve([]),
    tab === "inbox" ? listThreads() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHead
        title="Mail"
        subtitle={
          tab === "compose"
            ? `Send branded emails from ${extractAddress(from)} via the dashboard.`
            : "Email conversations — replies thread to the original send."
        }
        right={
          tab === "inbox" ? (
            <LinkButton href="/mail?tab=compose">+ New email</LinkButton>
          ) : undefined
        }
      />

      <MailTabs current={tab} />

      {tab === "compose" ? (
        <EmailComposer
          clients={clients}
          recent={recent}
          from={from}
          sendAction={sendEmailAction}
        />
      ) : (
        <InboxList threads={threads} />
      )}
    </>
  );
}

function InboxList({
  threads,
}: {
  threads: Awaited<ReturnType<typeof listThreads>>;
}) {
  if (threads.length === 0) {
    return (
      <div className="bg-surface border border-line-soft rounded-2xl p-10 text-center text-muted-2 text-[0.9rem]">
        No conversations yet. Send your first email from the{" "}
        <Link href="/mail?tab=compose" className="text-accent underline">
          Compose
        </Link>{" "}
        tab — replies will land here automatically once you've configured the inbound MX.
      </div>
    );
  }
  return (
    <div className="bg-surface border border-line-soft rounded-2xl overflow-hidden">
      <ul>
        {threads.map((t) => (
          <li
            key={t.id}
            className="border-b border-line-soft last:border-b-0 hover:bg-surface-2 transition-colors"
          >
            <Link
              href={`/mail/${t.id}`}
              className="flex items-baseline justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[0.92rem] ${
                      t.unreadCount > 0 ? "font-semibold text-text" : "text-text"
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
  );
}

function extractAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1] : from;
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
