"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { Client, EmailMessage } from "@/db/schema";
import type { SendEmailResult } from "./actions";

const BRAND_NAME = "Jordan Saker";
const BRAND_EMAIL = "jordan@jordansakerdev.com";
const BRAND_PHONE = "0447 481 016";
const BRAND_WEBSITE = "jordansakerdev.com";
const BRAND_ABN = "95 658 646 131";
const ACCENT = "#E8743B";
const ACCENT_SOFT = "rgba(232,116,59,0.14)";

type SendAction = (fd: FormData) => Promise<SendEmailResult>;

export function EmailComposer({
  clients,
  recent,
  from,
  sendAction,
}: {
  clients: Client[];
  recent: EmailMessage[];
  from: string;
  sendAction: SendAction;
}) {
  const [to, setTo] = useState("");
  const [clientId, setClientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(
    "Hi there,\n\nWrite your message here.\n\nThanks,",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fromAddress = useMemo(() => {
    const m = from.match(/<([^>]+)>/);
    return m ? m[1] : from;
  }, [from]);

  function onClientPick(id: string) {
    setClientId(id);
    if (id) {
      const c = clients.find((x) => String(x.id) === id);
      if (c?.email) setTo(c.email);
    }
  }

  function wrapSelection(left: string, right: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = body.slice(0, start);
    const sel = body.slice(start, end);
    const after = body.slice(end);
    const next = `${before}${left}${sel || "text"}${right}${after}`;
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + left.length, start + left.length + (sel || "text").length);
    });
  }

  function insertList() {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const before = body.slice(0, start);
    const after = body.slice(start);
    const insert = before.endsWith("\n") || before === "" ? "• " : "\n• ";
    setBody(before + insert + after);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + insert.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function onFilesChange(list: FileList | null) {
    if (!list) return;
    setFiles((curr) => [...curr, ...Array.from(list)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(idx: number) {
    setFiles((curr) => curr.filter((_, i) => i !== idx));
  }

  function submit() {
    setError(null);
    setOkMsg(null);
    if (!to || !subject || !body.trim()) {
      setError("To, Subject and Body are required.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("to", to);
      if (clientId) fd.set("clientId", clientId);
      fd.set("subject", subject);
      fd.set("body", body);
      for (const f of files) fd.append("attachments", f);
      const result = await sendAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOkMsg("Sent.");
      setBody("");
      setSubject("");
      setFiles([]);
    });
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {/* COMPOSE */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="bg-surface border border-line-soft rounded-2xl p-6"
      >
        <h2 className="font-serif font-medium text-[1.15rem] mb-5">Compose</h2>

        <Field label="To">
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="client@example.com.au"
            className={inputClass}
          />
        </Field>

        {clients.length > 0 ? (
          <Field label="Or select a client">
            <select
              value={clientId}
              onChange={(e) => onClientPick(e.target.value)}
              className={inputClass}
            >
              <option value="">— Choose client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id} disabled={!c.email}>
                  {c.name}
                  {c.email ? ` · ${c.email}` : " · no email"}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Subject">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Template">
          <select className={inputClass} defaultValue="general" disabled>
            <option value="general">General — plain branded email</option>
          </select>
        </Field>

        <Field label="Body">
          <div className="flex items-center gap-3 px-3 py-2 border border-line border-b-0 rounded-t-lg bg-bg-2 text-[0.78rem] text-muted">
            <button
              type="button"
              onClick={() => wrapSelection("**", "**")}
              className="font-bold hover:text-text"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => wrapSelection("*", "*")}
              className="italic hover:text-text"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => wrapSelection("[", "](https://)")}
              className="hover:text-text"
            >
              Link
            </button>
            <button
              type="button"
              onClick={insertList}
              className="hover:text-text"
            >
              • List
            </button>
          </div>
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={9}
            className="w-full bg-bg-2 border border-line border-t-0 rounded-b-lg px-3 py-3 text-[0.95rem] text-text focus:outline-none focus:border-accent resize-y leading-relaxed"
          />
        </Field>

        <Field label="Attachments">
          <div className="border border-dashed border-line rounded-lg p-3 bg-bg-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => onFilesChange(e.target.files)}
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
                      <span className="text-muted">· {formatBytes(f.size)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
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
        </Field>

        {error ? (
          <p className="text-red text-sm mb-3">{error}</p>
        ) : null}
        {okMsg ? <p className="text-green text-sm mb-3">{okMsg}</p> : null}

        <div className="flex items-center justify-between mt-5">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-accent text-bg font-semibold text-[0.88rem] px-4 py-2.5 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)] transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            {pending ? "Sending…" : "Send email"}
          </button>
          <span className="text-[0.78rem] text-muted-2">
            From {fromAddress} via Resend
          </span>
        </div>
      </form>

      {/* PREVIEW — light themed because it mirrors how a real email renders */}
      <div className="bg-[#F4EFE3] border border-[#F1ECDE] rounded-2xl p-6 text-[#1B1814]">
        <h2 className="font-serif font-medium text-[1.15rem] mb-4 flex items-center gap-2 text-[#1B1814]">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: ACCENT }}
            aria-hidden
          />
          Live preview
        </h2>

        <div className="bg-white border border-[#F1ECDE] rounded-xl p-5 mb-5 shadow-[0_1px_0_rgba(27,24,20,0.03)]">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <span className="text-[0.85rem] text-[#1B1814]">
              <b>{BRAND_NAME}</b>{" "}
              <span className="text-[#766C5F]">· {fromAddress}</span>
            </span>
            <span className="text-[0.75rem] text-[#766C5F]">Just now</span>
          </div>
          <div className="text-[0.92rem] text-[#1B1814] font-medium mb-4">
            {subject || <span className="text-[#766C5F]">Subject preview</span>}
          </div>

          {/* The rendered email itself */}
          <div className="bg-[#FAF6EE] border border-[#F1ECDE] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F1ECDE] flex items-center gap-3 bg-white">
              <span
                className="w-8 h-8 rounded-md flex items-center justify-center text-[#0E0D0B] text-[0.78rem] font-semibold"
                style={{ background: ACCENT, fontFamily: "Georgia, serif" }}
              >
                JS
              </span>
              <span className="font-semibold text-[1.02rem] text-[#1B1814]">
                {BRAND_NAME}
              </span>
            </div>
            <div className="px-5 py-5 text-[0.93rem] text-[#1B1814] leading-relaxed bg-white">
              <BodyPreview value={body} />
            </div>
            <div className="px-5 pb-5 pt-2 bg-white text-[0.86rem]">
              <div className="font-semibold text-[#1B1814]">{BRAND_NAME}</div>
              <div className="text-[#766C5F] mt-0.5">
                <a href={`mailto:${BRAND_EMAIL}`} style={{ color: ACCENT }}>
                  {BRAND_EMAIL}
                </a>{" "}
                · {BRAND_PHONE}
              </div>
              <div className="mt-0.5">
                <a href={`https://${BRAND_WEBSITE}`} style={{ color: ACCENT }}>
                  {BRAND_WEBSITE}
                </a>
              </div>
            </div>
            <div className="px-5 py-3 bg-[#FAF6EE] border-t border-[#F1ECDE] text-center text-[0.72rem] text-[#766C5F]">
              {BRAND_NAME} · ABN {BRAND_ABN}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-[0.95rem] font-medium mb-2 text-[#1B1814]">Recently sent</h3>
          {recent.length === 0 ? (
            <p className="text-[0.85rem] text-[#766C5F]">Nothing sent yet.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="bg-white border border-[#F1ECDE] rounded-lg px-4 py-3 flex items-baseline justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-[0.88rem] text-[#1B1814] truncate flex items-center gap-2">
                      {r.toAddress}
                      {r.status === "failed" ? (
                        <span className="mono text-[0.62rem] uppercase tracking-wider text-[#B14B3E] bg-[rgba(214,115,95,0.14)] px-1.5 py-0.5 rounded">
                          failed
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[0.78rem] text-[#766C5F] truncate">
                      {r.subject}
                    </div>
                  </div>
                  <span className="text-[0.72rem] text-[#766C5F] shrink-0">
                    {timeAgo(r.sentAt as unknown as string)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function BodyPreview({ value }: { value: string }) {
  const paragraphs = value
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return <p className="text-[#766C5F]">Type a message on the left…</p>;
  }
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className="mb-3 last:mb-0 whitespace-pre-wrap">
          {p}
        </p>
      ))}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block mono text-[0.66rem] tracking-[0.1em] uppercase text-muted mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full bg-bg-2 border border-line rounded-lg px-3 py-2.5 text-[0.92rem] text-text focus:outline-none focus:border-accent";

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
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
