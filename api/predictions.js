const URL_BASE=process.env.SUPABASE_URL||"";
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_ANON_KEY||"";
async function db(path,options={}){
 if(!URL_BASE||!KEY) throw new Error("Supabase no esta configurado.");
 const r=await fetch(URL_BASE.replace(/\/$/,"")+"/rest/v1/"+path,{...options,headers:{apikey:KEY,Authorization:"Bearer "+KEY,"Content-Type":"application/json",...(options.headers||{})}});
 const t=await r.text(); let b=null; try{b=t?JSON.parse(t):null}catch{}
 if(!r.ok){const e=new Error(b?.message||b?.hint||"Error de Supabase");e.status=r.status;throw e} return b;
}
function auth(req){const s=process.env.PRIME_LEDGER_SECRET||process.env.CRON_SECRET;if(!s)return true;const x=req.headers["x-prime-secret"]||req.headers.authorization?.replace(/^Bearer\s+/i,"");return x===s}
export default async function handler(req,res){
 try{
  if(!URL_BASE||!KEY)return res.status(503).json({configured:false,error:"Faltan variables de Supabase."});
  if(req.method==="GET"){
   const q=new URL(req.url,"http://localhost").searchParams, sport=q.get("sport"), status=q.get("status");
   const p=new URLSearchParams({select:"*",order:"scheduled_at.desc",limit:String(Math.min(100,Math.max(1,Number(q.get("limit")||50))))});
   if(sport==="nba"||sport==="tennis")p.set("sport","eq."+sport);
   if(["pending","correct","incorrect","void"].includes(status))p.set("status","eq."+status);
   return res.status(200).json({configured:true,items:await db("predictions?"+p)});
  }
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  if(!auth(req))return res.status(401).json({error:"Unauthorized"});
  const p=typeof req.body==="string"?JSON.parse(req.body):(req.body||{});
  const required=["sport","event_id","home_name","away_name","model_version","home_probability","away_probability","prediction_hash"];
  const missing=required.filter(k=>p[k]===undefined||p[k]===null||p[k]==="");
  if(missing.length)return res.status(400).json({error:"Campos faltantes",missing});
  const row={sport:p.sport,league:p.league||null,event_id:String(p.event_id),home_name:p.home_name,away_name:p.away_name,scheduled_at:p.scheduled_at||null,published_at:p.published_at||new Date().toISOString(),model_version:p.model_version,home_probability:Number(p.home_probability),away_probability:Number(p.away_probability),projected_home_score:p.projected_home_score==null?null:Number(p.projected_home_score),projected_away_score:p.projected_away_score==null?null:Number(p.projected_away_score),confidence:p.confidence==null?null:Number(p.confidence),data_coverage:p.data_coverage==null?null:Number(p.data_coverage),integrity_risk:p.integrity_risk==null?null:Number(p.integrity_risk),features:p.features||{},prediction_hash:p.prediction_hash};
  const saved=await db("predictions",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=representation"},body:JSON.stringify(row)});
  return res.status(201).json({saved:true,item:Array.isArray(saved)?saved[0]:saved});
 }catch(e){console.error(e);return res.status(e.status||500).json({error:e.message||"Ledger error"})}
}