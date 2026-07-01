"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirm } from "@/components/confirm";
import type { Document } from "@/db/schema";
import { DocumentEditor } from "./document-editor";

type ListDoc = { id: number; title: string; updatedAt: Date };

type Props = {
  docs: ListDoc[];
  activeDoc: Document | null;
  createAction: () => Promise<void>;
  saveAction: (input: {
    id: number;
    title?: string;
    contentJson?: string;
    contentHtml?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  deleteAction: (formData: FormData) => Promise<void>;
};

export function DocumentsShell({
  docs,
  activeDoc,
  createAction,
  saveAction,
  deleteAction,
}: Props) {
  const router = useRouter();
  const [creating, startCreate] = useTransition();
  const { ask, dialog } = useConfirm();
  const [titleLocal, setTitleLocal] = useState(activeDoc?.title ?? "");

  // Sync local title when the active doc changes
  const activeId = activeDoc?.id ?? null;
  const [lastActiveId, setLastActiveId] = useState<number | null>(activeId);
  if (activeId !== lastActiveId) {
    setLastActiveId(activeId);
    setTitleLocal(activeDoc?.title ?? "");
  }

  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-5 items-start">
      <aside className="bg-surface border border-line-soft rounded-2xl p-3 lg:sticky lg:top-8">
        <div className="flex flex-col gap-1">
          {docs.map((d) => {
            const isActive = d.id === activeId;
            return (
              <div
                key={d.id}
                className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-[9px] text-[0.86rem] transition-colors ${
                  isActive
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <Link
                  href={`/documents?id=${d.id}`}
                  className="flex-1 truncate"
                  title={d.title}
                >
                  {d.title || "Untitled"}
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await ask("Delete this document? This can't be undone.", {
                      title: "Delete document",
                      confirmLabel: "Delete",
                      danger: true,
                    });
                    if (!ok) return;
                    const fd = new FormData();
                    fd.set("id", String(d.id));
                    await deleteAction(fd);
                    router.refresh();
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-2 hover:text-red text-base leading-none"
                  aria-label={`Delete ${d.title}`}
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            type="button"
            disabled={creating}
            onClick={() => startCreate(() => createAction())}
            className="border border-dashed border-line-soft text-muted-2 rounded-[9px] py-2.5 text-[0.82rem] mt-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {creating ? "Creating…" : "+ New document"}
          </button>
        </div>
      </aside>

      {activeDoc ? (
        <DocumentEditor
          key={activeDoc.id}
          doc={activeDoc}
          title={titleLocal}
          onTitleChange={(v) => {
            setTitleLocal(v);
            void saveAction({ id: activeDoc.id, title: v });
          }}
          saveAction={saveAction}
        />
      ) : (
        <div className="bg-surface border border-line-soft rounded-2xl p-10 text-center text-muted-2">
          No document selected. Create one to start.
        </div>
      )}

      {dialog}
    </div>
  );
}
