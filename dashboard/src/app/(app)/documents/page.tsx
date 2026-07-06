import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { PageHead } from "@/components/ui";
import { SectionTabs } from "@/components/section-tabs";
import { DOCUMENTS_TABS } from "./tabs";
import { getSettings } from "@/lib/settings";
import { DocumentsShell } from "./documents-shell";
import { createDocumentAction, deleteDocumentAction, saveDocumentAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents · Studio" };

type SP = Promise<{ id?: string }>;

export default async function DocumentsPage({ searchParams }: { searchParams: SP }) {
  const { id: idParam } = await searchParams;

  const [settings, docs] = await Promise.all([
    getSettings(),
    db
      .select({
        id: documents.id,
        title: documents.title,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .orderBy(desc(documents.updatedAt), asc(documents.id)),
  ]);

  const requested = idParam ? Number(idParam) : NaN;
  const activeId =
    Number.isInteger(requested) && docs.some((d) => d.id === requested)
      ? requested
      : docs[0]?.id ?? null;

  const active = activeId
    ? (
        await db
          .select()
          .from(documents)
          .where(eq(documents.id, activeId))
          .limit(1)
      )[0] ?? null
    : null;

  return (
    <>
      <PageHead
        title="Documents"
        subtitle="Draft proposals, statements of work and notes with rich formatting and images."
      />
      <SectionTabs tabs={DOCUMENTS_TABS} />
      <DocumentsShell
        docs={docs}
        activeDoc={active}
        brand={{
          legalName: settings.legalName,
          abn: settings.abn,
          email: settings.businessEmail,
          address: settings.addressLine,
        }}
        createAction={createDocumentAction}
        saveAction={saveDocumentAction}
        deleteAction={deleteDocumentAction}
      />
    </>
  );
}
