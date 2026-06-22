import Link from "next/link";
import { desc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bankStatements } from "@/db/schema";

export async function PendingStatements() {
  const rows = await db
    .select()
    .from(bankStatements)
    .where(isNull(bankStatements.importedAt))
    .orderBy(desc(bankStatements.uploadedAt))
    .limit(5);

  if (!rows.length) return null;

  return (
    <div className="px-5 py-4 border-b border-line-soft">
      <div className="mono text-[0.66rem] tracking-[0.1em] uppercase text-muted mb-2">
        Awaiting review
      </div>
      <ul className="space-y-1.5">
        {rows.map((s) => (
          <li key={s.id} className="text-[0.85rem] flex items-center gap-2">
            <Link
              href={`/bas/import/${s.id}`}
              className="text-accent hover:underline"
            >
              {s.filename}
            </Link>
            <span className="text-muted text-[0.78rem]">
              · {s.transactionCount} txns
              {s.periodStart && s.periodEnd
                ? ` · ${s.periodStart} → ${s.periodEnd}`
                : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
