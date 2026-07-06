import { Empty, PageHead, Panel, Th } from "@/components/ui";
import { SectionTabs } from "@/components/section-tabs";
import { DOCUMENTS_TABS } from "../documents/tabs";
import { AuditRows } from "./audit-rows";
import {
  createAuditAction,
  deleteAuditAction,
  listAudits,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audits · Studio" };

export default async function AuditListPage() {
  const rows = await listAudits();
  return (
    <>
      <PageHead
        title="Documents"
        subtitle="Branded performance reviews for prospects. Edit, download, or send via email."
        right={
          <form action={createAuditAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-accent text-bg font-semibold text-[0.88rem] px-4 py-2.5 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)] transition-all"
            >
              + New audit
            </button>
          </form>
        }
      />
      <SectionTabs tabs={DOCUMENTS_TABS} />

      <Panel>
        {rows.length === 0 ? (
          <Empty>No audits yet — create your first.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>URL</Th>
                  <Th className="text-right">Score</Th>
                  <Th className="text-right">Fee</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Updated</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                <AuditRows rows={rows} deleteAction={deleteAuditAction} />
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
