import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { and, eq, sql } from "drizzle-orm";

async function fetchInbound(emailId: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY missing");
  const r = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`fetch failed: ${r.status} ${await r.text()}`);
  return (await r.json()) as {
    message_id?: string;
    text?: string | null;
    html?: string | null;
    headers?: Record<string, string>;
  };
}

function pickHeader(h: Record<string, string> | undefined, name: string): string | null {
  if (!h) return null;
  const lc = name.toLowerCase();
  for (const k of Object.keys(h)) {
    if (k.toLowerCase() === lc) return String(h[k]);
  }
  return null;
}

async function main() {
  const { db } = await import("../src/db/index");
  const { emailMessages } = await import("../src/db/schema");

  const rows = await db
    .select()
    .from(emailMessages)
    .where(
      and(eq(emailMessages.direction, "inbound"), sql`length(${emailMessages.bodyText}) = 0`),
    );

  if (!rows.length) {
    console.log("No inbound rows missing bodies.");
    process.exit(0);
  }

  console.log(`Backfilling ${rows.length} inbound row(s)…`);
  for (const r of rows) {
    let webhookPayload: unknown;
    try {
      webhookPayload = JSON.parse(r.rawPayload ?? "{}");
    } catch {
      console.log(`  row ${r.id}: rawPayload is not JSON — skipping`);
      continue;
    }
    const data =
      (webhookPayload as { data?: { email_id?: string; id?: string } })?.data ?? {};
    const emailId = data.email_id ?? data.id;
    if (!emailId) {
      console.log(`  row ${r.id}: no email_id in payload — skipping`);
      continue;
    }
    try {
      const full = await fetchInbound(emailId);
      if (!full) {
        console.log(`  row ${r.id}: not found at Resend`);
        continue;
      }
      const messageId = full.message_id ?? r.messageIdHeader;
      const inReplyTo = pickHeader(full.headers, "In-Reply-To") ?? r.inReplyTo;
      const referencesHeader =
        pickHeader(full.headers, "References") ?? r.referencesHeader;
      await db
        .update(emailMessages)
        .set({
          bodyText: full.text ?? "",
          bodyHtml: full.html ?? null,
          messageIdHeader: messageId,
          inReplyTo,
          referencesHeader,
          rawPayload: JSON.stringify({ webhook: webhookPayload, full }),
        })
        .where(eq(emailMessages.id, r.id));
      console.log(`  row ${r.id}: updated (body=${(full.text ?? "").length}b)`);
    } catch (err) {
      console.log(`  row ${r.id}: failed`, err);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
