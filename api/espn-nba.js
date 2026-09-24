export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const input = new URL(req.url, "http://localhost");
  const startRaw = String(input.searchParams.get("start_date") || "");
  const endRaw = String(input.searchParams.get("end_date") || "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(endRaw)) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const start = new Date(`${startRaw}T00:00:00Z`);
  const end = new Date(`${endRaw}T23:59:59Z`);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  // ESPN's reliable scoreboard contract is one calendar date per request.
  // Query the requested window in small concurrent batches and stitch the
  // real events together server-side.
  const dates = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10).replaceAll("-", ""));
  }

  const fetchDate = async date => {
    const upstream =
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}&limit=100`;

    const response = await fetch(upstream, {
      headers: {
        Accept: "application/json",
        "User-Agent": "WYNTR/1.0"
      }
    });

    const body = await response.text();

    if (!response.ok) {
      throw new Error(
        `ESPN ${date} failed (HTTP ${response.status}): ${body.slice(0, 240)}`
      );
    }

    const payload = JSON.parse(body);
    return Array.isArray(payload?.events) ? payload.events : [];
  };

  try {
    const events = [];

    // Keep concurrency bounded so one calendar refresh does not hammer ESPN.
    for (let i = 0; i < dates.length; i += 10) {
      const batch = dates.slice(i, i + 10);
      const results = await Promise.all(batch.map(fetchDate));
      results.forEach(rows => events.push(...rows));
    }

    const filtered = events.filter(event => {
      const date = new Date(event?.date);
      return Number.isFinite(date.getTime()) && date >= start && date <= end;
    });

    const unique = [];
    const seen = new Set();

    for (const event of filtered) {
      const id = String(event?.id || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      unique.push(event);
    }

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=900"
    );
    res.setHeader("Content-Type", "application/json");

    return res.status(200).json({
      source: "ESPN",
      start_date: startRaw,
      end_date: endRaw,
      events: unique
    });
  } catch (error) {
    console.error("WYNTR ESPN NBA proxy error:", error);
    return res.status(502).json({
      error: "ESPN NBA schedule unavailable",
      details: String(error?.message || error).slice(0, 300)
    });
  }
}
