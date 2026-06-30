import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientActivities, clients } from "@/db/schema";
import type { ActivityType } from "@/db/schema";
import type { PipelineCard } from "./crm-client-helpers";

export {
  STAGES,
  STAGE_LABEL,
  STAGE_COLOR,
  describeRelativeDate,
} from "./crm-client-helpers";
export type { PipelineCard } from "./crm-client-helpers";

async function loadActiveFollowUps() {
  return db
    .select({
      id: clientActivities.id,
      clientId: clientActivities.clientId,
      type: clientActivities.type,
      activityDate: clientActivities.activityDate,
      note: clientActivities.note,
      followUpDue: clientActivities.followUpDue,
    })
    .from(clientActivities)
    .where(
      and(
        sql`${clientActivities.followUpDue} IS NOT NULL`,
        isNull(clientActivities.followUpDoneAt),
      ),
    )
    .orderBy(asc(clientActivities.followUpDue));
}

async function loadLatestActivities() {
  const rows = await db
    .select({
      clientId: clientActivities.clientId,
      type: clientActivities.type,
      activityDate: clientActivities.activityDate,
    })
    .from(clientActivities)
    .orderBy(asc(clientActivities.clientId), desc(clientActivities.activityDate));
  const map = new Map<number, { type: ActivityType; date: string }>();
  for (const r of rows) {
    if (!map.has(r.clientId)) {
      map.set(r.clientId, { type: r.type, date: r.activityDate });
    }
  }
  return map;
}

export async function loadBoard(): Promise<PipelineCard[]> {
  const rows = await db
    .select()
    .from(clients)
    .orderBy(asc(clients.stage), asc(clients.sortOrder), asc(clients.id));
  const followUps = await loadActiveFollowUps();
  const latestByClient = await loadLatestActivities();
  const followUpByClient = new Map<number, (typeof followUps)[number]>();
  for (const f of followUps) {
    if (!followUpByClient.has(f.clientId)) followUpByClient.set(f.clientId, f);
  }
  return rows.map((r) => {
    const last = latestByClient.get(r.id) ?? null;
    const fu = followUpByClient.get(r.id);
    return {
      id: r.id,
      name: r.name,
      stage: r.stage,
      estimatedValueCents: r.estimatedValueCents,
      source: r.source,
      email: r.email,
      abn: r.abn,
      address: r.address,
      notes: r.notes,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt.toISOString().slice(0, 10),
      lastContact: last,
      activeFollowUp: fu
        ? {
            activityId: fu.id,
            due: fu.followUpDue!,
            note: fu.note,
            activityType: fu.type,
            activityDate: fu.activityDate,
          }
        : null,
    };
  });
}

export async function loadClientDetail(clientId: number) {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client) return null;
  const activities = await db
    .select()
    .from(clientActivities)
    .where(eq(clientActivities.clientId, clientId))
    .orderBy(desc(clientActivities.activityDate), desc(clientActivities.id));
  return { client, activities };
}

export async function loadFollowUpDashboard() {
  const rows = await db
    .select({
      activityId: clientActivities.id,
      clientId: clients.id,
      clientName: clients.name,
      clientStage: clients.stage,
      type: clientActivities.type,
      activityDate: clientActivities.activityDate,
      note: clientActivities.note,
      followUpDue: clientActivities.followUpDue,
    })
    .from(clientActivities)
    .innerJoin(clients, eq(clients.id, clientActivities.clientId))
    .where(
      and(
        sql`${clientActivities.followUpDue} IS NOT NULL`,
        isNull(clientActivities.followUpDoneAt),
      ),
    )
    .orderBy(asc(clientActivities.followUpDue));
  return rows;
}
