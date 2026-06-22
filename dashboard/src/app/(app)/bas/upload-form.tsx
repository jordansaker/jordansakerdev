"use client";

import { useRef, useState, useTransition } from "react";
import type { UploadResult } from "./upload-action";

export function StatementUploadForm({
  action,
}: {
  action: (fd: FormData) => Promise<UploadResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          const result = await action(fd);
          if (!result.ok) setError(result.error);
          // ok path redirects via the action
        })
      }
      className="px-5 py-4 border-b border-line-soft"
    >
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <label className="block mono text-[0.66rem] tracking-[0.1em] uppercase text-muted mb-1.5">
            NAB statement PDF
          </label>
          <input
            ref={inputRef}
            type="file"
            name="pdf"
            accept="application/pdf"
            required
            className="block w-full text-[0.85rem] text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-accent-soft file:text-accent file:font-semibold file:text-[0.78rem] cursor-pointer"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent text-bg font-semibold text-[0.85rem] px-4 py-2.5 disabled:opacity-50 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)] transition-all"
        >
          {pending ? "Parsing…" : "Upload + parse"}
        </button>
      </div>
      <p className="text-[0.72rem] text-muted-2 mt-2 leading-relaxed">
        PDF text is extracted locally, then sent to Claude for structured extraction (~2¢
        per statement). Nothing is imported until you review and confirm.
      </p>
      {error ? <p className="text-red text-sm mt-2">{error}</p> : null}
    </form>
  );
}
