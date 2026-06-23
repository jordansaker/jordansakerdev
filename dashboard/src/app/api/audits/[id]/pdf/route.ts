import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { audits } from "@/db/schema";
import type { AuditFinding } from "@/db/schema";
import { isAuthenticated } from "@/lib/auth";
import { renderAuditPdf } from "@/lib/pdf/audit-pdf";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthenticated())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) {
    return new NextResponse("Bad id", { status: 400 });
  }
  const [row] = await db.select().from(audits).where(eq(audits.id, id)).limit(1);
  if (!row) return new NextResponse("Not found", { status: 404 });

  const findings = safeJson<AuditFinding[]>(row.findings, []);
  const scope = safeJson<string[]>(row.scope, []);

  const pdf = await renderAuditPdf({
    client: row.client,
    url: row.url,
    score: row.score,
    fee: row.fee,
    findings,
    scope,
  });

  const safeName = row.client.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "audit";
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}-performance-review.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
