import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

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

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function toCents(s: string): number {
  return Math.round(Number(s.replace(/,/g, "")) * 100);
}

function isoDate(day: number, month: number, year: number): string {
  const d = new Date(Date.UTC(year, month, day));
  return d.toISOString().slice(0, 10);
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: true });
  return Array.isArray(result.text) ? result.text.join("\n") : result.text;
}

/**
 * Extracts statement period start/end. NAB statements typically show something
 * like "Statement period 01 Mar 2026 to 31 Mar 2026" or "from 01/03/2026 to 31/03/2026".
 */
function findPeriod(text: string): { start: string | null; end: string | null } {
  // "1 Mar 2026 to 31 Mar 2026" or "1 Mar 2026 - 31 Mar 2026"
  const m1 = text.match(
    /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})\s*(?:to|-|–|—)\s*(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/,
  );
  if (m1) {
    const sm = MONTHS[m1[2].toLowerCase()];
    const em = MONTHS[m1[5].toLowerCase()];
    if (sm !== undefined && em !== undefined) {
      return {
        start: isoDate(Number(m1[1]), sm, Number(m1[3])),
        end: isoDate(Number(m1[4]), em, Number(m1[6])),
      };
    }
  }
  // "01/03/2026 to 31/03/2026" (Australian DD/MM/YYYY)
  const m2 = text.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(?:to|-|–|—)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  );
  if (m2) {
    return {
      start: isoDate(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3])),
      end: isoDate(Number(m2[4]), Number(m2[5]) - 1, Number(m2[6])),
    };
  }
  return { start: null, end: null };
}

function findBsbAndAccount(text: string): {
  bsb: string | null;
  account: string | null;
} {
  const bsb = text.match(/\b(\d{3}[-\s]?\d{3})\b(?=[^\n]*(?:BSB|bsb))/);
  const bsbAlt = text.match(/BSB[:\s]+(\d{3}[-\s]?\d{3})/i);
  const acc = text.match(/Account(?:\s*No)?[:\s]+(\d[\d\s]{4,})/i);
  return {
    bsb: (bsbAlt?.[1] ?? bsb?.[1] ?? null)?.replace(/\s+/g, "-") ?? null,
    account: acc?.[1]?.trim().replace(/\s+/g, " ") ?? null,
  };
}

function findBalance(
  text: string,
  label: string,
): number | null {
  const re = new RegExp(`${label}[^\\n]*?(-?\\d{1,3}(?:,\\d{3})*\\.\\d{2})`, "i");
  const m = text.match(re);
  return m ? toCents(m[1]) : null;
}

/**
 * Transaction row regex — tuned for NAB's flattened PDF text.
 *
 * Captures:
 *   1. Day (1-2 digits)
 *   2. Month abbreviation (3 letters)
 *   3. Rest of line (description + amounts)
 *
 * NAB rows can have 1 amount (with balance) or 2 amounts (debit or credit + balance).
 * After unpdf flattens columns, the cleanest signal is: walk the line right-to-left,
 * the last decimal number is the running balance, anything before it is the
 * transaction amount.
 */
const ROW_RE = /^(\d{1,2})\s+([A-Za-z]{3})\s+(.+)$/;
const AMOUNT_RE = /(-?\d{1,3}(?:,\d{3})*\.\d{2})/g;

function defaultYearFor(month: number, periodStart: string | null): number {
  if (periodStart) {
    const py = Number(periodStart.slice(0, 4));
    const pm = Number(periodStart.slice(5, 7)) - 1;
    // If month is earlier in the year than period start month, it must be the next calendar year
    return month < pm ? py + 1 : py;
  }
  return new Date().getFullYear();
}

function inferDirectionByKeyword(desc: string): "credit" | "debit" | null {
  const d = desc.toUpperCase();
  if (/\b(DEPOSIT|CREDIT|PAYMENT FROM|TRANSFER FROM|REFUND|INTEREST PAID|SALARY)\b/.test(d)) {
    return "credit";
  }
  if (/\b(WITHDRAWAL|DEBIT|EFTPOS|PURCHASE|FEE|CHARGE|BPAY|DIRECT DEBIT|TRANSFER TO|PAYMENT TO)\b/.test(d)) {
    return "debit";
  }
  return null;
}

export async function parseStatement(buffer: Buffer): Promise<ParsedStatement> {
  const text = await extractPdfText(buffer);
  if (text.trim().length < 100) {
    throw new Error("PDF text extraction produced almost no text — is this a scanned image?");
  }

  const { start: periodStart, end: periodEnd } = findPeriod(text);
  const { bsb, account } = findBsbAndAccount(text);
  const openingBalanceCents = findBalance(text, "Opening\\s+Balance");
  const closingBalanceCents = findBalance(text, "Closing\\s+Balance");

  const transactions: ParsedTransaction[] = [];
  let prevBalance = openingBalanceCents;
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (/opening\s+balance|closing\s+balance|brought\s+forward|carried\s+forward/i.test(line)) {
      continue;
    }

    const m = line.match(ROW_RE);
    if (!m) continue;
    const month = MONTHS[m[2].toLowerCase()];
    if (month === undefined) continue;
    const day = Number(m[1]);
    if (day < 1 || day > 31) continue;

    const rest = m[3];
    const amounts = [...rest.matchAll(AMOUNT_RE)].map((x) => x[1]);
    if (amounts.length === 0) continue;

    // Strip the captured amounts from the rest to get the description
    let description = rest;
    for (const a of amounts) description = description.replace(a, "");
    description = description.replace(/\s+/g, " ").trim();
    if (!description) continue;

    let amount: number;
    let balance: number | null = null;
    if (amounts.length === 1) {
      amount = toCents(amounts[0]);
    } else {
      // Two or more — last is balance, prior is the transaction amount
      balance = toCents(amounts[amounts.length - 1]);
      amount = toCents(amounts[amounts.length - 2]);
    }
    if (amount <= 0) continue;

    let direction: "credit" | "debit" | null = null;
    if (balance !== null && prevBalance !== null) {
      // Balance delta tells us direction unambiguously
      direction = balance >= prevBalance ? "credit" : "debit";
    }
    if (direction === null) direction = inferDirectionByKeyword(description);
    if (direction === null) direction = "debit"; // safe default

    const year = defaultYearFor(month, periodStart);
    transactions.push({
      date: isoDate(day, month, year),
      description,
      amountCents: amount,
      direction,
      balanceCents: balance,
    });

    if (balance !== null) prevBalance = balance;
  }

  if (!transactions.length) {
    throw new Error(
      "No transactions matched the NAB row pattern. The statement layout may have changed, or this isn't a NAB statement.",
    );
  }

  return {
    bsb,
    accountNumber: account,
    periodStart,
    periodEnd,
    openingBalanceCents,
    closingBalanceCents,
    transactions,
  };
}
