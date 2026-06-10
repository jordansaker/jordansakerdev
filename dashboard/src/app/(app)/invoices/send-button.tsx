"use client";

import { useState, useTransition } from "react";

export function SendInvoiceButton({
  id,
  sendAction,
}: {
  id: number;
  sendAction: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            const fd = new FormData();
            fd.set("id", String(id));
            const result = await sendAction(fd);
            if (!result.ok) {
              setMsg(result.error ?? "Failed to send");
            } else {
              setMsg("Sent");
            }
          })
        }
        className="text-[0.78rem] text-accent-2 hover:underline disabled:opacity-50"
      >
        {pending ? "Sending…" : msg ?? "Send"}
      </button>
    </>
  );
}
