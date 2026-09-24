export default async function handler(req, res) {
  const clean = value => String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const unique = items => {
    const seen = new Set();
    return items.filter(item => {
      const key = item.url || item.title;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  try {
    const response = await fetch("https://www.nba.com/news", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WYNTR NBA News/1.0)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) throw new Error("NBA.com HTTP " + response.status);

    const html = await response.text();
    const items = [];
    const anchorRe = /<a[^>]+href=["']([^"']*\/news\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = anchorRe.exec(html)) && items.length < 40) {
      const url = match[1].startsWith("http")
        ? match[1]
        : "https://www.nba.com" + (match[1].startsWith("/") ? match[1] : "/" + match[1]);
      const title = clean(match[2]);

      if (!title || title.length < 12 || title.length > 180) continue;
      if (/load more|see all|home|news|fantasy/i.test(title)) continue;

      items.push({
        id: url,
        title,
        description: "",
        published: new Date().toISOString(),
        source: "NBA.com",
        url,
        image: null
      });
    }

    const result = unique(items).slice(0, 16);

    if (!result.length) throw new Error("NBA.com returned no articles");

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      source: "NBA.com",
      updatedAt: new Date().toISOString(),
      items: result
    });
  } catch (nbaError) {
    console.error("WYNTR NBA.com news:", nbaError);

    // ESPN remains a fallback, but NBA.com is the primary source.
    try {
      const upstream = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=20",
        { headers: { "User-Agent": "Mozilla/5.0 (compatible; WYNTR/1.0)" } }
      );

      if (!upstream.ok) throw new Error("ESPN HTTP " + upstream.status);

      const data = await upstream.json();
      const items = (Array.isArray(data.articles) ? data.articles : [])
        .filter(a => a && a.headline && a.links?.web?.href)
        .map(a => ({
          id: String(a.id || a.headline),
          title: String(a.headline).trim(),
          description: String(a.description || "").trim(),
          published: a.published || new Date().toISOString(),
          source: "ESPN",
          url: a.links.web.href,
          image: a.images?.find(x => x?.url)?.url || null
        }))
        .slice(0, 16);

      if (!items.length) throw new Error("ESPN returned no articles");

      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).json({
        source: "ESPN",
        updatedAt: new Date().toISOString(),
        items
      });
    } catch (espnError) {
      console.error("WYNTR ESPN news fallback:", espnError);
      return res.status(502).json({
        error: "NBA news unavailable",
        details: "Primary and fallback news feeds are unavailable"
      });
    }
  }
}
