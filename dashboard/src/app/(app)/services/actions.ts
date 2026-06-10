"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { services } from "@/db/schema";
import { parseAmountToCents } from "@/lib/money";

const Unit = z.enum(["fixed", "hourly", "monthly"]);

const ServiceForm = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().default(""),
  price: z.string().trim(),
  unit: Unit,
});

export async function createServiceAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const parsed = ServiceForm.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    price: formData.get("price"),
    unit: formData.get("unit"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const priceCents = parseAmountToCents(parsed.data.price);
  await db.insert(services).values({
    name: parsed.data.name,
    description: parsed.data.description,
    priceCents,
    unit: parsed.data.unit,
    sortOrder: Date.now() % 1_000_000,
  });
  revalidatePath("/services");
  return { error: undefined };
}

export async function updateServiceAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid id" };
  const parsed = ServiceForm.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    price: formData.get("price"),
    unit: formData.get("unit"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await db
    .update(services)
    .set({
      name: parsed.data.name,
      description: parsed.data.description,
      priceCents: parseAmountToCents(parsed.data.price),
      unit: parsed.data.unit,
    })
    .where(eq(services.id, id));
  revalidatePath("/services");
  return { error: undefined };
}

export async function deleteServiceAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await db.delete(services).where(eq(services.id, id));
  revalidatePath("/services");
}
