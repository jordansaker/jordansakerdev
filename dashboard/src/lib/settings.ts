import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { settings } from "@/db/schema";

export const getSettings = cache(async () => {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (!row) {
    throw new Error("Settings row missing — run `npm run db:seed`.");
  }
  return row;
});
