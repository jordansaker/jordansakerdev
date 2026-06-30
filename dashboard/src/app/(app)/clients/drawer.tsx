"use client";

import { useEffect, useState, useTransition } from "react";
import { useConfirm } from "@/components/confirm";
import { formatCents0 } from "@/lib/money";
import {
  describeRelativeDate,
  type PipelineCard,
} from "@/lib/crm-client-helpers";
import type { ActivityType, ClientActivity, ClientStage } from "@/db/schema";

const STAGE_LABEL: Record<ClientStage, string> = {
  new_lead: "New Lead",
  in_conversation: "In Conversation",
  quoted: "Quoted",
  engaged: "Engaged",
  in_build: "In Build",
  delivered: "Delivered",
};

const ACTIVITY_TYPES: Array<{ key: ActivityType; label: string; icon: string }> = [
  { key: "email", label: "Email", icon: "✉" },
  { key: "call", label: "Call", icon: "☎" },
  { key: "meeting", label: "Meeting", icon: "◫" },
  { key: "note", label: "Note", icon: "✎" },
];

type UpdateAction = (
  prev: { error?: string } | undefined,
  fd: FormData,
) => Promise<{ error?: string }>;

type LogActivityAction = (input: {
  clientId: number;
  type: ActivityType;
  activityDate: string;
  note: string;
  followUpDue: string | null;
}) => Promise<{ ok: boolean; error?: string }>;

type SimpleFormAction = (fd: FormData) => Promise<void> | Promise<{ ok: boolean; error?: string }>;

