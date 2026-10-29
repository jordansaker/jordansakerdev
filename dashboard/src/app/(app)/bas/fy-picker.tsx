"use client";

import { useRouter } from "next/navigation";

export function FyPicker({ q, fy, minFy, maxFy }: { q: number; fy: number; minFy: number; maxFy: number }) {
  const router = useRouter();
  const years: number[] = [];
  for (let y = maxFy; y >= minFy; y--) years.push(y);
  return (
    <label className="flex items-center gap-2 ms-auto rounded-full border border-line-soft bg-surface px-3 py-1.5">
      <span className="mono text-[0.66rem] tracking-[0.12em] uppercase text-muted">FY</span>
      <select
        aria-label="Financial year"
        value={fy}
        onChange={(e) => router.push(`/bas?q=${q}&fy=${e.target.value}`)}
        className="bg-transparent mono text-[0.83rem] text-text focus:outline-none"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}
