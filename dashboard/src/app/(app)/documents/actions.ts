"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { documents } from "@/db/schema";

export async function createDocumentAction() {
  const [row] = await db
    .insert(documents)
    .values({})
    .returning({ id: documents.id });
  revalidatePath("/documents");
  redirect(`/documents?id=${row.id}`);
}

const SaveSchema = z.object({
  id: z.coerce.number().int().positive(),
  title: z.string().max(200).optional(),
  contentJson: z.string().max(2_000_000).optional(),
  contentHtml: z.string().max(2_000_000).optional(),
});

export async function saveDocumentAction(input: z.input<typeof SaveSchema>) {
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const { id, title, contentJson, contentHtml } = parsed.data;
  await db
    .update(documents)
    .set({
      ...(title !== undefined ? { title: title.trim() || "Untitled document" } : {}),
      ...(contentJson !== undefined ? { contentJson } : {}),
      ...(contentHtml !== undefined ? { contentHtml } : {}),
      updatedAt: sql`now()`,
    })
    .where(eq(documents.id, id));
  return { ok: true as const };
}

export async function deleteDocumentAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await db.delete(documents).where(eq(documents.id, id));
  revalidatePath("/documents");
  redirect("/documents");
}
