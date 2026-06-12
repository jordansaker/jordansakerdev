"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Client, Service } from "@/db/schema";
import { formatCents, GST_RATE } from "@/lib/money";
import type { SaveQuoteResult } from "./actions";

type Line = {
  description: string;
  quantity: number;
  unitPriceCents: number;
};

const empty: Line = { description: "", quantity: 1, unitPriceCents: 0 };

const unitLabel: Record<Service["unit"], string> = {
  fixed: "fixed",
  hourly: "/hr",
  monthly: "/mo",
};

export function QuoteBuilder({
  clients,
  services,
  gstRegistered,
  saveAction,
}: {
  clients: Client[];
  services: Service[];
  gstRegistered: boolean;
  saveAction: (input: {
    clientId: number;
    notes?: string;
    lines: Line[];
    asInvoice: boolean;
  }) => Promise<SaveQuoteResult>;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState<number>(clients[0]?.id ?? 0);
  const [lines, setLines] = useState<Line[]>([{ ...empty }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const subtotalCents = useMemo(
    () => lines.reduce((s, l) => s + Math.round(l.quantity * l.unitPriceCents), 0),
    [lines],
  );
  const gst = gstRegistered ? Math.round(subtotalCents * GST_RATE) : 0;
  const total = subtotalCents + gst;

  function addStdLine(id: string) {
    if (!id) return;
    const svc = services.find((x) => String(x.id) === id);
    if (!svc) return;
    setLines((curr) => {
      const isInitialEmpty =
        curr.length === 1 && !curr[0].description && curr[0].unitPriceCents === 0;
      const next = isInitialEmpty ? [] : [...curr];
      next.push({
        description: svc.name,
        quantity: 1,
        unitPriceCents: svc.priceCents,
      });
      return next;
    });
  }

  function update(i: number, patch: Partial<Line>) {
    setLines((curr) => curr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addCustom() {
    setLines((curr) => [...curr, { ...empty }]);
  }

  function remove(i: number) {
    setLines((curr) => {
      const next = curr.filter((_, idx) => idx !== i);
      return next.length ? next : [{ ...empty }];
    });
  }

  function save(asInvoice: boolean) {
    setError(null);
    const valid = lines.filter((l) => l.description.trim() && l.unitPriceCents > 0);
    if (!valid.length) {
      setError("Add at least one line item with a description and price.");
      return;
    }
    startTransition(async () => {
      const result = await saveAction({
        clientId,
        notes: notes.trim() || undefined,
        lines: valid,
        asInvoice,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLines([{ ...empty }]);
      setNotes("");
      if (result.kind === "invoice") {
        router.push("/invoices");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5">
      <div className="bg-surface border border-line-soft rounded-2xl p-5">
        <Field label="Client">
          <select
            value={clientId}
            onChange={(e) => setClientId(Number(e.target.value))}
            className={inputClass}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Add a standard service">
          <select
            value=""
            onChange={(e) => {
              addStdLine(e.target.value);
              e.target.value = "";
            }}
            className={inputClass}
          >
            <option value="">— pick a service to add —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatCents(s.priceCents)}
                {s.unit !== "fixed" ? ` ${unitLabel[s.unit]}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <label className="block mono text-[0.66rem] tracking-[0.1em] uppercase text-muted mt-2 mb-2.5">
          Line items
        </label>
        <div className="grid grid-cols-[1fr_60px_90px_28px] sm:grid-cols-[1fr_70px_110px_36px] gap-2.5 text-muted-2 text-[0.7rem] mono mb-1">
          <span>DESCRIPTION</span>
          <span>QTY</span>
          <span>UNIT PRICE</span>
          <span />
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_60px_90px_28px] sm:grid-cols-[1fr_70px_110px_36px] gap-2.5 items-center">
              <input
                value={l.description}
                placeholder="Description"
                onChange={(e) => update(i, { description: e.target.value })}
                className={lineInputClass}
              />
              <input
                type="number"
                value={l.quantity}
                min={0}
                step="0.25"
                onChange={(e) =>
                  update(i, { quantity: Number(e.target.value) || 0 })
                }
                className={lineInputClass}
              />
              <input
                type="number"
                value={l.unitPriceCents / 100}
                min={0}
                step="0.01"
                onChange={(e) =>
                  update(i, {
                    unitPriceCents: Math.round((Number(e.target.value) || 0) * 100),
                  })
                }
                className={lineInputClass}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-muted-2 hover:text-red text-lg"
                aria-label="Remove line"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addCustom}
          className="w-full mt-3 border border-dashed border-line text-muted rounded-lg py-2.5 text-[0.85rem] hover:border-accent hover:text-accent transition-colors"
        >
          + Add custom line item
        </button>

        <Field label="Notes (optional)" className="mt-4">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Visible on the quote PDF"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="bg-bg-2 border border-line-soft rounded-2xl p-5 h-fit sticky top-8">
        <h3 className="font-serif font-medium text-[1.1rem] mb-4">Quote summary</h3>
        <Row label="Subtotal" value={formatCents(subtotalCents)} />
        <Row
          label="GST (10%)"
          value={formatCents(gst)}
          dim={!gstRegistered}
        />
        <div className="flex justify-between pt-3.5 mt-2 border-t border-line text-base font-semibold">
          <span>Total</span>
          <span className="font-serif text-accent text-[1.25rem] font-normal">
            {formatCents(total)}
          </span>
        </div>
        {error ? <p className="text-red text-sm mt-3">{error}</p> : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => save(false)}
          className="w-full mt-4 rounded-full bg-accent text-bg font-semibold text-[0.88rem] py-2.5 disabled:opacity-50 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)] transition-all"
        >
          {pending ? "Saving…" : "Save quote"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => save(true)}
          className="w-full mt-2 rounded-full border border-line text-text font-semibold text-[0.88rem] py-2.5 hover:border-text disabled:opacity-50 transition-colors"
        >
          Save & convert to invoice
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-bg-2 border border-line rounded-lg px-3 py-2.5 text-[0.92rem] focus:outline-none focus:border-accent";
const lineInputClass =
  "w-full bg-bg-2 border border-line rounded-lg px-2.5 py-2 text-[0.88rem] focus:outline-none focus:border-accent";

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mb-4 ${className}`}>
      <label className="block mono text-[0.66rem] tracking-[0.1em] uppercase text-muted mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div
      className={`flex justify-between py-2 text-[0.92rem] text-muted ${
        dim ? "opacity-40" : ""
      }`}
    >
      <span>{label}</span>
      <span className="mono text-text">{value}</span>
    </div>
  );
}
