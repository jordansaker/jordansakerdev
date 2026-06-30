"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatCents0 } from "@/lib/money";
import {
  STAGE_COLOR,
  STAGE_LABEL,
  describeRelativeDate,
  matchesSearch,
  sortByRecentActivity,
  type PipelineCard,
} from "@/lib/crm-client-helpers";
import type { ClientActivity, ClientStage } from "@/db/schema";
import { ClientDrawer } from "./drawer";
import { AddLeadModal } from "./add-lead-modal";
import { ClientListTable } from "./client-list-table";

type MoveAction = (input: {
  clientId: number;
  targetStage: ClientStage;
  beforeId: number | null;
}) => Promise<{ ok: boolean; error?: string }>;

type CreateLeadAction = (
  prev: { error?: string } | undefined,
  fd: FormData,
) => Promise<{ error?: string }>;

type UpdateClientAction = CreateLeadAction;

type LogActivityAction = (input: {
  clientId: number;
  type: ClientActivity["type"];
  activityDate: string;
  note: string;
  followUpDue: string | null;
}) => Promise<{ ok: boolean; error?: string }>;

type SimpleFormAction = (fd: FormData) => Promise<void> | Promise<{ ok: boolean; error?: string }>;

export function Board({
  stages,
  cards,
  drawerData,
  moveAction,
  createLeadAction,
  updateClientAction,
  deleteClientAction,
  logActivityAction,
  markFollowUpDoneAction,
  deleteActivityAction,
}: {
  stages: ClientStage[];
  cards: PipelineCard[];
  drawerData: { client: PipelineCard | null; activities: ClientActivity[] } | null;
  moveAction: MoveAction;
  createLeadAction: CreateLeadAction;
  updateClientAction: UpdateClientAction;
  deleteClientAction: SimpleFormAction;
  logActivityAction: LogActivityAction;
  markFollowUpDoneAction: SimpleFormAction;
  deleteActivityAction: SimpleFormAction;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [optimisticCards, setOptimisticCards] = useState(cards);
  const [, startTransition] = useTransition();
  const [addingLead, setAddingLead] = useState(false);
  const [query, setQuery] = useState("");

  // Keep optimistic state in sync when server re-renders
  useMemo(() => {
    setOptimisticCards(cards);
  }, [cards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const filteredCards = useMemo(
    () => optimisticCards.filter((c) => matchesSearch(c, query)),
    [optimisticCards, query],
  );

  const cardsByStage = useMemo(() => {
    const map = new Map<ClientStage, PipelineCard[]>();
    for (const s of stages) map.set(s, []);
    for (const c of filteredCards) {
      const list = map.get(c.stage);
      if (list) list.push(c);
    }
    return map;
  }, [filteredCards, stages]);

  const listRows = useMemo(
    () => [...filteredCards].sort(sortByRecentActivity),
    [filteredCards],
  );

  function openCard(id: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("client", String(id));
    router.push(`/clients?${params.toString()}`, { scroll: false });
  }

  function closeDrawer() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("client");
    const qs = params.toString();
    router.push(qs ? `/clients?${qs}` : "/clients", { scroll: false });
  }

  function findCard(id: number) {
    return optimisticCards.find((c) => c.id === id);
  }

  function performMove(
    clientId: number,
    targetStage: ClientStage,
    beforeId: number | null,
  ) {
    setOptimisticCards((curr) => {
      const moving = curr.find((c) => c.id === clientId);
      if (!moving) return curr;
      const without = curr.filter((c) => c.id !== clientId);
      const sameStage = without.filter((c) => c.stage === targetStage);
      const others = without.filter((c) => c.stage !== targetStage);
      let insertIdx = sameStage.length;
      if (beforeId !== null) {
        const i = sameStage.findIndex((c) => c.id === beforeId);
        if (i >= 0) insertIdx = i;
      }
      const nextSameStage = [
        ...sameStage.slice(0, insertIdx),
        { ...moving, stage: targetStage },
        ...sameStage.slice(insertIdx),
      ];
      const reindexed = nextSameStage.map((c, idx) => ({
        ...c,
        sortOrder: (idx + 1) * 100,
      }));
      return [...others, ...reindexed].sort((a, b) =>
        a.stage === b.stage ? a.sortOrder - b.sortOrder : 0,
      );
    });
    startTransition(async () => {
      await moveAction({ clientId, targetStage, beforeId });
      router.refresh();
    });
  }

  function nudge(card: PipelineCard, dir: -1 | 1) {
    const idx = stages.indexOf(card.stage);
    const next = stages[idx + dir];
    if (!next) return;
    performMove(card.id, next, null);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = Number(active.id);
    const card = findCard(activeId);
    if (!card) return;

    // over.id is either a card id (sortable item) or a stage container id
    const overIdStr = String(over.id);
    let targetStage: ClientStage;
    let beforeId: number | null = null;

    if (overIdStr.startsWith("stage:")) {
      targetStage = overIdStr.slice("stage:".length) as ClientStage;
      beforeId = null;
    } else {
      const overCard = findCard(Number(overIdStr));
      if (!overCard) return;
      targetStage = overCard.stage;
      // place activeCard before overCard
      beforeId = overCard.id;
      // If reordering within same stage and active is above over, place after instead
      if (card.stage === targetStage) {
        const stageList = cardsByStage.get(targetStage)!;
        const activeIdx = stageList.findIndex((c) => c.id === activeId);
        const overIdx = stageList.findIndex((c) => c.id === overCard.id);
        if (activeIdx < overIdx) {
          // Move down → drop after overCard, i.e. before the next one
          const next = stageList[overIdx + 1];
          beforeId = next ? next.id : null;
        }
      }
    }

    performMove(activeId, targetStage, beforeId);
  }

  // Avoid unused warning
  void onDragOver;
  function onDragOver(_e: DragOverEvent) {}

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-2 pointer-events-none"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients by name, email, source, or notes…"
            className="w-full bg-bg-2 border border-line rounded-full pl-9 pr-9 py-2 text-[0.9rem] text-text focus:outline-none focus:border-accent"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-2 hover:text-text text-[1rem]"
            >
              ×
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setAddingLead(true)}
          className="rounded-full bg-accent text-bg font-semibold text-[0.88rem] px-4 py-2.5 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)] transition-all whitespace-nowrap"
        >
          + Add lead
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          {stages.map((stage) => {
            const stageCards = cardsByStage.get(stage) ?? [];
            const totalCents = stageCards.reduce(
              (s, c) => s + (c.estimatedValueCents ?? 0),
              0,
            );
            return (
              <StageColumn
                key={stage}
                stage={stage}
                cards={stageCards}
                totalCents={totalCents}
                onOpen={openCard}
                onNudge={nudge}
                stages={stages}
              />
            );
          })}
        </div>
      </DndContext>

      <div className="mt-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif font-medium text-[1.1rem]">All clients</h2>
          <span className="text-[0.78rem] text-muted-2 mono">
            {listRows.length}
            {query ? ` of ${optimisticCards.length}` : ""}
          </span>
        </div>
        <ClientListTable cards={listRows} onOpen={openCard} />
      </div>

      {addingLead ? (
        <AddLeadModal
          stages={stages}
          action={createLeadAction}
          onClose={() => setAddingLead(false)}
        />
      ) : null}

      {drawerData && drawerData.client ? (
        <ClientDrawer
          client={drawerData.client}
          activities={drawerData.activities}
          stages={stages}
          onClose={closeDrawer}
          updateClientAction={updateClientAction}
          deleteClientAction={deleteClientAction}
          logActivityAction={logActivityAction}
          markFollowUpDoneAction={markFollowUpDoneAction}
          deleteActivityAction={deleteActivityAction}
        />
      ) : null}
    </>
  );
}

