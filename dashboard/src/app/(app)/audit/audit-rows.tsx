"use client";

import Link from "next/link";
import { Tag, Td } from "@/components/ui";
import { useConfirm } from "@/components/confirm";
import type { Audit } from "@/db/schema";

type DeleteAction = (fd: FormData) => Promise<void>;

export function AuditRows({
  rows,
  deleteAction,
}: {
  rows: Audit[];
  deleteAction: DeleteAction;
}) {
  const { ask, dialog } = useConfirm();

  return (
    <>
      {dialog}
      {rows.map((a) => (
        <tr key={a.id} className="hover:bg-surface-2 transition-colors">
          <Td>
            <Link
              href={`/audit/${a.id}`}
              className="text-text hover:text-accent transition-colors"
            >
              {a.client}
            </Link>
          </Td>
          <Td className="mono text-muted">{a.url}</Td>
          <Td className="mono text-right">{a.score ?? "—"}</Td>
          <Td className="mono text-right">{a.fee ? `$${a.fee}` : "—"}</Td>
          <Td>
            {a.sentAt ? (
              <Tag variant="sent">sent</Tag>
            ) : (
              <Tag variant="draft">draft</Tag>
            )}
          </Td>
          <Td className="mono text-right text-muted whitespace-nowrap">
            {timeAgo(a.updatedAt)}
          </Td>
          <Td className="text-right whitespace-nowrap">
            <button
              type="button"
              onClick={async () => {
                const ok = await ask(`Delete the ${a.client} audit?`, {
                  confirmLabel: "Delete",
                  danger: true,
                });
                if (ok) {
                  const fd = new FormData();
                  fd.set("id", String(a.id));
                  await deleteAction(fd);
                }
              }}
              className="text-[0.78rem] text-muted-2 hover:text-red transition-colors"
            >
              Delete
            </button>
          </Td>
        </tr>
      ))}
    </>
  );
}

function timeAgo(d: Date | string): string {
  const t = typeof d === "string" ? new Date(d) : d;
  const s = Math.floor((Date.now() - t.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return t.toISOString().slice(0, 10);
}
