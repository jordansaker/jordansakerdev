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
    <>
      {/* Mobile: stacked cards (< md). Wide tables on small screens force a
          horizontal scroll that's awkward to thumb through. */}
      <div className="md:hidden space-y-2">
        {cards.map((c) => (
          <MobileCard key={c.id} card={c} onOpen={onOpen} />
        ))}
      </div>

      {/* Tablet/desktop: full table (md+). */}
      <div className="hidden md:block bg-surface border border-line-soft rounded-2xl overflow-hidden">
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
                    <Td className="text-muted text-[0.85rem]">
                      {c.source ?? "—"}
                    </Td>
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
    </>
  );
}

function MobileCard({
  card,
  onOpen,
}: {
  card: PipelineCard;
  onOpen: (id: number) => void;
}) {
  const fu = card.activeFollowUp
    ? describeRelativeDate(card.activeFollowUp.due)
    : null;
  return (
    <button
      type="button"
      onClick={() => onOpen(card.id)}
      className="w-full text-left bg-surface border border-line-soft rounded-xl p-4 hover:bg-surface-2 active:bg-surface-2 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[0.95rem] text-text truncate">
            {card.name}
          </div>
          {card.email ? (
            <div className="text-[0.78rem] text-muted-2 mono mt-0.5 truncate">
              {card.email}
            </div>
          ) : null}
        </div>
        {card.estimatedValueCents != null ? (
          <div className="mono text-[0.88rem] text-text shrink-0">
            {formatCents0(card.estimatedValueCents)}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-[0.74rem]">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: STAGE_COLOR[card.stage] }}
            aria-hidden
          />
          {STAGE_LABEL[card.stage]}
        </span>
        {fu ? (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.68rem] mono ${
              fu.tone === "overdue"
                ? "bg-red-soft text-red"
                : "bg-amber-soft text-amber"
            }`}
          >
            {fu.tone === "overdue" ? "⚑" : "⏳"}
            <span>{fu.text}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[0.74rem] text-muted-2 flex-wrap">
        {card.source ? (
          <span className="truncate max-w-[55%]">{card.source}</span>
        ) : null}
        {card.lastContact ? (
          <span className="mono whitespace-nowrap">
            <span className="uppercase tracking-wider mr-1">
              {card.lastContact.type}
            </span>
            {card.lastContact.date}
          </span>
        ) : (
          <span className="text-muted-2">No contact yet</span>
        )}
      </div>
    </button>
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
