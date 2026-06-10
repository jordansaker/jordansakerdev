"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getSettings } from "@/lib/settings";

export async function toggleGstAction() {
  const current = await getSettings();
  await db
    .update(settings)
    .set({ gstRegistered: !current.gstRegistered, updatedAt: new Date() })
    .where(eq(settings.id, 1));
  revalidatePath("/", "layout");
}
