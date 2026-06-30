import { PageHead } from "@/components/ui";
import { formatCents0 } from "@/lib/money";
import { STAGES, loadBoard, loadClientDetail } from "@/lib/crm";
import { Board } from "./board";
import {
  createLeadAction,
  deleteActivityAction,
  deleteClientAction,
  logActivityAction,
  markFollowUpDoneAction,
  moveClientAction,
  updateClientAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients · Studio" };

type SP = Promise<{ client?: string }>;

export default async function ClientsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const cards = await loadBoard();

  const activePipelineCents = cards
    .filter((c) => c.stage !== "delivered")
    .reduce((s, c) => s + (c.estimatedValueCents ?? 0), 0);
  const wonWorkCents = cards
    .filter((c) => c.stage === "engaged" || c.stage === "in_build")
    .reduce((s, c) => s + (c.estimatedValueCents ?? 0), 0);
  const deliveredCount = cards.filter((c) => c.stage === "delivered").length;

  const drawerId = sp.client && /^\d+$/.test(sp.client) ? Number(sp.client) : null;
  const drawerCard = drawerId ? cards.find((c) => c.id === drawerId) ?? null : null;
  const drawerDetail = drawerId ? await loadClientDetail(drawerId) : null;
  const drawerData =
    drawerCard && drawerDetail
      ? { client: drawerCard, activities: drawerDetail.activities }
      : null;

  return (
    <>
      <PageHead
        title="Clients"
        subtitle="Drag cards between stages. Click any card for the outreach log."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat
          label="Active pipeline"
          value={formatCents0(activePipelineCents)}
          sub="Total value not yet delivered"
        />
        <Stat
          label="Won work"
          value={formatCents0(wonWorkCents)}
          sub="Engaged + In build"
          accent
        />
        <Stat
          label="Delivered"
          value={String(deliveredCount)}
          sub={deliveredCount === 1 ? "client" : "clients"}
        />
      </div>

      <Board
        stages={STAGES}
        cards={cards}
        drawerData={drawerData}
        moveAction={moveClientAction}
        createLeadAction={createLeadAction}
        updateClientAction={updateClientAction}
        deleteClientAction={deleteClientAction}
        logActivityAction={logActivityAction}
        markFollowUpDoneAction={markFollowUpDoneAction}
        deleteActivityAction={deleteActivityAction}
      />
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-surface border border-line-soft rounded-2xl p-5">
      <div className="mono text-[0.66rem] tracking-[0.12em] uppercase text-muted">
        {label}
      </div>
      <div
        className={`font-serif font-normal text-[1.9rem] mt-2.5 leading-none ${
          accent ? "text-accent" : ""
        }`}
      >
        {value}
      </div>
      <div className="text-[0.8rem] text-muted mt-2">{sub}</div>
    </div>
  );
}
