import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/ui";
import { db } from "@/db";
import { audits } from "@/db/schema";
import type { AuditFinding } from "@/db/schema";
import {
  defaultSectionsFor,
  type AuditSections,
  type TemplateKey,
} from "@/lib/audit-templates";
import { AuditEditor } from "./audit-editor";
import {
  deleteAuditAction,
  sendAuditEmailAction,
  updateAuditAction,
} from "../actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const [row] = await db
    .select({ client: audits.client })
    .from(audits)
    .where(eq(audits.id, Number(id)))
    .limit(1);
  return { title: row ? `${row.client} audit · Studio` : "Audit · Studio" };
}

export default async function AuditEditorPage({ params }: { params: Params }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) notFound();
  const [row] = await db
    .select()
    .from(audits)
    .where(eq(audits.id, idNum))
    .limit(1);
  if (!row) notFound();

  const initial = {
    client: row.client,
    url: row.url,
    template: row.template as TemplateKey,
    sections: safeJson<AuditSections>(
      row.sections,
      defaultSectionsFor(row.template),
    ),
    score: row.score?.toString() ?? "",
    fee: row.fee ?? "",
    findings: safeJson<AuditFinding[]>(row.findings, []),
    scope: safeJson<string[]>(row.scope, []),
    recipientEmail: row.recipientEmail ?? "",
  };

  return (
    <>
      <PageHead
        title={row.client}
        subtitle={
          <>
            <span className="mono text-muted">{row.url}</span>
            {row.sentAt ? (
              <span className="ml-3 mono text-[0.78rem] text-green">
                · sent {row.sentAt.toISOString().slice(0, 10)}
              </span>
            ) : null}
          </>
        }
        right={
          <Link
            href="/audit"
            className="rounded-full border border-line text-text font-semibold text-[0.88rem] px-4 py-2.5 hover:border-text transition-colors"
          >
            ← All audits
          </Link>
        }
      />

      <AuditEditor
        id={row.id}
        initial={initial}
        saveAction={updateAuditAction}
        sendAction={sendAuditEmailAction}
        deleteAction={deleteAuditAction}
      />
    </>
  );
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
