/* Prime Score rescue boot
   Keeps the dashboard usable if an upstream source is slow or a cached shell
   prevents the primary data loader from painting the home screen.
*/
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
  const isoDay = d => new Date(d).toISOString().slice(0,10);

  async function json(url, timeout=9000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const r = await fetch(url, {cache:"no-store", signal:controller.signal, headers:{Accept:"application/json"}});
      if (!r.ok) throw new Error("HTTP "+r.status);
      return await r.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function nbaRows(payload) {
    const events = Array.isArray(payload?.events) ? payload.events : [];
    return events.map(e => {
      const c = e?.competitions?.[0];
      const teams = c?.competitors || [];
      const home = teams.find(x => x?.homeAway === "home") || teams[0];
      const away = teams.find(x => x?.homeAway === "away") || teams[1];
      if (!e?.id || !home?.team || !away?.team) return null;
      return {
        id:String(e.id),
        date:e.date,
        home:{name:home.team.displayName||home.team.shortDisplayName||"Local",short:home.team.abbreviation||home.team.shortDisplayName||"Local",logo:home.team.logo||""},
        away:{name:away.team.displayName||away.team.shortDisplayName||"Visitante",short:away.team.abbreviation||away.team.shortDisplayName||"Visitante",logo:away.team.logo||""},
        completed:String(e?.status?.type?.state||"").toLowerCase()==="post",
        status:e?.status?.type?.shortDetail||e?.status?.type?.description||"Próximo"
      };
    }).filter(Boolean);
  }

  async function fetchNBA() {
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate()+14);
    try {
      const data = await json("/api/espn-nba?start_date="+isoDay(start)+"&end_date="+isoDay(end),12000);
      const rows = Array.isArray(data?.events) ? data.events : [];
      return rows.map(e => {
        const c=e?.competitions?.[0], teams=c?.competitors||[];
        const h=teams.find(x=>x?.homeAway==="home")||teams[0], a=teams.find(x=>x?.homeAway==="away")||teams[1];
        if(!e?.id||!h?.team||!a?.team)return null;
        return {id:String(e.id),date:e.date,home:{name:h.team.displayName||h.team.shortDisplayName,short:h.team.abbreviation||h.team.shortDisplayName,logo:h.team.logo||""},away:{name:a.team.displayName||a.team.shortDisplayName,short:a.team.abbreviation||a.team.shortDisplayName,logo:a.team.logo||""},completed:String(e?.status?.type?.state||"").toLowerCase()==="post",status:e?.status?.type?.shortDetail||"Próximo"};
      }).filter(Boolean).sort((a,b)=>new Date(a.date)-new Date(b.date));
    } catch(e) {
      console.warn("Prime Score rescue NBA:",e);
      return [];
    }
  }

  async function fetchTennis() {
    try {
      const data = await json("/api/live-tennis?t=rescue-"+Date.now(),10000);
      if(Array.isArray(data?.items) && data.items.length) return data.items;
    } catch(e) {
      console.warn("Prime Score rescue Tennis API:",e);
    }
    const items=[];
    const base=new Date();
    for(const tour of ["atp","wta"]) {
      for(let i=0;i<3;i++) {
        const d=new Date(base); d.setUTCDate(d.getUTCDate()+i);
        try {
          const data=await json("https://site.api.espn.com/apis/site/v2/sports/tennis/"+tour+"/scoreboard?dates="+d.toISOString().slice(0,10).replaceAll("-",""),8000);
          for(const e of (data?.events||[])) {
            const c=e?.competitions?.[0], teams=c?.competitors||[];
            const h=teams.find(x=>x?.homeAway==="home")||teams[0], a=teams.find(x=>x?.homeAway==="away")||teams[1];
            if(!e?.id||!h?.athlete||!a?.athlete)continue;
            const state=String(e?.status?.type?.state||"").toLowerCase();
            items.push({id:"rescue-"+tour+"-"+e.id,tour:tour.toUpperCase(),tournament:c?.type?.text||e?.name||"Tennis",date:e.date,status:state==="in"?"live":state==="post"?"completed":"upcoming",players:[{id:h.athlete.id,name:h.athlete.displayName||h.athlete.fullName||"Jugador 1"},{id:a.athlete.id,name:a.athlete.displayName||a.athlete.fullName||"Jugador 2"}],sets:[]});
          }
        } catch(e) {}
      }
    }
    return Array.from(new Map(items.map(x=>[x.id,x])).values());
  }

  function paintNBA(rows) {
    const root=$("todayGames");
    if(!root || !rows.length)return false;
    const upcoming=rows.filter(x=>!x.completed && new Date(x.date)>=new Date()).slice(0,3);
    const list=upcoming.length?upcoming:rows.slice(0,3);
    root.innerHTML=list.map(g=>'<button class="today-game featured" type="button" data-rescue-nba="'+esc(g.id)+'">'+
      '<div class="today-game-head"><span>🏀 NBA · '+esc(g.status||"PRÓXIMO")+'</span><span class="today-live">PRIME SIGNAL</span></div>'+
      '<div class="today-matchup"><div class="today-team">'+(g.away.logo?'<img src="'+esc(g.away.logo)+'" alt="">':"")+esc(g.away.short)+'</div><div class="today-vs">VS</div><div class="today-team">'+esc(g.home.short)+(g.home.logo?'<img src="'+esc(g.home.logo)+'" alt="">':"")+'</div></div>'+
      '<div class="today-card-bottom"><span>NBA Intelligence</span><b>ABRIR FICHA →</b></div></button>').join("");
    root.querySelectorAll("[data-rescue-nba]").forEach(b=>b.addEventListener("click",()=>{ location.href="/?match="+encodeURIComponent(b.dataset.rescueNba)+"#analysis"; }));
    if($("dashboardTitle"))$("dashboardTitle").textContent="Próximos partidos";
    if($("dashboardDate"))$("dashboardDate").textContent="NBA · PRÓXIMA JORNADA";
    return true;
  }

  function paintTennis(items) {
    const valid=items.filter(m=>m&&(m.tour==="ATP"||m.tour==="WTA")&&Array.isArray(m.players)&&m.players.length>=2);
    const root=$("tennisMatches");
    if(root && valid.length && root.textContent.includes("Cargando")) {
      root.innerHTML=valid.slice(0,12).map(m=>'<button class="tennis-card" type="button" data-rescue-tennis="'+esc(m.id)+'">'+
        '<div class="tennis-card-top"><span>'+esc(m.tour)+' · '+esc(m.tournament||"Tennis")+'</span><b>'+esc(m.status==="live"?"EN VIVO":"PRÓXIMO")+'</b></div>'+
        '<div class="tennis-players"><strong>'+esc(m.players[0].name)+'</strong><span>VS</span><strong>'+esc(m.players[1].name)+'</strong></div>'+
        '<div class="tennis-card-foot">Prime Tennis Intelligence →</div></button>').join("");
      root.querySelectorAll("[data-rescue-tennis]").forEach(b=>b.addEventListener("click",()=>{
        if(typeof window.selectTennisMatch==="function") window.selectTennisMatch(b.dataset.rescueTennis);
        else if($("tennisAnalysis")) $("tennisAnalysis").innerHTML='<div class="card"><strong>Prime Tennis Intelligence</strong><p>'+esc((valid.find(x=>x.id===b.dataset.rescueTennis)?.players||[]).map(p=>p.name).join(" vs "))+'</p><span class="muted">Ficha avanzada disponible al restablecer el motor principal.</span></div>';
      }));
    }
    return valid;
  }

  async function boot() {
    const root=$("todayGames");
    const stuck=root && /Cargando los partidos destacados/i.test(root.textContent||"");
    if(!stuck && typeof window.loadCalendar==="function") return;

    const [nba, tennis] = await Promise.all([fetchNBA(), fetchTennis()]);
    const nbaPainted=paintNBA(nba);
    const validTennis=paintTennis(tennis);

    if(!nbaPainted && root && !validTennis.length) {
      root.innerHTML='<div class="dashboard-empty"><strong>Datos temporalmente indisponibles</strong><br>Reintenta en unos segundos.</div>';
    } else if(root && validTennis.length && !nbaPainted) {
      root.innerHTML=validTennis.slice(0,3).map(m=>'<button class="today-game featured" type="button" data-rescue-tennis="'+esc(m.id)+'"><div class="today-game-head"><span>🎾 '+esc(m.tour)+' · '+esc(m.tournament||"Tennis")+'</span><span class="today-live">PRÓXIMO</span></div><div class="today-matchup"><div class="today-team">'+esc(m.players[0].name)+'</div><div class="today-vs">VS</div><div class="today-team">'+esc(m.players[1].name)+'</div></div><div class="today-card-bottom"><span>Prime Tennis Intelligence</span><b>ABRIR FICHA →</b></div></button>').join("");
    }
    if($("autoRefreshStatus"))$("autoRefreshStatus").textContent="Datos conectados · "+new Date().toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"});
  }

  setTimeout(boot,2500);
  window.addEventListener("online",()=>setTimeout(boot,300));
})();