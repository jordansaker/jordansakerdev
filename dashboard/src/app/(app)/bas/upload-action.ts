"use server";

import { createHash } from "node:crypto";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
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
    return { ok: false, error: "Parser found no transactions in the CSV" };
  }

  // Detect overlap with previously-imported statements: any debit/credit that
  // already produced an expense or matched an invoice should be pre-flagged so
  // the review table deselects it by default (user can override).
  const prior =
    parsed.periodStart && parsed.periodEnd
      ? await db
          .select({
            txDate: bankTransactions.txDate,
            amountCents: bankTransactions.amountCents,
            direction: bankTransactions.direction,
            description: bankTransactions.description,
          })
          .from(bankTransactions)
          .where(
            and(
              gte(bankTransactions.txDate, parsed.periodStart),
              lte(bankTransactions.txDate, parsed.periodEnd),
              inArray(bankTransactions.status, ["imported", "matched"]),
            ),
          )
      : [];
  const dupKey = (
    d: string,
    cents: number,
    dir: "credit" | "debit",
    desc: string,
  ) => `${d}|${cents}|${dir}|${desc}`;
  const priorKeys = new Set(
    prior.map((p) => dupKey(p.txDate, p.amountCents, p.direction, p.description)),
  );

  // Match invoices for credit rows BEFORE entering the transaction so a flaky
  // match query can't half-insert anything.
  const txWithMatches: Array<{
    tx: (typeof parsed.transactions)[number];
    matchedInvoiceId: number | null;
    isDuplicate: boolean;
  }> = [];
  for (const tx of parsed.transactions) {
    const isDuplicate = priorKeys.has(
      dupKey(tx.date, tx.amountCents, tx.direction, tx.description),
    );
    let matchedInvoiceId: number | null = null;
    if (tx.direction === "credit" && !isDuplicate) {
      try {
        const match = await matchInvoice(tx.date, tx.amountCents);
        matchedInvoiceId = match?.invoiceId ?? null;
      } catch {
        matchedInvoiceId = null;
      }
    }
    txWithMatches.push({ tx, matchedInvoiceId, isDuplicate });
  }

  let statementId: number;
  try {
    statementId = await db.transaction(async (sx) => {
      const [statement] = await sx
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

      await sx.insert(bankTransactions).values(
        txWithMatches.map(({ tx, matchedInvoiceId, isDuplicate }, i) => ({
          statementId: statement.id,
          txDate: tx.date,
          description: tx.description,
          amountCents: tx.amountCents,
          direction: tx.direction,
          balanceCents: tx.balanceCents,
          status: (isDuplicate
            ? "ignored"
            : matchedInvoiceId
              ? "matched"
              : "pending") as "ignored" | "matched" | "pending",
          matchedInvoiceId,
          hasGstGuess: !isDuplicate && tx.direction === "debit",
          sortOrder: i,
        })),
      );

      return statement.id;
    });
  } catch (err) {
    console.error("[uploadStatement] DB transaction failed", err);
    return {
      ok: false,
      error:
        "Database write failed while saving the parsed statement. Try again or check the server logs.",
    };
  }

  redirect(`/bas/import/${statementId}`);
}
