"use client";

import Link from "next/link";
import { useTransition } from "react";
import { describeRelativeDate } from "@/lib/crm-client-helpers";
import type { ActivityType, ClientStage } from "@/db/schema";

type Row = {
  activityId: number;
  clientId: number;
  clientName: string;
  clientStage: ClientStage;
  clientStageLabel: string;
  clientStageColor: string;
  type: ActivityType;
  activityDate: string;
  note: string;
  followUpDue: string;
};

type MarkDoneAction = (
  fd: FormData,
) => Promise<{ ok: boolean; error?: string }> | Promise<void>;

export function FollowUpsList({
  rows,
  markDoneAction,
}: {
  rows: Row[];
  markDoneAction: MarkDoneAction;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <ul>
      {rows.map((r) => {
        const desc = describeRelativeDate(r.followUpDue);
        const toneClass =
          desc.tone === "overdue"
            ? "text-red"
            : desc.tone === "today"
              ? "text-amber"
              : "text-muted";
        return (
          <li
            key={r.activityId}
            className="border-b border-line-soft last:border-b-0 px-5 py-4 hover:bg-surface-2 transition-colors flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`font-semibold text-[0.92rem] ${toneClass}`}>
                  {desc.text}
                </span>
                <span className="mono text-[0.78rem] text-muted-2">
                  {r.followUpDue}
                </span>
              </div>
              <div className="text-[0.88rem] text-text mt-0.5 flex items-baseline gap-1.5 flex-wrap">
                <Link
                  href={`/clients?client=${r.clientId}`}
                  className="hover:text-accent transition-colors"
                >
                  {r.clientName}
                </Link>
                <span
                  className="inline-flex items-center gap-1 text-[0.7rem] mono uppercase tracking-wider text-muted-2"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: r.clientStageColor }}
                    aria-hidden
                  />
                  {r.clientStageLabel}
                </span>
              </div>
              <div className="text-[0.78rem] text-muted-2 mt-1 truncate">
                <span className="mono uppercase mr-1">{r.type}</span>
                {r.activityDate}
                {r.note ? `: ${r.note}` : ""}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                href={`/clients?client=${r.clientId}`}
                className="px-3 py-1.5 rounded-full border border-line text-text font-semibold text-[0.82rem] hover:border-text transition-colors"
              >
                Open
              </Link>
              <form
                action={(fd) =>
                  startTransition(async () => {
                    await markDoneAction(fd);
                  })
                }
              >
                <input type="hidden" name="activityId" value={r.activityId} />
                <button
                  type="submit"
                  disabled={pending}
                  className="px-3 py-1.5 rounded-full bg-accent text-bg font-semibold text-[0.82rem] disabled:opacity-50 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)] transition-all"
                >
                  Mark done
                </button>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
