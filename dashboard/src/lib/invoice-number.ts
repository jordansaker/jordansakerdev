import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";

const TRAILING_DIGITS = /(\d+)$/;

export function nextInvoiceNumberFrom(currentMax: string | null): string {
  let n = 0;
  if (currentMax) {
    const m = currentMax.match(TRAILING_DIGITS);
    if (m) n = Number(m[1]);
  }
  return `INV-${String(n + 1).padStart(4, "0")}`;
}

/**
 * Assigns the next invoice number to this invoice if it doesn't already have one.
 * Returns the assigned (or pre-existing) number. Idempotent.
 *
 * Numbering = max(existing invoice numbers) + 1, so deleting the most recent
 * invoice frees up its number for the next publish. Existing numbers are
 * never renumbered.
 */
export async function publishInvoiceNumber(invoiceId: number): Promise<string> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ number: invoices.number })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    if (!row) throw new Error("Invoice not found");
    if (row.number) return row.number;

    const [{ max }] = await tx
      .select({ max: sql<string | null>`max(${invoices.number})` })
      .from(invoices);
    const next = nextInvoiceNumberFrom(max);
    await tx
      .update(invoices)
      .set({ number: next })
      .where(eq(invoices.id, invoiceId));
    return next;
  });
}
