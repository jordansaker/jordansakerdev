import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/ui";
import { getImportData } from "@/lib/import-queries";
import { ReviewTable } from "./review-table";
import { commitImportAction, discardStatementAction } from "./actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function ReviewImportPage({ params }: { params: Params }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) notFound();
  const data = await getImportData(idNum);
  if (!data) notFound();

  const { statement, rows } = data;
  const debitCount = rows.filter((r) => r.direction === "debit").length;
  const creditCount = rows.filter((r) => r.direction === "credit").length;
  const matched = rows.filter((r) => r.matchedInvoiceId !== null).length;

  return (
    <>
      <PageHead
        title="Review bank statement"
        subtitle={
          <>
            <span className="mono">{statement.filename}</span>
            {statement.periodStart && statement.periodEnd ? (
              <span className="text-muted-2">
                {" "}
                · {statement.periodStart} → {statement.periodEnd}
              </span>
            ) : null}
            <span className="text-muted-2">
              {" "}· {debitCount} debits · {creditCount} credits · {matched} pre-matched
            </span>
          </>
        }
        right={
          <Link
            href="/bas"
            className="rounded-full border border-line text-text font-semibold text-[0.88rem] px-4 py-2.5 hover:border-text transition-colors"
          >
            ← Back to BAS
          </Link>
        }
      />

      <ReviewTable
        statementId={statement.id}
        rows={rows}
        commitAction={commitImportAction}
        discardAction={discardStatementAction}
      />
    </>
  );
}
