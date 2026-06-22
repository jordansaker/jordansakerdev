"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  bankStatements,
  bankTransactions,
  expenses,
  invoices,
} from "@/db/schema";

const SelectionSchema = z.object({
  txId: z.coerce.number().int().positive(),
  selected: z.boolean(),
  description: z.string().trim().min(1),
  hasGst: z.boolean(),
  matchedInvoiceId: z.number().int().positive().nullable(),
  confirmMatch: z.boolean(),
});

const CommitSchema = z.object({
  statementId: z.number().int().positive(),
  selections: z.array(SelectionSchema),
});

export type CommitInput = z.input<typeof CommitSchema>;
export type CommitResult =
  | {
      ok: true;
      expensesCreated: number;
      invoicesMarkedPaid: number;
      ignored: number;
    }
  | { ok: false; error: string };

export async function commitImportAction(input: CommitInput): Promise<CommitResult> {
  const parsed = CommitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { statementId, selections } = parsed.data;

  const [statement] = await db
    .select({ id: bankStatements.id, importedAt: bankStatements.importedAt })
    .from(bankStatements)
    .where(eq(bankStatements.id, statementId))
    .limit(1);
  if (!statement) return { ok: false, error: "Statement not found" };
  if (statement.importedAt) {
    return { ok: false, error: "Statement was already imported" };
  }

  const txRows = await db
    .select()
    .from(bankTransactions)
    .where(eq(bankTransactions.statementId, statementId));
  const byId = new Map(txRows.map((r) => [r.id, r]));

  let expensesCreated = 0;
  let invoicesMarkedPaid = 0;
  let ignored = 0;

  await db.transaction(async (tx) => {
    for (const sel of selections) {
      const row = byId.get(sel.txId);
      if (!row) continue;

      if (!sel.selected) {
        await tx
          .update(bankTransactions)
          .set({ status: "ignored" })
          .where(eq(bankTransactions.id, row.id));
        ignored++;
        continue;
      }

      if (row.direction === "debit") {
        const exGstCents = sel.hasGst
          ? Math.round(row.amountCents / 1.1)
          : row.amountCents;
        const [expense] = await tx
          .insert(expenses)
          .values({
            description: sel.description,
            spentOn: row.txDate,
            amountCents: exGstCents,
            hasGst: sel.hasGst,
          })
          .returning({ id: expenses.id });
        await tx
          .update(bankTransactions)
          .set({ status: "imported", matchedExpenseId: expense.id })
          .where(eq(bankTransactions.id, row.id));
        expensesCreated++;
        continue;
      }

      // Credit
      if (sel.confirmMatch && sel.matchedInvoiceId) {
        await tx
          .update(invoices)
          .set({ status: "paid", paidAt: new Date() })
          .where(eq(invoices.id, sel.matchedInvoiceId));
        await tx
          .update(bankTransactions)
          .set({ status: "matched", matchedInvoiceId: sel.matchedInvoiceId })
          .where(eq(bankTransactions.id, row.id));
        invoicesMarkedPaid++;
      } else {
        // Credit selected but no match confirmed — treat as ignored (no expense, no payment)
        await tx
          .update(bankTransactions)
          .set({ status: "ignored" })
          .where(eq(bankTransactions.id, row.id));
        ignored++;
      }
    }

    await tx
      .update(bankStatements)
      .set({ importedAt: sql`now()` })
      .where(eq(bankStatements.id, statementId));
  });

  revalidatePath("/bas");
  revalidatePath("/invoices");
  revalidatePath("/");

  return { ok: true, expensesCreated, invoicesMarkedPaid, ignored };
}

export async function discardStatementAction(formData: FormData) {
  const id = Number(formData.get("statementId"));
  if (!Number.isInteger(id)) return;
  await db.delete(bankStatements).where(eq(bankStatements.id, id));
  revalidatePath("/bas");
  redirect("/bas");
}
