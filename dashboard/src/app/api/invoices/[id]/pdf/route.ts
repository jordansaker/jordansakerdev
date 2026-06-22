import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { getInvoiceById } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

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
  const [invoice, settings] = await Promise.all([getInvoiceById(id), getSettings()]);
  if (!invoice) return new NextResponse("Not found", { status: 404 });

  const pdf = await renderInvoicePdf({
    settings,
    client: invoice.client,
    invoice: {
      number: invoice.number,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate ?? null,
      gstRegistered: invoice.gstRegistered,
      notes: invoice.notes ?? null,
    },
    lines: invoice.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
    })),
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number ?? `draft-${invoice.id}`}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
