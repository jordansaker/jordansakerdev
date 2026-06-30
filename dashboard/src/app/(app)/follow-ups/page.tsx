import Link from "next/link";
import { PageHead, Panel } from "@/components/ui";
import { STAGE_COLOR, STAGE_LABEL, loadFollowUpDashboard } from "@/lib/crm";
import { FollowUpsList } from "./follow-ups-list";
import { markFollowUpDoneAction } from "../clients/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Follow-ups · Studio" };

export default async function FollowUpsPage() {
  const rows = await loadFollowUpDashboard();
  const today = new Date().toISOString().slice(0, 10);

  let overdueCount = 0;
  let todayCount = 0;
  for (const r of rows) {
    if (!r.followUpDue) continue;
    if (r.followUpDue < today) overdueCount++;
    else if (r.followUpDue === today) todayCount++;
  }
  const totalCount = rows.length;
  const uniqueClientCount = new Set(rows.map((r) => r.clientId)).size;

  return (
    <>
      <PageHead
        title="Follow-ups"
        subtitle="Today's chase list — pulled from every client's pending follow-ups, sorted soonest first."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Overdue" value={overdueCount} tone={overdueCount > 0 ? "red" : "muted"} />
        <Stat
          label="Due today"
          value={todayCount}
          tone={todayCount > 0 ? "amber" : "muted"}
        />
        <Stat
          label="Pending"
          value={totalCount}
          sub={
            totalCount > 0
              ? `across ${uniqueClientCount} client${uniqueClientCount === 1 ? "" : "s"}`
              : undefined
          }
        />
      </div>

      <Panel>
        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <div className="font-serif text-[1.4rem] mb-1">All caught up</div>
            <div className="text-muted text-[0.9rem]">
              Nothing to chase right now. Log a follow-up from any{" "}
              <Link href="/clients" className="text-accent underline">
                client card
              </Link>{" "}
              when something needs revisiting.
            </div>
          </div>
        ) : (
          <FollowUpsList
            rows={rows.map((r) => ({
              activityId: r.activityId,
              clientId: r.clientId,
              clientName: r.clientName,
              clientStage: r.clientStage,
              clientStageLabel: STAGE_LABEL[r.clientStage],
              clientStageColor: STAGE_COLOR[r.clientStage],
              type: r.type,
              activityDate: r.activityDate,
              note: r.note,
              followUpDue: r.followUpDue!,
            }))}
            markDoneAction={markFollowUpDoneAction}
          />
        )}
      </Panel>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "muted",
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "red" | "amber" | "muted";
}) {
  const toneClass =
    tone === "red" ? "text-red" : tone === "amber" ? "text-amber" : "text-text";
  return (
    <div className="bg-surface border border-line-soft rounded-2xl p-5">
      <div className="mono text-[0.66rem] tracking-[0.12em] uppercase text-muted">
        {label}
      </div>
      <div className={`font-serif font-normal text-[1.9rem] mt-2.5 leading-none ${toneClass}`}>
        {value}
      </div>
      {sub ? <div className="text-[0.8rem] text-muted mt-2">{sub}</div> : null}
    </div>
  );
}
