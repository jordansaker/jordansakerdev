import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, emailMessages, emailThreads } from "@/db/schema";

const DEFAULT_DOMAIN = "mail.jordansakerdev.com";

function sendingDomain(): string {
  const from = process.env.RESEND_FROM ?? "";
  const m = from.match(/<[^@>]+@([^>]+)>/);
  return m?.[1] ?? from.split("@")[1] ?? DEFAULT_DOMAIN;
}

export function newMessageId(): string {
  return `<${randomUUID()}@${sendingDomain()}>`;
}

function normalizeSubject(subject: string): string {
  return subject.replace(/^(re:|fwd?:)\s*/i, "").trim();
}

function extractEmail(input: string): string {
  const m = input.match(/<([^>]+)>/);
  return (m?.[1] ?? input).trim().toLowerCase();
}

/** Look up a thread by an In-Reply-To / References chain. */
export async function findThreadByReplyChain(
  inReplyTo: string | null,
  references: string | null,
): Promise<number | null> {
  const candidates = new Set<string>();
  if (inReplyTo) candidates.add(inReplyTo.trim());
  if (references) {
    for (const r of references.match(/<[^>]+>/g) ?? []) candidates.add(r);
  }
  if (!candidates.size) return null;
  const ids = Array.from(candidates);
  const rows = await db
    .select({ threadId: emailMessages.threadId })
    .from(emailMessages)
    .where(sql`${emailMessages.messageIdHeader} = ANY(${ids})`)
    .limit(1);
  return rows[0]?.threadId ?? null;
}

export async function findOrCreateThread({
  inReplyTo,
  references,
  subject,
  participantEmail,
  clientEmail,
}: {
  inReplyTo: string | null;
  references: string | null;
  subject: string;
  participantEmail: string;
  clientEmail?: string | null;
}): Promise<{ id: number; existed: boolean }> {
  const existing = await findThreadByReplyChain(inReplyTo, references);
  if (existing) return { id: existing, existed: true };

  const participant = extractEmail(participantEmail);
  let clientId: number | null = null;
  if (clientEmail) {
    const [c] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(sql`lower(${clients.email})`, clientEmail.toLowerCase()))
      .limit(1);
    clientId = c?.id ?? null;
  }

  const [row] = await db
    .insert(emailThreads)
    .values({
      subject: normalizeSubject(subject) || "(no subject)",
      participantEmail: participant,
      clientId,
      lastMessageAt: new Date(),
    })
    .returning({ id: emailThreads.id });
  return { id: row.id, existed: false };
}

export async function bumpThread(threadId: number, opts: { incUnread?: boolean } = {}) {
  await db
    .update(emailThreads)
    .set({
      lastMessageAt: new Date(),
      messageCount: sql`${emailThreads.messageCount} + 1`,
      unreadCount: opts.incUnread
        ? sql`${emailThreads.unreadCount} + 1`
        : emailThreads.unreadCount,
    })
    .where(eq(emailThreads.id, threadId));
}

export async function listThreads(limit = 50) {
  return db
    .select()
    .from(emailThreads)
    .orderBy(desc(emailThreads.lastMessageAt))
    .limit(limit);
}

export async function getThread(id: number) {
  const [thread] = await db
    .select()
    .from(emailThreads)
    .where(eq(emailThreads.id, id))
    .limit(1);
  if (!thread) return null;
  const messages = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.threadId, id))
    .orderBy(asc(emailMessages.sentAt), asc(emailMessages.id));
  return { thread, messages };
}

export async function getLastOutboundOfThread(threadId: number) {
  const [row] = await db
    .select()
    .from(emailMessages)
    .where(and(eq(emailMessages.threadId, threadId), eq(emailMessages.direction, "outbound")))
    .orderBy(desc(emailMessages.sentAt))
    .limit(1);
  return row ?? null;
}

export async function getLastMessageOfThread(threadId: number) {
  const [row] = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.threadId, threadId))
    .orderBy(desc(emailMessages.sentAt))
    .limit(1);
  return row ?? null;
}

export async function markThreadRead(threadId: number) {
  await db
    .update(emailThreads)
    .set({ unreadCount: 0 })
    .where(eq(emailThreads.id, threadId));
  await db
    .update(emailMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(emailMessages.threadId, threadId),
        eq(emailMessages.direction, "inbound"),
        sql`${emailMessages.readAt} IS NULL`,
      ),
    );
}

export function buildReferences(prev: string | null, messageId: string): string {
  if (!prev) return messageId;
  return `${prev.trim()} ${messageId}`.trim();
}
