"use client";

import { useState, useTransition } from "react";
import { useConfirm } from "@/components/confirm";
import type { Service } from "@/db/schema";
import { formatCents0 } from "@/lib/money";
import {
  createServiceAction,
  deleteServiceAction,
  updateServiceAction,
} from "./actions";

const unitLabel: Record<Service["unit"], string> = {
  fixed: "fixed",
  hourly: "/hr",
  monthly: "/mo",
};

export function ServicesList({ items }: { items: Service[] }) {
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const { ask, dialog } = useConfirm();

  return (
    <>
      {dialog}
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => setEditingId("new")}
          className="rounded-full bg-accent text-bg font-semibold text-[0.88rem] px-4 py-2.5 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)] transition-all"
        >
          + Add service
        </button>
      </div>

      {editingId === "new" ? (
        <ServiceForm
          key="new"
          mode="create"
          initial={null}
          onClose={() => setEditingId(null)}
        />
      ) : null}

      <div className="grid md:grid-cols-2 gap-4">
        {items.map((s) =>
          editingId === s.id ? (
            <ServiceForm
              key={s.id}
              mode="edit"
              initial={s}
              onClose={() => setEditingId(null)}
            />
          ) : (
            <div
              key={s.id}
              className="bg-surface border border-line-soft rounded-2xl p-5 flex justify-between gap-4 hover:border-line hover:bg-surface-2 transition-colors"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-[1.02rem]">{s.name}</h3>
                <p className="text-muted text-[0.85rem] leading-relaxed mt-1">{s.description}</p>
                <div className="flex gap-1.5 mt-3">
                  <button
                    type="button"
                    onClick={() => setEditingId(s.id)}
                    className="border border-line-soft text-muted rounded-md px-2 py-1 text-[0.72rem] hover:text-text hover:border-line"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        await ask(`Remove "${s.name}"?`, {
                          confirmLabel: "Remove",
                          danger: true,
                        })
                      ) {
                        const fd = new FormData();
                        fd.set("id", String(s.id));
                        await deleteServiceAction(fd);
                      }
                    }}
                    className="border border-line-soft text-muted rounded-md px-2 py-1 text-[0.72rem] hover:text-red hover:border-red-soft"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-serif text-[1.4rem] text-accent">
                  {formatCents0(s.priceCents)}
                </div>
                <div className="text-muted mono text-[0.7rem]">{unitLabel[s.unit]}</div>
              </div>
            </div>
          ),
        )}
      </div>
    </>
  );
}

function ServiceForm({
  mode,
  initial,
  onClose,
}: {
  mode: "create" | "edit";
  initial: Service | null;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = (fd: FormData) => {
    startTransition(async () => {
      setError(null);
      const action = mode === "create" ? createServiceAction : updateServiceAction;
      const result = await action(undefined, fd);
      if (result?.error) setError(result.error);
      else onClose();
    });
  };

  return (
    <form
      action={submit}
      className="bg-bg-2 border border-line rounded-2xl p-5 grid grid-cols-2 gap-3"
    >
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="col-span-2">
        <label className="mono text-[0.66rem] tracking-[0.1em] uppercase text-muted">Name</label>
        <input
          name="name"
          defaultValue={initial?.name ?? ""}
          required
          className="w-full mt-1 bg-bg-2 border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
        />
      </div>
      <div className="col-span-2">
        <label className="mono text-[0.66rem] tracking-[0.1em] uppercase text-muted">
          Description
        </label>
        <input
          name="description"
          defaultValue={initial?.description ?? ""}
          className="w-full mt-1 bg-bg-2 border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="mono text-[0.66rem] tracking-[0.1em] uppercase text-muted">
          Price (ex GST)
        </label>
        <input
          name="price"
          type="number"
          step="0.01"
          defaultValue={initial ? (initial.priceCents / 100).toFixed(2) : ""}
          required
          className="w-full mt-1 bg-bg-2 border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="mono text-[0.66rem] tracking-[0.1em] uppercase text-muted">Unit</label>
        <select
          name="unit"
          defaultValue={initial?.unit ?? "fixed"}
          className="w-full mt-1 bg-bg-2 border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
        >
          <option value="fixed">Fixed</option>
          <option value="hourly">Hourly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
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
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
