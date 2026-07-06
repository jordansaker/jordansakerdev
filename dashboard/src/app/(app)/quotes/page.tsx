import { Empty, PageHead, Panel, Tag, Td, Th } from "@/components/ui";
import { SectionTabs } from "@/components/section-tabs";
import { QUOTES_TABS } from "./tabs";
import { formatCents } from "@/lib/money";
import { listClients, listQuotes, listServices } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import type { TagVariant } from "@/components/ui";
import {
  convertQuoteToInvoiceAction,
  cycleQuoteStatusAction,
  deleteQuoteAction,
  saveQuoteAction,
} from "./actions";
import { QuoteBuilder } from "./quote-builder";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quotes · Studio" };

export default async function QuotesPage() {
  const [clients, services, quotes, settings] = await Promise.all([
    listClients(),
    listServices(),
    listQuotes(),
    getSettings(),
  ]);

  return (
    <>
      <PageHead
        title="Quotes"
        subtitle="Build a custom project quote from standard services plus one-off items."
      />
      <SectionTabs tabs={QUOTES_TABS} />

      {clients.length === 0 ? (
        <div className="bg-surface border border-line-soft rounded-2xl p-8 text-muted">
          Add a client first — visit{" "}
          <a href="/clients" className="text-accent underline">
            Clients
          </a>
          .
        </div>
      ) : (
        <QuoteBuilder
          clients={clients}
          services={services}
          gstRegistered={settings.gstRegistered}
          saveAction={saveQuoteAction}
        />
      )}

      <div className="mt-8">
        <Panel title="Saved quotes">
          {quotes.length === 0 ? (
            <Empty>No quotes saved yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr>
                    <Th>Quote</Th>
                    <Th>Client</Th>
                    <Th>Date</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Total</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-surface-2 transition-colors">
                    <Td className="mono">{q.number}</Td>
                    <Td>{q.clientName}</Td>
                    <Td className="mono text-muted">{q.issueDate}</Td>
                    <Td>
                      <form action={cycleQuoteStatusAction}>
                        <input type="hidden" name="id" value={q.id} />
                        <button type="submit" className="bg-transparent border-0 cursor-pointer">
                          <Tag variant={q.status as TagVariant}>{q.status}</Tag>
                        </button>
                      </form>
                    </Td>
                    <Td className="mono text-right font-medium">{formatCents(q.totalCents)}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {q.status !== "declined" ? (
                        <form action={convertQuoteToInvoiceAction} className="inline">
                          <input type="hidden" name="id" value={q.id} />
                          <button
                            type="submit"
                            className="text-[0.78rem] text-accent hover:underline mr-3"
                          >
                            → Invoice
                          </button>
                        </form>
                      ) : null}
                      <form action={deleteQuoteAction} className="inline">
                        <input type="hidden" name="id" value={q.id} />
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
      </div>
    </>
  );
}