function StageColumn({
  stage,
  cards,
  totalCents,
  onOpen,
  onNudge,
  stages,
}: {
  stage: ClientStage;
  cards: PipelineCard[];
  totalCents: number;
  onOpen: (id: number) => void;
  onNudge: (card: PipelineCard, dir: -1 | 1) => void;
  stages: ClientStage[];
}) {
  return (
    <div className="bg-bg-2 border border-line-soft rounded-2xl flex-shrink-0 w-[280px] sm:w-[300px] flex flex-col lg:max-h-[calc(100vh-280px)]">
      <div className="px-4 py-3 border-b border-line-soft sticky top-0 bg-bg-2 rounded-t-2xl">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: STAGE_COLOR[stage] }}
            aria-hidden
          />
          <h3 className="font-semibold text-[0.9rem]">{STAGE_LABEL[stage]}</h3>
          <span className="mono text-[0.72rem] text-muted-2 ml-auto">
            {cards.length}
          </span>
        </div>
        <div className="mono text-[0.78rem] text-muted">
          {totalCents > 0 ? formatCents0(totalCents) : "—"}
        </div>
      </div>
      <SortableContext
        id={`stage:${stage}`}
        items={cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="p-3 space-y-2 lg:overflow-y-auto flex-1" data-stage={stage}>
          {cards.length === 0 ? (
            <DropPlaceholder stage={stage} />
          ) : (
            cards.map((c) => (
              <PipelineCardView
                key={c.id}
                card={c}
                onOpen={onOpen}
                onNudge={onNudge}
                stages={stages}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function DropPlaceholder({ stage }: { stage: ClientStage }) {
  // Empty droppable — dnd-kit handles drops via SortableContext id when empty
  void stage;
  return (
    <div className="text-center text-muted-2 text-[0.8rem] py-8 border border-dashed border-line-soft rounded-lg">
      Drop here
    </div>
  );
}

function PipelineCardView({
  card,
  onOpen,
  onNudge,
  stages,
}: {
  card: PipelineCard;
  onOpen: (id: number) => void;
  onNudge: (card: PipelineCard, dir: -1 | 1) => void;
  stages: ClientStage[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderLeftColor: STAGE_COLOR[card.stage],
  };
  const stageIdx = stages.indexOf(card.stage);
  const canBack = stageIdx > 0;
  const canFwd = stageIdx < stages.length - 1;

  const fu = card.activeFollowUp;
  const followUpDesc = fu ? describeRelativeDate(fu.due) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group bg-surface border border-line-soft border-l-[3px] rounded-lg p-3 cursor-pointer hover:bg-surface-2 transition-colors"
      {...attributes}
      onClick={(e) => {
        // Don't open if clicking nudge button
        if ((e.target as HTMLElement).closest("[data-nudge]")) return;
        onOpen(card.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (
            !(e.target as HTMLElement).hasAttribute("draggable") &&
            !(e.target as HTMLElement).closest("[data-nudge]")
          )
            return;
        }
      }}
    >
      <div className="flex items-start gap-2">
        <div
          {...listeners}
          className="flex-1 min-w-0"
          aria-label="Drag handle"
        >
          <div className="font-semibold text-[0.92rem] truncate">{card.name}</div>
          <div className="mono text-[0.78rem] text-muted mt-0.5">
            {card.estimatedValueCents != null
              ? formatCents0(card.estimatedValueCents)
              : "—"}
          </div>
          {card.source ? (
            <div className="text-[0.72rem] text-muted-2 mt-0.5 truncate">
              {card.source}
            </div>
          ) : null}
        </div>
        <div
          className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          data-nudge
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (canBack) onNudge(card, -1);
            }}
            disabled={!canBack}
            aria-label="Move back a stage"
            className="w-6 h-6 rounded border border-line-soft text-muted hover:text-text hover:border-line disabled:opacity-30 text-[0.7rem]"
          >
            ◂
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (canFwd) onNudge(card, 1);
            }}
            disabled={!canFwd}
            aria-label="Move forward a stage"
            className="w-6 h-6 rounded border border-line-soft text-muted hover:text-text hover:border-line disabled:opacity-30 text-[0.7rem]"
          >
            ▸
          </button>
        </div>
      </div>

      {fu && followUpDesc ? (
        <div
          className={`mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.7rem] mono ${
            followUpDesc.tone === "overdue"
              ? "bg-red-soft text-red"
              : "bg-amber-soft text-amber"
          }`}
        >
          {followUpDesc.tone === "overdue" ? "⚑" : "⏳"}
          <span>{followUpDesc.text}</span>
        </div>
      ) : null}

      {card.lastContact ? (
        <div className="text-[0.7rem] text-muted-2 mt-1.5">
          Last {card.lastContact.type} · {card.lastContact.date}
        </div>
      ) : null}
    </div>
  );
}
