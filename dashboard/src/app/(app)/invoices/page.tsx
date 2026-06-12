import Link from "next/link";
import { Empty, LinkButton, PageHead, Panel, Tag, Td, Th } from "@/components/ui";
import type { TagVariant } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { listInvoices } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { SendInvoiceButton } from "./send-button";
import {
  cycleInvoiceStatusAction,
  deleteInvoiceAction,
  updateInvoiceIssueDateAction,
} from "./actions";
import { EditableInvoiceDate } from "./editable-date";
import { sendInvoiceEmailAction } from "./send-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices · Studio" };

export default async function InvoicesPage() {
  const [invoices, settings] = await Promise.all([listInvoices(), getSettings()]);

  return (
    <>
      <PageHead
        title="Invoices"
        subtitle="Issued and draft tax invoices. Click a status badge to cycle it."
        right={<LinkButton href="/quotes">+ New from quote</LinkButton>}
      />

      <Panel>
        {invoices.length === 0 ? (
          <Empty>No invoices yet — create one from a quote.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Client</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Subtotal</Th>
                  <Th className="text-right">GST</Th>
                  <Th className="text-right">Total</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="hover:bg-surface-2 transition-colors">
                  <Td className="mono">{i.number}</Td>
                  <Td>{i.clientName}</Td>
                  <Td>
                    <EditableInvoiceDate
                      id={i.id}
                      value={i.issueDate}
                      editable={i.status === "draft"}
                      action={updateInvoiceIssueDateAction}
                    />
                  </Td>
                  <Td>
                    <form action={cycleInvoiceStatusAction} className="inline">
                      <input type="hidden" name="id" value={i.id} />
                      <button type="submit" className="bg-transparent border-0 cursor-pointer">
                        <Tag variant={i.status as TagVariant}>{i.status}</Tag>
                      </button>
                    </form>
                  </Td>
                  <Td className="mono text-right text-muted">{formatCents(i.subtotalCents)}</Td>
                  <Td className="mono text-right text-muted">{formatCents(i.gstCents)}</Td>
                  <Td className="mono text-right font-semibold">{formatCents(i.totalCents)}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <Link
                      href={`/api/invoices/${i.id}/pdf`}
                      target="_blank"
                      className="text-[0.78rem] text-accent hover:underline mr-3"
                    >
                      PDF
                    </Link>
                    <SendInvoiceButton id={i.id} sendAction={sendInvoiceEmailAction} />
                    <form action={deleteInvoiceAction} className="inline ml-3">
                      <input type="hidden" name="id" value={i.id} />
                      <button
                        type="submit"
                        className="text-[0.78rem] text-muted-2 hover:text-red"
                      >
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

      <div className="mt-6">
        <Panel title='Every invoice includes — ATO tax invoice fields'>
          <div className="p-5 space-y-1.5">
            {[
              'The words "Tax invoice"',
              `Your name & ABN — ${settings.abn}`,
              "Date of issue & invoice number",
              "Description of each item",
              `GST shown separately${settings.gstRegistered ? "" : " (not shown — not GST registered)"}`,
              "Buyer's identity / ABN for $1,000+",
            ].map((t) => (
              <div key={t} className="flex items-center gap-2.5 text-[0.8rem] text-muted py-1">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="w-[15px] h-[15px] text-green shrink-0"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {t}
              </div>
            ))}
            <p className="text-[0.78rem] text-muted-2 pt-3 leading-relaxed">
              Reflects ATO requirements for valid tax invoices. Confirm specifics with your
              accountant — this prototype isn&apos;t tax advice.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
