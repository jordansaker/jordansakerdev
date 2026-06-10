import "server-only";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  expenses,
  invoiceLines,
  invoices,
  quoteLines,
  quotes,
  services,
} from "@/db/schema";
import { gstCents, lineSubtotalCents } from "./money";
import { quarterFY, quarterRange } from "./quarter";

export async function listServices() {
  return db.select().from(services).orderBy(asc(services.sortOrder), asc(services.id));
}

export async function listClients() {
  return db.select().from(clients).orderBy(asc(clients.name));
}

export async function getClient(id: number) {
  const [row] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return row ?? null;
}

export type InvoiceWithLines = Awaited<ReturnType<typeof listInvoices>>[number];

export async function listInvoices() {
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientId: invoices.clientId,
      clientName: clients.name,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      status: invoices.status,
      gstRegistered: invoices.gstRegistered,
      sentAt: invoices.sentAt,
      paidAt: invoices.paidAt,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .orderBy(desc(invoices.issueDate), desc(invoices.id));

  const ids = rows.map((r) => r.id);
  const lines = ids.length
    ? await db
        .select()
        .from(invoiceLines)
        .where(sql`${invoiceLines.invoiceId} IN ${ids}`)
        .orderBy(asc(invoiceLines.sortOrder), asc(invoiceLines.id))
    : [];

  return rows.map((r) => {
    const ls = lines.filter((l) => l.invoiceId === r.id);
    const subtotalCents = lineSubtotalCents(ls);
    const gst = gstCents(subtotalCents, r.gstRegistered);
    return { ...r, lines: ls, subtotalCents, gstCents: gst, totalCents: subtotalCents + gst };
  });
}

export async function getInvoiceById(id: number) {
  const [row] = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientId: invoices.clientId,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      status: invoices.status,
      gstRegistered: invoices.gstRegistered,
      sentAt: invoices.sentAt,
      paidAt: invoices.paidAt,
      notes: invoices.notes,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!row) return null;
  const ls = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, id))
    .orderBy(asc(invoiceLines.sortOrder), asc(invoiceLines.id));
  const client = await getClient(row.clientId);
  const subtotalCents = lineSubtotalCents(ls);
  const gst = gstCents(subtotalCents, row.gstRegistered);
  return {
    ...row,
    lines: ls,
    client,
    subtotalCents,
    gstCents: gst,
    totalCents: subtotalCents + gst,
  };
}

export async function listQuotes() {
  const rows = await db
    .select({
      id: quotes.id,
      number: quotes.number,
      clientId: quotes.clientId,
      clientName: clients.name,
      issueDate: quotes.issueDate,
      status: quotes.status,
      gstRegistered: quotes.gstRegistered,
      sentAt: quotes.sentAt,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .innerJoin(clients, eq(clients.id, quotes.clientId))
    .orderBy(desc(quotes.issueDate), desc(quotes.id));

  const ids = rows.map((r) => r.id);
  const lines = ids.length
    ? await db
        .select()
        .from(quoteLines)
        .where(sql`${quoteLines.quoteId} IN ${ids}`)
        .orderBy(asc(quoteLines.sortOrder), asc(quoteLines.id))
    : [];

  return rows.map((r) => {
    const ls = lines.filter((l) => l.quoteId === r.id);
    const subtotalCents = lineSubtotalCents(ls);
    const gst = gstCents(subtotalCents, r.gstRegistered);
    return { ...r, lines: ls, subtotalCents, gstCents: gst, totalCents: subtotalCents + gst };
  });
}

export async function getQuoteById(id: number) {
  const [row] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, id))
    .limit(1);
  if (!row) return null;
  const ls = await db
    .select()
    .from(quoteLines)
    .where(eq(quoteLines.quoteId, id))
    .orderBy(asc(quoteLines.sortOrder), asc(quoteLines.id));
  const client = await getClient(row.clientId);
  const subtotalCents = lineSubtotalCents(ls);
  const gst = gstCents(subtotalCents, row.gstRegistered);
  return {
    ...row,
    lines: ls,
    client,
    subtotalCents,
    gstCents: gst,
    totalCents: subtotalCents + gst,
  };
}