export function ClientDrawer({
  client,
  activities,
  stages,
  onClose,
  updateClientAction,
  deleteClientAction,
  logActivityAction,
  markFollowUpDoneAction,
  deleteActivityAction,
}: {
  client: PipelineCard;
  activities: ClientActivity[];
  stages: ClientStage[];
  onClose: () => void;
  updateClientAction: UpdateAction;
  deleteClientAction: SimpleFormAction;
  logActivityAction: LogActivityAction;
  markFollowUpDoneAction: SimpleFormAction;
  deleteActivityAction: SimpleFormAction;
}) {
  const [editDetails, setEditDetails] = useState(false);
  const [pending, startTransition] = useTransition();
  const [logError, setLogError] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();
  const [logType, setLogType] = useState<ActivityType>("email");
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logNote, setLogNote] = useState("");
  const [needsFollowUp, setNeedsFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const activeFollowUp = activities.find(
    (a) => a.followUpDue && !a.followUpDoneAt,
  );
  const followUpDesc = activeFollowUp?.followUpDue
    ? describeRelativeDate(activeFollowUp.followUpDue)
    : null;

  function logIt() {
    if (!logNote.trim() && logType !== "note") {
      // Allow blank note for explicit notes type? But user explicitly chose note — require text
    }
    setLogError(null);
    startTransition(async () => {
      const result = await logActivityAction({
        clientId: client.id,
        type: logType,
        activityDate: logDate,
        note: logNote.trim(),
        followUpDue: needsFollowUp ? followUpDate : null,
      });
      if (!result.ok) {
        setLogError(result.error ?? "Couldn't log activity");
        return;
      }
      setLogNote("");
      setNeedsFollowUp(false);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      {dialog}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 bg-bg border-l border-line w-full sm:max-w-[460px] h-full overflow-y-auto shadow-[-12px_0_40px_rgba(0,0,0,0.4)]">
        <div className="sticky top-0 bg-bg border-b border-line-soft px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-[1.3rem] font-medium truncate">
                {client.name}
              </h2>
            </div>
            <div className="text-[0.8rem] text-muted mt-0.5">
              {STAGE_LABEL[client.stage]}
              {client.estimatedValueCents != null
                ? ` · ${formatCents0(client.estimatedValueCents)}`
                : ""}
              {client.source ? ` · ${client.source}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="text-muted hover:text-text text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          {activeFollowUp && followUpDesc ? (
            <div
              className={`rounded-lg p-3 border ${
                followUpDesc.tone === "overdue"
                  ? "border-red-soft bg-red-soft text-red"
                  : "border-amber-soft bg-amber-soft text-amber"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-[0.85rem]">
                  <span className="font-semibold">
                    {followUpDesc.tone === "overdue" ? "⚑ Follow up overdue" : "⏳ Follow up"}
                  </span>{" "}
                  <span className="mono">· {activeFollowUp.followUpDue}</span>{" "}
                  <span className="opacity-80">· {followUpDesc.text}</span>
                </div>
                <form
                  action={(fd) =>
                    startTransition(async () => {
                      await markFollowUpDoneAction(fd);
                    })
                  }
                >
                  <input type="hidden" name="activityId" value={activeFollowUp.id} />
                  <button
                    type="submit"
                    className="text-[0.75rem] underline hover:no-underline"
                  >
                    Mark done
                  </button>
                </form>
              </div>
              {activeFollowUp.note ? (
                <div className="text-[0.78rem] mt-1 opacity-80 leading-snug">
                  Re: {activeFollowUp.note}
                </div>
              ) : null}
            </div>
          ) : null}

          <Section title="Log activity">
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {ACTIVITY_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setLogType(t.key)}
                  className={`px-3 py-1.5 rounded-full text-[0.78rem] border transition-colors ${
                    logType === t.key
                      ? "bg-accent text-bg border-accent"
                      : "bg-bg-2 text-muted border-line-soft hover:text-text"
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="bg-bg-2 border border-line rounded-lg px-3 py-1.5 text-[0.85rem] text-text focus:outline-none focus:border-accent"
              />
              <textarea
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                rows={3}
                placeholder="What happened?"
                className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[0.9rem] text-text focus:outline-none focus:border-accent resize-y"
              />
              <label className="flex items-center gap-2 text-[0.85rem] text-muted">
                <input
                  type="checkbox"
                  checked={needsFollowUp}
                  onChange={(e) => setNeedsFollowUp(e.target.checked)}
                  className="accent-accent"
                />
                Needs follow-up
              </label>
              {needsFollowUp ? (
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="bg-bg-2 border border-line rounded-lg px-3 py-1.5 text-[0.85rem] text-text focus:outline-none focus:border-accent"
                />
              ) : null}
              {logError ? <p className="text-red text-sm">{logError}</p> : null}
              <button
                type="button"
                onClick={logIt}
                disabled={pending || !logNote.trim()}
                className="rounded-full bg-accent text-bg font-semibold text-[0.85rem] px-4 py-2 disabled:opacity-50"
              >
                {pending ? "Logging…" : "Log it"}
              </button>
            </div>
          </Section>

          <Section title="Timeline">
            {activities.length === 0 ? (
              <p className="text-[0.85rem] text-muted-2">
                No activity logged yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {activities.map((a) => (
                  <li
                    key={a.id}
                    className="bg-surface border border-line-soft rounded-lg p-3"
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <div className="text-[0.85rem]">
                        <span className="mono text-[0.62rem] uppercase tracking-wider mr-1.5 px-1.5 py-0.5 rounded bg-bg-2 text-muted">
                          {a.type}
                        </span>
                        <span className="mono text-muted">{a.activityDate}</span>
                      </div>
                      <form
                        action={(fd) =>
                          startTransition(async () => {
                            await deleteActivityAction(fd);
                          })
                        }
                      >
                        <input type="hidden" name="activityId" value={a.id} />
                        <button
                          type="submit"
                          className="text-[0.7rem] text-muted-2 hover:text-red"
                          aria-label="Delete activity"
                        >
                          ×
                        </button>
                      </form>
                    </div>
                    {a.note ? (
                      <p className="text-[0.85rem] text-text leading-snug whitespace-pre-wrap">
                        {a.note}
                      </p>
                    ) : null}
                    {a.followUpDue ? (
                      <div className="mt-1.5 text-[0.72rem] text-muted-2">
                        Follow-up{" "}
                        {a.followUpDoneAt
                          ? "done"
                          : describeRelativeDate(a.followUpDue).text}{" "}
                        · {a.followUpDue}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Details"
            right={
              <button
                type="button"
                onClick={() => setEditDetails((v) => !v)}
                className="text-[0.78rem] text-muted hover:text-accent transition-colors"
              >
                {editDetails ? "Cancel" : "Edit"}
              </button>
            }
          >
            {editDetails ? (
              <DetailsForm
                client={client}
                stages={stages}
                action={updateClientAction}
                onDone={() => setEditDetails(false)}
              />
            ) : (
              <dl className="space-y-1.5 text-[0.85rem]">
                <DetailRow label="Estimated value">
                  {client.estimatedValueCents != null
                    ? formatCents0(client.estimatedValueCents)
                    : "—"}
                </DetailRow>
                <DetailRow label="Source">{client.source || "—"}</DetailRow>
                <DetailRow label="Email">{client.email || "—"}</DetailRow>
                <DetailRow label="ABN">{client.abn || "—"}</DetailRow>
                <DetailRow label="Address">{client.address || "—"}</DetailRow>
                {client.notes ? (
                  <div className="text-muted-2 pt-2 border-t border-line-soft mt-2 whitespace-pre-wrap">
                    {client.notes}
                  </div>
                ) : null}
              </dl>
            )}
          </Section>

          <Section title="Danger zone">
            <button
              type="button"
              onClick={async () => {
                const ok = await ask(
                  `Delete ${client.name}? All logged activity will be removed.`,
                  { confirmLabel: "Delete", danger: true },
                );
                if (!ok) return;
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("id", String(client.id));
                  await deleteClientAction(fd);
                  onClose();
                });
              }}
              className="text-[0.78rem] text-muted-2 hover:text-red transition-colors"
            >
              Delete client
            </button>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-[0.85rem] mono uppercase tracking-wider text-muted">
          {title}
        </h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="text-muted-2 w-28 flex-shrink-0">{label}</dt>
      <dd className="text-text flex-1 min-w-0 truncate">{children}</dd>
    </div>
  );
}

function DetailsForm({
  client,
  stages,
  action,
  onDone,
}: {
  client: PipelineCard;
  stages: ClientStage[];
  action: UpdateAction;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          const result = await action(undefined, fd);
          if (result?.error) setError(result.error);
          else onDone();
        })
      }
      className="space-y-2"
    >
      <input type="hidden" name="id" value={client.id} />
      <FormField label="Name">
        <input
          name="name"
          defaultValue={client.name}
          required
          className={inputClass}
        />
      </FormField>
      <FormField label="Stage">
        <select
          name="stage"
          defaultValue={client.stage}
          className={inputClass}
        >
          {stages.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Estimated value ($)">
        <input
          name="estimatedValue"
          type="number"
          step="100"
          defaultValue={
            client.estimatedValueCents != null
              ? (client.estimatedValueCents / 100).toFixed(0)
              : ""
          }
          className={inputClass}
        />
      </FormField>
      <FormField label="Source">
        <input
          name="source"
          defaultValue={client.source ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Email">
        <input
          name="email"
          type="email"
          defaultValue={client.email ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="ABN">
        <input
          name="abn"
          defaultValue={client.abn ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Address">
        <input
          name="address"
          defaultValue={client.address ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Notes">
        <textarea
          name="notes"
          defaultValue={client.notes ?? ""}
          rows={3}
          className={`${inputClass} resize-y`}
        />
      </FormField>
      {error ? <p className="text-red text-sm">{error}</p> : null}
      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 rounded-full border border-line text-text font-semibold text-[0.82rem]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-1.5 rounded-full bg-accent text-bg font-semibold text-[0.82rem] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full bg-bg-2 border border-line rounded-lg px-3 py-1.5 text-[0.88rem] text-text focus:outline-none focus:border-accent";

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block mono text-[0.62rem] tracking-[0.1em] uppercase text-muted mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
