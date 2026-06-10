import "server-only";

const BRAND = {
  name: "Jordan Saker",
  email: "jordan@jordansakerdev.com",
  phone: "0447 481 016",
  website: "jordansakerdev.com",
  abn: "95 658 646 131",
  monogram: "JS",
  accent: "#E8743B",
  accentSoft: "rgba(232,116,59,0.14)",
  ink: "#1B1814",
  muted: "#766C5F",
  surface: "#FFFFFF",
  page: "#FAF6EE",
  line: "#E5DDD0",
  lineSoft: "#F1ECDE",
};

function paragraphs(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px 0;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderBrandEmail({
  body,
  preheader,
}: {
  body: string;
  preheader?: string;
}): string {
  const bodyHtml = paragraphs(body);
  const preheaderTxt = preheader ?? body.slice(0, 120);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(BRAND.name)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};font-family:-apple-system,BlinkMacSystemFont,'Hanken Grotesk','Segoe UI',Helvetica,Arial,sans-serif;color:${BRAND.ink};line-height:1.55;">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;">${escapeHtml(preheaderTxt)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.page};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:${BRAND.surface};border:1px solid ${BRAND.line};border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid ${BRAND.lineSoft};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="width:34px;height:34px;border-radius:8px;background:${BRAND.accent};color:#0E0D0B;font-weight:600;font-family:Georgia,serif;font-size:14px;text-align:center;line-height:34px;">${BRAND.monogram}</div>
                  </td>
                  <td style="vertical-align:middle;padding-left:12px;font-size:16px;font-weight:600;color:${BRAND.ink};">${escapeHtml(BRAND.name)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px 6px 28px;font-size:15px;color:${BRAND.ink};">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:6px 28px 22px 28px;font-size:14px;color:${BRAND.ink};">
              <div style="font-weight:600;">${escapeHtml(BRAND.name)}</div>
              <div style="margin-top:4px;color:${BRAND.muted};">
                <a href="mailto:${BRAND.email}" style="color:${BRAND.accent};text-decoration:none;">${BRAND.email}</a>
                &nbsp;·&nbsp; ${escapeHtml(BRAND.phone)}
              </div>
              <div style="margin-top:2px;color:${BRAND.muted};">
                <a href="https://${BRAND.website}" style="color:${BRAND.accent};text-decoration:none;">${BRAND.website}</a>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:12px 28px;background:${BRAND.page};border-top:1px solid ${BRAND.lineSoft};font-size:12px;color:${BRAND.muted};">
              ${escapeHtml(BRAND.name)} · ABN ${escapeHtml(BRAND.abn)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderBrandText({ body }: { body: string }): string {
  return [
    body.trim(),
    "",
    "—",
    BRAND.name,
    `${BRAND.email} · ${BRAND.phone}`,
    BRAND.website,
    "",
    `${BRAND.name} · ABN ${BRAND.abn}`,
  ].join("\n");
}

export const BRAND_INFO = BRAND;
