"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/confirm";
import { Empty, Panel, Td, Th } from "@/components/ui";
import { formatCents } from "@/lib/money";
import type { ImportTransaction } from "@/lib/import-queries";
import type { CommitInput, CommitResult } from "./actions";

type RowState = {
  selected: boolean;
  description: string;
  hasGst: boolean;
  confirmMatch: boolean;
};

export function ReviewTable({
  statementId,
  rows,
  commitAction,
  discardAction,
}: {
  statementId: number;
  rows: ImportTransaction[];
  commitAction: (input: CommitInput) => Promise<CommitResult>;
  discardAction: (fd: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [state, setState] = useState<Record<number, RowState>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.id,
        {
          // Default: select all debits, select credits only when a match was found
          selected:
            r.direction === "debit" || r.matchedInvoiceId !== null,
          description: r.description,
          hasGst: r.hasGstGuess,
          confirmMatch: r.matchedInvoiceId !== null,
        },
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { ask, dialog } = useConfirm();

  const summary = useMemo(() => {
    let expensesToCreate = 0;
    let expensesCents = 0;
    let paymentsToConfirm = 0;
    let paymentsCents = 0;
    let ignored = 0;
    for (const r of rows) {
      const s = state[r.id];
      if (!s?.selected) {
        ignored++;
        continue;
      }
      if (r.direction === "debit") {
        expensesToCreate++;
        expensesCents += r.amountCents;
      } else if (s.confirmMatch && r.matchedInvoiceId) {
        paymentsToConfirm++;
        paymentsCents += r.amountCents;
      } else {
        ignored++;
      }
    }
    return { expensesToCreate, expensesCents, paymentsToConfirm, paymentsCents, ignored };
  }, [rows, state]);

  function patch(id: number, p: Partial<RowState>) {
    setState((s) => ({ ...s, [id]: { ...s[id], ...p } }));
  }

  function commit() {
    setError(null);
    startTransition(async () => {
      const result = await commitAction({
        statementId,
        selections: rows.map((r) => ({
          txId: r.id,
          selected: state[r.id]?.selected ?? false,
          description: state[r.id]?.description ?? r.description,
          hasGst: state[r.id]?.hasGst ?? r.hasGstGuess,
          matchedInvoiceId: r.matchedInvoiceId,
          confirmMatch: state[r.id]?.confirmMatch ?? false,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/bas");
    });
  }

  return (
    <>
      {dialog}
      <Panel
        title="Proposed import"
        meta={`${summary.expensesToCreate} expenses · ${summary.paymentsToConfirm} payments · ${summary.ignored} ignored`}
      >
        {rows.length === 0 ? (
          <Empty>No transactions on this statement</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr>
                  <Th className="w-8" />
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = state[r.id];
                  return (
                    <tr key={r.id} className="hover:bg-surface-2 transition-colors">
                      <Td>
                        <input
                          type="checkbox"
                          checked={s.selected}
                          onChange={(e) => patch(r.id, { selected: e.target.checked })}
                          className="accent-accent"
                        />
                      </Td>
                      <Td className="mono text-muted whitespace-nowrap">{r.txDate}</Td>
                      <Td>
                        <input
                          type="text"
                          value={s.description}
                          onChange={(e) => patch(r.id, { description: e.target.value })}
                          disabled={!s.selected}
                          className="w-full bg-bg-2 border border-line-soft rounded px-2 py-1 text-[0.88rem] focus:outline-none focus:border-accent disabled:opacity-50"
                        />
                      </Td>
                      <Td
                        className={`mono text-right whitespace-nowrap font-medium ${
                          r.direction === "credit" ? "text-green" : "text-red"
                        }`}
                      >
                        {r.direction === "credit" ? "+" : "−"}
                        {formatCents(r.amountCents)}
                      </Td>
                      <Td>
                        {r.direction === "debit" ? (
                          <label className="flex items-center gap-2 text-[0.82rem] text-muted">
                            <input
                              type="checkbox"
                              checked={s.hasGst}
                              onChange={(e) => patch(r.id, { hasGst: e.target.checked })}
                              disabled={!s.selected}
                              className="accent-accent"
                            />
                            GST inclusive
                          </label>
                        ) : r.matchedInvoiceId && r.matchedInvoiceNumber ? (
                          <label className="flex items-center gap-2 text-[0.82rem]">
                            <input
                              type="checkbox"
                              checked={s.confirmMatch}
                              onChange={(e) =>
                                patch(r.id, { confirmMatch: e.target.checked })
                              }
                              disabled={!s.selected}
                              className="accent-accent"
                            />
                            <span className="text-muted">
                              Mark{" "}
                              <span className="mono text-accent">
                                {r.matchedInvoiceNumber}
                              </span>{" "}
                              paid
                            </span>
                          </label>
                        ) : (
                          <span className="text-[0.82rem] text-muted-2">
                            No matching invoice
                          </span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="text-[0.85rem] text-muted">
          On commit:{" "}
          <span className="text-text">
            {summary.expensesToCreate} expense{summary.expensesToCreate === 1 ? "" : "s"}{" "}
            ({formatCents(summary.expensesCents)})
          </span>{" "}
          ·{" "}
          <span className="text-text">
            {summary.paymentsToConfirm} invoice{summary.paymentsToConfirm === 1 ? "" : "s"}{" "}
            marked paid ({formatCents(summary.paymentsCents)})
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              const ok = await ask(
                "Discard this statement and all parsed transactions?",
                { confirmLabel: "Discard", danger: true },
              );
              if (ok) {
                const fd = new FormData();
                fd.set("statementId", String(statementId));
                await discardAction(fd);
              }
            }}
            className="rounded-full border border-line text-muted hover:text-red hover:border-red-soft font-semibold text-[0.88rem] px-4 py-2.5 transition-colors"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={pending}
            className="rounded-full bg-accent text-bg font-semibold text-[0.88rem] px-4 py-2.5 disabled:opacity-50 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)] transition-all"
          >
            {pending ? "Committing…" : "Commit selections"}
          </button>
        </div>
      </div>
      {error ? <p className="text-red text-sm mt-3 text-right">{error}</p> : null}
    </>
  );
}
