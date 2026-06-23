// renderAudit.js
// HTML -> PDF buffer via Puppeteer (headless Chrome).
const puppeteer = require('puppeteer');
const { auditHtml } = require('./auditTemplate');

// Footer lives here (Chrome's print engine ignores CSS @page margin boxes,
// so the running footer must go through Puppeteer's footerTemplate instead).
const FOOTER = `<div style="font-size:7.5pt;color:#9a9a9a;width:100%;padding:0 18mm;
  display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif;">
  <span>Jordan Saker &middot; ABN 95 658 646 131 &middot; Mareeba, QLD</span>
  <span>jordan@jordansakerdev.com</span></div>`;

// Reuse one browser across requests — launching Chrome per request is slow.
let _browser;
async function getBrowser() {
  if (!_browser || !_browser.connected) {
    _browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return _browser;
}

async function renderAuditPdf(data) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(auditHtml(data), { waitUntil: 'networkidle0' });
    return await page.pdf({
      format: 'A4',
      printBackground: true, // REQUIRED — without it the orange fills/borders vanish
      margin: { top: '20mm', bottom: '18mm', left: '18mm', right: '18mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>', // empty header
      footerTemplate: FOOTER,
    });
  } finally {
    await page.close(); // close the tab, keep the browser warm
  }
}

module.exports = { renderAuditPdf };
