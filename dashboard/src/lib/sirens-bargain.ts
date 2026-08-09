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
  highestRent: z.number().int().min(0).max(100_000).default(0),
  leastAmountMoves: z.number().int().min(0).max(100_000).default(0),
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
        highestRent: p.highestRent,
        leastAmountMoves: p.leastAmountMoves,
      })),
    );

    // Drizzle's .values() serialises Date columns for us, but Date values
    // interpolated into a raw sql`` fragment pass through unchanged and
    // postgres.js rejects them with ERR_INVALID_ARG_TYPE. Pre-convert.
    const endedAtIso = endedAt.toISOString();
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
          highestRent: p.highestRent,
          leastAmountMoves: p.leastAmountMoves,
          lastMatchAt: endedAt,
        })
        .onConflictDoUpdate({
          target: sirensPlayers.nameKey,
          set: {
            // Preserve the latest casing of the display name.
            name: sql`CASE WHEN ${sirensPlayers.lastMatchAt} < ${endedAtIso}::timestamptz THEN ${p.name} ELSE ${sirensPlayers.name} END`,
            lastMatchAt: sql`GREATEST(${sirensPlayers.lastMatchAt}, ${endedAtIso}::timestamptz)`,
            wins: sql`${sirensPlayers.wins} + ${winInc}`,
            losses: sql`${sirensPlayers.losses} + ${lossInc}`,
            matches: sql`${sirensPlayers.matches} + 1`,
            totalRealms: sql`${sirensPlayers.totalRealms} + ${p.realms}`,
            totalSteals: sql`${sirensPlayers.totalSteals} + ${p.steals}`,
            totalTributes: sql`${sirensPlayers.totalTributes} + ${p.tributes}`,
            highestRent: sql`GREATEST(${sirensPlayers.highestRent}, ${p.highestRent})`,
            // 0 means "no data" — ignore it; otherwise take the min.
            leastAmountMoves: sql`CASE
              WHEN ${p.leastAmountMoves} = 0 THEN ${sirensPlayers.leastAmountMoves}
              WHEN ${sirensPlayers.leastAmountMoves} = 0 THEN ${p.leastAmountMoves}
              ELSE LEAST(${sirensPlayers.leastAmountMoves}, ${p.leastAmountMoves})
            END`,
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
  highestRent: number;
  leastAmountMoves: number;
  highestStreak: number;   // longest consecutive-win run ever
  currentStreak: number;   // wins in a row ending at their most recent match (0 if last was a loss)
  lastMatchAt: string;
};

export type LeaderboardResponse = {
  entries: LeaderboardEntry[];
  currentStreakLeader: { name: string; streak: number } | null;
};

/**
 * Derive per-player streaks from sirens_match_players. Consecutive-win runs
 * are found via the "gaps and islands" trick — row_number ordered by
 * chronology minus row_number partitioned by (player, won) tags every
 * consecutive run with a stable group id.
 */
type StreakRow = { name_key: string; highest_win_streak: number; current_win_streak: number };

async function readStreaks(): Promise<Map<string, { highest: number; current: number }>> {
  // Order by m.id (monotonic serial = true insertion order). Ordering by
  // ended_at is unsafe because it's client-supplied and can be out of order
  // relative to when matches were actually played/posted.
  const rows = (await db.execute(sql`
    WITH ordered AS (
      SELECT
        LOWER(mp.name) AS name_key,
        mp.won,
        m.id AS match_id,
        ROW_NUMBER() OVER (PARTITION BY LOWER(mp.name) ORDER BY m.id) AS rn
      FROM sirens_match_players mp
      JOIN sirens_matches m ON m.id = mp.match_id
    ),
    grouped AS (
      SELECT
        name_key, won, match_id, rn,
        rn - ROW_NUMBER() OVER (PARTITION BY name_key, won ORDER BY match_id) AS grp
      FROM ordered
    ),
    runs AS (
      SELECT
        name_key, won, grp,
        COUNT(*)::int AS run_length,
        MAX(match_id) AS last_match_id
      FROM grouped
      GROUP BY name_key, won, grp
    ),
    latest_run AS (
      SELECT DISTINCT ON (name_key)
        name_key,
        (CASE WHEN won THEN run_length ELSE 0 END)::int AS current_win_streak
      FROM runs
      ORDER BY name_key, last_match_id DESC
    ),
    highest_run AS (
      SELECT
        name_key,
        COALESCE(MAX(CASE WHEN won THEN run_length END), 0)::int AS highest_win_streak
      FROM runs
      GROUP BY name_key
    )
    SELECT h.name_key, h.highest_win_streak, COALESCE(l.current_win_streak, 0)::int AS current_win_streak
    FROM highest_run h
    LEFT JOIN latest_run l USING (name_key)
  `)) as unknown as StreakRow[];

  const map = new Map<string, { highest: number; current: number }>();
  for (const r of rows) {
    map.set(r.name_key, { highest: r.highest_win_streak, current: r.current_win_streak });
  }
  return map;
}

export type MatchListEntry = {
  endedAt: string;
  turns: number;
  winner: string;
  players: {
    name: string;
    realms: number;
    steals: number;
    tributes: number;
    highestRent: number;
    leastAmountMoves: number;
  }[];
};

/**
 * Return matches in the exact shape the game POSTs them (winner, players[]
 * with name + realms + steals + tributes, endedAt, turns). Newest first.
 */
export async function readMatches(
  opts: { limit?: number } = {},
): Promise<MatchListEntry[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const matches = await db
    .select({
      id: sirensMatches.id,
      endedAt: sirensMatches.endedAt,
      turns: sirensMatches.turns,
      winner: sirensMatches.winnerName,
    })
    .from(sirensMatches)
    .orderBy(sql`${sirensMatches.endedAt} DESC`)
    .limit(limit);

  if (matches.length === 0) return [];

  const ids = matches.map((m) => m.id);
  const players = await db
    .select({
      matchId: sirensMatchPlayers.matchId,
      name: sirensMatchPlayers.name,
      realms: sirensMatchPlayers.realms,
      steals: sirensMatchPlayers.steals,
      tributes: sirensMatchPlayers.tributes,
      highestRent: sirensMatchPlayers.highestRent,
      leastAmountMoves: sirensMatchPlayers.leastAmountMoves,
    })
    .from(sirensMatchPlayers)
    .where(sql`${sirensMatchPlayers.matchId} IN ${ids}`);

  const byMatch = new Map<number, MatchListEntry["players"]>();
  for (const p of players) {
    const arr = byMatch.get(p.matchId) ?? [];
    arr.push({
      name: p.name,
      realms: p.realms,
      steals: p.steals,
      tributes: p.tributes,
      highestRent: p.highestRent,
      leastAmountMoves: p.leastAmountMoves,
    });
    byMatch.set(p.matchId, arr);
  }

  return matches.map((m) => ({
    endedAt: m.endedAt.toISOString(),
    turns: m.turns,
    winner: m.winner,
    players: byMatch.get(m.id) ?? [],
  }));
}

export async function readLeaderboard(
  opts: { limit?: number; minMatches?: number } = {},
): Promise<LeaderboardResponse> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const minMatches = Math.max(opts.minMatches ?? 1, 1);

  const [rows, streaks] = await Promise.all([
    db
      .select()
      .from(sirensPlayers)
      .where(gte(sirensPlayers.matches, minMatches))
      .orderBy(
        sql`${sirensPlayers.wins} DESC,
            (${sirensPlayers.wins}::float / NULLIF(${sirensPlayers.matches}, 0)) DESC,
            ${sirensPlayers.lastMatchAt} DESC`,
      )
      .limit(limit),
    readStreaks(),
  ]);

  const entries: LeaderboardEntry[] = rows.map((r) => {
    const s = streaks.get(r.nameKey) ?? { highest: 0, current: 0 };
    return {
      name: r.name,
      wins: r.wins,
      losses: r.losses,
      matches: r.matches,
      winRate: r.matches > 0 ? r.wins / r.matches : 0,
      totalRealms: r.totalRealms,
      totalSteals: r.totalSteals,
      totalTributes: r.totalTributes,
      highestRent: r.highestRent,
      leastAmountMoves: r.leastAmountMoves,
      highestStreak: s.highest,
      currentStreak: s.current,
      lastMatchAt: r.lastMatchAt.toISOString(),
    };
  });

  // Leader on active streak: longest currentStreak > 0, tiebreak by wins.
  let leader: LeaderboardResponse["currentStreakLeader"] = null;
  for (const e of entries) {
    if (e.currentStreak <= 0) continue;
    if (
      !leader ||
      e.currentStreak > leader.streak ||
      (e.currentStreak === leader.streak &&
        e.wins > (entries.find((x) => x.name === leader?.name)?.wins ?? 0))
    ) {
      leader = { name: e.name, streak: e.currentStreak };
    }
  }

  return { entries, currentStreakLeader: leader };
}
