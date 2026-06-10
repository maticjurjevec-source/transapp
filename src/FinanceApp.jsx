import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://yxaqnvxihfxhpebsgflc.supabase.co",
  "sb_publishable_MK8IOnYCZKYC_gggJCZjFw_ypRV5wWm"
);

// ─── Helpers ───
function fmt(d){if(!d)return"—";try{return new Date(d).toLocaleDateString("sl-SI",{day:"2-digit",month:"2-digit",year:"numeric"})}catch{return"—"}}
function parseZnesek(s){if(!s)return 0;if(typeof s==="number")return s;const c=String(s).replace(/[^\d,.\s]/g," ").trim();let n=c.replace(/\s/g,"").replace(/\.(?=\d{3}(\D|$))/g,"").replace(",",".");return parseFloat(n)||0}
function izvleciEmail(t){if(!t)return"";const m=t.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);return m?m[0]:""}

export default function FinanceApp(){
  // Data
  const [racuni,setRacuni]=useState([]);
  const [nalogi,setNalogi]=useState([]);
  const [cmrDocs,setCmrDocs]=useState({});
  const [loading,setLoading]=useState(true);
  
  // UI
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("vsi");
  const [detail,setDetail]=useState(null);
  const [imgPreview,setImgPreview]=useState(null);
  const [sortBy,setSortBy]=useState("datum_desc");

  // ─── Fetch data ───
  useEffect(()=>{
    async function load(){
      setLoading(true);
      const [r,n]=await Promise.all([
        supabase.from("racuni").select("*").order("created_at",{ascending:false}),
        supabase.from("nalogi").select("*")
      ]);
      if(r.data)setRacuni(r.data);
      if(n.data)setNalogi(n.data);
      setLoading(false);
    }
    load();
  },[]);

  // Fetch CMR za odprt detail
  useEffect(()=>{
    if(!detail?.nalog_id&&!detail?.nalogId)return;
    const nId=detail.nalog_id||detail.nalogId;
    if(cmrDocs[nId])return;
    supabase.from("cmr_dokumenti").select("*").eq("nalog_id",nId).order("created_at",{ascending:false}).then(({data})=>{
      if(data)setCmrDocs(prev=>({...prev,[nId]:data}));
    });
  },[detail]);

  // ─── Computed ───
  const povezanNalog=useMemo(()=>{
    if(!detail)return null;
    const nId=detail.nalog_id||detail.nalogId;
    return nId?nalogi.find(n=>n.id===nId):null;
  },[detail,nalogi]);

  const cmrList=useMemo(()=>{
    const nId=detail?.nalog_id||detail?.nalogId;
    return nId?cmrDocs[nId]||[]:[];
  },[detail,cmrDocs]);

  const zaFakturo=useMemo(()=>nalogi.filter(n=>n.status==="za_fakturo"),[nalogi]);

  const filtered=useMemo(()=>{
    let items=racuni;
    if(statusFilter!=="vsi")items=items.filter(r=>r.status===statusFilter);
    if(search.trim()){
      const q=search.toLowerCase().trim();
      items=items.filter(r=>
        (r.id||"").toLowerCase().includes(q)||
        (r.stranka||"").toLowerCase().includes(q)||
        (r.kontaktEmail||r.kontakt_email||"").toLowerCase().includes(q)||
        String(r.znesek||"").includes(q)||
        (r.opombe||"").toLowerCase().includes(q)
      );
    }
    // Sort
    items=[...items].sort((a,b)=>{
      if(sortBy==="datum_desc")return new Date(b.created_at||b.datum||0)-new Date(a.created_at||a.datum||0);
      if(sortBy==="datum_asc")return new Date(a.created_at||a.datum||0)-new Date(b.created_at||b.datum||0);
      if(sortBy==="znesek_desc")return(b.znesek||0)-(a.znesek||0);
      if(sortBy==="znesek_asc")return(a.znesek||0)-(b.znesek||0);
      if(sortBy==="stranka")return(a.stranka||"").localeCompare(b.stranka||"");
      return 0;
    });
    return items;
  },[racuni,statusFilter,search,sortBy]);

  const stats=useMemo(()=>({
    skupaj:racuni.reduce((a,r)=>a+(r.znesek||0),0),
    odprto:racuni.filter(r=>r.status==="poslan").reduce((a,r)=>a+(r.znesek||0),0),
    placano:racuni.filter(r=>r.status==="placano").reduce((a,r)=>a+(r.znesek||0),0),
    zapadlo:racuni.filter(r=>{
      if(r.status!=="poslan")return false;
      return r.rok&&new Date(r.rok)<new Date();
    }).reduce((a,r)=>a+(r.znesek||0),0),
    count:racuni.length,
  }),[racuni]);

  // ─── Actions ───
  async function oznacPlacano(id){
    const{error}=await supabase.from("racuni").update({status:"placano",datum_placila:new Date().toISOString().slice(0,10)}).eq("id",id);
    if(!error){
      setRacuni(prev=>prev.map(r=>r.id===id?{...r,status:"placano",datum_placila:new Date().toISOString().slice(0,10)}:r));
      if(detail?.id===id)setDetail(d=>({...d,status:"placano",datum_placila:new Date().toISOString().slice(0,10)}));
    }
  }

  async function oznacPoslan(id){
    const{error}=await supabase.from("racuni").update({status:"poslan"}).eq("id",id);
    if(!error){
      setRacuni(prev=>prev.map(r=>r.id===id?{...r,status:"poslan",datum_placila:null}:r));
      if(detail?.id===id)setDetail(d=>({...d,status:"poslan",datum_placila:null}));
    }
  }

  // ─── Helpers za polja ───
  const getOriginalUrl=(n)=>n?.original_pdf_url||n?.originalPdfUrl||null;
  const getRef=(n)=>n?.nak_referenca||n?.nakReferenca||null;
  const getZnesekOriginal=(n)=>n?.znesek_original||n?.znesekOriginal||null;

  function getCmrUrl(cmr){
    if(!cmr?.storage_pot)return null;
    if(cmr.storage_pot.startsWith("http"))return cmr.storage_pot;
    const{data}=supabase.storage.from("cmr_dokumenti").getPublicUrl(cmr.storage_pot);
    return data?.publicUrl||null;
  }

  function dniDoRoka(r){
    if(!r.rok||r.status==="placano")return null;
    return Math.ceil((new Date(r.rok+"T00:00:00")-new Date())/86400000);
  }

  // ─── Styles ───
  const c={
    bg:"#f0f2f5",card:"#fff",primary:"#1e3a5f",accent:"#2563eb",
    green:"#16a34a",red:"#dc2626",orange:"#d97706",muted:"#64748b",light:"#94a3b8",
    border:"#e2e8f0",bgSoft:"#f8fafc",
  };
  const statusCfg={
    osnutek:{label:"Osnutek",color:c.muted,bg:"#f8fafc"},
    poslan:{label:"Poslan",color:c.accent,bg:"#eff6ff"},
    placano:{label:"Plačano",color:c.green,bg:"#f0fdf4"},
    zapadlo:{label:"Zapadlo",color:c.red,bg:"#fef2f2"},
  };

  if(loading)return(
    <div style={{minHeight:"100vh",background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:12}}>📊</div>
        <div style={{fontSize:15,color:c.muted}}>Nalagam finančne podatke...</div>
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:c.bg,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      {/* HEADER */}
      <div style={{background:`linear-gradient(135deg, ${c.primary} 0%, #0f2744 100%)`,color:"#fff",padding:"20px 24px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
            <div>
              <div style={{fontSize:22,fontWeight:800,letterSpacing:-0.5}}>💰 Finance</div>
              <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>MATJAŽ JURJEVEC, s.p. · Pregled računov</div>
            </div>
            <div style={{fontSize:11,color:"#94a3b8",textAlign:"right"}}>
              <div>Prijava: Bernarda Jurjevec</div>
              <div>{fmt(new Date().toISOString())}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"20px 16px"}}>
        {/* STATS */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:20}}>
          {[
            ["💶","Skupaj",stats.skupaj,c.accent],
            ["⏳","Odprto",stats.odprto,c.orange],
            ["✅","Plačano",stats.placano,c.green],
            ["⚠️","Zapadlo",stats.zapadlo,c.red],
          ].map(([ic,lb,vl,cl])=>(
            <div key={lb} style={{background:c.card,borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:20}}>{ic}</span>
                <span style={{fontSize:10,color:c.light,textTransform:"uppercase",letterSpacing:1}}>{lb}</span>
              </div>
              <div style={{fontSize:22,fontWeight:800,color:cl,marginTop:6}}>{vl.toFixed(0)} €</div>
            </div>
          ))}
        </div>

        {/* ZA FAKTURO */}
        {zaFakturo.length>0&&<div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:12,padding:16,marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:14,color:"#92400e",marginBottom:10}}>💶 Čaka na fakturo ({zaFakturo.length})</div>
          {zaFakturo.map(n=>{
            const zOrig=getZnesekOriginal(n);const ref=getRef(n);
            const jeSloDdv=n?.je_slovenska_ddv!==false;
            const osnova=zOrig?parseZnesek(zOrig):0;
            const skupaj=jeSloDdv?osnova*1.22:osnova;
            return(
              <div key={n.id} style={{padding:"8px 0",borderBottom:"1px solid #fef3c7",fontSize:13}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <span style={{fontWeight:700}}>{n.stranka}</span>
                    <span style={{color:c.muted,marginLeft:8}}>{n.stevilka_naloga} · {n.nak_kraj} → {n.raz_kraj}</span>
                  </div>
                  {zOrig&&<div style={{fontWeight:700,color:c.green}}>{skupaj.toFixed(2)} € {jeSloDdv?"(+22% DDV)":"(RC)"}</div>}
                </div>
                {ref&&<div style={{fontSize:11,color:c.muted,marginTop:2}}>Ref: <span style={{fontFamily:"monospace",color:c.accent}}>{ref}</span></div>}
              </div>
            );
          })}
        </div>}

        {/* ISKALNIK + FILTRI */}
        <div style={{background:c.card,borderRadius:12,padding:16,marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
            <div style={{flex:"1 1 250px",position:"relative"}}>
              <input 
                value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="🔍 Išči po stranki, številki, emailu, znesku..."
                style={{width:"100%",padding:"10px 12px 10px 12px",border:`1px solid ${c.border}`,borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}
              />
              {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:c.border,border:"none",borderRadius:"50%",width:20,height:20,fontSize:11,cursor:"pointer",color:c.muted}}>✕</button>}
            </div>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{padding:"10px 12px",border:`1px solid ${c.border}`,borderRadius:8,fontSize:12,background:"#fff",color:c.primary,cursor:"pointer"}}>
              <option value="datum_desc">Najnovejši</option>
              <option value="datum_asc">Najstarejši</option>
              <option value="znesek_desc">Največji znesek</option>
              <option value="znesek_asc">Najmanjši znesek</option>
              <option value="stranka">Stranka A→Z</option>
            </select>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[["vsi","Vsi ("+racuni.length+")"],["osnutek","Osnutki"],["poslan","Poslani"],["placano","Plačani"],["zapadlo","Zapadli"]].map(([v,l])=>(
              <button key={v} onClick={()=>setStatusFilter(v)} style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${statusFilter===v?c.accent:c.border}`,background:statusFilter===v?c.accent:"#fff",color:statusFilter===v?"#fff":c.muted,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>{l}</button>
            ))}
          </div>
          {search&&<div style={{fontSize:11,color:c.muted,marginTop:8}}>{filtered.length} {filtered.length===1?"rezultat":"rezultatov"} za "{search}"</div>}
        </div>

        {/* SEZNAM RAČUNOV */}
        {filtered.length===0&&<div style={{textAlign:"center",padding:40,color:c.light}}>Ni računov.</div>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(r=>{
            const sc=statusCfg[r.status]||statusCfg.osnutek;
            const zap=r.status==="poslan"&&r.rok&&new Date(r.rok)<new Date();
            const dni=dniDoRoka(r);
            const effSc=zap?statusCfg.zapadlo:sc;
            return(
              <div key={r.id} onClick={()=>setDetail(r)} style={{background:c.card,borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",transition:"all 0.15s",border:"1.5px solid transparent",borderLeftColor:effSc.color,borderLeftWidth:4}} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.1)";}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                      <span style={{fontSize:12,fontFamily:"monospace",fontWeight:700,color:c.accent}}>{r.id}</span>
                      <span style={{padding:"2px 8px",borderRadius:10,background:effSc.bg,color:effSc.color,fontSize:10,fontWeight:700}}>{zap?"⚠️ Zapadlo":sc.label}</span>
                      {dni!==null&&!zap&&dni<=7&&<span style={{fontSize:10,color:c.orange,fontWeight:600}}>Še {dni} dni</span>}
                      {zap&&<span style={{fontSize:10,color:c.red,fontWeight:600}}>Zapadel pred {Math.abs(dni)} dni</span>}
                    </div>
                    <div style={{fontWeight:700,fontSize:15,color:c.primary}}>{r.stranka}</div>
                    <div style={{display:"flex",gap:12,marginTop:3,flexWrap:"wrap"}}>
                      {(r.kontaktEmail||r.kontakt_email)&&<span style={{fontSize:11,color:c.muted}}>✉️ {r.kontaktEmail||r.kontakt_email}</span>}
                      <span style={{fontSize:11,color:c.muted}}>📅 Rok: {fmt(r.rok)}</span>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:20,fontWeight:800,color:c.primary}}>{(r.znesek||0).toFixed(2)} €</div>
                    {r.datum&&<div style={{fontSize:10,color:c.light,marginTop:2}}>Izdan: {fmt(r.datum)}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DETAIL MODAL */}
      {detail&&(()=>{
        const sc=statusCfg[detail.status]||statusCfg.osnutek;
        const zap=detail.status==="poslan"&&detail.rok&&new Date(detail.rok)<new Date();
        const dni=dniDoRoka(detail);
        const effSc=zap?statusCfg.zapadlo:sc;
        const originalUrl=povezanNalog?getOriginalUrl(povezanNalog):null;
        const refP=povezanNalog?getRef(povezanNalog):null;
        const znesekOrig=povezanNalog?getZnesekOriginal(povezanNalog):null;
        const reverseCharge=detail.reverseCharge||detail.reverse_charge;
        const osnova=reverseCharge?(detail.znesek||0):(detail.znesek||0)/1.22;
        const ddv=reverseCharge?0:(detail.znesek||0)-osnova;

        return(<div style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.5)",display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"30px 16px",overflowY:"auto"}} onClick={()=>setDetail(null)}>
          <div style={{background:c.card,borderRadius:16,maxWidth:700,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.2)",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
            {/* Header */}
            <div style={{background:`linear-gradient(135deg, ${c.primary} 0%, #0f2744 100%)`,color:"#fff",padding:"20px 24px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:c.light}}>Račun</div>
                  <div style={{fontSize:22,fontWeight:800,fontFamily:"monospace",marginTop:2}}>{detail.id}</div>
                  {refP&&<div style={{marginTop:6,fontSize:11,color:c.light}}>📋 Ref: <span style={{color:"#fbbf24",fontWeight:700,fontFamily:"monospace"}}>{refP}</span></div>}
                  <div style={{marginTop:6}}><span style={{padding:"3px 10px",borderRadius:10,background:effSc.bg,color:effSc.color,fontSize:11,fontWeight:700}}>{zap?"⚠️ Zapadlo":sc.label}</span></div>
                </div>
                <button onClick={()=>setDetail(null)} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:32,height:32,borderRadius:8,fontSize:16,cursor:"pointer"}}>✕</button>
              </div>
            </div>

            <div style={{padding:"20px 24px"}}>
              {/* Znesek */}
              <div style={{background:c.bgSoft,border:`1px solid ${c.border}`,borderRadius:12,padding:16,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                <div>
                  <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:c.light}}>Za plačilo</div>
                  <div style={{fontSize:30,fontWeight:800,color:c.primary}}>{(detail.znesek||0).toFixed(2)} €</div>
                </div>
                {detail.rok&&<div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:c.light}}>Rok plačila</div>
                  <div style={{fontSize:14,fontWeight:700,color:zap?c.red:c.primary}}>{fmt(detail.rok)}</div>
                  {dni!==null&&<div style={{fontSize:11,marginTop:2,color:zap?c.red:dni<=7?c.orange:c.muted,fontWeight:zap?700:500}}>
                    {zap?`Zapadel pred ${Math.abs(dni)} dni`:dni===0?"Zapade danes":`Še ${dni} dni`}
                  </div>}
                </div>}
              </div>

              {/* Stranka */}
              <Section title="🏢 Stranka">
                <div style={{fontWeight:700,fontSize:14,color:c.primary}}>{detail.stranka}</div>
                {(detail.kontaktEmail||detail.kontakt_email)&&<div style={{fontSize:12,color:c.muted,marginTop:3}}>✉️ {detail.kontaktEmail||detail.kontakt_email}</div>}
                {reverseCharge&&<span style={{display:"inline-block",marginTop:6,fontSize:10,background:"#fef3c7",color:"#92400e",padding:"2px 8px",borderRadius:4,fontWeight:600}}>Reverse charge</span>}
              </Section>

              {/* Povezan nalog */}
              {povezanNalog&&<Section title="🚚 Povezan nalog">
                <div style={{fontFamily:"monospace",fontWeight:700,fontSize:13,color:c.accent}}>{povezanNalog.stevilka_naloga||povezanNalog.id}</div>
                <div style={{fontSize:12,color:c.muted,marginTop:3}}>📍 {povezanNalog.nak_kraj} → {povezanNalog.raz_kraj}</div>
                {povezanNalog.blago&&<div style={{fontSize:11,color:c.light,marginTop:2}}>Blago: {povezanNalog.blago}</div>}
              </Section>}

              {/* CMR */}
              {povezanNalog&&<Section title={`📎 CMR dokumenti ${cmrList.length>0?`(${cmrList.length})`:""}`}>
                {cmrList.length===0?
                  <div style={{color:c.orange,fontSize:12,textAlign:"center",padding:8}}>⚠️ Ni CMR dokumentov</div>:
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:8}}>
                    {cmrList.map(cmr=>{
                      const url=getCmrUrl(cmr);
                      const isImg=/\.(jpg|jpeg|png|webp|gif)$/i.test(cmr.ime_datoteke||"");
                      return(<div key={cmr.id} onClick={()=>{if(isImg&&url)setImgPreview(url);else if(url)window.open(url,"_blank");}} style={{background:c.bgSoft,border:`1px solid ${c.border}`,borderRadius:8,padding:4,cursor:"pointer",textAlign:"center",transition:"all 0.15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=c.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=c.border}>
                        {isImg&&url?<img src={url} alt="" style={{width:"100%",height:70,objectFit:"cover",borderRadius:4}} onError={e=>{e.target.style.display="none"}}/>:
                          <div style={{height:70,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📄</div>}
                        <div style={{fontSize:9,color:c.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:3}}>{cmr.ime_datoteke}</div>
                      </div>);
                    })}
                  </div>}
              </Section>}

              {/* Original nalog PDF */}
              {originalUrl&&<Section title="📄 Original nalog">
                <a href={originalUrl} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:12,background:c.bgSoft,border:`1px solid ${c.border}`,borderRadius:8,padding:12,textDecoration:"none",color:"inherit",transition:"all 0.15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=c.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=c.border}>
                  <div style={{width:36,height:36,borderRadius:6,background:"#fef2f2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📄</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,color:c.primary}}>{decodeURIComponent(originalUrl.split("/").pop()||"nalog.pdf")}</div>
                    <div style={{fontSize:11,color:c.muted}}>Odpri ↗</div>
                  </div>
                  {znesekOrig&&<div style={{textAlign:"right"}}>
                    <div style={{fontSize:10,color:c.light}}>Cena iz naloga</div>
                    <div style={{fontSize:14,fontWeight:700,color:c.green}}>{parseZnesek(znesekOrig).toFixed(2)} €</div>
                  </div>}
                </a>
              </Section>}

              {/* Razčlenitev */}
              <Section title="💶 Razčlenitev">
                <div style={{border:`1px solid ${c.border}`,borderRadius:8,overflow:"hidden",fontSize:13}}>
                  <Row label={`Prevoz${povezanNalog?` (${povezanNalog.nak_kraj} → ${povezanNalog.raz_kraj})`:""}`} value={`${osnova.toFixed(2)} €`}/>
                  <Row label="Osnova" value={`${osnova.toFixed(2)} €`} light/>
                  <Row label={`DDV ${reverseCharge?"(reverse charge)":"(22%)"}`} value={`${ddv.toFixed(2)} €`} light/>
                  <Row label="Skupaj" value={`${(detail.znesek||0).toFixed(2)} €`} bold/>
                </div>
              </Section>

              {/* Meta */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                <MiniCard label="📅 Izdan" value={fmt(detail.datum||detail.created_at)}/>
                {detail.datum_placila||detail.datumPlacila?
                  <MiniCard label="✅ Plačano" value={fmt(detail.datum_placila||detail.datumPlacila)} green/>:
                  <MiniCard label="⏳ Status" value="Neplačano"/>}
              </div>

              {/* Opombe */}
              {(detail.opombe)&&<Section title="📝 Opombe">
                <div style={{fontSize:13,color:c.primary}}>{detail.opombe}</div>
              </Section>}

              {/* Akcije */}
              <div style={{display:"flex",gap:8,flexWrap:"wrap",paddingTop:8,borderTop:`1px solid ${c.border}`}}>
                {detail.status!=="placano"&&<Btn color={c.green} white label="✅ Označi plačano" onClick={()=>oznacPlacano(detail.id)}/>}
                {detail.status==="placano"&&<Btn color="#e2e8f0" label="↩️ Razveljavi" onClick={()=>oznacPoslan(detail.id)}/>}
                <Btn color="#e2e8f0" label="📄 Natisni" onClick={()=>window.print()}/>
                <Btn color="#e2e8f0" label={"✉️ Pošlji"} onClick={()=>{
                  const subj=`Račun ${detail.id}`;
                  const body=`Spoštovani,\n\nV priponki pošiljamo račun ${detail.id} v znesku ${(detail.znesek||0).toFixed(2)} € z rokom plačila ${fmt(detail.rok)}.\n\nLep pozdrav,\nMATJAŽ JURJEVEC, s.p.\nSI76353362`;
                  window.location.href=`mailto:${detail.kontaktEmail||detail.kontakt_email||""}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
                }}/>
              </div>
            </div>
          </div>
        </div>);
      })()}

      {/* Lightbox */}
      {imgPreview&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20,cursor:"pointer"}} onClick={()=>setImgPreview(null)}>
        <img src={imgPreview} alt="" style={{maxWidth:"95%",maxHeight:"95vh",objectFit:"contain",borderRadius:8,boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}/>
        <button style={{position:"absolute",top:20,right:20,background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",width:40,height:40,borderRadius:20,fontSize:18,cursor:"pointer"}} onClick={()=>setImgPreview(null)}>✕</button>
      </div>}
    </div>
  );
}

// ─── Mini komponente ───
function Section({title,children}){
  return(<div style={{marginBottom:16}}>
    <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8",marginBottom:6,fontWeight:700}}>{title}</div>
    <div style={{background:"#f8fafc",borderRadius:8,padding:12}}>{children}</div>
  </div>);
}

function Row({label,value,light,bold}){
  return(<div style={{padding:bold?"10px 12px":"8px 12px",display:"flex",justifyContent:"space-between",borderTop:light||bold?"1px solid #e2e8f0":"none",background:bold?"#f8fafc":"transparent",borderTopWidth:bold?2:1}}>
    <span style={{color:bold?"#0f2744":"#64748b",fontWeight:bold?700:400,fontSize:bold?14:12}}>{label}</span>
    <span style={{color:"#0f2744",fontWeight:bold?800:600,fontSize:bold?14:12}}>{value}</span>
  </div>);
}

function MiniCard({label,value,green}){
  return(<div style={{background:green?"#f0fdf4":"#f8fafc",borderRadius:8,padding:10}}>
    <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:green?"#16a34a":"#94a3b8",marginBottom:3}}>{label}</div>
    <div style={{fontSize:13,fontWeight:600,color:green?"#166534":"#0f2744"}}>{value}</div>
  </div>);
}

function Btn({color,white,label,onClick}){
  return(<button onClick={onClick} style={{padding:"8px 16px",borderRadius:8,border:"none",background:color,color:white?"#fff":"#334155",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}} onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>{label}</button>);
}
