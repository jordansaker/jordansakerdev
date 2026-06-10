"use client";

import { useState, useTransition } from "react";
import type { Client } from "@/db/schema";
import {
  createClientAction,
  deleteClientAction,
  updateClientAction,
} from "./actions";

export function ClientsList({
  items,
  forceCreate,
}: {
  items: Client[];
  forceCreate?: boolean;
}) {
  const [editingId, setEditingId] = useState<number | "new" | null>(
    forceCreate ? "new" : null,
  );

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => setEditingId("new")}
          className="rounded-full bg-accent text-bg font-semibold text-[0.88rem] px-4 py-2.5 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)] transition-all"
        >
          + Add client
        </button>
      </div>

      {editingId === "new" ? (
        <ClientForm
          key="new"
          mode="create"
          initial={null}
          onClose={() => setEditingId(null)}
        />
      ) : null}

      {items.length === 0 && editingId !== "new" ? (
        <div className="bg-surface border border-line-soft rounded-2xl p-10 text-center text-muted-2 text-[0.9rem]">
          No clients yet — add your first.
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-4">
        {items.map((c) =>
          editingId === c.id ? (
            <ClientForm
              key={c.id}
              mode="edit"
              initial={c}
              onClose={() => setEditingId(null)}
            />
          ) : (
            <div
              key={c.id}
              className="bg-surface border border-line-soft rounded-2xl p-5 hover:border-line hover:bg-surface-2 transition-colors"
            >
              <h3 className="font-semibold text-[1.02rem]">{c.name}</h3>
              <dl className="mt-2 space-y-1 text-[0.85rem] text-muted">
                {c.email ? <div>{c.email}</div> : null}
                {c.abn ? <div className="mono">ABN {c.abn}</div> : null}
                {c.address ? <div>{c.address}</div> : null}
                {c.notes ? <div className="text-muted-2">{c.notes}</div> : null}
              </dl>
              <div className="flex gap-1.5 mt-3">
                <button
                  type="button"
                  onClick={() => setEditingId(c.id)}
                  className="border border-line-soft text-muted rounded-md px-2 py-1 text-[0.72rem] hover:text-text hover:border-line"
                >
                  Edit
                </button>
                <form
                  action={async (fd) => {
                    if (confirm(`Remove ${c.name}?`)) await deleteClientAction(fd);
                  }}
                >
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    className="border border-line-soft text-muted rounded-md px-2 py-1 text-[0.72rem] hover:text-red hover:border-red-soft"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </div>
          ),
        )}
      </div>
    </>
  );
}

function ClientForm({
  mode,
  initial,
  onClose,
}: {
  mode: "create" | "edit";
  initial: Client | null;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = (fd: FormData) => {
    startTransition(async () => {
      setError(null);
      const action = mode === "create" ? createClientAction : updateClientAction;
      const result = await action(undefined, fd);
      if (result?.error) setError(result.error);
      else onClose();
    });
  };
  return (
    <form
      action={submit}
      className="bg-bg-2 border border-line rounded-2xl p-5 grid grid-cols-2 gap-3 md:col-span-2"
    >
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Field label="Name" required>
        <input
          name="name"
          defaultValue={initial?.name ?? ""}
          required
          className={inputClass}
        />
      </Field>
      <Field label="Email">
        <input
          name="email"
          type="email"
          defaultValue={initial?.email ?? ""}
          className={inputClass}
        />
      </Field>
      <Field label="ABN">
        <input
          name="abn"
          defaultValue={initial?.abn ?? ""}
          className={inputClass}
        />
      </Field>
      <Field label="Postal address">
        <input
          name="address"
          defaultValue={initial?.address ?? ""}
          className={inputClass}
        />
      </Field>
      <Field label="Notes" full>
        <input
          name="notes"
          defaultValue={initial?.notes ?? ""}
          className={inputClass}
        />
      </Field>
      {error ? <p className="col-span-2 text-red text-sm">{error}</p> : null}
      <div className="col-span-2 flex gap-2 justify-end mt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg border border-line text-[0.85rem] hover:border-text"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-1.5 rounded-lg bg-accent text-bg font-semibold text-[0.85rem] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save client"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full mt-1 bg-bg-2 border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent";

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="mono text-[0.66rem] tracking-[0.1em] uppercase text-muted">
        {label}
        {required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}
