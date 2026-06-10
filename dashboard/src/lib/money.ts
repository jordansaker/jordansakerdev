export const GST_RATE = 0.1;

const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const aud0 = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

export function formatCents(cents: number): string {
  return aud.format(cents / 100);
}

export function formatCents0(cents: number): string {
  return aud0.format(cents / 100);
}

export function parseAmountToCents(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === "") return 0;
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export type LineInput = { quantity: string | number; unitPriceCents: number };

export function lineSubtotalCents(lines: LineInput[]): number {
  return lines.reduce((acc, l) => {
    const qty = typeof l.quantity === "number" ? l.quantity : Number(l.quantity ?? 0);
    return acc + Math.round(qty * l.unitPriceCents);
  }, 0);
}

export function gstCents(amountCents: number, gstRegistered: boolean): number {
  if (!gstRegistered) return 0;
  return Math.round(amountCents * GST_RATE);
}

export function totalCents(lines: LineInput[], gstRegistered: boolean): number {
  const sub = lineSubtotalCents(lines);
  return sub + gstCents(sub, gstRegistered);
}
