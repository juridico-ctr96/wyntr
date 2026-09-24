export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: "The Odds API is not configured",
      code: "ODDS_API_NOT_CONFIGURED"
    });
  }

  const requestUrl = new URL(req.url, "http://localhost");
  const query = new URLSearchParams();

  const allowed = [
    "regions",
    "markets",
    "oddsFormat",
    "dateFormat",
    "eventIds",
    "commenceTimeFrom",
    "commenceTimeTo",
    "bookmakers"
  ];

  for (const key of allowed) {
    const value = requestUrl.searchParams.get(key);
    if (value) query.set(key, value);
  }

  if (!query.has("regions")) query.set("regions", "us");
  if (!query.has("markets")) query.set("markets", "h2h,spreads,totals");
  if (!query.has("oddsFormat")) query.set("oddsFormat", "decimal");

  query.set("apiKey", apiKey);

  const upstream =
    `https://api.the-odds-api.com/v4/sports/basketball_nba/odds?${query.toString()}`;

  try {
    const response = await fetch(upstream, {
      headers: {
        Accept: "application/json",
        "User-Agent": "WYNTR/1.0"
      }
    });

    const body = await response.text();

    res.setHeader(
      "Cache-Control",
      "s-maxage=30, stale-while-revalidate=60"
    );
    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "application/json"
    );

    for (const header of [
      "x-requests-remaining",
      "x-requests-used",
      "x-requests-last"
    ]) {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    }

    if (!response.ok) {
      let details = "The Odds API request failed";
      try {
        const parsed = JSON.parse(body);
        details =
          parsed?.message ||
          parsed?.error ||
          parsed?.error_code ||
          details;
      } catch {}

      return res.status(response.status).json({
        error: details,
        upstreamStatus: response.status
      });
    }

    return res.status(200).send(body);
  } catch (error) {
    console.error("WYNTR Odds proxy error:", error);
    return res.status(502).json({
      error: "The Odds API upstream unavailable"
    });
  }
}
