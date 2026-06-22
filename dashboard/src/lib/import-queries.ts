import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bankStatements, bankTransactions, invoices } from "@/db/schema";

export type ImportTransaction = {
  id: number;
  txDate: string;
  description: string;
  amountCents: number;
  direction: "credit" | "debit";
  balanceCents: number | null;
  status: "pending" | "imported" | "ignored" | "matched";
  hasGstGuess: boolean;
  matchedInvoiceId: number | null;
  matchedInvoiceNumber: string | null;
};

export async function getImportData(statementId: number) {
  const [statement] = await db
    .select()
    .from(bankStatements)
    .where(eq(bankStatements.id, statementId))
    .limit(1);
  if (!statement) return null;

  const rows = await db
    .select({
      id: bankTransactions.id,
      txDate: bankTransactions.txDate,
      description: bankTransactions.description,
      amountCents: bankTransactions.amountCents,
      direction: bankTransactions.direction,
      balanceCents: bankTransactions.balanceCents,
      status: bankTransactions.status,
      hasGstGuess: bankTransactions.hasGstGuess,
      matchedInvoiceId: bankTransactions.matchedInvoiceId,
      matchedInvoiceNumber: invoices.number,
    })
    .from(bankTransactions)
    .leftJoin(invoices, eq(invoices.id, bankTransactions.matchedInvoiceId))
    .where(eq(bankTransactions.statementId, statementId))
    .orderBy(asc(bankTransactions.sortOrder), asc(bankTransactions.id));

  return { statement, rows };
}
