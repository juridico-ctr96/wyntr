export default async function handler(req, res) {
  try {
    const upstream = await fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news", {
      headers: { "User-Agent": "WYNTR/1.0" }
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: "News upstream unavailable" });
    }

    const data = await upstream.json();
    const now = Date.now();
    const articles = Array.isArray(data.articles) ? data.articles : [];

    const blocked = /one tree hill|fantasy|podcast|video|rank(ed|ings)?|quiz/i;
    const preferred = /trade|sign|extension|injur|training camp|media day|contract|free agent|waive|retir|nba|season|coach|draft|kawhi|curry|tatum|jokic|luka|lebron|durant|wembanyama|towns/i;

    const items = articles
      .filter(a => a && a.headline && a.links?.web?.href)
      .filter(a => !blocked.test(a.headline))
      .map(a => {
        const published = Date.parse(a.published || a.lastModified || "") || now;
        return {
          id: String(a.id || a.headline),
          title: String(a.headline).trim(),
          description: String(a.description || "").trim(),
          published: new Date(published).toISOString(),
          timestamp: published,
          source: String(a.byline || "ESPN").trim() || "ESPN",
          url: a.links.web.href,
          image: a.images?.find(x => x?.url)?.url || null,
          relevance: preferred.test(a.headline) ? 2 : 1
        };
      })
      .filter(a => now - a.timestamp < 1000 * 60 * 60 * 72)
      .sort((a, b) => (b.relevance - a.relevance) || (b.timestamp - a.timestamp))
      .slice(0, 12)
      .map(({ timestamp, relevance, ...a }) => a);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      source: "ESPN",
      updatedAt: new Date().toISOString(),
      items
    });
  } catch (error) {
    console.error("WYNTR NBA news:", error);
    return res.status(500).json({ error: "NBA news unavailable" });
  }
}
