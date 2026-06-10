"use client";

import { useState, useTransition } from "react";

type Action = (fd: FormData) => Promise<{ ok: boolean; error?: string }>;

export function EditableInvoiceDate({
  id,
  value,
  editable,
  action,
}: {
  id: number;
  value: string;
  editable: boolean;
  action: Action;
}) {
  const [v, setV] = useState(value);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editable) {
    return <span className="mono text-muted">{value}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="date"
        value={v}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          setV(next);
          setError(null);
          if (!next) return;
          startTransition(async () => {
            const fd = new FormData();
            fd.set("id", String(id));
            fd.set("value", next);
            const result = await action(fd);
            if (!result.ok) {
              setError(result.error ?? "Save failed");
              setV(value);
            }
          });
        }}
        className="mono text-[0.85rem] bg-bg-2 border border-line-soft rounded px-1.5 py-0.5 text-text focus:outline-none focus:border-accent disabled:opacity-50"
      />
      {error ? <span className="text-red text-[0.7rem]">{error}</span> : null}
    </span>
  );
}
