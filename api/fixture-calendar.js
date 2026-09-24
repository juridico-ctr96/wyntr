export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const upstream = "https://fixturedownload.azurewebsites.net/feed/json/nba-2026";

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
      "s-maxage=3600, stale-while-revalidate=21600"
    );
    res.setHeader("Content-Type", "application/json");

    if (!response.ok) {
      return res.status(response.status).json({
        error: "NBA fixture source failed",
        upstreamStatus: response.status
      });
    }

    return res.status(200).send(body);
  } catch (error) {
    console.error("WYNTR fixture calendar proxy error:", error);
    return res.status(502).json({
      error: "NBA fixture source unavailable"
    });
  }
}
