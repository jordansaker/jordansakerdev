"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { audits } from "@/db/schema";
import type { AuditFinding } from "@/db/schema";
import { renderAuditPdf } from "@/lib/pdf/audit-pdf";
import { renderBrandEmail, renderBrandText } from "@/lib/email-template";
import {
  PERFORMANCE_DEFAULTS,
  defaultSectionsFor,
  type AuditSections,
} from "@/lib/audit-templates";

const FindingSchema = z.object({
  title: z.string().trim().min(1),
  paras: z.array(z.string().trim().min(1)),
});

const SectionsSchema = z.object({
  eyebrow: z.string(),
  titleFragment: z.string(),
  lede: z.string(),
  callout: z.object({
    heading: z.string(),
    para1: z.string(),
    para2: z.string(),
  }),
  section1Title: z.string(),
  section2Title: z.string(),
  section2Intro: z.string(),
  section2Outro: z.string(),
  section3Title: z.string(),
  section3Paras: z.array(z.string()),
  section4Title: z.string(),
  priceLabel: z.string(),
  priceFootnote: z.string(),
  signoff: z.string(),
});

const AuditFormSchema = z.object({
  client: z.string().trim().min(1, "Client is required"),
  url: z.string().trim().min(1, "URL is required"),
  template: z.string().trim().default("performance"),
  sections: SectionsSchema,
  score: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v.trim() === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n) : null;
    }),
  fee: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
  findings: z.array(FindingSchema).default([]),
  scope: z.array(z.string().trim().min(1)).default([]),
  recipientEmail: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || v.trim() === "") return null;
      return v.trim();
    }),
});

export type SaveAuditInput = z.input<typeof AuditFormSchema>;

export async function createAuditAction() {
  const [row] = await db
    .insert(audits)
    .values({
      client: "New audit",
      url: "example.com",
      template: "performance",
      sections: JSON.stringify(PERFORMANCE_DEFAULTS),
    })
    .returning({ id: audits.id });
  revalidatePath("/audit");
  redirect(`/audit/${row.id}`);
}

export async function updateAuditAction(
  id: number,
  input: SaveAuditInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(id)) return { ok: false, error: "Invalid id" };
  const parsed = AuditFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  await db
    .update(audits)
    .set({
      client: data.client,
      url: data.url,
      template: data.template,
      sections: JSON.stringify(data.sections),
      score: data.score,
      fee: data.fee,
      findings: JSON.stringify(data.findings),
      scope: JSON.stringify(data.scope),
      recipientEmail: data.recipientEmail,
      updatedAt: new Date(),
    })
    .where(eq(audits.id, id));
  revalidatePath("/audit");
  revalidatePath(`/audit/${id}`);
  return { ok: true };
}

export async function deleteAuditAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await db.delete(audits).where(eq(audits.id, id));
  revalidatePath("/audit");
  redirect("/audit");
}

export async function listAudits() {
  return db.select().from(audits).orderBy(desc(audits.updatedAt));
}

export async function sendAuditEmailAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, error: "Invalid id" };

  const [row] = await db.select().from(audits).where(eq(audits.id, id)).limit(1);
  if (!row) return { ok: false, error: "Audit not found" };
  if (!row.recipientEmail) {
    return {
      ok: false,
      error: "Add a recipient email on the audit before sending.",
    };
  }

  const findings = safeJson<AuditFinding[]>(row.findings, []);
  const scope = safeJson<string[]>(row.scope, []);
  const sections = safeJson<AuditSections>(
    row.sections,
    defaultSectionsFor(row.template),
  );

  let pdf: Buffer;
  try {
    pdf = await renderAuditPdf({
      client: row.client,
      url: row.url,
      score: row.score,
      fee: row.fee,
      sections,
      findings,
      scope,
    });
  } catch (err) {
    console.error("Audit PDF render failed", err);
    return { ok: false, error: "Failed to render PDF" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "RESEND_API_KEY is not set — set it in .env.local to send",
    };
  }

  const subject = `${sections.eyebrow} — ${row.url}`;
  const body = [
    `Hi ${row.client},`,
    ``,
    `Attached is the no-obligation ${sections.eyebrow.toLowerCase()} for ${row.url} — yours to keep regardless of whether we work together.`,
    ``,
    `Happy to walk through any of it on a call.`,
    ``,
    `Thanks,`,
  ].join("\n");

  const html = renderBrandEmail({ body });
  const text = renderBrandText({ body });

  const from = process.env.RESEND_FROM || "Jordan Saker <jordan@jordansakerdev.com>";
  const safeName = row.client.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "audit";

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: row.recipientEmail,
      replyTo: "jordan@jordansakerdev.com",
      subject,
      text,
      html,
      attachments: [
        {
          filename: `${safeName}-${row.template}-review.pdf`,
          content: pdf,
        },
      ],
    });
    if (result.error) {
      return { ok: false, error: result.error.message };
    }
  } catch (err) {
    console.error("Resend send failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }

  await db.update(audits).set({ sentAt: new Date() }).where(eq(audits.id, id));
  revalidatePath("/audit");
  revalidatePath(`/audit/${id}`);
  return { ok: true };
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
