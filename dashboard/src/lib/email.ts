import "server-only";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { invoices, quotes } from "@/db/schema";
import { renderInvoicePdf } from "./pdf/invoice-pdf";
import { getInvoiceById, getQuoteById } from "./queries";
import { formatCents } from "./money";
import { getSettings } from "./settings";

function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

function fromAddress() {
  return process.env.RESEND_FROM || "invoices@jordansakerdev.com";
}

export async function sendInvoiceEmail(
  invoiceId: number,
): Promise<{ ok: boolean; error?: string }> {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) return { ok: false, error: "Invoice not found" };
  if (!invoice.client?.email) {
    return { ok: false, error: "Client has no email — add one on the Clients page" };
  }
  const settings = await getSettings();

  let pdf: Buffer;
  try {
    pdf = await renderInvoicePdf({
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
  } catch (err) {
    console.error("PDF render failed", err);
    return { ok: false, error: "Failed to render PDF" };
  }

  const subject = `Tax invoice ${invoice.number} from ${settings.legalName}`;
  const totalLine = formatCents(invoice.totalCents);
  const text = [
    `Hi ${invoice.client.name},`,
    "",
    `Please find attached tax invoice ${invoice.number} for ${totalLine}.`,
    "",
    `Payment details:`,
    settings.paymentInstructions,
    "",
    `Please reference ${invoice.number} with your payment.`,
    "",
    "Thanks,",
    settings.legalName,
    `${settings.businessEmail}`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; color: #1B1814; line-height: 1.55; font-size: 15px;">
      <p>Hi ${escapeHtml(invoice.client.name)},</p>
      <p>Please find attached tax invoice <b>${invoice.number}</b> for <b>${totalLine}</b>.</p>
      <p style="margin-top: 18px;"><b>Payment details</b><br>${escapeHtml(settings.paymentInstructions)}</p>
      <p>Please reference <b>${invoice.number}</b> with your payment.</p>
      <p style="margin-top: 24px;">Thanks,<br>${escapeHtml(settings.legalName)}<br>
        <a href="mailto:${settings.businessEmail}">${settings.businessEmail}</a>
      </p>
    </div>
  `;

  try {
    const r = await resend().emails.send({
      from: fromAddress(),
      to: invoice.client.email,
      replyTo: settings.businessEmail,
      subject,
      text,
      html,
      attachments: [
        {
          filename: `${invoice.number}.pdf`,
          content: pdf,
        },
      ],
    });
    if (r.error) {
      return { ok: false, error: r.error.message };
    }
  } catch (err) {
    console.error("Resend send failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }

  await db
    .update(invoices)
    .set({
      sentAt: new Date(),
      status: invoice.status === "draft" ? "sent" : invoice.status,
    })
    .where(eq(invoices.id, invoiceId));

  return { ok: true };
}

export async function sendQuoteEmail(
  quoteId: number,
): Promise<{ ok: boolean; error?: string }> {
  const quote = await getQuoteById(quoteId);
  if (!quote) return { ok: false, error: "Quote not found" };
  if (!quote.client?.email) {
    return { ok: false, error: "Client has no email — add one on the Clients page" };
  }
  const settings = await getSettings();

  const totalLine = formatCents(quote.totalCents);
  const subject = `Quote ${quote.number} from ${settings.legalName}`;
  const lineList = quote.lines
    .map(
      (l) =>
        `  • ${l.description} (${l.quantity} × ${formatCents(l.unitPriceCents)})`,
    )
    .join("\n");
  const text = [
    `Hi ${quote.client.name},`,
    "",
    `Please find a quote for the project below.`,
    "",
    lineList,
    "",
    `Subtotal: ${formatCents(quote.subtotalCents)}`,
    quote.gstRegistered ? `GST (10%): ${formatCents(quote.gstCents)}` : "",
    `Total: ${totalLine}`,
    "",
    quote.notes ? `Notes: ${quote.notes}\n` : "",
    "Reply to this email to accept or to discuss further.",
    "",
    "Thanks,",
    settings.legalName,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const r = await resend().emails.send({
      from: fromAddress(),
      to: quote.client.email,
      replyTo: settings.businessEmail,
      subject,
      text,
    });
    if (r.error) return { ok: false, error: r.error.message };
  } catch (err) {
    console.error("Resend send failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }

  await db.update(quotes).set({ sentAt: new Date() }).where(eq(quotes.id, quoteId));
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
