export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey =
    process.env.BALLDONTLIE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "BALLDONTLIE_API_KEY is not configured"
    });
  }

  const query =
    new URL(
      req.url,
      "http://localhost"
    ).search;

  const upstream =
    `https://api.balldontlie.io/v1/games${query}`;

  try {

    const response =
      await fetch(
        upstream,
        {
          headers: {
            Accept: "application/json",
            Authorization: apiKey,
            "User-Agent": "WYNTR/1.0"
          }
        }
      );

    const body =
      await response.text();

    res.setHeader(
      "Cache-Control",
      "s-maxage=30, stale-while-revalidate=120"
    );

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") ||
        "application/json"
    );

    if(!response.ok){

      let details =
        body;

      try {
        const parsed =
          JSON.parse(body);

        details =
          parsed?.error ||
          parsed?.message ||
          body;
      } catch {}

      return res.status(response.status).json({
        error:
          "BALLDONTLIE request failed",
        upstreamStatus:
          response.status,
        details:
          String(details).slice(0,300)
      });

    }

    return res
      .status(200)
      .send(body);

  } catch (error) {

    console.error(
      "WYNTR BALLDONTLIE proxy error:",
      error
    );

    return res.status(502).json({
      error:
        "BALLDONTLIE upstream unavailable"
    });

  }
}
