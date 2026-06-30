/**
 * Client-safe CRM data and helpers. No DB, no `server-only` — imports from this
 * file are safe in client components. The server-only DB queries live in
 * lib/crm.ts and re-export everything below.
 */
import type { ActivityType, ClientStage } from "@/db/schema";

export const STAGES: ClientStage[] = [
  "new_lead",
  "in_conversation",
  "quoted",
  "engaged",
  "in_build",
  "delivered",
];

export const STAGE_LABEL: Record<ClientStage, string> = {
  new_lead: "New Lead",
  in_conversation: "In Conversation",
  quoted: "Quoted",
  engaged: "Engaged",
  in_build: "In Build",
  delivered: "Delivered",
};

export const STAGE_COLOR: Record<ClientStage, string> = {
  new_lead: "#6B7280",
  in_conversation: "#5B8DEE",
  quoted: "#D6A95F",
  engaged: "#9B7EBD",
  in_build: "#E8743B",
  delivered: "#7FB27F",
};

export type PipelineCard = {
  id: number;
  name: string;
  stage: ClientStage;
  estimatedValueCents: number | null;
  source: string | null;
  email: string | null;
  abn: string | null;
  address: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string; // ISO date
  lastContact: { type: ActivityType; date: string } | null;
  activeFollowUp: {
    activityId: number;
    due: string;
    note: string;
    activityType: ActivityType;
    activityDate: string;
  } | null;
};

/**
 * Case-insensitive substring match against name / email / source / notes.
 * Empty query matches everything.
 */
export function matchesSearch(card: PipelineCard, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    card.name,
    card.email ?? "",
    card.source ?? "",
    card.notes ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/**
 * Most-recently-touched first. Falls back to createdAt when there's no logged
 * activity yet, then to id desc for total stability.
 */
export function sortByRecentActivity(a: PipelineCard, b: PipelineCard): number {
  const aTouch = a.lastContact?.date ?? a.createdAt;
  const bTouch = b.lastContact?.date ?? b.createdAt;
  if (aTouch !== bTouch) return aTouch < bTouch ? 1 : -1;
  return b.id - a.id;
}

export function describeRelativeDate(iso: string): {
  text: string;
  tone: "overdue" | "today" | "tomorrow" | "soon" | "later";
  daysFromToday: number;
} {
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(`${iso}T00:00:00Z`);
  const t = new Date(`${today}T00:00:00Z`);
  const days = Math.round((due.getTime() - t.getTime()) / 86_400_000);
  if (days < 0) {
    const abs = Math.abs(days);
    return {
      text: `${abs} day${abs === 1 ? "" : "s"} overdue`,
      tone: "overdue",
      daysFromToday: days,
    };
  }
  if (days === 0) return { text: "Today", tone: "today", daysFromToday: 0 };
  if (days === 1) return { text: "Tomorrow", tone: "tomorrow", daysFromToday: 1 };
  if (days <= 7) return { text: `In ${days} days`, tone: "soon", daysFromToday: days };
  return { text: `In ${days} days`, tone: "later", daysFromToday: days };
}
