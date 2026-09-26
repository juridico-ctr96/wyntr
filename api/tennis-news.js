const SOURCES = [
  { tour: "ATP", url: "https://www.atptour.com/en/news" },
  { tour: "WTA", url: "https://www.wtatennis.com/news" }
];

const PLAYER_NAMES = [
  "Carlos Alcaraz","Jannik Sinner","Novak Djokovic","Alexander Zverev","Daniil Medvedev",
  "Taylor Fritz","Ben Shelton","Frances Tiafoe","Stefanos Tsitsipas","Holger Rune",
  "Casper Ruud","Alex de Minaur","Andrey Rublev","Jack Draper","Tommy Paul",
  "Elena Rybakina","Aryna Sabalenka","Iga Swiatek","Coco Gauff","Jessica Pegula",
  "Amanda Anisimova","Mirra Andreeva","Elise Mertens","Leylah Fernandez","Alexandra Eala",
  "Maja Chwalinska","Qinwen Zheng","Jasmine Paolini","Paula Badosa","Madison Keys",
  "Emma Navarro","Naomi Osaka","Ons Jabeur","Jelena Ostapenko","Linda Noskova",
  "Karolina Muchova","Donna Vekic","Belinda Bencic","Victoria Azarenka","Sofia Kenin",
  "Elina Svitolina","Daria Kasatkina","Beatriz Haddad Maia","Danielle Collins"
];

const clean = value => String(value || "")
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&").replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const absoluteUrl = (href, base) => {
  try { return new URL(href, base).href; } catch { return ""; }
};

function classify(title) {
  const t = title.toLowerCase();
  let category = "context";
  let impact = "low";
  let reason = "Contexto general del circuito.";

  if (/injur|lesion|illness|sick|wrist|ankle|back|shoulder|knee|hip|medical|surgery|withdraw|pulls out|retires|retirement|walkover|unable/.test(t)) {
    category = "injury";
    impact = "high";
    reason = "Posible efecto directo sobre disponibilidad o estado físico.";
  } else if (/rain|delay|schedule|resum|postpon|weather|cancel/.test(t)) {
    category = "schedule";
    impact = "medium";
    reason = "Puede modificar descanso, horario o condiciones de preparación.";
  } else if (/coach|coaching|training|practice|return|comeback|fatigue|rest/.test(t)) {
    category = "form";
    impact = "medium";
    reason = "Puede aportar contexto sobre forma, preparación o carga competitiva.";
  } else if (/draw|seed|ranking|no\. 1|number one|qualif|entry list/.test(t)) {
    category = "tournament";
    impact = "low";
    reason = "Contexto competitivo o de cuadro.";
  } else if (/statement|said|says|interview|reaction|feature/.test(t)) {
    category = "statement";
    impact = "low";
    reason = "Declaración o contexto cualitativo; no implica cambio de modelo por sí sola.";
  }

  return { category, impact, reason };
}

function entitiesFrom(title) {
  return PLAYER_NAMES.filter(name => title.toLowerCase().includes(name.toLowerCase()));
}

async function parseSource(source) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Prime-Score Tennis News/1.0)",
      "Accept": "text/html,application/xhtml+xml"
    }
  });
  if (!response.ok) throw new Error(source.tour + " HTTP " + response.status);
  const html = await response.text();
  const items = [];
  const re = /<a[^>]+href=["']([^"']*(?:\/news\/|\/en\/news\/)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = re.exec(html)) && items.length < 20) {
    const url = absoluteUrl(m[1], source.url);
    const title = clean(m[2]);
    if (!url || title.length < 12 || title.length > 220) continue;
    if (/read more|view all|news|videos|latest/i.test(title) && title.length < 25) continue;

    const context = html.slice(Math.max(0, m.index - 1400), Math.min(html.length, re.lastIndex + 1400));
    const imgMatch = context.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i);
    const image = imgMatch?.[1] ? absoluteUrl(imgMatch[1], source.url) : null;
    const meta = classify(title);

    items.push({
      id: url,
      sport: "tennis",
      tour: source.tour,
      title,
      description: "",
      published: new Date().toISOString(),
      source: source.tour + " Tour",
      url,
      image,
      entities: entitiesFrom(title),
      category: meta.category,
      impact: meta.impact,
      impactReason: meta.reason
    });
  }

  const unique = Array.from(new Map(items.map(x => [x.url, x])).values()).slice(0, 12);

  return Promise.all(unique.map(async item => {
    if (item.image) return item;
    try {
      const article = await fetch(item.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Prime-Score Tennis News/1.0)" }
      });
      if (!article.ok) return item;
      const html = await article.text();
      const img = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      return img?.[1] ? { ...item, image: absoluteUrl(img[1], item.url) } : item;
    } catch { return item; }
  }));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
  try {
    const results = await Promise.allSettled(SOURCES.map(parseSource));
    const items = results
      .filter(r => r.status === "fulfilled")
      .flatMap(r => r.value)
      .sort((a,b) => new Date(b.published) - new Date(a.published));

    if (!items.length) throw new Error("No tennis news available");

    return res.status(200).json({
      sport: "tennis",
      source: "ATP Tour + WTA",
      updatedAt: new Date().toISOString(),
      items: items.slice(0, 20)
    });
  } catch (error) {
    return res.status(502).json({
      sport: "tennis",
      source: "ATP Tour + WTA",
      error: error?.message || "Tennis news unavailable"
    });
  }
}
