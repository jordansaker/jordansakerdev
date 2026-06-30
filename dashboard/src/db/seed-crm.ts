import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { eq, sql } from "drizzle-orm";

type StageKey =
  | "new_lead"
  | "in_conversation"
  | "quoted"
  | "engaged"
  | "in_build"
  | "delivered";

type ActivityType = "email" | "call" | "meeting" | "note";

type SeedActivity = {
  type: ActivityType;
  daysAgo: number;
  note: string;
  followUpInDays?: number; // negative = overdue
};

type SeedLead = {
  name: string;
  stage: StageKey;
  estimatedValueCents: number | null;
  source: string;
  email?: string;
  abn?: string;
  activities?: SeedActivity[];
};

const LEADS: SeedLead[] = [
  {
    name: "Atherton Brewing",
    stage: "in_conversation",
    estimatedValueCents: 350_000,
    source: "Referral",
    email: "hello@athertonbrewing.example",
    activities: [
      {
        type: "email",
        daysAgo: 40,
        note: "Sent intro email re: their online ordering. No reply yet.",
        followUpInDays: -10, // overdue
      },
    ],
  },
  {
    name: "Port Douglas Dive",
    stage: "in_conversation",
    estimatedValueCents: 280_000,
    source: "Website enquiry",
    email: "bookings@pddive.example",
    activities: [
      {
        type: "email",
        daysAgo: 14,
        note: "Initial enquiry — they're rebuilding their booking flow for the wet season.",
      },
      {
        type: "call",
        daysAgo: 7,
        note: "Discovery call — 20 minutes. Pain point is mobile abandonment. Want a quote.",
        followUpInDays: 5, // upcoming
      },
    ],
  },
  {
    name: "Cassowary Coast Council",
    stage: "quoted",
    estimatedValueCents: 1_800_000,
    source: "RFP",
    email: "procurement@cassowarycoast.example",
    activities: [
      {
        type: "note",
        daysAgo: 21,
        note: "RFP for tourism portal rebuild — submitted formal response.",
        followUpInDays: 14, // upcoming
      },
    ],
  },
  {
    name: "Mossman Mango Co.",
    stage: "new_lead",
    estimatedValueCents: 180_000,
    source: "Cold outreach",
    activities: [],
  },
  {
    name: "Daintree Eco Lodges",
    stage: "new_lead",
    estimatedValueCents: 420_000,
    source: "LinkedIn",
    activities: [],
  },
];

const EXISTING_STAGE_MAP: Record<string, StageKey> = {
  "Cairns Coffee Roasters": "delivered",
  "Tableland Tours": "in_build",
  "Reef & Vine Cellars": "quoted",
};

async function main() {
  const { db } = await import("./index");
  const { clients, clientActivities } = await import("./schema");

  console.log("Updating existing clients to their natural stage…");
  for (const [name, stage] of Object.entries(EXISTING_STAGE_MAP)) {
    await db
      .update(clients)
      .set({ stage })
      .where(sql`lower(${clients.name}) = lower(${name})`);
  }

  console.log("Seeding mockup leads (skipping any that already exist)…");
  for (const lead of LEADS) {
    const [existing] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(sql`lower(${clients.name}) = lower(${lead.name})`)
      .limit(1);

    let clientId = existing?.id;
    if (!clientId) {
      const [row] = await db
        .insert(clients)
        .values({
          name: lead.name,
          stage: lead.stage,
          estimatedValueCents: lead.estimatedValueCents,
          source: lead.source,
          email: lead.email,
          abn: lead.abn,
          sortOrder: Date.now() % 1_000_000,
        })
        .returning({ id: clients.id });
      clientId = row.id;
      console.log(`  + ${lead.name} (${lead.stage})`);
    } else {
      // Update stage/source/value in case the prior seed used different values
      await db
        .update(clients)
        .set({
          stage: lead.stage,
          estimatedValueCents: lead.estimatedValueCents,
          source: lead.source,
        })
        .where(eq(clients.id, clientId));
      console.log(`  · ${lead.name} (already present — refreshed pipeline fields)`);
    }

    if (!lead.activities?.length) continue;

    // Idempotent: delete any prior seed activities for this client before re-inserting.
    // Real activities the user has logged are kept because we tag seed inserts with a
    // distinctive note prefix... actually simplest: skip if there are already activities.
    const existingActivities = await db
      .select({ id: clientActivities.id })
      .from(clientActivities)
      .where(eq(clientActivities.clientId, clientId))
      .limit(1);
    if (existingActivities.length) {
      console.log(`    (has activities — leaving as-is)`);
      continue;
    }

    for (const a of lead.activities) {
      const activityDate = isoDateDaysAgo(a.daysAgo);
      const followUpDue =
        a.followUpInDays !== undefined
          ? isoDateDaysAgo(-a.followUpInDays)
          : null;
      await db.insert(clientActivities).values({
        clientId,
        type: a.type,
        activityDate,
        note: a.note,
        followUpDue,
      });
    }
  }

  console.log("Done.");
  process.exit(0);
}

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
