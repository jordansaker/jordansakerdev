// audits.routes.js
// A tiny "Audits" tab for Studio.
//
//   const express = require('express');
//   const app = express();
//   app.use(express.json());                 // <-- required for the POST body
//   app.use(require('./audits.routes'));
//
// Then visit /audits.
const express = require('express');
const { renderAuditPdf } = require('./renderAudit');
const router = express.Router();

// --- The form (GET /audits) ---
router.get('/audits', (_req, res) => {
  res.type('html').send(FORM_HTML);
});

// --- Generate + download (POST /audits/generate), expects JSON ---
router.post('/audits/generate', async (req, res) => {
  try {
    const pdf = await renderAuditPdf(req.body || {});
    const safe = String(req.body.client || 'audit').replace(/[^a-z0-9]+/gi, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safe}-performance-review.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('audit render failed:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

const FORM_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>New audit · Studio</title>
<style>
 body{font-family:Helvetica,Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#1c1b19;}
 h1{font-family:Georgia,serif;font-size:22px;font-weight:600;} .accent{color:#e7743d;}
 label{display:block;font-size:13px;font-weight:600;margin:14px 0 4px;}
 input,textarea{width:100%;padding:9px 11px;border:1px solid #d8d6d0;border-radius:8px;font:inherit;}
 textarea{min-height:64px;resize:vertical;}
 .row{display:flex;gap:10px;flex-wrap:wrap;} .row>div{flex:1;min-width:160px;}
 .card{border:1px solid #e6e4df;border-radius:10px;padding:12px;margin-top:10px;}
 button{font:inherit;cursor:pointer;border-radius:8px;padding:9px 14px;border:1px solid #d8d6d0;background:#fff;margin-top:8px;}
 button.primary{background:#e7743d;border-color:#e7743d;color:#fff;font-weight:600;margin-top:22px;}
 .small{font-size:12px;color:#888;}
</style></head><body>
<h1>New <span class="accent">audit</span></h1>
<p class="small">Fills the branded template and downloads a PDF. Leave score or fee blank to keep the orange placeholder.</p>

<div class="row">
 <div><label>Client</label><input id="client" placeholder="Skybury"></div>
 <div><label>Site URL</label><input id="url" placeholder="skybury.com.au"></div>
</div>
<div class="row">
 <div><label>Mobile score (/100)</label><input id="score" type="number" placeholder="42"></div>
 <div><label>Fixed fee ($)</label><input id="fee" placeholder="1,200"></div>
</div>

<label>Findings</label>
<div id="findings"></div>
<button type="button" onclick="addFinding()">+ Add finding</button>

<label style="margin-top:20px;">What I'd do — one item per line</label>
<textarea id="scope" placeholder="Re-engineer how the currency selector loads
Resize and reformat the homepage imagery
Defer non-critical scripts and the review embed"></textarea>

<button class="primary" onclick="generate()">Generate PDF</button>

<template id="ftpl">
 <div class="card">
  <input class="f-title" placeholder="Finding title">
  <textarea class="f-body" style="margin-top:8px;" placeholder="Description. Leave a blank line between paragraphs for multiple."></textarea>
 </div>
</template>

<script>
 const F = document.getElementById('findings');
 function addFinding(){ F.appendChild(document.getElementById('ftpl').content.cloneNode(true)); }
 addFinding();
 async function generate(){
   const findings = [...F.querySelectorAll('.card')].map(c => ({
     title: c.querySelector('.f-title').value.trim(),
     paras: c.querySelector('.f-body').value.split(/\\n\\s*\\n/).map(s => s.trim()).filter(Boolean)
   })).filter(f => f.title);
   const scope = document.getElementById('scope').value.split(/\\n/).map(s => s.trim()).filter(Boolean);
   const data = {
     client: client.value.trim(),
     url: url.value.trim(),
     score: score.value || null,
     fee: fee.value.trim() || null,
     findings, scope
   };
   const r = await fetch('/audits/generate', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(data)
   });
   if (!r.ok) { alert('Generate failed — check the server log.'); return; }
   const blob = await r.blob();
   const a = document.createElement('a');
   a.href = URL.createObjectURL(blob);
   a.download = (client.value.trim() || 'audit') + '-performance-review.pdf';
   a.click();
   URL.revokeObjectURL(a.href);
 }
</script></body></html>`;

module.exports = router;
