"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  activityType as activityTypeEnum,
  clientActivities,
  clientStage as clientStageEnum,
  clients,
} from "@/db/schema";
import type { ClientStage } from "@/db/schema";

const ClientFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  abn: z.string().trim().optional(),
  email: z.union([z.literal(""), z.email()]).optional(),
  address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  source: z.string().trim().optional(),
  estimatedValue: z.string().trim().optional(),
  stage: z.enum(clientStageEnum.enumValues).optional(),
});

function values(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    abn: (formData.get("abn") as string) || undefined,
    email: (formData.get("email") as string) || "",
    address: (formData.get("address") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
    source: (formData.get("source") as string) || undefined,
    estimatedValue: (formData.get("estimatedValue") as string) || undefined,
    stage: (formData.get("stage") as ClientStage | null) || undefined,
  };
}

function parseValueToCents(v: string | undefined): number | null {
  if (!v || v.trim() === "") return null;
  const n = Number(v.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export async function createLeadAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = ClientFormSchema.safeParse(values(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, source, estimatedValue, stage, email } = parsed.data;
  try {
    await db.insert(clients).values({
      name,
      source: source ?? null,
      estimatedValueCents: parseValueToCents(estimatedValue),
      stage: stage ?? "new_lead",
      email: email || null,
      sortOrder: Date.now() % 1_000_000,
    });
  } catch (err) {
    if (
      err instanceof Error &&
      /unique|duplicate/i.test(err.message)
    ) {
      return { error: "A client with that name already exists" };
    }
    throw err;
  }
  revalidatePath("/clients");
  return {};
}

export async function updateClientAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid id" };
  const parsed = ClientFormSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { name, abn, email, address, notes, source, estimatedValue, stage } =
    parsed.data;
  await db
    .update(clients)
    .set({
      name,
      abn: abn ?? null,
      email: email || null,
      address: address ?? null,
      notes: notes ?? null,
      source: source ?? null,
      estimatedValueCents: parseValueToCents(estimatedValue),
      ...(stage ? { stage } : {}),
    })
    .where(eq(clients.id, id));
  revalidatePath("/clients");
  revalidatePath("/follow-ups");
  return {};
}

export async function deleteClientAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  try {
    await db.delete(clients).where(eq(clients.id, id));
  } catch (err) {
    console.error("delete client failed", err);
  }
  revalidatePath("/clients");
  revalidatePath("/follow-ups");
}

const MoveSchema = z.object({
  clientId: z.number().int().positive(),
  targetStage: z.enum(clientStageEnum.enumValues),
  beforeId: z.number().int().positive().nullable(),
});

export async function moveClientAction(
  input: z.input<typeof MoveSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = MoveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid move" };
  }
  const { clientId, targetStage, beforeId } = parsed.data;

  await db.transaction(async (tx) => {
    // Pull all clients in target stage in current order, excluding the moving one
    const rows = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(
          eq(clients.stage, targetStage),
          sql`${clients.id} <> ${clientId}`,
        ),
      )
      .orderBy(clients.sortOrder, clients.id);

    const ordered: number[] = [];
    let inserted = false;
    for (const r of rows) {
      if (beforeId !== null && r.id === beforeId && !inserted) {
        ordered.push(clientId);
        inserted = true;
      }
      ordered.push(r.id);
    }
    if (!inserted) ordered.push(clientId); // drop at end

    // Renumber with a fresh gap of 100 so subsequent drags have room
    for (let i = 0; i < ordered.length; i++) {
      await tx
        .update(clients)
        .set({
          sortOrder: (i + 1) * 100,
          ...(ordered[i] === clientId ? { stage: targetStage } : {}),
        })
        .where(eq(clients.id, ordered[i]));
    }
  });

  revalidatePath("/clients");
  return { ok: true };
}

const LogActivitySchema = z.object({
  clientId: z.number().int().positive(),
  type: z.enum(activityTypeEnum.enumValues),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().default(""),
  followUpDue: z
    .string()
    .nullable()
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "Invalid follow-up date",
    }),
});

export type LogActivityInput = z.input<typeof LogActivitySchema>;

export async function logActivityAction(
  input: LogActivityInput,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = LogActivitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { clientId, type, activityDate, note, followUpDue } = parsed.data;
  await db.insert(clientActivities).values({
    clientId,
    type,
    activityDate,
    note,
    followUpDue,
  });
  revalidatePath("/clients");
  revalidatePath("/follow-ups");
  return { ok: true };
}

export async function markFollowUpDoneAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const activityId = Number(formData.get("activityId"));
  if (!Number.isInteger(activityId)) return { ok: false, error: "Invalid id" };
  await db
    .update(clientActivities)
    .set({ followUpDoneAt: new Date() })
    .where(
      and(
        eq(clientActivities.id, activityId),
        isNull(clientActivities.followUpDoneAt),
      ),
    );
  revalidatePath("/clients");
  revalidatePath("/follow-ups");
  return { ok: true };
}

export async function deleteActivityAction(formData: FormData) {
  const id = Number(formData.get("activityId"));
  if (!Number.isInteger(id)) return;
  await db.delete(clientActivities).where(eq(clientActivities.id, id));
  revalidatePath("/clients");
  revalidatePath("/follow-ups");
}
