import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  sirensMatchPlayers,
  sirensMatches,
  sirensPlayers,
} from "@/db/schema";

/**
 * Public endpoint fed by https://jordansaker.github.io/sirens-bargain/.
 *
 * Auth is HMAC-SHA256 over `<timestamp>.<raw-body>` with a shared secret
 * (SIRENS_BARGAIN_SECRET). The secret is embedded in the game's client JS,
 * which is public — the scheme deters trivial curl posts and replay attacks
 * but does not stop a determined cheat. That trade-off is accepted; keep the
 * denormalised leaderboard in `sirens_players` easy to reset if needed.
 */

export const ALLOWED_ORIGIN = "https://jordansaker.github.io";
const TIMESTAMP_WINDOW_SEC = 5 * 60;
const FUTURE_SKEW_SEC = 60;

const playerSchema = z.object({
  name: z.string().trim().min(1).max(60),
  realms: z.number().int().min(0).max(1000).default(0),
  steals: z.number().int().min(0).max(1000).default(0),
  tributes: z.number().int().min(0).max(1000).default(0),
});

export const matchPayloadSchema = z
  .object({
    endedAt: z.string().datetime(),
    turns: z.number().int().min(1).max(1000),
    winner: z.string().trim().min(1).max(60),
    players: z.array(playerSchema).min(1).max(8),
  })
  .refine(
    (d) =>
      d.players.some(
        (p) => p.name.toLowerCase() === d.winner.toLowerCase(),
      ),
    { message: "winner must match one of the player names" },
  );

export type MatchPayload = z.infer<typeof matchPayloadSchema>;

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "content-type, x-sirens-timestamp, x-sirens-signature",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function jsonResponse(
  body: unknown,
  init: { status?: number; extraHeaders?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(),
      ...(init.extraHeaders ?? {}),
    },
  });
}

type VerifyResult = { ok: true } | { ok: false; status: number; error: string };

export function verifySignature(
  secret: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
  rawBody: string,
  nowSec: number,
): VerifyResult {
  if (!timestampHeader || !signatureHeader) {
    return { ok: false, status: 401, error: "Missing signature headers" };
  }
  const ts = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(ts)) {
    return { ok: false, status: 401, error: "Bad timestamp" };
  }
  if (ts > nowSec + FUTURE_SKEW_SEC || nowSec - ts > TIMESTAMP_WINDOW_SEC) {
    return { ok: false, status: 401, error: "Timestamp out of window" };
  }
  const expected = createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signatureHeader, "hex");
  } catch {
    return { ok: false, status: 401, error: "Bad signature encoding" };
  }
  if (provided.length !== expected.length) {
    return { ok: false, status: 401, error: "Signature mismatch" };
  }
  if (!timingSafeEqual(provided, expected)) {
    return { ok: false, status: 401, error: "Signature mismatch" };
  }
  return { ok: true };
}

export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

/**
 * Deterministic match id: sha256 over the fields that uniquely identify a
 * match (endedAt + winner + sorted player names, all lower-cased). Same
 * payload posted twice yields the same id, so the UNIQUE constraint on
 * sirens_matches.match_id makes ingest idempotent.
 */
export function computeMatchId(payload: MatchPayload): string {
  const names = payload.players
    .map((p) => p.name.toLowerCase())
    .sort()
    .join("|");
  const key = `${payload.endedAt}|${payload.winner.toLowerCase()}|${names}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

type IngestResult =
  | { status: "created"; matchId: number }
  | { status: "duplicate"; matchId: number };

export async function ingestMatch(
  payload: MatchPayload,
  ipHash: string | null,
): Promise<IngestResult> {
  const matchIdHash = computeMatchId(payload);
  const winnerKey = payload.winner.toLowerCase();

  return await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: sirensMatches.id })
      .from(sirensMatches)
      .where(eq(sirensMatches.matchId, matchIdHash))
      .limit(1);
    if (existing[0]) {
      return { status: "duplicate", matchId: existing[0].id };
    }

    const endedAt = new Date(payload.endedAt);
    const [inserted] = await tx
      .insert(sirensMatches)
      .values({
        matchId: matchIdHash,
        endedAt,
        turns: payload.turns,
        winnerName: payload.winner,
        ipHash,
      })
      .returning({ id: sirensMatches.id });
    const matchRowId = inserted.id;

    await tx.insert(sirensMatchPlayers).values(
      payload.players.map((p) => ({
        matchId: matchRowId,
        name: p.name,
        won: p.name.toLowerCase() === winnerKey,
        realms: p.realms,
        steals: p.steals,
        tributes: p.tributes,
      })),
    );

    for (const p of payload.players) {
      const won = p.name.toLowerCase() === winnerKey;
      const winInc = won ? 1 : 0;
      const lossInc = won ? 0 : 1;
      const nameKey = p.name.toLowerCase();
      await tx
        .insert(sirensPlayers)
        .values({
          nameKey,
          name: p.name,
          wins: winInc,
          losses: lossInc,
          matches: 1,
          totalRealms: p.realms,
          totalSteals: p.steals,
          totalTributes: p.tributes,
          lastMatchAt: endedAt,
        })
        .onConflictDoUpdate({
          target: sirensPlayers.nameKey,
          set: {
            // Preserve the latest casing of the display name.
            name: sql`CASE WHEN ${sirensPlayers.lastMatchAt} < ${endedAt} THEN ${p.name} ELSE ${sirensPlayers.name} END`,
            lastMatchAt: sql`GREATEST(${sirensPlayers.lastMatchAt}, ${endedAt})`,
            wins: sql`${sirensPlayers.wins} + ${winInc}`,
            losses: sql`${sirensPlayers.losses} + ${lossInc}`,
            matches: sql`${sirensPlayers.matches} + 1`,
            totalRealms: sql`${sirensPlayers.totalRealms} + ${p.realms}`,
            totalSteals: sql`${sirensPlayers.totalSteals} + ${p.steals}`,
            totalTributes: sql`${sirensPlayers.totalTributes} + ${p.tributes}`,
            updatedAt: sql`now()`,
          },
        });
    }

    return { status: "created", matchId: matchRowId };
  });
}

export type LeaderboardEntry = {
  name: string;
  wins: number;
  losses: number;
  matches: number;
  winRate: number;
  totalRealms: number;
  totalSteals: number;
  totalTributes: number;
  lastMatchAt: string;
};

export async function readLeaderboard(
  opts: { limit?: number; minMatches?: number } = {},
): Promise<LeaderboardEntry[]> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const minMatches = Math.max(opts.minMatches ?? 1, 1);
  const rows = await db
    .select()
    .from(sirensPlayers)
    .where(gte(sirensPlayers.matches, minMatches))
    .orderBy(
      sql`${sirensPlayers.wins} DESC,
          (${sirensPlayers.wins}::float / NULLIF(${sirensPlayers.matches}, 0)) DESC,
          ${sirensPlayers.lastMatchAt} DESC`,
    )
    .limit(limit);
  return rows.map((r) => ({
    name: r.name,
    wins: r.wins,
    losses: r.losses,
    matches: r.matches,
    winRate: r.matches > 0 ? r.wins / r.matches : 0,
    totalRealms: r.totalRealms,
    totalSteals: r.totalSteals,
    totalTributes: r.totalTributes,
    lastMatchAt: r.lastMatchAt.toISOString(),
  }));
}
