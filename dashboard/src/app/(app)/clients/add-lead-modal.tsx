"use client";

import { useEffect, useState, useTransition } from "react";
import type { ClientStage } from "@/db/schema";

type CreateLeadAction = (
  prev: { error?: string } | undefined,
  fd: FormData,
) => Promise<{ error?: string }>;

const STAGE_LABELS: Record<ClientStage, string> = {
  new_lead: "New Lead",
  in_conversation: "In Conversation",
  quoted: "Quoted",
  engaged: "Engaged",
  in_build: "In Build",
  delivered: "Delivered",
};

export function AddLeadModal({
  stages,
  action,
  onClose,
}: {
  stages: ClientStage[];
  action: CreateLeadAction;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-surface border border-line-soft rounded-2xl p-6 max-w-md w-full shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]">
        <h2 className="font-serif font-medium text-[1.15rem] mb-4">New lead</h2>
        <form
          action={(fd) =>
            startTransition(async () => {
              setError(null);
              const result = await action(undefined, fd);
              if (result?.error) setError(result.error);
              else onClose();
            })
          }
          className="space-y-3"
        >
          <Field label="Company name" required>
            <input
              name="name"
              required
              autoFocus
              className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[0.92rem] text-text focus:outline-none focus:border-accent"
            />
          </Field>
          <Field label="Estimated value ($)">
            <input
              name="estimatedValue"
              type="number"
              step="100"
              className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[0.92rem] text-text focus:outline-none focus:border-accent"
              placeholder="2500"
            />
          </Field>
          <Field label="Source">
            <input
              name="source"
              className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[0.92rem] text-text focus:outline-none focus:border-accent"
              placeholder="Referral · LinkedIn · Cold outreach"
            />
          </Field>
          <Field label="Starting stage">
            <select
              name="stage"
              defaultValue="new_lead"
              className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[0.92rem] text-text focus:outline-none focus:border-accent"
            >
              {stages.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          {error ? <p className="text-red text-sm">{error}</p> : null}
          <div className="flex justify-end gap-2 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-line text-text font-semibold text-[0.85rem] hover:border-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 rounded-full bg-accent text-bg font-semibold text-[0.85rem] disabled:opacity-50 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)] transition-all"
            >
              {pending ? "Adding…" : "Add lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block mono text-[0.66rem] tracking-[0.1em] uppercase text-muted mb-1.5">
        {label}
        {required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}
