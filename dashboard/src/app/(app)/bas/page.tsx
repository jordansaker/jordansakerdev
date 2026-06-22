import Link from "next/link";
import { Empty, PageHead, Panel, Stat, Td, Th } from "@/components/ui";
import { formatCents, formatCents0 } from "@/lib/money";
import { quarterFinancials } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import {
  QUARTER_DUE,
  QUARTER_LABELS,
  currentQuarter,
  quarterFY,
} from "@/lib/quarter";
import { ExpenseForm } from "./expense-form";
import { createExpenseAction, deleteExpenseAction } from "./actions";
import { PendingStatements } from "./pending-statements";
import { uploadStatementAction } from "./upload-action";
import { StatementUploadForm } from "./upload-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "BAS · Studio" };

type SP = Promise<{ q?: string; fy?: string }>;

export default async function BasPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const settings = await getSettings();
  const today = new Date();
  const defaultFy = quarterFY(today);
  const defaultQ = currentQuarter();
  const q = Number.isInteger(Number(sp.q))
    ? (Math.min(3, Math.max(0, Number(sp.q))) as 0 | 1 | 2 | 3)
    : defaultQ;
  const fy = sp.fy && /^\d{4}$/.test(sp.fy) ? Number(sp.fy) : defaultFy;
  const data = await quarterFinancials(q, fy);

  return (
    <>
      <PageHead
        title="BAS"
        subtitle={
          settings.gstRegistered
            ? "GST summary by quarter."
            : "You're marked as not GST registered — toggle it in the sidebar."
        }
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {QUARTER_LABELS.map((label, i) => (
          <Link
            key={i}
            href={`/bas?q=${i}&fy=${fy}`}
            className={`px-4 py-2 rounded-full text-[0.83rem] mono border transition-colors ${
              i === q
                ? "bg-accent-soft border-accent-soft text-accent"
                : "bg-surface border-line-soft text-muted hover:text-text"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="bg-gradient-to-br from-accent-soft to-transparent border border-accent-soft rounded-2xl p-6 mb-5 flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="mono text-[0.66rem] tracking-[0.12em] uppercase text-muted">
            Net GST {data.netGstCents >= 0 ? "payable to ATO" : "refund"} ·{" "}
            {QUARTER_LABELS[q]} {fy}
          </div>
          <div className="font-serif text-[2.6rem] text-accent font-normal leading-none mt-1">
            {formatCents0(Math.abs(data.netGstCents))}
          </div>
        </div>
        <div className="text-right">
          <div className="mono text-[0.66rem] tracking-[0.12em] uppercase text-muted">
            Lodgement due
          </div>
          <div className="font-serif text-[1.5rem] mt-1.5">
            {QUARTER_DUE[q]} {fy}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <Stat
          label="1A · GST on sales"
          value={formatCents0(data.gstCollectedCents)}
          sub={`from ${data.invoices.length} invoices`}
        />
        <Stat
          label="1B · GST on purchases"
          value={formatCents0(data.gstPaidCents)}
          sub={`from ${data.expenses.length} expenses`}
        />
        <Stat
          label="G1 · Total sales"
          value={formatCents0(data.salesCents + data.gstCollectedCents)}
          sub="GST-inclusive"
        />
      </div>

      <Panel title="Sales this quarter" meta="GST collected → label 1A">
        {data.invoices.length === 0 ? (
          <Empty>No invoices in this quarter</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Client</Th>
                  <Th className="text-right">Sale (ex GST)</Th>
                  <Th className="text-right">GST</Th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((i) => (
                  <tr key={i.id} className="hover:bg-surface-2 transition-colors">
                    <Td className="mono whitespace-nowrap">{i.number}</Td>
                    <Td>{i.clientName}</Td>
                    <Td className="mono text-right whitespace-nowrap">{formatCents(i.subtotalCents)}</Td>
                    <Td className="mono text-right text-accent whitespace-nowrap">{formatCents(i.gstCents)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="mt-5">
        <Panel title="Import bank statement" meta="Upload a NAB PDF; review before commit">
          <StatementUploadForm action={uploadStatementAction} />
          <PendingStatements />
        </Panel>
      </div>

      <div className="mt-5">
        <Panel title="Expenses this quarter" meta="GST paid → label 1B">
          <ExpenseForm action={createExpenseAction} />
          {data.expenses.length === 0 ? (
            <Empty>No expenses in this quarter</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <Th>Expense</Th>
                    <Th>Date</Th>
                    <Th className="text-right">Amount (ex GST)</Th>
                    <Th className="text-right">GST</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-surface-2 transition-colors">
                      <Td>{e.description}</Td>
                      <Td className="mono text-muted whitespace-nowrap">{e.spentOn}</Td>
                      <Td className="mono text-right whitespace-nowrap">{formatCents(e.amountCents)}</Td>
                      <Td className="mono text-right text-accent-2 whitespace-nowrap">
                        {e.hasGst ? formatCents(Math.round(e.amountCents * 0.1)) : "—"}
                      </Td>
                      <Td className="text-right">
                        <form action={deleteExpenseAction} className="inline">
                          <input type="hidden" name="id" value={e.id} />
                          <button type="submit" className="text-[0.78rem] text-muted-2 hover:text-red">
                            Delete
                          </button>
                        </form>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <p className="text-[0.78rem] text-muted-2 mt-4 leading-relaxed">
        Simplified illustration of the GST portion of a quarterly BAS. Real BAS may also include
        PAYG and other obligations — confirm with your accountant.
      </p>
    </>
  );
}
