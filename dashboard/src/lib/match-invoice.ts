import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, invoiceLines, invoices } from "@/db/schema";
import { gstCents, lineSubtotalCents } from "./money";

const AMOUNT_TOLERANCE_CENTS = 50; // $0.50
const DATE_WINDOW_DAYS = 21;

export type InvoiceMatch = {
  invoiceId: number;
  number: string;
  clientName: string;
  issueDate: string;
  totalCents: number;
  delta: number;
};

/**
 * Find an unpaid invoice whose total is within $0.50 of `amountCents` and whose
 * issue date is within ±21 days of `txDate` (ISO). Returns the closest match by
 * date distance, or null.
 */
export async function matchInvoice(
  txDate: string,
  amountCents: number,
): Promise<InvoiceMatch | null> {
  const candidates = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientName: clients.name,
      issueDate: invoices.issueDate,
      gstRegistered: invoices.gstRegistered,
      status: invoices.status,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(
      and(
        sql`${invoices.status} IN ('sent', 'overdue', 'draft')`,
        sql`${invoices.issueDate} BETWEEN ${txDate}::date - ${DATE_WINDOW_DAYS} AND ${txDate}::date + ${DATE_WINDOW_DAYS}`,
      ),
    )
    .orderBy(asc(invoices.issueDate));

  if (!candidates.length) return null;

  const ids = candidates.map((c) => c.id);
  const lines = await db
    .select()
    .from(invoiceLines)
    .where(sql`${invoiceLines.invoiceId} IN ${ids}`);

  let best: InvoiceMatch | null = null;
  for (const c of candidates) {
    const ls = lines.filter((l) => l.invoiceId === c.id);
    const sub = lineSubtotalCents(ls);
    const total = sub + gstCents(sub, c.gstRegistered);
    if (Math.abs(total - amountCents) > AMOUNT_TOLERANCE_CENTS) continue;
    const dateDelta = Math.abs(
      (new Date(c.issueDate).getTime() - new Date(txDate).getTime()) / 86_400_000,
    );
    if (!best || dateDelta < Math.abs(best.delta)) {
      best = {
        invoiceId: c.id,
        number: c.number,
        clientName: c.clientName,
        issueDate: c.issueDate,
        totalCents: total,
        delta: dateDelta,
      };
    }
  }
  return best;
}
