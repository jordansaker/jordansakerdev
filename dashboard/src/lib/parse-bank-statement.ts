import "server-only";

export type ParsedTransaction = {
  date: string; // YYYY-MM-DD
  description: string;
  amountCents: number; // positive
  direction: "credit" | "debit";
  balanceCents: number | null;
};

export type ParsedStatement = {
  bsb: string | null;
  accountNumber: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  openingBalanceCents: number | null;
  closingBalanceCents: number | null;
  transactions: ParsedTransaction[];
};

/**
 * Minimal RFC-4180-ish CSV parser. Handles quoted fields with embedded commas
 * and doubled-quote escapes ("she said ""hi"""). Returns rows as string arrays.
 */
function parseCsv(text: string): string[][] {
  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      // peek for \n — let \n branch handle the row push to avoid double-push
      if (text[i + 1] === "\n") {
        i++;
        continue;
      }
      // bare \r as row terminator
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const HEADER_HINTS = {
  date: ["date", "transaction date", "txn date", "posting date"],
  amount: ["amount", "value", "debit/credit", "transaction amount"],
  description: ["description", "narration", "details", "transaction details", "particulars"],
  balance: ["balance", "running balance", "account balance"],
};

type ColumnMap = { date: number; amount: number; description: number; balance: number };

function detectColumns(header: string[]): ColumnMap | null {
  const norm = header.map((h) => h.trim().toLowerCase());
  const find = (hints: string[]) => norm.findIndex((h) => hints.includes(h));
  const date = find(HEADER_HINTS.date);
  const amount = find(HEADER_HINTS.amount);
  const description = find(HEADER_HINTS.description);
  if (date === -1 || amount === -1 || description === -1) return null;
  return {
    date,
    amount,
    description,
    balance: find(HEADER_HINTS.balance),
  };
}

function parseAmount(s: string): number | null {
  const cleaned = s.replace(/[$,\s]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Parse a date string into YYYY-MM-DD. Accepts:
 *   - DD/MM/YYYY  (NAB Australian)
 *   - DD/MM/YY    (2-digit year → 2000s)
 *   - DD-MM-YYYY
 *   - YYYY-MM-DD  (already ISO)
 */
function parseDate(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, d, mo, ys] = m;
    let year = Number(ys);
    if (year < 100) year += 2000;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

export async function parseStatement(buffer: Buffer): Promise<ParsedStatement> {
  const text = buffer.toString("utf8");
  if (text.trim().length < 10) {
    throw new Error("File appears to be empty");
  }
  const rows = parseCsv(text);
  if (!rows.length) {
    throw new Error("CSV had no rows");
  }

  // Determine if the first row is a header by trying column detection.
  let cols = detectColumns(rows[0]);
  let dataRows: string[][];
  if (cols) {
    dataRows = rows.slice(1);
  } else {
    // No recognisable header — assume NAB default column order: date, amount, description, balance
    if (rows[0].length < 3) {
      throw new Error(
        "Couldn't read column layout. Export the CSV from NAB Internet Banking with default columns (Date, Amount, Description, Balance).",
      );
    }
    cols = { date: 0, amount: 1, description: 2, balance: rows[0].length > 3 ? 3 : -1 };
    dataRows = rows;
  }

  const transactions: ParsedTransaction[] = [];
  for (const r of dataRows) {
    const rawDate = r[cols.date];
    const rawAmount = r[cols.amount];
    const rawDescription = r[cols.description];
    if (!rawDate || !rawAmount || !rawDescription) continue;

    const date = parseDate(rawDate);
    if (!date) continue;
    const signedAmount = parseAmount(rawAmount);
    if (signedAmount === null) continue;

    const direction: "credit" | "debit" = signedAmount >= 0 ? "credit" : "debit";
    const amountCents = Math.abs(signedAmount);
    if (amountCents === 0) continue;

    const description = rawDescription.replace(/\s+/g, " ").trim();
    if (!description) continue;

    let balanceCents: number | null = null;
    if (cols.balance >= 0 && r[cols.balance]) {
      const b = parseAmount(r[cols.balance]);
      if (b !== null) balanceCents = b;
    }

    transactions.push({ date, description, amountCents, direction, balanceCents });
  }

  if (!transactions.length) {
    throw new Error(
      "No transactions parsed from the CSV. Check that it's a NAB transaction export with Date, Amount, and Description columns.",
    );
  }

  // Derive period from min/max transaction date
  const dates = transactions.map((t) => t.date).sort();
  const periodStart = dates[0];
  const periodEnd = dates[dates.length - 1];

  // Opening = (balance of first row) - (amount of first row). Use the first row in CSV order.
  let openingBalanceCents: number | null = null;
  let closingBalanceCents: number | null = null;
  const firstWithBalance = transactions.find((t) => t.balanceCents !== null);
  if (firstWithBalance && firstWithBalance.balanceCents !== null) {
    const delta = firstWithBalance.direction === "credit"
      ? firstWithBalance.amountCents
      : -firstWithBalance.amountCents;
    openingBalanceCents = firstWithBalance.balanceCents - delta;
  }
  const lastWithBalance = [...transactions].reverse().find((t) => t.balanceCents !== null);
  if (lastWithBalance && lastWithBalance.balanceCents !== null) {
    closingBalanceCents = lastWithBalance.balanceCents;
  }

  return {
    bsb: null,
    accountNumber: null,
    periodStart,
    periodEnd,
    openingBalanceCents,
    closingBalanceCents,
    transactions,
  };
}
