const BASE = "https://api.livetennisapi.com/api/public/v1";

function getKey() {
  return process.env.LIVE_TENNIS_API_KEY || process.env.TENNIS_API_KEY || "";
}

function normalizePlayer(player, fallback = {}) {
  return {
    id: player?.id ?? fallback.id ?? null,
    name: player?.name || player?.full_name || fallback.name || "Jugador",
    shortName: player?.short_name || player?.shortName || player?.name || fallback.name || "Jugador",
    country: player?.country || "",
    ranking: Number.isFinite(Number(player?.ranking)) ? Number(player.ranking) : null,
    rankingPoints: Number.isFinite(Number(player?.ranking_points)) ? Number(player.ranking_points) : null
  };
}

function normalizeMatch(row) {
  const p1 = normalizePlayer(row?.players?.p1);
  const p2 = normalizePlayer(row?.players?.p2);
  const score = row?.score || {};

  return {
    id: String(row?.id ?? ""),
    tour: String(row?.tour || "").toUpperCase(),
    draw: row?.draw || null,
    tournament: row?.tournament || "Tennis",
    tournamentId: row?.tournament_id ?? null,
    tier: row?.tier || null,
    surface: row?.surface || null,
    round: row?.round || "",
    roundCode: row?.round_code || null,
    date: row?.scheduled_time || row?.start_time || row?.start_date || row?.date || null,
    status: row?.status || "",
    statusDetail: row?.event_status || "",
    players: [p1, p2],
    sets: Array.isArray(score?.sets) ? score.sets : (Array.isArray(row?.sets) ? row.sets : []),
    games: Array.isArray(score?.games) ? score.games : (Array.isArray(row?.games) ? row.games : []),
    points: Array.isArray(score?.points) ? score.points : (Array.isArray(row?.points) ? row.points : []),
    server: score?.server ?? row?.server ?? null,
    isTiebreak: Boolean(score?.is_tiebreak ?? row?.is_tiebreak),
    winner: row?.winner ?? null,
    outcome: row?.outcome || null,
    hasAnalysis: Boolean(row?.has_analysis),
    hasMarket: Boolean(row?.has_market)
  };
}
async function fetchMatches(key, params) {
  const url = new URL(BASE + "/matches");
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      "X-API-Key": key,
      "Accept": "application/json",
      "User-Agent": "Prime-Score/0.4.0"
    }
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body?.message || body?.error || `Live Tennis API HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

export default async function handler(req, res) {
  const key = getKey();

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=180");

  if (!key) {
    return res.status(503).json({
      sport: "tennis",
      source: "Live Tennis API",
      configured: false,
      error: "Falta LIVE_TENNIS_API_KEY en Vercel."
    });
  }

  try {
    const [live, upcoming, completed] = await Promise.allSettled([
      fetchMatches(key, { status: "live", draw: "singles", limit: 100 }),
      fetchMatches(key, { status: "upcoming", draw: "singles", limit: 100 }),
      fetchMatches(key, { status: "completed", draw: "singles", limit: 30 })
    ]);

    const read = result => result.status === "fulfilled"
      ? (Array.isArray(result.value?.data) ? result.value.data : [])
      : [];

    const errors = [live, upcoming, completed]
      .filter(result => result.status === "rejected")
      .map(result => ({
        status: result.reason?.status || 500,
        message: result.reason?.message || "Error consultando tenis"
      }));

    const items = [
      ...read(live),
      ...read(upcoming),
      ...read(completed)
    ]
      .map(normalizeMatch)
      .filter(match => match.id && match.players.length === 2);

    const unique = Array.from(new Map(items.map(match => [match.id, match])).values());
    unique.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    return res.status(200).json({
      sport: "tennis",
      source: "Live Tennis API",
      configured: true,
      updatedAt: new Date().toISOString(),
      counts: {
        live: unique.filter(m => m.status === "live").length,
        upcoming: unique.filter(m => m.status === "upcoming").length,
        completed: unique.filter(m => m.status === "completed").length
      },
      errors,
      items: unique
    });
  } catch (error) {
    return res.status(error?.status || 502).json({
      sport: "tennis",
      source: "Live Tennis API",
      configured: true,
      error: error?.message || "No se pudo consultar Live Tennis API"
    });
  }
}
