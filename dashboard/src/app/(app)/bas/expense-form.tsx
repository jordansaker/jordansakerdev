"use client";

import { useRef, useState, useTransition } from "react";

type Action = (
  prev: { error?: string } | undefined,
  formData: FormData,
) => Promise<{ error?: string }>;

export function ExpenseForm({ action }: { action: Action }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          const result = await action(undefined, fd);
          if (result?.error) setError(result.error);
          else formRef.current?.reset();
        })
      }
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_140px_140px_auto_auto] items-end gap-2 px-5 py-4 border-b border-line-soft"
    >
      <Field label="Description" className="sm:col-span-2 lg:col-span-1">
        <input
          name="description"
          required
          placeholder="Hosting, software, equipment…"
          className={inputClass}
        />
      </Field>
      <Field label="Date">
        <input
          name="spentOn"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className={inputClass}
        />
      </Field>
      <Field label="Amount (ex GST)">
        <input
          name="amount"
          type="number"
          step="0.01"
          required
          className={inputClass}
        />
      </Field>
      <label className="flex items-center gap-2 text-[0.85rem] text-muted pb-2.5">
        <input type="checkbox" name="hasGst" defaultChecked className="accent-accent" />
        GST
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent text-bg font-semibold text-[0.85rem] px-3 py-2 disabled:opacity-50 sm:col-span-2 lg:col-span-1"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      {error ? <p className="col-span-full text-red text-sm">{error}</p> : null}
    </form>
  );
}

const inputClass =
  "w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[0.88rem] focus:outline-none focus:border-accent";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block mono text-[0.66rem] tracking-[0.1em] uppercase text-muted mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
