"use client";

import { useState, useTransition } from "react";
import { useConfirm } from "@/components/confirm";
import type { AuditFinding } from "@/db/schema";
import {
  TEMPLATE_LABELS,
  defaultSectionsFor,
  type AuditSections,
  type TemplateKey,
} from "@/lib/audit-templates";
import type { SaveAuditInput } from "../actions";

type Initial = {
  client: string;
  url: string;
  template: TemplateKey;
  sections: AuditSections;
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
  const [template, setTemplate] = useState<TemplateKey>(initial.template);
  const [sections, setSections] = useState<AuditSections>(initial.sections);
  const [score, setScore] = useState(initial.score);
  const [fee, setFee] = useState(initial.fee);
  const [findings, setFindings] = useState<AuditFinding[]>(
    initial.findings.length ? initial.findings : [{ title: "", paras: [""] }],
  );
  const [scopeText, setScopeText] = useState(initial.scope.join("\n"));
  const [recipientEmail, setRecipientEmail] = useState(initial.recipientEmail);
  const [copyOpen, setCopyOpen] = useState(false);

  const [saving, startSaving] = useTransition();
  const [sending, startSending] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [savedOnce, setSavedOnce] = useState(initial.client !== "New audit");
  const { ask, dialog } = useConfirm();

  async function applyTemplate(next: TemplateKey) {
    const fresh = defaultSectionsFor(next);
    const currentMatchesOldTemplate =
      JSON.stringify(sections) === JSON.stringify(defaultSectionsFor(template));
    if (!currentMatchesOldTemplate) {
      const ok = await ask(
        "Switching templates overwrites every Copy field with the new template's defaults. Continue?",
        { confirmLabel: "Switch template", danger: true },
      );
      if (!ok) return;
    }
    setTemplate(next);
    setSections(fresh);
  }

  function patchSection<K extends keyof AuditSections>(
    key: K,
    value: AuditSections[K],
  ) {
    setSections((s) => ({ ...s, [key]: value }));
  }

  function patchCallout(field: "heading" | "para1" | "para2", value: string) {
    setSections((s) => ({ ...s, callout: { ...s.callout, [field]: value } }));
  }

  function patchSection3Para(idx: number, value: string) {
    setSections((s) => {
      const next = [...s.section3Paras];
      next[idx] = value;
      return { ...s, section3Paras: next };
    });
  }

  function addSection3Para() {
    setSections((s) => ({ ...s, section3Paras: [...s.section3Paras, ""] }));
  }

  function removeSection3Para(idx: number) {
    setSections((s) => ({
      ...s,
      section3Paras: s.section3Paras.filter((_, i) => i !== idx),
    }));
  }

  function buildInput(): SaveAuditInput {
    return {
      client: client.trim() || "Client",
      url: url.trim() || "example.com",
      template,
      sections,
      score,
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
      {dialog}
      <div className="space-y-5">
        <div className="bg-surface border border-line-soft rounded-2xl p-6">
          <h2 className="font-serif font-medium text-[1.15rem] mb-5">Setup</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Template" full>
              <select
                value={template}
                onChange={(e) => applyTemplate(e.target.value as TemplateKey)}
                className={inputClass}
              >
                {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map((k) => (
                  <option key={k} value={k}>
                    {TEMPLATE_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
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
            <Field label="Audit score (/100)">
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
              Findings — what&apos;s wrong
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

        <details
          className="bg-surface border border-line-soft rounded-2xl"
          open={copyOpen}
          onToggle={(e) => setCopyOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer px-6 py-5 flex items-center justify-between">
            <span className="font-serif font-medium text-[1.15rem]">
              Customise copy
            </span>
            <span className="text-[0.78rem] text-muted">
              Tokens: {"{client} {url} {score} {fee}"}
            </span>
          </summary>
          <div className="px-6 pb-6 pt-2 space-y-5">
            <Section title="Header + intro">
              <Field label="Eyebrow (small caps line above the title)">
                <input
                  value={sections.eyebrow}
                  onChange={(e) => patchSection("eyebrow", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Title fragment (the orange part after the URL)">
                <input
                  value={sections.titleFragment}
                  onChange={(e) => patchSection("titleFragment", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Lede paragraph">
                <textarea
                  value={sections.lede}
                  onChange={(e) => patchSection("lede", e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-y`}
                />
              </Field>
            </Section>

            <Section title="Situation callout">
              <Field label="Heading (bold lead-in)">
                <input
                  value={sections.callout.heading}
                  onChange={(e) => patchCallout("heading", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Paragraph 1">
                <textarea
                  value={sections.callout.para1}
                  onChange={(e) => patchCallout("para1", e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-y`}
                />
              </Field>
              <Field label="Paragraph 2 (often references {score})">
                <textarea
                  value={sections.callout.para2}
                  onChange={(e) => patchCallout("para2", e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-y`}
                />
              </Field>
            </Section>

            <Section title="Findings section">
              <Field label="Section heading">
                <input
                  value={sections.section1Title}
                  onChange={(e) => patchSection("section1Title", e.target.value)}
                  className={inputClass}
                />
              </Field>
            </Section>

            <Section title="Scope section">
              <Field label="Section heading">
                <input
                  value={sections.section2Title}
                  onChange={(e) => patchSection("section2Title", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Intro line above the bullet list">
                <textarea
                  value={sections.section2Intro}
                  onChange={(e) => patchSection("section2Intro", e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-y`}
                />
              </Field>
              <Field label="Outro line below the bullet list">
                <textarea
                  value={sections.section2Outro}
                  onChange={(e) => patchSection("section2Outro", e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-y`}
                />
              </Field>
            </Section>

            <Section title="Honest expectations">
              <Field label="Section heading">
                <input
                  value={sections.section3Title}
                  onChange={(e) => patchSection("section3Title", e.target.value)}
                  className={inputClass}
                />
              </Field>
              {sections.section3Paras.map((p, i) => (
                <Field key={i} label={`Paragraph ${i + 1}`}>
                  <div className="flex gap-2">
                    <textarea
                      value={p}
                      onChange={(e) => patchSection3Para(i, e.target.value)}
                      rows={2}
                      className={`${inputClass} resize-y`}
                    />
                    {sections.section3Paras.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeSection3Para(i)}
                        className="text-muted-2 hover:text-red"
                        aria-label="Remove paragraph"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                </Field>
              ))}
              <button
                type="button"
                onClick={addSection3Para}
                className="text-[0.82rem] text-muted hover:text-accent transition-colors"
              >
                + Add paragraph
              </button>
            </Section>

            <Section title="Commercials">
              <Field label="Section heading">
                <input
                  value={sections.section4Title}
                  onChange={(e) => patchSection("section4Title", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Price box label">
                <input
                  value={sections.priceLabel}
                  onChange={(e) => patchSection("priceLabel", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Footnote under the price">
                <textarea
                  value={sections.priceFootnote}
                  onChange={(e) => patchSection("priceFootnote", e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-y`}
                />
              </Field>
            </Section>

            <Section title="Signoff">
              <Field label="Closing line">
                <textarea
                  value={sections.signoff}
                  onChange={(e) => patchSection("signoff", e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-y`}
                />
              </Field>
            </Section>
          </div>
        </details>
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

          <div className="mt-5 pt-4 border-t border-line-soft">
            <button
              type="button"
              onClick={async () => {
                const ok = await ask("Delete this audit?", {
                  confirmLabel: "Delete",
                  danger: true,
                });
                if (ok) {
                  const fd = new FormData();
                  fd.set("id", String(id));
                  await deleteAction(fd);
                }
              }}
              className="text-[0.78rem] text-muted-2 hover:text-red transition-colors"
            >
              Delete audit
            </button>
          </div>
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
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`mb-3 last:mb-0 ${full ? "sm:col-span-2" : ""}`}>
      <label className="block mono text-[0.66rem] tracking-[0.1em] uppercase text-muted mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-bg-2 border border-line-soft rounded-lg p-4">
      <h3 className="font-serif font-medium text-[1rem] mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
