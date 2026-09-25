export default async function handler(req, res) {
  const now = new Date();
  const days = Math.min(Math.max(Number(req.query?.days || 7), 1), 14);
  const startDate = new Date(now);
  startDate.setUTCHours(0,0,0,0);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + days);
  const start = startDate.toISOString().slice(0,10).replaceAll("-", "");
  const end = endDate.toISOString().slice(0,10).replaceAll("-", "");

  const headers = {
    "User-Agent": "Prime-Score/0.3.2",
    "Accept": "application/json"
  };

  function tourFromGrouping(groupingName) {
    const value = String(groupingName || "").toLowerCase();
    if (value.includes("women") || value.includes("wta")) return "WTA";
    if (value.includes("men") || value.includes("atp")) return "ATP";
    return "";
  }

  function normalizeMatch(competition, context = {}) {
    const competitors = Array.isArray(competition?.competitors)
      ? competition.competitors.filter(c => c?.athlete?.displayName || c?.athlete?.fullName)
      : [];

    if (competitors.length !== 2) return null;

    const grouping = String(context.groupingName || "");
    const groupingLower = grouping.toLowerCase();

    // We only want singles for the first tennis release.
    if (grouping && !groupingLower.includes("singles")) return null;

    const tour = context.tour || tourFromGrouping(grouping);
    if (!tour) return null;

    const ordered = [...competitors].sort(
      (a, b) => Number(a.order || 0) - Number(b.order || 0)
    );

    const [p1, p2] = ordered;

    const sets = (player) =>
      (Array.isArray(player?.linescores) ? player.linescores : []).map(s => ({
        value: Number.isFinite(Number(s.value)) ? Number(s.value) : null,
        displayValue: s.displayValue ?? null,
        tiebreak: s.tiebreak ?? null,
        winner: Boolean(s.winner)
      }));

    const status = competition.status || {};
    const type = status.type || {};
    const venue = competition.venue || {};

    return {
      id: String(competition.id || context.eventId || crypto.randomUUID()),
      eventId: String(context.eventId || competition.id || ""),
      tour,
      tournament: context.tournamentName || competition.name || tour,
      date: competition.startDate || competition.date || context.eventDate || null,
      status: type.state === "in" ? "live" : type.completed ? "final" : "upcoming",
      statusDetail: type.detail || type.shortDetail || type.description || "Programado",
      period: Number(status.period || 0),
      round: competition.round?.displayName || "",
      grouping: grouping || "Singles",
      venue: venue.fullName || "",
      court: venue.court || "",
      formatSets: Number(competition.format?.regulation?.periods || 3),
      players: [
        {
          id: String(p1.id || p1.athlete.id),
          name: p1.athlete.displayName || p1.athlete.fullName,
          shortName: p1.athlete.shortName || p1.athlete.displayName || p1.athlete.fullName,
          country: p1.athlete.flag?.alt || "",
          flag: p1.athlete.flag?.href || "",
          winner: Boolean(p1.winner),
          sets: sets(p1)
        },
        {
          id: String(p2.id || p2.athlete.id),
          name: p2.athlete.displayName || p2.athlete.fullName,
          shortName: p2.athlete.shortName || p2.athlete.displayName || p2.athlete.fullName,
          country: p2.athlete.flag?.alt || "",
          flag: p2.athlete.flag?.href || "",
          winner: Boolean(p2.winner),
          sets: sets(p2)
        }
      ]
    };
  }

  function collectBoardMatches(board) {
    const matches = [];
    const seen = new Set();

    const add = (competition, context) => {
      const match = normalizeMatch(competition, context);
      if (!match || seen.has(match.id)) return;
      seen.add(match.id);
      matches.push(match);
    };

    for (const event of Array.isArray(board?.events) ? board.events : []) {
      const base = {
        eventId: String(event.id || ""),
        eventDate: event.date || null,
        tournamentName: event.name || event.shortName || "Tennis"
      };

      // Current ESPN tennis shape: tournament -> grouping -> competitions.
      for (const grouping of Array.isArray(event.groupings) ? event.groupings : []) {
        const groupingName =
          grouping?.grouping?.displayName ||
          grouping?.grouping?.name ||
          grouping?.name ||
          "";

        for (const competition of Array.isArray(grouping.competitions) ? grouping.competitions : []) {
          add(competition, {
            ...base,
            groupingName,
            tour: tourFromGrouping(groupingName)
          });
        }
      }

      // Defensive fallback: event.competitions[].
      for (const competition of Array.isArray(event.competitions) ? event.competitions : []) {
        const groupingName =
          competition?.grouping?.displayName ||
          competition?.grouping?.name ||
          "";
        add(competition, {
          ...base,
          groupingName,
          tour: tourFromGrouping(groupingName)
        });
      }

      // Defensive fallback: event itself is a match.
      if (Array.isArray(event.competitors)) {
        add(event, {
          ...base,
          groupingName: event.grouping?.displayName || event.grouping?.name || "Singles",
          tour: tourFromGrouping(event.grouping?.displayName || event.grouping?.name)
        });
      }
    }

    return matches;
  }

  async function fetchBoard() {
    const urls = [
      `https://site.api.espn.com/apis/site/v2/sports/tennis/all/scoreboard?dates=${start}-${end}`,
      `https://site.api.espn.com/apis/site/v2/sports/tennis/all/scoreboard`
    ];

    let lastError = null;

    for (const url of urls) {
      try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
          lastError = new Error(`ESPN HTTP ${response.status}`);
          continue;
        }

        const board = await response.json();
        const items = collectBoardMatches(board);
        if (items.length || Array.isArray(board?.events)) {
          return { board, items };
        }
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("ESPN Tennis sin respuesta");
  }

  try {
    const { board, items } = await fetchBoard();

    items.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    res.status(200).json({
      sport: "tennis",
      start,
      end,
      updatedAt: new Date().toISOString(),
      source: "ESPN",
      eventCount: Array.isArray(board?.events) ? board.events.length : 0,
      items
    });
  } catch (error) {
    res.status(502).json({
      sport: "tennis",
      source: "ESPN",
      error: error?.message || "No se pudo consultar tenis"
    });
  }
}
