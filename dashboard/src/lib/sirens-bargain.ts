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
  playerId: z.string().min(1).max(64),
  name: z.string().min(1).max(60),
  result: z.enum(["win", "loss", "draw"]),
  turnOrder: z.number().int().min(1).max(16),
  realmsCompleted: z.number().int().min(0).max(100).default(0),
  pearlsBanked: z.number().int().min(0).max(10_000).default(0),
  cardsStolen: z.number().int().min(0).max(10_000).default(0),
  tributesCharged: z.number().int().min(0).max(10_000).default(0),
  sirensRefusalsPlayed: z.number().int().min(0).max(10_000).default(0),
  ratingBefore: z.number().int().min(0).max(10_000),
  ratingAfter: z.number().int().min(0).max(10_000),
  ratingDelta: z.number().int().min(-1000).max(1000),
});

export const matchPayloadSchema = z.object({
  matchId: z.string().min(1).max(64),
  mode: z.string().min(1).max(32),
  roomCode: z.string().max(16).nullish(),
  endedAt: z.string().datetime(),
  durationSeconds: z.number().int().min(1).max(86_400),
  turns: z.number().int().min(1).max(1000),
  winnerId: z.string().max(64).nullish(),
  players: z.array(playerSchema).min(1).max(8),
});

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

type IngestResult =
  | { status: "created"; matchId: number }
  | { status: "duplicate"; matchId: number };

/**
 * Insert a match + its players, and upsert the denormalised leaderboard row
 * for each player. Idempotent on matchId.
 */
export async function ingestMatch(
  payload: MatchPayload,
  ipHash: string | null,
): Promise<IngestResult> {
  return await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: sirensMatches.id })
      .from(sirensMatches)
      .where(eq(sirensMatches.matchId, payload.matchId))
      .limit(1);
    if (existing[0]) {
      return { status: "duplicate", matchId: existing[0].id };
    }

    const endedAt = new Date(payload.endedAt);
    const [inserted] = await tx
      .insert(sirensMatches)
      .values({
        matchId: payload.matchId,
        mode: payload.mode,
        roomCode: payload.roomCode ?? null,
        endedAt,
        durationSeconds: payload.durationSeconds,
        turns: payload.turns,
        winnerPlayerId: payload.winnerId ?? null,
        ipHash,
      })
      .returning({ id: sirensMatches.id });
    const matchRowId = inserted.id;

    await tx.insert(sirensMatchPlayers).values(
      payload.players.map((p) => ({
        matchId: matchRowId,
        playerId: p.playerId,
        name: p.name,
        result: p.result,
        turnOrder: p.turnOrder,
        realmsCompleted: p.realmsCompleted,
        pearlsBanked: p.pearlsBanked,
        cardsStolen: p.cardsStolen,
        tributesCharged: p.tributesCharged,
        sirensRefusalsPlayed: p.sirensRefusalsPlayed,
        ratingBefore: p.ratingBefore,
        ratingAfter: p.ratingAfter,
        ratingDelta: p.ratingDelta,
      })),
    );

    for (const p of payload.players) {
      const win = p.result === "win" ? 1 : 0;
      const loss = p.result === "loss" ? 1 : 0;
      const draw = p.result === "draw" ? 1 : 0;
      await tx
        .insert(sirensPlayers)
        .values({
          playerId: p.playerId,
          name: p.name,
          rating: p.ratingAfter,
          wins: win,
          losses: loss,
          draws: draw,
          matches: 1,
          lastMatchAt: endedAt,
        })
        .onConflictDoUpdate({
          target: sirensPlayers.playerId,
          set: {
            // Only accept the new rating if this match is newer than the last one
            // we've seen for this player. Prevents out-of-order posts from
            // clobbering the current rating.
            rating: sql`CASE WHEN ${sirensPlayers.lastMatchAt} < ${endedAt} THEN ${p.ratingAfter} ELSE ${sirensPlayers.rating} END`,
            name: sql`CASE WHEN ${sirensPlayers.lastMatchAt} < ${endedAt} THEN ${p.name} ELSE ${sirensPlayers.name} END`,
            lastMatchAt: sql`GREATEST(${sirensPlayers.lastMatchAt}, ${endedAt})`,
            wins: sql`${sirensPlayers.wins} + ${win}`,
            losses: sql`${sirensPlayers.losses} + ${loss}`,
            draws: sql`${sirensPlayers.draws} + ${draw}`,
            matches: sql`${sirensPlayers.matches} + 1`,
            updatedAt: sql`now()`,
          },
        });
    }

    return { status: "created", matchId: matchRowId };
  });
}

export type LeaderboardEntry = {
  playerId: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  matches: number;
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
    .orderBy(sql`${sirensPlayers.rating} DESC, ${sirensPlayers.lastMatchAt} DESC`)
    .limit(limit);
  return rows.map((r) => ({
    playerId: r.playerId,
    name: r.name,
    rating: r.rating,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    matches: r.matches,
    lastMatchAt: r.lastMatchAt.toISOString(),
  }));
}

