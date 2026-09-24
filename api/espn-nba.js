export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const input=new URL(req.url,"http://localhost");
  const start=String(input.searchParams.get("start_date")||"").replace(/-/g,"");
  const end=String(input.searchParams.get("end_date")||"").replace(/-/g,"");

  if(!/^\d{8}$/.test(start)||!/^\d{8}$/.test(end)){
    return res.status(400).json({error:"Invalid date range"});
  }

  const upstream=`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${start}-${end}&limit=1000`;

  try{
    const response=await fetch(upstream,{
      headers:{Accept:"application/json","User-Agent":"WYNTR/1.0"}
    });
    const body=await response.text();

    res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=900");
    res.setHeader("Content-Type",response.headers.get("content-type")||"application/json");

    if(!response.ok){
      return res.status(response.status).json({
        error:"ESPN NBA schedule request failed",
        upstreamStatus:response.status,
        details:body.slice(0,300)
      });
    }

    return res.status(200).send(body);
  }catch(error){
    console.error("WYNTR ESPN NBA proxy error:",error);
    return res.status(502).json({error:"ESPN NBA schedule unavailable"});
  }
}