// Australian financial-year quarter helpers
// Q1 Jul–Sep, Q2 Oct–Dec, Q3 Jan–Mar, Q4 Apr–Jun
export const QUARTER_LABELS = ["Q1 · Jul–Sep", "Q2 · Oct–Dec", "Q3 · Jan–Mar", "Q4 · Apr–Jun"] as const;
export const QUARTER_DUE = ["28 Oct", "28 Feb", "28 Apr", "28 Jul"] as const;

export function quarterIndex(date: Date | string): 0 | 1 | 2 | 3 {
  const d = typeof date === "string" ? new Date(date) : date;
  const m = d.getMonth();
  return (Math.floor(((m + 6) % 12) / 3) as 0 | 1 | 2 | 3);
}

export function currentQuarter(): 0 | 1 | 2 | 3 {
  return quarterIndex(new Date());
}

// Returns FY label like "2026" for the financial year that contains the quarter
export function quarterFY(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const m = d.getMonth();
  const y = d.getFullYear();
  return m >= 6 ? y + 1 : y;
}

// Returns inclusive [start, end) dates for the given quarter of the given FY
export function quarterRange(q: 0 | 1 | 2 | 3, fy: number): { start: string; end: string } {
  const startMonths = [6, 9, 0, 3] as const; // Jul, Oct, Jan, Apr
  const startYears = [fy - 1, fy - 1, fy, fy] as const;
  const sm = startMonths[q];
  const sy = startYears[q];
  const start = new Date(sy, sm, 1);
  const end = new Date(sy, sm + 3, 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
