import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { desc, eq } from "drizzle-orm";

async function main() {
  const { db } = await import("../src/db/index");
  const { emailMessages } = await import("../src/db/schema");

  const rows = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.direction, "inbound"))
    .orderBy(desc(emailMessages.sentAt))
    .limit(1);

  if (!rows.length) {
    console.log("No inbound messages in DB.");
    process.exit(0);
  }

  const r = rows[0];
  console.log("=== Most recent inbound row ===");
  console.log("id          :", r.id);
  console.log("threadId    :", r.threadId);
  console.log("from        :", r.fromAddress);
  console.log("to          :", r.toAddress);
  console.log("subject     :", r.subject);
  console.log("messageId   :", r.messageIdHeader);
  console.log("inReplyTo   :", r.inReplyTo);
  console.log("bodyText len:", r.bodyText.length);
  console.log("bodyHtml len:", r.bodyHtml?.length ?? 0);
  console.log("");
  console.log("=== bodyText (first 200) ===");
  console.log(JSON.stringify(r.bodyText.slice(0, 200)));
  console.log("");
  console.log("=== rawPayload (first 4000) ===");
  console.log(r.rawPayload?.slice(0, 4000) ?? "(none)");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
