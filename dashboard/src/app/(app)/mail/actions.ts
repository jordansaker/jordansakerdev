"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { z } from "zod";
import { db } from "@/db";
import { emailMessages } from "@/db/schema";
import { renderBrandEmail, renderBrandText } from "@/lib/email-template";
import {
  buildReferences,
  bumpThread,
  findOrCreateThread,
  getLastOutboundOfThread,
  newMessageId,
} from "@/lib/threading";

const FROM_FALLBACK = "Jordan Saker <invoices@jordansakerdev.com>";

const SendSchema = z.object({
  to: z.email("Enter a valid recipient email"),
  clientId: z
    .string()
    .optional()
    .transform((v) => (v && /^\d+$/.test(v) ? Number(v) : null)),
  subject: z.string().trim().min(1, "Subject is required"),
  body: z.string().trim().min(1, "Body is required"),
  threadId: z
    .string()
    .optional()
    .transform((v) => (v && /^\d+$/.test(v) ? Number(v) : null)),
});

export type SendEmailResult =
  | { ok: true; id: number; threadId: number }
  | { ok: false; error: string };

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export async function sendEmailAction(formData: FormData): Promise<SendEmailResult> {
  const parsed = SendSchema.safeParse({
    to: formData.get("to"),
    clientId: formData.get("clientId") ?? undefined,
    subject: formData.get("subject"),
    body: formData.get("body"),
    threadId: formData.get("threadId") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { to, subject, body, threadId } = parsed.data;

  const fileEntries = formData
    .getAll("attachments")
    .filter((v): v is File => v instanceof File && v.size > 0);

  let totalBytes = 0;
  for (const f of fileEntries) {
    if (f.size > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: `Attachment "${f.name}" exceeds 10MB` };
    }
    totalBytes += f.size;
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return { ok: false, error: "Attachments total over 20MB — Resend won't accept that" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || FROM_FALLBACK;

  // Threading: if this is a reply (threadId given), use that thread + chain headers.
  // Otherwise find-or-create a fresh thread keyed by recipient + subject.
  let inReplyTo: string | null = null;
  let referencesHeader: string | null = null;
  let resolvedThreadId: number;
  if (threadId) {
    const last = await getLastOutboundOfThread(threadId);
    if (last) {
      inReplyTo = last.messageIdHeader;
      referencesHeader = buildReferences(last.referencesHeader, last.messageIdHeader);
    }
    resolvedThreadId = threadId;
  } else {
    const t = await findOrCreateThread({
      inReplyTo: null,
      references: null,
      subject,
      participantEmail: to,
      clientEmail: to,
    });
    resolvedThreadId = t.id;
  }

  const messageId = newMessageId();
  const html = renderBrandEmail({ body });
  const text = renderBrandText({ body });

  let resendError: string | null = null;
  if (!apiKey) {
    resendError = "RESEND_API_KEY is not set — set it in .env.local to actually send";
  } else {
    try {
      const attachments = await Promise.all(
        fileEntries.map(async (f) => ({
          filename: f.name,
          content: Buffer.from(await f.arrayBuffer()),
        })),
      );
      const headers: Record<string, string> = { "Message-Id": messageId };
      if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
      if (referencesHeader) headers["References"] = referencesHeader;

      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from,
        to,
        replyTo: "jordan@jordansakerdev.com",
        subject,
        text,
        html,
        headers,
        attachments: attachments.length ? attachments : undefined,
      });
      if (result.error) resendError = result.error.message;
    } catch (err) {
      console.error("Resend send failed", err);
      resendError = err instanceof Error ? err.message : "Send failed";
    }
  }

  const attachmentMeta = fileEntries.map((f) => ({
    filename: f.name,
    size: f.size,
    type: f.type,
  }));

  const [row] = await db
    .insert(emailMessages)
    .values({
      threadId: resolvedThreadId,
      direction: "outbound",
      messageIdHeader: messageId,
      inReplyTo,
      referencesHeader,
      fromAddress: from,
      toAddress: to,
      subject,
      bodyText: text,
      bodyHtml: html,
      attachments: JSON.stringify(attachmentMeta),
      status: resendError ? "failed" : "sent",
      errorMessage: resendError,
    })
    .returning({ id: emailMessages.id });

  await bumpThread(resolvedThreadId);

  revalidatePath("/mail");
  revalidatePath(`/mail/${resolvedThreadId}`);

  if (resendError) return { ok: false, error: resendError };
  return { ok: true, id: row.id, threadId: resolvedThreadId };
}

export async function recentSentEmails(limit = 6) {
  return db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.direction, "outbound"))
    .orderBy(desc(emailMessages.sentAt))
    .limit(limit);
}
