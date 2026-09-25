export default async function handler(req, res) {
  const now = new Date();
  const days = Math.min(Math.max(Number(req.query?.days || 7), 1), 14);
  const startDate = new Date(now);
  startDate.setUTCHours(0,0,0,0);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + days);
  const start = startDate.toISOString().slice(0,10).replaceAll("-","");
  const end = endDate.toISOString().slice(0,10).replaceAll("-","");

  const tours = [
    { slug: "atp", tour: "ATP" },
    { slug: "wta", tour: "WTA" }
  ];

  const headers = { "User-Agent": "Prime-Score/0.3.2" };

  const fetchTour = async ({slug,tour}) => {
    const urls = [
      `https://site.api.espn.com/apis/site/v2/sports/tennis/${slug}/scoreboard`,
      `https://site.api.espn.com/apis/site/v2/sports/tennis/${slug}/scoreboard?dates=${start}-${end}`
    ];

    let data = null;
    let lastError = null;

    for (const url of urls) {
      try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
          lastError = new Error(`${tour} HTTP ${response.status}`);
          continue;
        }
        data = await response.json();
        if (Array.isArray(data?.events) && data.events.length) break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!data) throw lastError || new Error(`${tour} sin respuesta`);

    const matches = [];
    const seen = new Set();

    for (const event of Array.isArray(data.events) ? data.events : []) {
      for (const grouping of Array.isArray(event.groupings) ? event.groupings : []) {
        const groupingName = grouping.grouping?.displayName || grouping.grouping?.slug || "Singles";
        for (const competition of Array.isArray(grouping.competitions) ? grouping.competitions : []) {
          const competitors = Array.isArray(competition.competitors)
            ? competition.competitors.filter(c => c?.athlete?.displayName)
            : [];
          if (competitors.length !== 2) continue;

          const ordered = [...competitors].sort((a,b) => Number(a.order || 0) - Number(b.order || 0));
          const p1 = ordered[0], p2 = ordered[1];
          const sets = (p) => (Array.isArray(p.linescores) ? p.linescores : []).map(s => ({
            value: Number.isFinite(Number(s.value)) ? Number(s.value) : null,
            tiebreak: s.tiebreak ?? null,
            winner: Boolean(s.winner)
          }));

          const status = competition.status || {};
          const type = status.type || {};
          const round = competition.round?.displayName || "";
          const venue = competition.venue || {};
          const matchId = String(competition.id || event.id);
          if (seen.has(matchId)) continue;
          seen.add(matchId);

          matches.push({
            id: matchId,
            eventId: String(event.id),
            tour,
            tournament: event.name || event.shortName || tour,
            date: competition.startDate || competition.date || event.date || null,
            status: type.state === "in" ? "live" : type.completed ? "final" : "upcoming",
            statusDetail: type.detail || type.shortDetail || type.description || "Programado",
            period: Number(status.period || 0),
            round,
            grouping: groupingName,
            venue: venue.fullName || "",
            court: venue.court || "",
            formatSets: Number(competition.format?.regulation?.periods || 3),
            players: [
              {
                id: String(p1.id || p1.athlete.id),
                name: p1.athlete.displayName,
                shortName: p1.athlete.shortName || p1.athlete.displayName,
                country: p1.athlete.flag?.alt || "",
                flag: p1.athlete.flag?.href || "",
                winner: Boolean(p1.winner),
                sets: sets(p1)
              },
              {
                id: String(p2.id || p2.athlete.id),
                name: p2.athlete.displayName,
                shortName: p2.athlete.shortName || p2.athlete.displayName,
                country: p2.athlete.flag?.alt || "",
                flag: p2.athlete.flag?.href || "",
                winner: Boolean(p2.winner),
                sets: sets(p2)
              }
            ]
          });
        }
      }
    }

    return matches;
  };

  try {
    const settled = await Promise.allSettled(tours.map(fetchTour));
    const items = settled.flatMap(r => r.status === "fulfilled" ? r.value : []);
    const errors = settled
      .filter(r => r.status === "rejected")
      .map(r => r.reason?.message || "Error desconocido");
    items.sort((a,b) => new Date(a.date || 0) - new Date(b.date || 0));

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    res.status(200).json({
      sport: "tennis",
      start,
      end,
      updatedAt: new Date().toISOString(),
      source: "ESPN",
      errors,
      items
    });
  } catch (error) {
    res.status(502).json({
      sport: "tennis",
      error: error?.message || "No se pudo consultar tenis"
    });
  }
}
