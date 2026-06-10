"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clients } from "@/db/schema";

const ClientForm = z.object({
  name: z.string().trim().min(1, "Name is required"),
  abn: z.string().trim().optional(),
  email: z.union([z.literal(""), z.email()]).optional(),
  address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

function values(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    abn: (formData.get("abn") as string) || undefined,
    email: (formData.get("email") as string) || "",
    address: (formData.get("address") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  };
}

export async function createClientAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const parsed = ClientForm.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { email, ...rest } = parsed.data;
  await db.insert(clients).values({
    ...rest,
    email: email || null,
  });
  revalidatePath("/clients");
  return { error: undefined };
}

export async function updateClientAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid id" };
  const parsed = ClientForm.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { email, ...rest } = parsed.data;
  await db
    .update(clients)
    .set({ ...rest, email: email || null })
    .where(eq(clients.id, id));
  revalidatePath("/clients");
  return { error: undefined };
}

export async function deleteClientAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  try {
    await db.delete(clients).where(eq(clients.id, id));
  } catch (err) {
    // FK violation: client has invoices/quotes
    console.error("delete client failed", err);
  }
  revalidatePath("/clients");
}
