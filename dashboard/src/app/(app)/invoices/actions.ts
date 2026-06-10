"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { invoiceStatus, invoices } from "@/db/schema";

const order = invoiceStatus.enumValues;

export async function updateInvoiceIssueDateAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const id = Number(formData.get("id"));
  const value = String(formData.get("value") ?? "");
  if (!Number.isInteger(id)) return { ok: false, error: "Invalid id" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, error: "Invalid date" };

  const [row] = await db
    .select({ status: invoices.status })
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!row) return { ok: false, error: "Invoice not found" };
  if (row.status !== "draft") {
    return { ok: false, error: "Only draft invoices can be edited" };
  }
  await db.update(invoices).set({ issueDate: value }).where(eq(invoices.id, id));
  revalidatePath("/invoices");
  revalidatePath("/");
  return { ok: true };
}

export async function cycleInvoiceStatusAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const [row] = await db
    .select({ status: invoices.status })
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!row) return;
  const next = order[(order.indexOf(row.status) + 1) % order.length];
  const update: { status: typeof next; paidAt?: Date | null } = { status: next };
  if (next === "paid") update.paidAt = new Date();
  if (next === "draft") update.paidAt = null;
  await db.update(invoices).set(update).where(eq(invoices.id, id));
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function deleteInvoiceAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await db.delete(invoices).where(eq(invoices.id, id));
  revalidatePath("/invoices");
  revalidatePath("/");
}
