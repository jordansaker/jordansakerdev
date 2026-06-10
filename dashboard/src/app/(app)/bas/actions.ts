"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { parseAmountToCents } from "@/lib/money";

const ExpenseForm = z.object({
  description: z.string().trim().min(1, "Description is required"),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  amount: z.string().trim(),
  hasGst: z.union([z.literal("on"), z.literal("")]).optional(),
});

export async function createExpenseAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const parsed = ExpenseForm.safeParse({
    description: formData.get("description"),
    spentOn: formData.get("spentOn"),
    amount: formData.get("amount"),
    hasGst: formData.get("hasGst") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await db.insert(expenses).values({
    description: parsed.data.description,
    spentOn: parsed.data.spentOn,
    amountCents: parseAmountToCents(parsed.data.amount),
    hasGst: parsed.data.hasGst === "on",
  });
  revalidatePath("/bas");
  return { error: undefined };
}

export async function deleteExpenseAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await db.delete(expenses).where(eq(expenses.id, id));
  revalidatePath("/bas");
}
