export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const upstream =
    "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json";

  try {
    const response = await fetch(upstream, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 WYNTR/1.0",
        Referer: "https://www.nba.com/",
        Origin: "https://www.nba.com"
      }
    });

    const body = await response.text();

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=900"
    );
    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "application/json"
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: "NBA schedule source failed",
        upstreamStatus: response.status
      });
    }

    return res.status(200).send(body);
  } catch (error) {
    console.error("WYNTR NBA schedule proxy error:", error);
    return res.status(502).json({
      error: "NBA schedule source unavailable"
    });
  }
}
