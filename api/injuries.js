export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.BALLDONTLIE_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: "BALLDONTLIE_API_KEY is not configured",
      code: "BALLDONTLIE_API_NOT_CONFIGURED"
    });
  }

  const requestUrl = new URL(req.url, "http://localhost");
  const query = new URLSearchParams();

  const teamIds = requestUrl.searchParams.getAll("team_ids[]");
  for (const teamId of teamIds.slice(0, 2)) {
    if (/^\d+$/.test(teamId)) query.append("team_ids[]", teamId);
  }

  const perPage = requestUrl.searchParams.get("per_page");
  if (perPage && /^\d+$/.test(perPage)) {
    query.set("per_page", String(Math.min(100, Math.max(1, Number(perPage)))));
  } else {
    query.set("per_page", "100");
  }

  const cursor = requestUrl.searchParams.get("cursor");
  if (cursor && /^\d+$/.test(cursor)) query.set("cursor", cursor);

  const upstream =
    `https://api.balldontlie.io/v1/player_injuries?${query.toString()}`;

  try {
    const response = await fetch(upstream, {
      headers: {
        Accept: "application/json",
        Authorization: apiKey,
        "User-Agent": "WYNTR/1.0"
      }
    });

    const body = await response.text();

    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=300"
    );
    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "application/json"
    );

    if (!response.ok) {
      let details = "BALLDONTLIE injuries request failed";
      try {
        const parsed = JSON.parse(body);
        details =
          parsed?.error ||
          parsed?.message ||
          details;
      } catch {}

      return res.status(response.status).json({
        error: details,
        upstreamStatus: response.status
      });
    }

    return res.status(200).send(body);
  } catch (error) {
    console.error("WYNTR injuries proxy error:", error);
    return res.status(502).json({
      error: "BALLDONTLIE injuries upstream unavailable"
    });
  }
}
