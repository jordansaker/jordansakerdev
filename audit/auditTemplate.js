// auditTemplate.js
// Branded audit -> HTML string for Jordan Saker / Studio.
// Pure function: data in, HTML out. No I/O, no Puppeteer here — easy to test.

const ACCENT = '#e7743d';

// Logo embedded inline (cleaner than a data-URI for a vector mark; renders 1:1 in Chrome).
// Swap the markup here if the brand mark ever changes.
const LOGO_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="46" height="46">` +
  `<rect width="80" height="80" rx="18" fill="${ACCENT}"/>` +
  `<text x="40" y="55" font-family="Georgia,'Times New Roman',serif" font-size="38" ` +
  `font-weight="600" fill="#0E0D0B" text-anchor="middle">JS</text></svg>`;

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * @param {object} data
 * @param {string} data.client   e.g. "Skybury"
 * @param {string} data.url      e.g. "skybury.com.au"
 * @param {string} [data.date]   defaults to current year
 * @param {number|string} [data.score]  mobile PageSpeed score (omit -> "[ score ]")
 * @param {string} [data.fee]    fixed fee, no $ (omit -> "[ fee ]")
 * @param {{title:string, paras:string[]}[]} [data.findings]
 * @param {string[]} [data.scope]  bullet list for "What I'd do"
 */
function auditHtml(data = {}) {
  const {
    client = 'Client',
    url = 'example.com',
    date = String(new Date().getFullYear()),
    score = null,
    fee = null,
    findings = [],
    scope = [],
  } = data;

  const scoreTok = score == null ? `<span class="token">[ score ]</span>` : esc(score);
  const feeTok = fee == null ? `<span class="token">[ fee ]</span>` : esc(fee);

  const findingsHtml = findings.map(f =>
    `<h3>${esc(f.title)}</h3>` +
    (f.paras || []).map(p => `<p class="muted">${esc(p)}</p>`).join('')
  ).join('');

  const scopeHtml = scope.map(s => `<li>${esc(s)}</li>`).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color:#1c1b19; font-size:10.2pt; line-height:1.6; }
  .head { width:100%; border-collapse:collapse; margin-bottom:4mm; }
  .head td { vertical-align:middle; }
  .brandcell { padding-left:11px; }
  .brandname { font-family:Georgia,'Times New Roman',serif; font-size:13pt; font-weight:600; color:#0E0D0B; line-height:1.1; }
  .brandsub { font-size:7.8pt; letter-spacing:.13em; text-transform:uppercase; color:#9a9a9a; margin-top:2px; }
  .meta { text-align:right; font-size:8pt; letter-spacing:.1em; text-transform:uppercase; color:#9a9a9a; line-height:1.7; }
  .rule { height:2.5px; background:${ACCENT}; width:100%; margin-bottom:7mm; }
  .eyebrow { font-size:8pt; letter-spacing:.16em; text-transform:uppercase; color:${ACCENT}; font-weight:bold; margin-bottom:3mm; }
  h1 { font-family:Georgia,'Times New Roman',serif; font-size:21pt; font-weight:600; line-height:1.15; color:#15140f; margin-bottom:2mm; }
  h1 .url { color:${ACCENT}; }
  .lede { font-size:9.6pt; color:#555; margin-bottom:7mm; }
  .section { margin-bottom:6.5mm; }
  .secnum { font-family:Georgia,serif; font-size:9pt; color:${ACCENT}; font-weight:600; }
  h2 { font-family:Georgia,'Times New Roman',serif; font-size:13.5pt; font-weight:600; color:#15140f; margin:1mm 0 3mm; padding-bottom:2mm; border-bottom:.7px solid #e6e4df; }
  h3 { font-family:Georgia,'Times New Roman',serif; font-size:11pt; font-weight:600; color:#2a2823; margin:4mm 0 1.5mm; }
  p { margin-bottom:2.5mm; }
  .muted { color:#555; }
  strong { color:#15140f; }
  .token { color:${ACCENT}; font-weight:bold; }
  .callout { background:#faf4ef; border-left:3px solid ${ACCENT}; padding:4mm 5mm; margin-bottom:6mm; }
  .callout p:last-child { margin-bottom:0; }
  .score { font-family:Georgia,serif; font-size:11pt; font-weight:600; color:#15140f; }
  ul.clean { list-style:none; margin:1mm 0 0; }
  ul.clean li { position:relative; padding-left:6mm; margin-bottom:1.8mm; }
  ul.clean li:before { content:""; position:absolute; left:0; top:3.2mm; width:3.5px; height:3.5px; background:${ACCENT}; border-radius:50%; }
  .price-box { border:.8px solid #e6e4df; border-top:2.5px solid ${ACCENT}; padding:5mm 6mm; margin:3mm 0 5mm; }
  .price-fig { font-family:Georgia,serif; font-size:16pt; font-weight:600; color:${ACCENT}; }
  .signoff { font-size:9pt; color:#777; font-style:italic; margin-top:7mm; padding-top:4mm; border-top:.7px solid #e6e4df; }
  </style></head><body>
  <table class="head"><tr>
    <td style="width:46px;">${LOGO_SVG}</td>
    <td class="brandcell"><div class="brandname">Jordan Saker</div><div class="brandsub">Software &amp; site performance</div></td>
    <td class="meta">Performance review<br>Mareeba, QLD<br>${esc(date)}</td>
  </tr></table>
  <div class="rule"></div>

  <div class="eyebrow">Site performance review</div>
  <h1>${esc(url)} — <span class="url">mobile speed</span></h1>
  <p class="lede">A no-obligation review of your storefront's mobile performance. Yours to keep regardless of whether we work together.</p>

  <div class="callout">
    <p><strong>The situation.</strong> ${esc(client)}'s site is currently loading slowly enough on mobile to <strong>fail Google's Core Web Vitals</strong> — the real-user speed metric that affects both the buying experience and search visibility. For a store taking orders online, that's a measurable drag on conversion, especially on phones.</p>
    <p class="muted">The encouraging part: the causes are specific, and none of them require changing your theme, your setup, your apps, or how the site looks. This is optimisation, not a rebuild. A current Google PageSpeed test scores the mobile homepage at <span class="score">${scoreTok}/100</span>.</p>
  </div>

  <div class="section"><span class="secnum">01</span>
    <h2>What's slowing it down</h2>
    ${findingsHtml}
  </div>

  <div class="section"><span class="secnum">02</span>
    <h2>What I'd do</h2>
    <p class="muted">A fixed-scope performance pass on the homepage and key templates:</p>
    <ul class="clean">${scopeHtml}</ul>
    <p class="muted" style="margin-top:3mm;"><strong>What stays exactly as it is:</strong> your theme, your setup, your apps, your checkout, and the entire look and content of the site. Nothing customer-facing changes except the speed. Work is done on an unpublished copy and shared for review before anything goes live — your live store is never touched mid-build.</p>
  </div>

  <div class="section"><span class="secnum">03</span>
    <h2>Honest expectations</h2>
    <p class="muted">The lab test score improves as soon as the work ships. Google's official Core Web Vitals status — the one in Search Console — is based on a rolling ~28-day window of real visitor data, so the "passing" status follows about a month later. The fix is immediate; Google's confirmation lags.</p>
    <p class="muted">I commit to a <strong>target</strong> — passing Core Web Vitals and a materially better mobile score — rather than a precise final number, confirmed on the working copy rather than over-promised here.</p>
  </div>

  <div class="section"><span class="secnum">04</span>
    <h2>Commercials</h2>
    <div class="price-box">
      <div class="muted" style="font-size:8.5pt; text-transform:uppercase; letter-spacing:.1em; margin-bottom:1.5mm;">Fixed-scope optimisation project</div>
      <span class="price-fig">$${feeTok}</span>
      <p class="muted" style="margin-top:2mm; margin-bottom:0;">A defined piece of work with a clear before/after — not an open-ended engagement. Optional ongoing maintenance available separately at a monthly rate, but not required.</p>
    </div>
  </div>

  <p class="signoff">Happy to walk through any of this on a call, or send the full PageSpeed report it's based on. No obligation either way. — Jordan</p>
  </body></html>`;
}

module.exports = { auditHtml };
