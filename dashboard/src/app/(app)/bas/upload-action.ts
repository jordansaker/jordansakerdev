"use server";

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { bankStatements, bankTransactions } from "@/db/schema";
import { matchInvoice } from "@/lib/match-invoice";
import { parseStatement } from "@/lib/parse-bank-statement";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB — CSVs are small

export type UploadResult =
  | { ok: true; statementId: number; transactionCount: number }
  | { ok: false; error: string };

export async function uploadStatementAction(
  formData: FormData,
): Promise<UploadResult> {
  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a CSV file to upload" };
  }
  if (
    file.type &&
    !file.type.includes("csv") &&
    !file.type.includes("text") &&
    !file.type.includes("excel") &&
    file.type !== ""
  ) {
    return { ok: false, error: "File must be a CSV" };
  }
  if (!/\.csv$/i.test(file.name)) {
    return { ok: false, error: "File must have a .csv extension" };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "CSV exceeds 5MB" };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(bytes).digest("hex");

  // Dedupe: if this exact PDF was uploaded before, jump to its review page.
  const [existing] = await db
    .select({ id: bankStatements.id, importedAt: bankStatements.importedAt })
    .from(bankStatements)
    .where(eq(bankStatements.contentHash, contentHash))
    .limit(1);
  if (existing) {
    if (existing.importedAt) {
      return {
        ok: false,
        error: `This statement was already imported on ${existing.importedAt.toISOString().slice(0, 10)}`,
      };
    }
    redirect(`/bas/import/${existing.id}`);
  }

  let parsed;
  try {
    parsed = await parseStatement(bytes);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to parse statement",
    };
  }

  if (!parsed.transactions.length) {
    return { ok: false, error: "Parser found no transactions in this PDF" };
  }

  const [statement] = await db
    .insert(bankStatements)
    .values({
      filename: file.name,
      contentHash,
      bsb: parsed.bsb,
      accountNumber: parsed.accountNumber,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      openingBalanceCents: parsed.openingBalanceCents,
      closingBalanceCents: parsed.closingBalanceCents,
      transactionCount: parsed.transactions.length,
    })
    .returning({ id: bankStatements.id });

  for (let i = 0; i < parsed.transactions.length; i++) {
    const t = parsed.transactions[i];
    let matchedInvoiceId: number | null = null;
    if (t.direction === "credit") {
      const match = await matchInvoice(t.date, t.amountCents);
      matchedInvoiceId = match?.invoiceId ?? null;
    }
    await db.insert(bankTransactions).values({
      statementId: statement.id,
      txDate: t.date,
      description: t.description,
      amountCents: t.amountCents,
      direction: t.direction,
      balanceCents: t.balanceCents,
      status: matchedInvoiceId ? "matched" : "pending",
      matchedInvoiceId,
      hasGstGuess: t.direction === "debit",
      sortOrder: i,
    });
  }

  redirect(`/bas/import/${statement.id}`);
}
