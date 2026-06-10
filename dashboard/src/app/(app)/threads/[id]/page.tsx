import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/ui";
import { sendEmailAction } from "../../email/actions";
import { getThread, markThreadRead } from "@/lib/threading";
import { ThreadReply } from "./thread-reply";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const t = await getThread(Number(id));
  return { title: t?.thread.subject ? `${t.thread.subject} · Inbox` : "Thread · Inbox" };
}

export default async function ThreadPage({ params }: { params: Params }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) notFound();
  const data = await getThread(idNum);
  if (!data) notFound();
  await markThreadRead(idNum);

  const { thread, messages } = data;

  return (
    <>
      <PageHead
        title={thread.subject}
        subtitle={
          <>
            With{" "}
            <a
              href={`mailto:${thread.participantEmail}`}
              className="text-accent hover:underline"
            >
              {thread.participantEmail}
            </a>{" "}
            · {thread.messageCount} message{thread.messageCount === 1 ? "" : "s"}
          </>
        }
        right={
          <Link
            href="/threads"
            className="rounded-full border border-line text-text font-semibold text-[0.88rem] px-4 py-2.5 hover:border-text transition-colors"
          >
            ← All threads
          </Link>
        }
      />

      <ul className="space-y-4 mb-8">
        {messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-2xl border overflow-hidden ${
              m.direction === "outbound"
                ? "bg-surface border-line-soft"
                : "bg-bg-2 border-accent-soft"
            }`}
          >
            <div className="px-5 py-3 border-b border-line-soft flex items-baseline justify-between gap-3">
              <div className="text-[0.85rem]">
                <span
                  className={`mono text-[0.62rem] uppercase tracking-wider mr-2 px-1.5 py-0.5 rounded ${
                    m.direction === "outbound"
                      ? "bg-[rgba(168,156,139,0.14)] text-muted"
                      : "bg-accent-soft text-accent"
                  }`}
                >
                  {m.direction === "outbound" ? "Sent" : "Received"}
                </span>
                <span className="text-muted">
                  {m.direction === "outbound" ? "to" : "from"}{" "}
                </span>
                <span className="text-text">
                  {m.direction === "outbound" ? m.toAddress : m.fromAddress}
                </span>
              </div>
              <span className="text-[0.72rem] text-muted-2 mono">
                {fmtDate(m.sentAt)}
              </span>
            </div>
            <div className="px-5 py-4 text-[0.93rem] text-text leading-relaxed whitespace-pre-wrap">
              {m.bodyText.trim() || "(no body)"}
            </div>
            {parseAttachments(m.attachments).length > 0 ? (
              <div className="px-5 pb-4 flex flex-wrap gap-2">
                {parseAttachments(m.attachments).map((a, i) => (
                  <span
                    key={i}
                    className="text-[0.78rem] bg-bg-2 border border-line-soft rounded px-2 py-1 text-muted"
                  >
                    📎 {a.filename}
                    {a.size != null
                      ? ` · ${(a.size / 1024).toFixed(1)} KB`
                      : ""}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <ThreadReply
        threadId={thread.id}
        to={thread.participantEmail}
        subject={ensureReSubject(thread.subject)}
        fromAddress={extractAddress(process.env.RESEND_FROM ?? "jordan@jordansakerdev.com")}
        sendAction={sendEmailAction}
      />
    </>
  );
}

function fmtDate(d: Date | string): string {
  const t = typeof d === "string" ? new Date(d) : d;
  return t.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ensureReSubject(s: string): string {
  if (/^re:/i.test(s.trim())) return s;
  return `Re: ${s}`;
}

function extractAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1] : from;
}

function parseAttachments(json: string): Array<{ filename: string; size?: number | null }> {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
