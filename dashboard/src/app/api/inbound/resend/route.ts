import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { db } from "@/db";
import { emailMessages } from "@/db/schema";
import { fetchInboundEmail, pickHeader } from "@/lib/resend-inbound";
import { bumpThread, findOrCreateThread } from "@/lib/threading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resend Inbound webhook handler.
 *
 * Resend signs deliveries with Svix. The `email.received` event only carries
 * metadata (from/to/subject/email_id); we follow up with
 * GET /emails/receiving/{email_id} for the body + full header set, which is
 * where Message-Id / In-Reply-To / References live for threading.
 */

type AnyObj = Record<string, unknown>;

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[inbound] RESEND_WEBHOOK_SECRET missing — refusing webhook");
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  let payload: AnyObj;
  try {
    const wh = new Webhook(secret);
    payload = wh.verify(rawBody, headers) as AnyObj;
  } catch (err) {
    console.error("[inbound] signature verification failed", err);
    return new NextResponse("Bad signature", { status: 400 });
  }

  const type = String(payload.type ?? "");
  if (!type.startsWith("email.received") && type !== "inbound.email") {
    return NextResponse.json({ ok: true, ignored: type });
  }

  const data = (payload.data ?? payload) as AnyObj;
  const emailId = typeof data.email_id === "string" ? data.email_id : (data.id as string | undefined);

  if (!emailId) {
    console.error("[inbound] missing email_id in payload", data);
    return NextResponse.json({ ok: false, error: "missing email_id" }, { status: 400 });
  }

  // Fetch the full email (body + headers).
  let full;
  try {
    full = await fetchInboundEmail(emailId);
  } catch (err) {
    console.error("[inbound] fetch failed", err);
    return NextResponse.json({ ok: false, error: "fetch failed" }, { status: 502 });
  }
  if (!full) {
    return NextResponse.json({ ok: false, error: "email not found at Resend" }, { status: 404 });
  }

  const fromAddress = full.from;
  const toList = full.to ?? [];
  const ccList = full.cc ?? [];
  const subject = full.subject ?? "(no subject)";
  const text = full.text ?? "";
  const html = full.html ?? null;

  const messageId = full.message_id ?? `<inbound-${emailId}@inbound.local>`;
  const inReplyTo = pickHeader(full.headers, "In-Reply-To");
  const referencesHeader = pickHeader(full.headers, "References");

  const attachmentMeta = (full.attachments ?? []).map((a) => ({
    filename: a.filename ?? "attachment",
    type: a.content_type ?? "application/octet-stream",
    size: typeof a.size === "number" ? a.size : null,
    url: a.url ?? null,
  }));

  const senderEmail = (fromAddress.match(/<([^>]+)>/)?.[1] ?? fromAddress).toLowerCase();

  // Idempotency: skip if this Message-Id is already stored (Resend retries).
  const [existing] = await db
    .select({ id: emailMessages.id })
    .from(emailMessages)
    .where(eq(emailMessages.messageIdHeader, messageId))
    .limit(1);
  if (existing) {
    return NextResponse.json({ ok: true, deduplicated: true });
  }

  const thread = await findOrCreateThread({
    inReplyTo,
    references: referencesHeader,
    subject,
    participantEmail: senderEmail,
    clientEmail: senderEmail,
  });

  await db.insert(emailMessages).values({
    threadId: thread.id,
    direction: "inbound",
    messageIdHeader: messageId,
    inReplyTo,
    referencesHeader,
    fromAddress,
    toAddress: toList.join(", "),
    cc: ccList.length ? ccList.join(", ") : null,
    subject,
    bodyText: text,
    bodyHtml: html,
    attachments: JSON.stringify(attachmentMeta),
    rawPayload: JSON.stringify({ webhook: payload, full }),
    status: "received",
  });

  await bumpThread(thread.id, { incUnread: true });

  return NextResponse.json({ ok: true, threadId: thread.id });
}
