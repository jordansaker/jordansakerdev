import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Client, Settings } from "@/db/schema";
import { GST_RATE } from "@/lib/money";

const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
});

function fmt(cents: number) {
  return aud.format(cents / 100);
}

const COLORS = {
  ink: "#1B1814",
  muted: "#766C5F",
  accent: "#E8743B",
  line: "#E5DDD0",
  bg: "#FAF6EE",
};

const styles = StyleSheet.create({
  page: {
    padding: 56,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: COLORS.ink,
    backgroundColor: "#FFFFFF",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  brand: {
    fontSize: 9,
    color: COLORS.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  legalName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 4 },
  metaLine: { fontSize: 9, color: COLORS.muted, marginTop: 2 },
  taxInvoice: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: COLORS.accent,
    letterSpacing: 1,
    textAlign: "right",
  },
  invNumber: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 4,
    textAlign: "right",
  },
  twoCol: {
    flexDirection: "row",
    gap: 28,
    marginTop: 18,
    marginBottom: 26,
  },
  col: { flex: 1 },
  colLabel: {
    fontSize: 8,
    color: COLORS.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  bold: { fontFamily: "Helvetica-Bold" },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ink,
    paddingBottom: 6,
    marginBottom: 6,
    fontSize: 8,
    color: COLORS.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.line,
  },
  cellDesc: { flex: 4, paddingRight: 8 },
  cellQty: { flex: 1, textAlign: "right" },
  cellPrice: { flex: 1.5, textAlign: "right" },
  cellTotal: { flex: 1.5, textAlign: "right" },
  totals: {
    marginTop: 18,
    alignSelf: "flex-end",
    width: 220,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalLabel: { color: COLORS.muted },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.ink,
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  grandValue: { color: COLORS.accent },
  payment: {
    marginTop: 36,
    padding: 14,
    backgroundColor: COLORS.bg,
    borderRadius: 6,
  },
  paymentLabel: {
    fontSize: 8,
    color: COLORS.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  footer: {
    marginTop: 28,
    fontSize: 8,
    color: COLORS.muted,
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: COLORS.line,
    paddingTop: 10,
  },
});

export type InvoicePdfData = {
  settings: Settings;
  client: Client | null;
  invoice: {
    number: string | null;
    issueDate: string;
    dueDate?: string | null;
    gstRegistered: boolean;
    notes?: string | null;
  };
  lines: Array<{
    description: string;
    quantity: string;
    unitPriceCents: number;
  }>;
};

function lineTotalCents(qty: string, priceCents: number) {
  return Math.round(Number(qty) * priceCents);
}

function PdfBody({ data }: { data: InvoicePdfData }) {
  const subtotalCents = data.lines.reduce(
    (s, l) => s + lineTotalCents(l.quantity, l.unitPriceCents),
    0,
  );
  const gstCents = data.invoice.gstRegistered
    ? Math.round(subtotalCents * GST_RATE)
    : 0;
  const totalCents = subtotalCents + gstCents;

  const numberDisplay = data.invoice.number ?? "DRAFT";
  const heading = data.invoice.number ? "TAX INVOICE" : "DRAFT INVOICE";

  return (
    <Document
      title={`Tax invoice ${numberDisplay}`}
      author={data.settings.legalName}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.legalName}>{data.settings.legalName}</Text>
            <Text style={styles.metaLine}>ABN {data.settings.abn}</Text>
            <Text style={styles.metaLine}>{data.settings.addressLine}</Text>
            <Text style={styles.metaLine}>{data.settings.businessEmail}</Text>
          </View>
          <View>
            <Text style={styles.taxInvoice}>{heading}</Text>
            <Text style={styles.invNumber}>{numberDisplay}</Text>
            <Text style={[styles.invNumber, { marginTop: 2 }]}>
              Issued {data.invoice.issueDate}
            </Text>
            {data.invoice.dueDate ? (
              <Text style={styles.invNumber}>Due {data.invoice.dueDate}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.colLabel}>Bill to</Text>
            <Text style={styles.bold}>{data.client?.name ?? "—"}</Text>
            {data.client?.abn ? (
              <Text style={styles.metaLine}>ABN {data.client.abn}</Text>
            ) : null}
            {data.client?.address ? (
              <Text style={styles.metaLine}>{data.client.address}</Text>
            ) : null}
            {data.client?.email ? (
              <Text style={styles.metaLine}>{data.client.email}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={styles.cellDesc}>Description</Text>
          <Text style={styles.cellQty}>Qty</Text>
          <Text style={styles.cellPrice}>Unit (ex GST)</Text>
          <Text style={styles.cellTotal}>Line total</Text>
        </View>
        {data.lines.map((l, i) => {
          const total = lineTotalCents(l.quantity, l.unitPriceCents);
          return (
            <View style={styles.tableRow} key={i}>
              <Text style={styles.cellDesc}>{l.description}</Text>
              <Text style={styles.cellQty}>{l.quantity}</Text>
              <Text style={styles.cellPrice}>{fmt(l.unitPriceCents)}</Text>
              <Text style={styles.cellTotal}>{fmt(total)}</Text>
            </View>
          );
        })}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal (ex GST)</Text>
            <Text>{fmt(subtotalCents)}</Text>
          </View>
          {data.invoice.gstRegistered ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST (10%)</Text>
              <Text>{fmt(gstCents)}</Text>
            </View>
          ) : null}
          <View style={styles.grandRow}>
            <Text>Total due</Text>
            <Text style={styles.grandValue}>{fmt(totalCents)}</Text>
          </View>
        </View>

        <View style={styles.payment}>
          <Text style={styles.paymentLabel}>Payment</Text>
          <Text>{data.settings.paymentInstructions}</Text>
          <Text style={[styles.metaLine, { marginTop: 6 }]}>
            Please reference {numberDisplay} with your payment.
          </Text>
        </View>

        {data.invoice.notes ? (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.paymentLabel}>Notes</Text>
            <Text style={{ fontSize: 9 }}>{data.invoice.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          {data.settings.legalName} · ABN {data.settings.abn} ·{" "}
          {data.settings.businessEmail}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<PdfBody data={data} />);
}
