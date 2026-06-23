# Audits tab — drop-in

Three files generate a branded performance-audit PDF from a form.

- `auditTemplate.js` — pure function `auditHtml(data)` → branded HTML string (logo + orange baked in).
- `renderAudit.js` — `renderAuditPdf(data)` → PDF buffer via Puppeteer.
- `audits.routes.js` — Express router: `GET /audits` (form) + `POST /audits/generate` (download).

## Install

```bash
npm i express puppeteer
```

## Wire it up

```js
const express = require('express');
const app = express();
app.use(express.json());              // required — the form POSTs JSON
app.use(require('./audits.routes'));  // adds /audits and /audits/generate
app.listen(3000);
```

Then open `/audits`, fill the form, hit Generate, PDF downloads. Behind your existing Studio auth, obviously.

## Data shape

```js
{
  client: "Skybury",
  url: "skybury.com.au",
  score: 42,            // omit/null -> shows "[ score ]" placeholder
  fee: "1,200",         // omit/null -> shows "[ fee ]" placeholder
  findings: [
    { title: "...", paras: ["paragraph 1", "paragraph 2"] }
  ],
  scope: ["...", "..."]  // bullets under "What I'd do"
}
```

The boilerplate sections (honest-expectations, "what stays as is", commercials wording, sign-off) are fixed in the template — only the per-client bits are data. Add a field to `auditTemplate.js` if you want more of it editable.

## Gotchas (the ones that actually bite)

- **`printBackground: true` is non-negotiable.** Without it Chrome strips the orange callout, accent rule and price-box border. Already set in `renderAudit.js`.
- **Footer is Puppeteer's, not CSS.** Chrome's print engine ignores CSS `@page` margin boxes, so the running footer lives in `footerTemplate` inside `renderAudit.js`, not in the template's CSS. Edit it there.
- **Findings are escaped (plain text).** Form input is HTML-escaped for safety, so you can't inject `<strong>` from the form. If you want a bold lead-in per finding, add a `lead` field to the template rather than passing markup through.
- **Fonts.** Headings use a Georgia/serif stack. If your server lacks Georgia it falls back to its default serif (fine, but slightly different). Install a serif font or self-host one if you want pixel-identical output.
- **Browser reuse.** `renderAudit.js` keeps one Chrome warm across requests. On a long-running server that's ideal; if you deploy somewhere that freezes between requests, it relaunches automatically.

## Serverless note

Puppeteer bundles full Chromium (~300MB) and needs a few system libs — perfect on a VPS/container, awkward on Vercel/Lambda. If you're serverless, swap to `puppeteer-core` + `@sparticuz/chromium`, or POST the HTML from `auditTemplate.js` to a hosted PDF API (PDFShift, DocRaptor, Browserless) and skip running Chrome yourself.
