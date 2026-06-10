import "server-only";

export type ResendInboundEmail = {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  reply_to?: string[];
  subject: string;
  message_id: string;
  text?: string | null;
  html?: string | null;
  html_format?: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename?: string;
    content_type?: string;
    size?: number;
    url?: string;
  }>;
  created_at?: string;
};

/**
 * Fetch the full body + headers for an inbound email.
 *
 * The Resend webhook for `email.received` only carries metadata. To get the
 * text/html and message-level headers (In-Reply-To, References, Message-Id)
 * we follow up with this endpoint using the email_id from the webhook.
 */
export async function fetchInboundEmail(
  emailId: string,
): Promise<ResendInboundEmail | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Resend inbound fetch failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as ResendInboundEmail;
}

export function pickHeader(
  headers: Record<string, string> | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  const lc = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lc) {
      const v = headers[k];
      return typeof v === "string" ? v : String(v);
    }
  }
  return null;
}
