import Link from "next/link";
import { Empty, PageHead, Panel, Tag, Td, Th } from "@/components/ui";
import { createAuditAction, listAudits } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audits · Studio" };

export default async function AuditListPage() {
  const rows = await listAudits();
  return (
    <>
      <PageHead
        title="Audits"
        subtitle="Branded performance reviews for prospects. Edit, download, or send via email."
        right={
          <form action={createAuditAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-accent text-bg font-semibold text-[0.88rem] px-4 py-2.5 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)] transition-all"
            >
              + New audit
            </button>
          </form>
        }
      />

      <Panel>
        {rows.length === 0 ? (
          <Empty>No audits yet — create your first.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>URL</Th>
                  <Th className="text-right">Score</Th>
                  <Th className="text-right">Fee</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Updated</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-2 transition-colors">
                    <Td>
                      <Link
                        href={`/audit/${a.id}`}
                        className="text-text hover:text-accent transition-colors"
                      >
                        {a.client}
                      </Link>
                    </Td>
                    <Td className="mono text-muted">{a.url}</Td>
                    <Td className="mono text-right">{a.score ?? "—"}</Td>
                    <Td className="mono text-right">
                      {a.fee ? `$${a.fee}` : "—"}
                    </Td>
                    <Td>
                      {a.sentAt ? (
                        <Tag variant="sent">sent</Tag>
                      ) : (
                        <Tag variant="draft">draft</Tag>
                      )}
                    </Td>
                    <Td className="mono text-right text-muted whitespace-nowrap">
                      {timeAgo(a.updatedAt)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
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
