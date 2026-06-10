"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  invoiceLines,
  invoices,
  quoteLines,
  quoteStatus,
  quotes,
  settings,
} from "@/db/schema";
import { getSettings } from "@/lib/settings";

const LineSchema = z.object({
  description: z.string().trim().min(1, "Each line needs a description"),
  quantity: z.coerce.number().min(0).default(1),
  unitPriceCents: z.coerce.number().int().min(0),
});

const QuoteFormSchema = z.object({
  clientId: z.coerce.number().int().positive("Pick a client"),
  notes: z.string().trim().optional(),
  lines: z.array(LineSchema).min(1, "Add at least one line item"),
  asInvoice: z.coerce.boolean().default(false),
});

type Input = z.input<typeof QuoteFormSchema>;
type Output = z.output<typeof QuoteFormSchema>;

export type SaveQuoteResult =
  | { ok: true; kind: "quote"; id: number; number: string }
  | { ok: true; kind: "invoice"; id: number; number: string }
  | { ok: false; error: string };

export async function saveQuoteAction(input: Input): Promise<SaveQuoteResult> {
  const parsed = QuoteFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data: Output = parsed.data;
  const s = await getSettings();
  const today = new Date().toISOString().slice(0, 10);

  if (data.asInvoice) {
    const result = await db.transaction(async (tx) => {
      const [{ invoiceSeq }] = await tx
        .update(settings)
        .set({ invoiceSeq: sql`${settings.invoiceSeq} + 1` })
        .where(eq(settings.id, 1))
        .returning({ invoiceSeq: settings.invoiceSeq });
      const number = `INV-${String(invoiceSeq).padStart(4, "0")}`;
      const [inv] = await tx
        .insert(invoices)
        .values({
          number,
          clientId: data.clientId,
          issueDate: today,
          status: "draft",
          gstRegistered: s.gstRegistered,
          notes: data.notes,
        })
        .returning({ id: invoices.id, number: invoices.number });
      await tx.insert(invoiceLines).values(
        data.lines.map((l, idx) => ({
          invoiceId: inv.id,
          description: l.description,
          quantity: l.quantity.toString(),
          unitPriceCents: l.unitPriceCents,
          sortOrder: idx,
        })),
      );
      return inv;
    });
    revalidatePath("/invoices");
    revalidatePath("/");
    return { ok: true, kind: "invoice", id: result.id, number: result.number };
  }

  const result = await db.transaction(async (tx) => {
    const [{ quoteSeq }] = await tx
      .update(settings)
      .set({ quoteSeq: sql`${settings.quoteSeq} + 1` })
      .where(eq(settings.id, 1))
      .returning({ quoteSeq: settings.quoteSeq });
    const number = `QT-${String(quoteSeq).padStart(3, "0")}`;
    const [q] = await tx
      .insert(quotes)
      .values({
        number,
        clientId: data.clientId,
        issueDate: today,
        status: "pending",
        gstRegistered: s.gstRegistered,
        notes: data.notes,
      })
      .returning({ id: quotes.id, number: quotes.number });
    await tx.insert(quoteLines).values(
      data.lines.map((l, idx) => ({
        quoteId: q.id,
        description: l.description,
        quantity: l.quantity.toString(),
        unitPriceCents: l.unitPriceCents,
        sortOrder: idx,
      })),
    );
    return q;
  });
  revalidatePath("/quotes");
  return { ok: true, kind: "quote", id: result.id, number: result.number };
}

const StatusSchema = z.enum(quoteStatus.enumValues);

export async function cycleQuoteStatusAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const [row] = await db
    .select({ status: quotes.status })
    .from(quotes)
    .where(eq(quotes.id, id))
    .limit(1);
  if (!row) return;
  const order = StatusSchema.options;
  const next = order[(order.indexOf(row.status) + 1) % order.length];
  await db.update(quotes).set({ status: next }).where(eq(quotes.id, id));
  revalidatePath("/quotes");
}

export async function convertQuoteToInvoiceAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const s = await getSettings();
  const [q] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!q) return;
  const ls = await db
    .select()
    .from(quoteLines)
    .where(eq(quoteLines.quoteId, id));

  const result = await db.transaction(async (tx) => {
    const [{ invoiceSeq }] = await tx
      .update(settings)
      .set({ invoiceSeq: sql`${settings.invoiceSeq} + 1` })
      .where(eq(settings.id, 1))
      .returning({ invoiceSeq: settings.invoiceSeq });
    const number = `INV-${String(invoiceSeq).padStart(4, "0")}`;
    const [inv] = await tx
      .insert(invoices)
      .values({
        number,
        clientId: q.clientId,
        issueDate: new Date().toISOString().slice(0, 10),
        status: "draft",
        gstRegistered: s.gstRegistered,
        fromQuoteId: q.id,
        notes: q.notes,
      })
      .returning({ id: invoices.id, number: invoices.number });
    await tx.insert(invoiceLines).values(
      ls.map((l, idx) => ({
        invoiceId: inv.id,
        description: l.description,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        sortOrder: idx,
      })),
    );
    await tx.update(quotes).set({ status: "accepted" }).where(eq(quotes.id, q.id));
    return inv;
  });
  revalidatePath("/invoices");
  revalidatePath("/quotes");
  redirect(`/invoices`);
}

export async function deleteQuoteAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await db.delete(quotes).where(eq(quotes.id, id));
  revalidatePath("/quotes");
}