export async function listExpenses() {
  return db
    .select()
    .from(expenses)
    .orderBy(desc(expenses.spentOn), desc(expenses.id));
}

export async function quarterFinancials(q: 0 | 1 | 2 | 3, fy: number) {
  const { start, end } = quarterRange(q, fy);
  const inv = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientId: invoices.clientId,
      clientName: clients.name,
      issueDate: invoices.issueDate,
      status: invoices.status,
      gstRegistered: invoices.gstRegistered,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(
      and(
        gte(invoices.issueDate, start),
        lt(invoices.issueDate, end),
        sql`${invoices.status} <> 'draft'`,
      ),
    )
    .orderBy(asc(invoices.issueDate));

  const invIds = inv.map((i) => i.id);
  const invLines = invIds.length
    ? await db
        .select()
        .from(invoiceLines)
        .where(sql`${invoiceLines.invoiceId} IN ${invIds}`)
    : [];

  const invWithLines = inv.map((i) => {
    const ls = invLines.filter((l) => l.invoiceId === i.id);
    const subtotalCents = lineSubtotalCents(ls);
    const gst = gstCents(subtotalCents, i.gstRegistered);
    return { ...i, subtotalCents, gstCents: gst };
  });

  const exp = await db
    .select()
    .from(expenses)
    .where(and(gte(expenses.spentOn, start), lt(expenses.spentOn, end)))
    .orderBy(asc(expenses.spentOn));

  const salesCents = invWithLines.reduce((s, i) => s + i.subtotalCents, 0);
  const gstCollectedCents = invWithLines.reduce((s, i) => s + i.gstCents, 0);
  const gstPaidCents = exp.reduce((s, e) => (e.hasGst ? s + Math.round(e.amountCents * 0.1) : s), 0);
  const expensesTotalCents = exp.reduce((s, e) => s + e.amountCents, 0);

  return {
    range: { start, end },
    invoices: invWithLines,
    expenses: exp,
    salesCents,
    gstCollectedCents,
    gstPaidCents,
    expensesTotalCents,
    netGstCents: gstCollectedCents - gstPaidCents,
  };
}

export async function overviewStats() {
  const allInv = await db
    .select({
      id: invoices.id,
      status: invoices.status,
      gstRegistered: invoices.gstRegistered,
      issueDate: invoices.issueDate,
    })
    .from(invoices);

  const allLines = await db.select().from(invoiceLines);

  const outstandingCents = allInv
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((acc, i) => {
      const ls = allLines.filter((l) => l.invoiceId === i.id);
      const sub = lineSubtotalCents(ls);
      return acc + sub + gstCents(sub, i.gstRegistered);
    }, 0);

  const today = new Date();
  const fy = quarterFY(today);
  const q = (Math.floor(((today.getMonth() + 6) % 12) / 3) as 0 | 1 | 2 | 3);
  const { start, end } = quarterRange(q, fy);
  const qInv = allInv.filter((i) => i.issueDate >= start && i.issueDate < end);
  const paidThisQuarterCents = qInv
    .filter((i) => i.status === "paid")
    .reduce((acc, i) => {
      const ls = allLines.filter((l) => l.invoiceId === i.id);
      const sub = lineSubtotalCents(ls);
      return acc + sub + gstCents(sub, i.gstRegistered);
    }, 0);
  const gstCollectedCents = qInv
    .filter((i) => i.status !== "draft")
    .reduce((acc, i) => {
      const ls = allLines.filter((l) => l.invoiceId === i.id);
      return acc + gstCents(lineSubtotalCents(ls), i.gstRegistered);
    }, 0);

  const unpaidCount = allInv.filter(
    (i) => i.status === "sent" || i.status === "overdue",
  ).length;

  return {
    outstandingCents,
    paidThisQuarterCents,
    gstCollectedCents,
    unpaidCount,
    quarter: q,
    fy,
  };
}
