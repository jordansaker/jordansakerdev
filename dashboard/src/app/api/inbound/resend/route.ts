import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { db } from "@/db";
import { emailMessages } from "@/db/schema";
import { bumpThread, findOrCreateThread } from "@/lib/threading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resend Inbound webhook handler.
 *
 * Resend signs webhook deliveries with Svix. Set RESEND_WEBHOOK_SECRET to the
 * "signing secret" from the Resend dashboard.
 *
 * Payload shape (defensive — Resend may evolve):
 *   {
 *     type: "email.received",
 *     data: {
 *       from:     "Alice <alice@example.com>" | { name, email },
 *       to:       ["jordan@mail.jordansakerdev.com"] | "jordan@…",
 *       cc?:      string[] | string,
 *       subject:  string,
 *       text?:    string,
 *       html?:    string,
 *       headers?: { "message-id"?, "in-reply-to"?, references? } | array,
 *       attachments?: Array<{ filename, contentType, size, content?, url? }>,
 *     }
 *   }
 */

type AnyObj = Record<string, unknown>;

function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as AnyObj;
    if (typeof o.email === "string") return o.email;
    if (typeof o.address === "string") return o.address;
  }
  return String(v);
}

function asAddressList(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(asString).filter(Boolean);
  return [asString(v)].filter(Boolean);
}

function pickHeader(headers: unknown, name: string): string | null {
  const lc = name.toLowerCase();
  if (!headers) return null;
  if (Array.isArray(headers)) {
    for (const h of headers as AnyObj[]) {
      const k = String(h?.name ?? h?.key ?? "").toLowerCase();
      if (k === lc) return String(h?.value ?? "");
    }
    return null;
  }
  if (typeof headers === "object") {
    const h = headers as AnyObj;
    for (const k of Object.keys(h)) {
      if (k.toLowerCase() === lc) return String(h[k] ?? "");
    }
  }
  return null;
}

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
    // Acknowledge non-inbound events (e.g. delivery, bounce) so Resend stops retrying.
    return NextResponse.json({ ok: true, ignored: type });
  }

  const data = (payload.data ?? payload) as AnyObj;

  const fromAddress = asString(data.from);
  const toList = asAddressList(data.to);
  const ccList = asAddressList(data.cc);
  const subject = String(data.subject ?? "(no subject)");
  const text = String(data.text ?? "");
  const html = data.html != null ? String(data.html) : null;

  const hdr = data.headers ?? {};
  const inReplyTo = pickHeader(hdr, "In-Reply-To");
  const referencesHeader = pickHeader(hdr, "References");
  const messageId =
    pickHeader(hdr, "Message-Id") ??
    `<inbound-${Date.now()}-${Math.random().toString(16).slice(2)}@inbound.local>`;

  const attachmentsRaw = Array.isArray(data.attachments) ? data.attachments : [];
  const attachmentMeta = attachmentsRaw.map((a) => {
    const o = a as AnyObj;
    return {
      filename: String(o.filename ?? "attachment"),
      type: String(o.contentType ?? o.type ?? "application/octet-stream"),
      size: typeof o.size === "number" ? (o.size as number) : null,
      url: typeof o.url === "string" ? (o.url as string) : null,
    };
  });

  const senderEmail = (fromAddress.match(/<([^>]+)>/)?.[1] ?? fromAddress).toLowerCase();

  // Idempotency: skip if we've already stored this Message-Id (Resend may retry).
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
    rawPayload: rawBody,
    status: "received",
  });

  await bumpThread(thread.id, { incUnread: true });

  return NextResponse.json({ ok: true, threadId: thread.id });
}
