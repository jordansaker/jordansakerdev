"use client";

import { useState, useTransition } from "react";
import type { AuditFinding } from "@/db/schema";
import type { SaveAuditInput } from "../actions";

type Initial = {
  client: string;
  url: string;
  score: string;
  fee: string;
  findings: AuditFinding[];
  scope: string[];
  recipientEmail: string;
};

type SaveAction = (
  id: number,
  input: SaveAuditInput,
) => Promise<{ ok: true } | { ok: false; error: string }>;
type SendAction = (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
type DeleteAction = (fd: FormData) => Promise<void>;

export function AuditEditor({
  id,
  initial,
  saveAction,
  sendAction,
  deleteAction,
}: {
  id: number;
  initial: Initial;
  saveAction: SaveAction;
  sendAction: SendAction;
  deleteAction: DeleteAction;
}) {
  const [client, setClient] = useState(initial.client);
  const [url, setUrl] = useState(initial.url);
  const [score, setScore] = useState(initial.score);
  const [fee, setFee] = useState(initial.fee);
  const [findings, setFindings] = useState<AuditFinding[]>(
    initial.findings.length ? initial.findings : [{ title: "", paras: [""] }],
  );
  const [scopeText, setScopeText] = useState(initial.scope.join("\n"));
  const [recipientEmail, setRecipientEmail] = useState(initial.recipientEmail);

  const [saving, startSaving] = useTransition();
  const [sending, startSending] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [savedOnce, setSavedOnce] = useState(initial.client !== "New audit");

  function buildInput(): SaveAuditInput {
    return {
      client: client.trim() || "Client",
      url: url.trim() || "example.com",
      score: score,
      fee: fee.trim(),
      findings: findings
        .map((f) => ({
          title: f.title.trim(),
          paras: f.paras.map((p) => p.trim()).filter(Boolean),
        }))
        .filter((f) => f.title),
      scope: scopeText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      recipientEmail: recipientEmail.trim(),
    };
  }

  function save() {
    setError(null);
    setOkMsg(null);
    startSaving(async () => {
      const result = await saveAction(id, buildInput());
      if (result.ok) {
        setOkMsg("Saved.");
        setSavedOnce(true);
      } else {
        setError(result.error);
      }
    });
  }

  function send() {
    setError(null);
    setOkMsg(null);
    if (!recipientEmail.trim()) {
      setError("Add a recipient email first.");
      return;
    }
    startSending(async () => {
      // Save first to ensure the latest content is on the PDF
      const saveResult = await saveAction(id, buildInput());
      if (!saveResult.ok) {
        setError(saveResult.error);
        return;
      }
      const fd = new FormData();
      fd.set("id", String(id));
      const result = await sendAction(fd);
      if (result.ok) {
        setOkMsg("Sent.");
        setSavedOnce(true);
      } else {
        setError(result.error ?? "Send failed");
      }
    });
  }

  function updateFinding(i: number, patch: Partial<AuditFinding>) {
    setFindings((curr) => curr.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function updateFindingBody(i: number, body: string) {
    const paras = body.split(/\n\s*\n/);
    updateFinding(i, { paras });
  }

  function addFinding() {
    setFindings((curr) => [...curr, { title: "", paras: [""] }]);
  }

  function removeFinding(i: number) {
    setFindings((curr) => curr.filter((_, idx) => idx !== i));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
      <div className="space-y-5">
        <div className="bg-surface border border-line-soft rounded-2xl p-6">
          <h2 className="font-serif font-medium text-[1.15rem] mb-5">Client</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Client name">
              <input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Site URL">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className={inputClass}
                placeholder="example.com.au"
              />
            </Field>
            <Field label="Mobile score (/100)">
              <input
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className={inputClass}
                placeholder="42"
                min={0}
                max={100}
              />
            </Field>
            <Field label="Fixed fee ($)">
              <input
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className={inputClass}
                placeholder="1,200"
              />
            </Field>
          </div>
        </div>

        <div className="bg-surface border border-line-soft rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif font-medium text-[1.15rem]">
              Findings — what&apos;s slowing it down
            </h2>
            <button
              type="button"
              onClick={addFinding}
              className="text-[0.82rem] text-muted hover:text-accent transition-colors"
            >
              + Add finding
            </button>
          </div>
          <div className="space-y-4">
            {findings.map((f, i) => (
              <div
                key={i}
                className="bg-bg-2 border border-line-soft rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <input
                      value={f.title}
                      onChange={(e) => updateFinding(i, { title: e.target.value })}
                      placeholder="Finding title"
                      className={inputClass}
                    />
                    <textarea
                      value={f.paras.join("\n\n")}
                      onChange={(e) => updateFindingBody(i, e.target.value)}
                      placeholder="Description. Leave a blank line between paragraphs."
                      rows={4}
                      className={`${inputClass} resize-y`}
                    />
                  </div>
                  {findings.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeFinding(i)}
                      className="text-muted-2 hover:text-red mt-2"
                      aria-label="Remove finding"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-line-soft rounded-2xl p-6">
          <h2 className="font-serif font-medium text-[1.15rem] mb-4">
            What I&apos;d do — one item per line
          </h2>
          <textarea
            value={scopeText}
            onChange={(e) => setScopeText(e.target.value)}
            rows={6}
            className={`${inputClass} resize-y`}
            placeholder={
              "Re-engineer how the currency selector loads\nResize and reformat the homepage imagery\nDefer non-critical scripts and the review embed"
            }
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-surface border border-line-soft rounded-2xl p-5 lg:sticky lg:top-6">
          <h3 className="font-serif font-medium text-[1.05rem] mb-3">Actions</h3>

          <Field label="Recipient email">
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="prospect@example.com"
              className={inputClass}
            />
          </Field>

          <div className="space-y-2 mt-4">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full rounded-full bg-accent text-bg font-semibold text-[0.88rem] py-2.5 disabled:opacity-50 hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)] transition-all"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {savedOnce ? (
              <a
                href={`/api/audits/${id}/pdf`}
                target="_blank"
                className="block w-full text-center rounded-full border border-line text-text font-semibold text-[0.88rem] py-2.5 hover:border-text transition-colors"
              >
                Download PDF
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="w-full rounded-full border border-line text-muted-2 font-semibold text-[0.88rem] py-2.5"
                title="Save first to download"
              >
                Download PDF
              </button>
            )}
            <button
              type="button"
              onClick={send}
              disabled={sending || !recipientEmail.trim()}
              className="w-full rounded-full bg-accent-2-soft text-accent-2 font-semibold text-[0.88rem] py-2.5 disabled:opacity-50 transition-colors"
            >
              {sending ? "Sending…" : "Send to client"}
            </button>
          </div>

          {error ? <p className="text-red text-[0.82rem] mt-3">{error}</p> : null}
          {okMsg ? <p className="text-green text-[0.82rem] mt-3">{okMsg}</p> : null}

          <form action={deleteAction} className="mt-5 pt-4 border-t border-line-soft">
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              onClick={(e) => {
                if (!confirm("Delete this audit?")) e.preventDefault();
              }}
              className="text-[0.78rem] text-muted-2 hover:text-red transition-colors"
            >
              Delete audit
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[0.92rem] text-text focus:outline-none focus:border-accent";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <label className="block mono text-[0.66rem] tracking-[0.1em] uppercase text-muted mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
