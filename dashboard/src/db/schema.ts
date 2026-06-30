import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const serviceUnit = pgEnum("service_unit", ["fixed", "hourly", "monthly"]);
export const quoteStatus = pgEnum("quote_status", ["pending", "accepted", "declined"]);
export const invoiceStatus = pgEnum("invoice_status", ["draft", "sent", "paid", "overdue"]);

export const settings = pgTable("settings", {
  id: integer().primaryKey().default(1),
  legalName: text().notNull(),
  abn: text().notNull(),
  gstRegistered: boolean().notNull().default(true),
  businessEmail: text().notNull(),
  addressLine: text().notNull(),
  paymentInstructions: text().notNull(),
  invoiceSeq: integer().notNull().default(1),
  quoteSeq: integer().notNull().default(1),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const services = pgTable(
  "services",
  {
    id: serial().primaryKey(),
    name: text().notNull().unique(),
    description: text().notNull().default(""),
    priceCents: integer().notNull(),
    unit: serviceUnit().notNull().default("fixed"),
    sortOrder: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
);

export const clientStage = pgEnum("client_stage", [
  "new_lead",
  "in_conversation",
  "quoted",
  "engaged",
  "in_build",
  "delivered",
]);

export const activityType = pgEnum("activity_type", [
  "email",
  "call",
  "meeting",
  "note",
]);

export const clients = pgTable(
  "clients",
  {
    id: serial().primaryKey(),
    name: text().notNull(),
    abn: text(),
    email: text(),
    address: text(),
    notes: text(),
    stage: clientStage().notNull().default("new_lead"),
    estimatedValueCents: integer(),
    source: text(),
    sortOrder: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("clients_name_unique").on(sql`lower(${t.name})`)],
);

export const clientActivities = pgTable("client_activities", {
  id: serial().primaryKey(),
  clientId: integer()
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  type: activityType().notNull(),
  activityDate: date().notNull(),
  note: text().notNull().default(""),
  followUpDue: date(),
  followUpDoneAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: serial().primaryKey(),
  number: text().notNull().unique(),
  clientId: integer()
    .notNull()
    .references(() => clients.id, { onDelete: "restrict" }),
  issueDate: date().notNull(),
  status: quoteStatus().notNull().default("pending"),
  gstRegistered: boolean().notNull(),
  sentAt: timestamp({ withTimezone: true }),
  notes: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const quoteLines = pgTable("quote_lines", {
  id: serial().primaryKey(),
  quoteId: integer()
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  description: text().notNull(),
  quantity: numeric({ precision: 10, scale: 2 }).notNull().default("1"),
  unitPriceCents: integer().notNull(),
  sortOrder: integer().notNull().default(0),
});

export const invoices = pgTable("invoices", {
  id: serial().primaryKey(),
  number: text().unique(),
  clientId: integer()
    .notNull()
    .references(() => clients.id, { onDelete: "restrict" }),
  issueDate: date().notNull(),
  dueDate: date(),
  status: invoiceStatus().notNull().default("draft"),
  gstRegistered: boolean().notNull(),
  fromQuoteId: integer().references(() => quotes.id, { onDelete: "set null" }),
  sentAt: timestamp({ withTimezone: true }),
  paidAt: timestamp({ withTimezone: true }),
  notes: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const invoiceLines = pgTable("invoice_lines", {
  id: serial().primaryKey(),
  invoiceId: integer()
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text().notNull(),
  quantity: numeric({ precision: 10, scale: 2 }).notNull().default("1"),
  unitPriceCents: integer().notNull(),
  sortOrder: integer().notNull().default(0),
});

export const messageDirection = pgEnum("message_direction", ["outbound", "inbound"]);

export const emailThreads = pgTable("email_threads", {
  id: serial().primaryKey(),
  subject: text().notNull(),
  participantEmail: text().notNull(),
  clientId: integer().references(() => clients.id, { onDelete: "set null" }),
  lastMessageAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  messageCount: integer().notNull().default(0),
  unreadCount: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const emailMessages = pgTable(
  "email_messages",
  {
    id: serial().primaryKey(),
    threadId: integer()
      .notNull()
      .references(() => emailThreads.id, { onDelete: "cascade" }),
    direction: messageDirection().notNull(),
    messageIdHeader: text().notNull(),
    inReplyTo: text(),
    referencesHeader: text(),
    fromAddress: text().notNull(),
    toAddress: text().notNull(),
    cc: text(),
    subject: text().notNull(),
    bodyText: text().notNull().default(""),
    bodyHtml: text(),
    attachments: text().default("[]").notNull(),
    rawPayload: text(),
    status: text().notNull().default("sent"),
    errorMessage: text(),
    readAt: timestamp({ withTimezone: true }),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("email_messages_message_id_unique").on(t.messageIdHeader)],
);

export const audits = pgTable("audits", {
  id: serial().primaryKey(),
  client: text().notNull(),
  url: text().notNull(),
  score: integer(),
  fee: text(),
  template: text().notNull().default("performance"),
  sections: text().notNull().default("{}"),
  findings: text().notNull().default("[]"),
  scope: text().notNull().default("[]"),
  recipientEmail: text(),
  sentAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const txDirection = pgEnum("tx_direction", ["credit", "debit"]);
export const txStatus = pgEnum("tx_status", [
  "pending",
  "imported",
  "ignored",
  "matched",
]);

export const bankStatements = pgTable(
  "bank_statements",
  {
    id: serial().primaryKey(),
    filename: text().notNull(),
    contentHash: text().notNull().unique(),
    bsb: text(),
    accountNumber: text(),
    periodStart: date(),
    periodEnd: date(),
    openingBalanceCents: integer(),
    closingBalanceCents: integer(),
    transactionCount: integer().notNull().default(0),
    uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    importedAt: timestamp({ withTimezone: true }),
  },
);

export const bankTransactions = pgTable("bank_transactions", {
  id: serial().primaryKey(),
  statementId: integer()
    .notNull()
    .references(() => bankStatements.id, { onDelete: "cascade" }),
  txDate: date().notNull(),
  description: text().notNull(),
  amountCents: integer().notNull(),
  direction: txDirection().notNull(),
  balanceCents: integer(),
  status: txStatus().notNull().default("pending"),
  matchedInvoiceId: integer().references(() => invoices.id, {
    onDelete: "set null",
  }),
  matchedExpenseId: integer().references(() => expenses.id, {
    onDelete: "set null",
  }),
  hasGstGuess: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: serial().primaryKey(),
  description: text().notNull(),
  spentOn: date().notNull(),
  amountCents: integer().notNull(),
  hasGst: boolean().notNull().default(true),
  notes: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const clientsRelations = relations(clients, ({ many }) => ({
  invoices: many(invoices),
  quotes: many(quotes),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  client: one(clients, { fields: [quotes.clientId], references: [clients.id] }),
  lines: many(quoteLines),
}));

export const quoteLinesRelations = relations(quoteLines, ({ one }) => ({
  quote: one(quotes, { fields: [quoteLines.quoteId], references: [quotes.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  lines: many(invoiceLines),
  fromQuote: one(quotes, { fields: [invoices.fromQuoteId], references: [quotes.id] }),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLines.invoiceId], references: [invoices.id] }),
}));

export type Settings = typeof settings.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type QuoteLine = typeof quoteLines.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type EmailThread = typeof emailThreads.$inferSelect;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type BankStatement = typeof bankStatements.$inferSelect;
export type BankTransaction = typeof bankTransactions.$inferSelect;
export type ClientActivity = typeof clientActivities.$inferSelect;
export type ClientStage =
  | "new_lead"
  | "in_conversation"
  | "quoted"
  | "engaged"
  | "in_build"
  | "delivered";
export type ActivityType = "email" | "call" | "meeting" | "note";
export type Audit = typeof audits.$inferSelect;
export type AuditFinding = { title: string; paras: string[] };
