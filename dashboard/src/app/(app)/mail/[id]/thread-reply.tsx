"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrandEmailPreview } from "@/components/brand-email-preview";
import type { SendEmailResult } from "../actions";

type SendAction = (fd: FormData) => Promise<SendEmailResult>;

export function ThreadReply({
  threadId,
  to,
  subject,
  fromAddress,
  sendAction,
}: {
  threadId: number;
  to: string;
  subject: string;
  fromAddress: string;
  sendAction: SendAction;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function submit() {
    setError(null);
    if (!body.trim()) {
      setError("Write a reply first.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("to", to);
      fd.set("subject", subject);
      fd.set("body", body);
      fd.set("threadId", String(threadId));
      for (const f of files) fd.append("attachments", f);
      const result = await sendAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setFiles([]);
      router.refresh();
    });
  }

  function onFiles(list: FileList | null) {
    if (!list) return;
    setFiles((curr) => [...curr, ...Array.from(list)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="bg-surface border border-line-soft rounded-2xl p-6 space-y-3"
      >
        <h2 className="font-serif font-medium text-[1.15rem]">Reply</h2>
        <div className="text-[0.85rem] text-muted">
          To <span className="text-text">{to}</span> · Subject{" "}
          <span className="text-text">{subject}</span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={9}
          placeholder="Write your reply…"
          className="w-full bg-bg-2 border border-line rounded-lg px-3 py-3 text-[0.95rem] text-text focus:outline-none focus:border-accent resize-y leading-relaxed"
        />
        <div className="border border-dashed border-line rounded-lg p-3 bg-bg-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => onFiles(e.target.files)}
            className="block w-full text-[0.85rem] text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-accent-soft file:text-accent file:font-semibold file:text-[0.78rem] cursor-pointer"
          />
          {files.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-[0.85rem]">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between bg-surface border border-line-soft rounded-md px-3 py-1.5"
                >
                  <span className="truncate text-text">
                    {f.name}{" "}
                    <span className="text-muted">
                      · {(f.size / 1024).toFixed(1)} KB
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((c) => c.filter((_, k) => k !== i))}
                    className="text-muted hover:text-red ml-3 text-[0.95rem]"
                    aria-label={`Remove ${f.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {error ? <p className="text-red text-sm">{error}</p> : null}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-accent text-bg font-semibold text-[0.88rem] px-4 py-2.5 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)] transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-4 h-4"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            {pending ? "Sending…" : "Send reply"}
          </button>
        </div>
      </form>

      <BrandEmailPreview
        subject={subject}
        body={body}
        fromAddress={fromAddress}
      />
    </div>
  );
}
