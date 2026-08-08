import {
  clientIp,
  hashIp,
  ingestMatch,
  jsonResponse,
  matchPayloadSchema,
  preflight,
  readMatches,
  verifySignature,
} from "@/lib/sirens-bargain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  try {
    const matches = await readMatches({ limit });
    return jsonResponse(
      { ok: true, matches },
      {
        extraHeaders: {
          "cache-control": "public, s-maxage=15, stale-while-revalidate=60",
        },
      },
    );
  } catch (err) {
    console.error("[sirens-bargain] matches read failed", err);
    return jsonResponse({ ok: false, error: "Read failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const secret = process.env.SIRENS_BARGAIN_SECRET;
  if (!secret) {
    return jsonResponse(
      { ok: false, error: "Endpoint not configured" },
      { status: 500 },
    );
  }

  const rawBody = await req.text();
  const nowSec = Math.floor(Date.now() / 1000);
  const check = verifySignature(
    secret,
    req.headers.get("x-sirens-timestamp"),
    req.headers.get("x-sirens-signature"),
    rawBody,
    nowSec,
  );
  if (!check.ok) {
    return jsonResponse({ ok: false, error: check.error }, { status: check.status });
  }

  let parsed;
  try {
    parsed = matchPayloadSchema.safeParse(JSON.parse(rawBody));
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!parsed.success) {
    return jsonResponse(
      { ok: false, error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const ipHash = hashIp(clientIp(req));
  try {
    const result = await ingestMatch(parsed.data, ipHash);
    return jsonResponse(
      { ok: true, status: result.status, matchId: result.matchId },
      { status: result.status === "created" ? 201 : 200 },
    );
  } catch (err) {
    console.error("[sirens-bargain] ingest failed", err);
    return jsonResponse({ ok: false, error: "Ingest failed" }, { status: 500 });
  }
}
