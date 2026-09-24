export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const input = new URL(req.url, "http://localhost");
  const startRaw = String(input.searchParams.get("start_date") || "");
  const endRaw = String(input.searchParams.get("end_date") || "");

  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(startRaw) || !/^\\d{4}-\\d{2}-\\d{2}$/.test(endRaw)) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  const start = new Date(`${startRaw}T00:00:00Z`);
  const end = new Date(`${endRaw}T23:59:59Z`);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  // ESPN deprecated YYYYMMDD-YYYYMMDD range queries in September 2026.
  // Query each calendar month instead, then filter the returned events to
  // the exact window requested by WYNTR. This keeps the upstream calls low
  // while avoiding the broken date-range endpoint.
  const months = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const lastMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= lastMonth) {
    const year = cursor.getUTCFullYear();
    const month = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${year}${month}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  try {
    const responses = await Promise.all(
      months.map(async month => {
        const upstream =
          `https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${month}&limit=300`;

        const response = await fetch(upstream, {
          headers: {
            Accept: "application/json",
            "User-Agent": "WYNTR/1.0"
          }
        });

        const body = await response.text();

        if (!response.ok) {
          throw new Error(
            `ESPN month ${month} failed (HTTP ${response.status}): ${body.slice(0, 240)}`
          );
        }

        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          throw new Error(`ESPN month ${month} returned invalid JSON`);
        }

        return Array.isArray(payload?.events) ? payload.events : [];
      })
    );

    const events = responses
      .flat()
      .filter(event => {
        const date = new Date(event?.date);
        return Number.isFinite(date.getTime()) &&
          date >= start &&
          date <= end;
      });

    const payload = {
      source: "ESPN",
      start_date: startRaw,
      end_date: endRaw,
      events
    };

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=900"
    );
    res.setHeader("Content-Type", "application/json");

    return res.status(200).json(payload);
  } catch (error) {
    console.error("WYNTR ESPN NBA proxy error:", error);
    return res.status(502).json({
      error: "ESPN NBA schedule unavailable",
      details: String(error?.message || error).slice(0, 300)
    });
  }
}
