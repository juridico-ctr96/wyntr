export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = new URL(req.url, "http://localhost").search;
  const upstream = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard${query}`;

  try {
    const response = await fetch(upstream, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "WYNTR/1.0"
      }
    });

    const body = await response.text();

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");

    return res.status(response.status).send(body);
  } catch (error) {
    console.error("WYNTR ESPN proxy error:", error);
    return res.status(502).json({
      error: "ESPN upstream unavailable"
    });
  }
}
