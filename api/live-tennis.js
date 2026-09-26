const BASE = "https://api.livetennisapi.com/api/public/v1";

function getKey() {
  return process.env.LIVE_TENNIS_API_KEY || process.env.TENNIS_API_KEY || "";
}

function normalizePlayer(player, fallback = {}) {
  const p = player || {};
  return {
    id: p.id ?? fallback.id ?? null,
    name: p.name || p.full_name || fallback.name || "Jugador",
    shortName: p.short_name || p.shortName || p.name || fallback.name || "Jugador",
    country: p.country || p.country_code || "",
    ranking: Number.isFinite(Number(p.ranking)) ? Number(p.ranking) : null,
    rankingPoints: Number.isFinite(Number(p.ranking_points)) ? Number(p.ranking_points) : null,
    flag: p.flag || null,
    hand: p.hand || null,
    backhand: p.backhand ?? null,
    rankingMovement: p.ranking_movement || p.rankingMovement || null,
    dataCompleteness: p.data_completeness || p.dataCompleteness || null,
    stats: p.stats || null
  };
}

function normalizeMatch(row) {
  const p1 = normalizePlayer(row?.players?.p1 || row?.players?.[0] || row?.player1 || row?.p1);
  const p2 = normalizePlayer(row?.players?.p2 || row?.players?.[1] || row?.player2 || row?.p2);
  const score = row?.score || {};

  return {
    id: String(row?.id ?? ""),
    tour: String(row?.tour || "").toUpperCase(),
    draw: row?.draw || null,
    tournament: row?.tournament || "Tennis",
    tournamentId: row?.tournament_id ?? null,
    tier: row?.tier || null,
    surface: row?.surface || null,
    round: row?.round || "",
    roundCode: row?.round_code || null,
    date: row?.scheduled_time || row?.start_time || row?.start_date || row?.date || null,
    status: row?.status || "",
    statusDetail: row?.event_status || "",
    players: [p1, p2],
    sets: Array.isArray(score?.sets) ? score.sets : (Array.isArray(row?.sets) ? row.sets : []),
    games: Array.isArray(score?.games) ? score.games : (Array.isArray(row?.games) ? row.games : []),
    points: Array.isArray(score?.points) ? score.points : (Array.isArray(row?.points) ? row.points : []),
    server: score?.server ?? row?.server ?? null,
    isTiebreak: Boolean(score?.is_tiebreak ?? row?.is_tiebreak),
    winner: row?.winner ?? null,
    outcome: row?.outcome || null,
    hasAnalysis: Boolean(row?.has_analysis),
    hasMarket: Boolean(row?.has_market)
  };
}
async function fetchFixtures(key, params) {
  const url = new URL(BASE + "/fixtures");
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
  }
  const response = await fetch(url, {
    headers: { "X-API-Key": key, "Accept": "application/json", "User-Agent": "Prime-Score/0.4.1" }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.message || body?.error || ("Live Tennis API HTTP " + response.status));
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function normalizeFixture(row) {
  const p1 = normalizePlayer({
    id: row?.player1_id,
    name: row?.player1_name
  });
  const p2 = normalizePlayer({
    id: row?.player2_id,
    name: row?.player2_name
  });
  return {
    id: String(row?.id ?? ""),
    tour: String(row?.tour || "").toUpperCase(),
    draw: row?.draw || null,
    tournament: row?.tournament || "Tennis",
    tournamentId: row?.tournament_id ?? null,
    tier: row?.tier || null,
    surface: row?.surface || null,
    round: row?.round || "",
    roundCode: row?.round_code || null,
    date: row?.start_time || row?.scheduled_time || row?.event_date || null,
    status: row?.status || "upcoming",
    statusDetail: row?.event_status || "",
    players: [p1, p2],
    sets: [],
    games: [],
    points: [],
    server: null,
    isTiebreak: false,
    winner: null,
    outcome: null,
    hasAnalysis: false,
    hasMarket: false
  };
}

async function fetchMatch(key, matchId) {
  const url = new URL(BASE + "/matches/" + encodeURIComponent(matchId));
  const response = await fetch(url, {
    headers: { "X-API-Key": key, "Accept": "application/json", "User-Agent": "Prime-Score/0.4.1" }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.message || body?.error || ("Live Tennis API HTTP " + response.status));
    error.status = response.status;
    throw error;
  }
  return body?.data || body;
}

async function fetchPlayer(key, playerId) {
  const url = new URL(BASE + "/players/" + encodeURIComponent(playerId));
  const response = await fetch(url, {
    headers: { "X-API-Key": key, "Accept": "application/json", "User-Agent": "Prime-Score/0.4.0" }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.message || body?.error || ("Live Tennis API HTTP " + response.status));
    error.status = response.status;
    throw error;
  }
  return body?.data || body;
}

async function fetchH2H(key, p1, p2) {
  const url = new URL(BASE + "/h2h");
  url.searchParams.set("p1", String(p1 || ""));
  url.searchParams.set("p2", String(p2 || ""));
  const response = await fetch(url, {
    headers: { "X-API-Key": key, "Accept": "application/json", "User-Agent": "Prime-Score/0.4.2" }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.message || body?.error || ("Live Tennis API H2H HTTP " + response.status));
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}
async function fetchESPNTennis(){
  const dates=[];
  const base=new Date();
  for(let i=0;i<3;i++){
    const d=new Date(base); d.setUTCDate(d.getUTCDate()+i);
    dates.push(d.toISOString().slice(0,10).replaceAll("-",""));
  }
  const tours=["atp","wta"];
  const requests=tours.flatMap(tour=>dates.map(date=>
    fetch("https://site.api.espn.com/apis/site/v2/sports/tennis/"+tour+"/scoreboard?dates="+date,{
      headers:{Accept:"application/json", "User-Agent":"Prime-Score/0.5.0"}
    }).then(async response=>{
      if(!response.ok) throw new Error("ESPN Tennis "+tour+" HTTP "+response.status);
      return {tour,data:await response.json()};
    })
  ));
  const results=await Promise.allSettled(requests);
  const items=[];
  for(const result of results){
    if(result.status!=="fulfilled") continue;
    const tour=result.value.tour.toUpperCase();
    for(const event of result.value.data?.events||[]){
      const competition=event?.competitions?.[0];
      const competitors=competition?.competitors||[];
      const home=competitors.find(x=>x?.homeAway==="home")||competitors[0];
      const away=competitors.find(x=>x?.homeAway==="away")||competitors[1];
      if(!event?.id||!home?.athlete||!away?.athlete) continue;
      const status=event?.status?.type||{};
      const state=String(status.state||"").toLowerCase();
      const normalizedStatus=state==="in"?"live":state==="post"?"completed":"upcoming";
      const sets=(competitors.length>=2)
        ? competitors.map(x=>(x?.linescores||[]).map(s=>Number.isFinite(Number(s?.value))?Number(s.value):s?.displayValue)).slice(0,2)
        : [];
      items.push({
        id:"espn-"+tour+"-"+String(event.id),
        tour,
        tournament:competition?.type?.text||event?.name||"Tennis",
        tournamentId:null,
        tier:null,
        surface:null,
        round:competition?.type?.abbreviation||"",
        roundCode:null,
        date:event?.date||null,
        status:normalizedStatus,
        statusDetail:status?.shortDetail||status?.description||"",
        players:[
          {id:home.athlete.id||null,name:home.athlete.displayName||home.athlete.fullName||"Jugador 1",shortName:home.athlete.shortName||home.athlete.displayName||"Jugador 1",country:"",ranking:null,rankingPoints:null,flag:null,hand:null,backhand:null,rankingMovement:null,dataCompleteness:null,stats:null},
          {id:away.athlete.id||null,name:away.athlete.displayName||away.athlete.fullName||"Jugador 2",shortName:away.athlete.shortName||away.athlete.displayName||"Jugador 2",country:"",ranking:null,rankingPoints:null,flag:null,hand:null,backhand:null,rankingMovement:null,dataCompleteness:null,stats:null}
        ],
        sets,
        games:[],
        points:[],
        server:null,
        isTiebreak:false,
        winner:null,
        outcome:null,
        hasAnalysis:false,
        hasMarket:false
      });
    }
  }
  return Array.from(new Map(items.map(x=>[x.id,x])).values());
}

async function fetchMatches(key, params) {
  const url = new URL(BASE + "/matches");
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      "X-API-Key": key,
      "Accept": "application/json",
      "User-Agent": "Prime-Score/0.4.0"
    }
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body?.message || body?.error || `Live Tennis API HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

export default async function handler(req, res) {
  const key = getKey();

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");

  if (!key) {
    try{
      const items=await fetchESPNTennis();
      return res.status(200).json({
        sport:"tennis",
        source:"ESPN fallback",
        configured:false,
        updatedAt:new Date().toISOString(),
        counts:{
          live:items.filter(m=>m.status==="live").length,
          upcoming:items.filter(m=>m.status==="upcoming").length,
          completed:items.filter(m=>m.status==="completed").length
        },
        items,
        warning:"LIVE_TENNIS_API_KEY no configurada; usando fuente pública de respaldo."
      });
    }catch(error){
      return res.status(502).json({sport:"tennis",source:"ESPN fallback",configured:false,error:error?.message||"No se pudo cargar Tennis."});
    }
  }

  const h2hP1 = req?.query?.h2hP1;
  const h2hP2 = req?.query?.h2hP2;
  if (h2hP1 && h2hP2) {
    try {
      const h2h = await fetchH2H(key, h2hP1, h2hP2);
      return res.status(200).json({
        sport: "tennis",
        source: "Live Tennis API",
        configured: true,
        updatedAt: new Date().toISOString(),
        h2h
      });
    } catch (error) {
      return res.status(error?.status || 502).json({
        sport: "tennis",
        source: "Live Tennis API",
        configured: true,
        h2h: null,
        error: error?.message || "No se pudo consultar H2H"
      });
    }
  }

  const matchId = req?.query?.matchId;
  if (matchId) {
    try {
      const match = await fetchMatch(key, matchId);
      return res.status(200).json({ sport: "tennis", source: "Live Tennis API", configured: true, updatedAt: new Date().toISOString(), match: normalizeMatch(match) });
    } catch (error) {
      return res.status(error?.status || 502).json({ sport: "tennis", source: "Live Tennis API", configured: true, error: error?.message || "No se pudo consultar el partido" });
    }
  }

  const playerId = req?.query?.playerId;
  if (playerId) {
    try {
      const player = await fetchPlayer(key, playerId);
      return res.status(200).json({ sport: "tennis", source: "Live Tennis API", configured: true, updatedAt: new Date().toISOString(), player });
    } catch (error) {
      return res.status(error?.status || 502).json({ sport: "tennis", source: "Live Tennis API", configured: true, error: error?.message || "No se pudo consultar el jugador" });
    }
  }

  try {
    // Dos llamadas consolidadas: el proveedor permite pedir todos los tours
    // en /matches y luego filtramos ATP/WTA en nuestro servidor. Esto evita
    // consumir cuatro llamadas por cada actualización del usuario.
    // Live scores come from /matches?status=live. Scheduled matches are
    // served by /fixtures, which is the provider's canonical FREE endpoint
    // for upcoming matches. Using /fixtures here also avoids returning an
    // empty upcoming slate on providers/keys that expose scheduling there.
    const [liveAll, atpFixtures, wtaFixtures] = await Promise.allSettled([
      fetchMatches(key, { status: "live", limit: 100 }),
      fetchFixtures(key, { tour: "atp", draw: "singles", limit: 100 }),
      fetchFixtures(key, { tour: "wta", draw: "singles", limit: 100 })
    ]);

    const read = result => result.status === "fulfilled"
      ? (Array.isArray(result.value?.data) ? result.value.data : [])
      : [];

    const errors = [liveAll, atpFixtures, wtaFixtures]
      .filter(result => result.status === "rejected")
      .map(result => ({
        status: result.reason?.status || 500,
        message: result.reason?.message || "Error consultando tenis"
      }));

    const normalizeStatus = value => {
      const raw = String(value || "").toLowerCase();
      if (raw.includes("live") || raw.includes("in_play") || raw === "playing") return "live";
      if (raw.includes("complete") || raw.includes("final") || raw === "finished") return "completed";
      return "upcoming";
    };

    const liveItems = read(liveAll).map(row => {
      const match = normalizeMatch(row);
      match.status = "live";
      return match;
    });

    const fixtureItems = [
      ...read(atpFixtures),
      ...read(wtaFixtures)
    ].map(row => {
      const match = normalizeFixture(row);
      match.status = normalizeStatus(match.status);
      return match;
    });

    const items = [
      ...liveItems,
      ...fixtureItems
    ].filter(match => {
      const tour = String(match.tour || "").toUpperCase();
      return match.id && (tour === "ATP" || tour === "WTA") &&
        Array.isArray(match.players) && match.players.length === 2;
    });

    let unique = Array.from(new Map(items.map(match => [match.id, match])).values());
    if(!unique.length){
      try{
        const fallback=await fetchESPNTennis();
        unique=Array.from(new Map(fallback.map(match=>[match.id,match])).values());
      }catch{}
    }
    unique.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    return res.status(200).json({
      sport: "tennis",
      source: unique.some(m=>String(m.id).startsWith("espn-")) ? "Live Tennis API + ESPN fallback" : "Live Tennis API",
      configured: true,
      updatedAt: new Date().toISOString(),
      counts: {
        live: unique.filter(m => m.status === "live").length,
        upcoming: unique.filter(m => m.status === "upcoming").length,
        completed: unique.filter(m => m.status === "completed").length
      },
      errors,
      items: unique
    });
  } catch (error) {
    return res.status(error?.status || 502).json({
      sport: "tennis",
      source: "Live Tennis API",
      configured: true,
      error: error?.message || "No se pudo consultar Live Tennis API"
    });
  }
}
