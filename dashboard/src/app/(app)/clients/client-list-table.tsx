"use client";

import { formatCents0 } from "@/lib/money";
import {
  STAGE_COLOR,
  STAGE_LABEL,
  describeRelativeDate,
  type PipelineCard,
} from "@/lib/crm-client-helpers";

export function ClientListTable({
  cards,
  onOpen,
}: {
  cards: PipelineCard[];
  onOpen: (id: number) => void;
}) {
  if (!cards.length) {
    return (
      <div className="bg-surface border border-line-soft rounded-2xl p-8 text-center text-muted-2 text-[0.9rem]">
        No clients match.
      </div>
    );
  }
  return (
    <div className="bg-surface border border-line-soft rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Stage</Th>
              <Th className="text-right">Value</Th>
              <Th>Source</Th>
              <Th>Last contact</Th>
              <Th>Follow-up</Th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => {
              const fu = c.activeFollowUp
                ? describeRelativeDate(c.activeFollowUp.due)
                : null;
              return (
                <tr
                  key={c.id}
                  onClick={() => onOpen(c.id)}
                  className="border-t border-line-soft hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <Td>
                    <div className="font-semibold text-[0.92rem] text-text">
                      {c.name}
                    </div>
                    {c.email ? (
                      <div className="text-[0.78rem] text-muted-2 mono mt-0.5 truncate">
                        {c.email}
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5 text-[0.78rem]">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: STAGE_COLOR[c.stage] }}
                        aria-hidden
                      />
                      {STAGE_LABEL[c.stage]}
                    </span>
                  </Td>
                  <Td className="mono text-right whitespace-nowrap">
                    {c.estimatedValueCents != null
                      ? formatCents0(c.estimatedValueCents)
                      : "—"}
                  </Td>
                  <Td className="text-muted text-[0.85rem]">{c.source ?? "—"}</Td>
                  <Td className="text-[0.82rem]">
                    {c.lastContact ? (
                      <>
                        <span className="mono text-[0.7rem] uppercase tracking-wider text-muted-2 mr-1.5">
                          {c.lastContact.type}
                        </span>
                        <span className="mono text-muted">
                          {c.lastContact.date}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-2">—</span>
                    )}
                  </Td>
                  <Td>
                    {fu ? (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.7rem] mono ${
                          fu.tone === "overdue"
                            ? "bg-red-soft text-red"
                            : "bg-amber-soft text-amber"
                        }`}
                      >
                        {fu.tone === "overdue" ? "⚑" : "⏳"}
                        <span>{fu.text}</span>
                      </span>
                    ) : (
                      <span className="text-muted-2 text-[0.78rem]">—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-left font-mono text-[0.66rem] tracking-[0.1em] uppercase text-muted-2 px-5 py-3 border-b border-line-soft font-medium ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-5 py-3.5 text-[0.9rem] align-top ${className}`}>
      {children}
    </td>
  );
}
