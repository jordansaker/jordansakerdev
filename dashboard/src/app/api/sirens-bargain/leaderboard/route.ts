import { jsonResponse, preflight, readLeaderboard } from "@/lib/sirens-bargain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "25", 10);
  const minMatches = Number.parseInt(url.searchParams.get("minMatches") ?? "1", 10);

  try {
    const { entries, currentStreakLeader } = await readLeaderboard({ limit, minMatches });
    return jsonResponse(
      { ok: true, entries, currentStreakLeader },
      {
        extraHeaders: {
          "cache-control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (err) {
    console.error("[sirens-bargain] leaderboard read failed", err);
    return jsonResponse({ ok: false, error: "Read failed" }, { status: 500 });
  }
}
