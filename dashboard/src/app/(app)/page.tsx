import Link from "next/link";
import { Empty, LinkButton, PageHead, Panel, Stat, Tag, Td, Th } from "@/components/ui";
import { formatCents, formatCents0 } from "@/lib/money";
import { listInvoices, overviewStats } from "@/lib/queries";
import { QUARTER_DUE, QUARTER_LABELS } from "@/lib/quarter";
import type { TagVariant } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [stats, invoices] = await Promise.all([overviewStats(), listInvoices()]);
  const recent = invoices.slice(0, 4);
  const qLabel = QUARTER_LABELS[stats.quarter];
  return (
    <>
      <PageHead
        title="Overview"
        subtitle={`Quarter to date — ${qLabel} ${stats.fy}`}
        right={<LinkButton href="/quotes">+ New quote</LinkButton>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Stat
          label="Outstanding"
          accent
          value={formatCents0(stats.outstandingCents)}
          sub={`${stats.unpaidCount} unpaid ${stats.unpaidCount === 1 ? "invoice" : "invoices"}`}
        />
        <Stat
          label="Paid this quarter"
          value={formatCents0(stats.paidThisQuarterCents)}
          sub="incl. GST"
        />
        <Stat
          label="GST collected (Q)"
          value={formatCents0(stats.gstCollectedCents)}
          sub="on sales this quarter"
        />
        <Stat
          label="Next BAS due"
          value={QUARTER_DUE[stats.quarter]}
          sub={`${qLabel} ${stats.fy}`}
        />
      </div>

      <Panel
        title="Recent invoices"
        right={
          <Link
            href="/invoices"
            className="rounded-lg border border-line px-3 py-1.5 text-[0.8rem] hover:border-text transition-colors"
          >
            View all
          </Link>
        }
      >
        {recent.length === 0 ? (
          <Empty>No invoices yet — create your first one from a quote.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Client</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((i) => (
                  <tr key={i.id} className="hover:bg-surface-2 transition-colors">
                    <Td className="mono whitespace-nowrap">
                    {i.number ?? <span className="text-muted-2">Draft</span>}
                  </Td>
                    <Td>{i.clientName}</Td>
                    <Td className="mono text-muted whitespace-nowrap">{i.issueDate}</Td>
                    <Td>
                      <Tag variant={i.status as TagVariant}>{i.status}</Tag>
                    </Td>
                    <Td className="mono text-right font-medium whitespace-nowrap">
                      {formatCents(i.totalCents)}
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
