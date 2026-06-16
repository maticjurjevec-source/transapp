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

// Natisni en dokument (PDF ali slika)
function jeTiskljiv(url){return /\.(pdf|jpg|jpeg|png|webp|gif)(\?|$)/i.test(url||"");}
function prenesiDatoteko(url){
  if(!url)return;
  const a=document.createElement("a");
  a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.download="";
  document.body.appendChild(a);a.click();a.remove();
}
function natisniDok(url,naslov){
  if(!url){alert("Ni dokumenta.");return;}
  if(!jeTiskljiv(url)){prenesiDatoteko(url);return;}
  const w=window.open("","_blank");
  if(!w){alert("Brskalnik je blokiral okno. Dovoli pojavna okna za tiskanje.");return;}
  const jePdf=/\.pdf(\?|$)/i.test(url);
  const body=jePdf
    ?`<embed src="${url}" type="application/pdf" style="width:100%;height:100vh;border:none;"/>`
    :`<img src="${url}" style="max-width:100%;display:block;margin:0 auto;"/>`;
  w.document.write(`<!DOCTYPE html><html><head><title>${naslov||"Dokument"}</title><style>@page{size:A4;margin:8mm;}body{margin:0;font-family:sans-serif;}</style></head><body>${body}</body></html>`);
  w.document.close();
  const doPrint=()=>{try{w.focus();w.print();}catch(e){}};
  if(jePdf){setTimeout(doPrint,900);}
  else{const img=w.document.images[0];if(img){if(img.complete)setTimeout(doPrint,300);else{img.onload=()=>setTimeout(doPrint,300);img.onerror=()=>setTimeout(doPrint,300);}}else setTimeout(doPrint,600);}
}
// Natisni več CMR slik (vsaka na svojo stran)
function natisniCMRji(urls,naslov){
  const valid=(urls||[]).filter(Boolean);
  if(valid.length===0){alert("Ni CMR slik za tiskanje.");return;}
  const w=window.open("","_blank");
  if(!w){alert("Brskalnik je blokiral okno. Dovoli pojavna okna za tiskanje.");return;}
  const body=valid.map(u=>`<div class="page"><img src="${u}"/></div>`).join("");
  w.document.write(`<!DOCTYPE html><html><head><title>${naslov||"CMR"}</title><style>@page{size:A4;margin:8mm;}body{margin:0;}.page{page-break-after:always;}.page:last-child{page-break-after:auto;}img{max-width:100%;display:block;margin:0 auto;}</style></head><body>${body}</body></html>`);
  w.document.close();
  let loaded=0,done=false;const imgs=w.document.images;
  const doPrint=()=>{if(done)return;done=true;try{w.focus();w.print();}catch(e){}};
  if(imgs.length===0){setTimeout(doPrint,600);return;}
  const check=()=>{loaded++;if(loaded>=imgs.length)setTimeout(doPrint,300);};
  for(const img of imgs){if(img.complete)check();else{img.onload=check;img.onerror=check;}}
  setTimeout(doPrint,4000);
}

export default function FinanceApp(){
  // Data
  const [racuni,setRacuni]=useState([]);
  const [nalogi,setNalogi]=useState([]);
  const [cmrDocs,setCmrDocs]=useState({});
  const [cmrByNalog,setCmrByNalog]=useState({});
  const [loading,setLoading]=useState(true);

  // UI
  const [tab,setTab]=useState("nalogi");
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("vsi");
  const [detail,setDetail]=useState(null);
  const [imgPreview,setImgPreview]=useState(null);
  const [sortBy,setSortBy]=useState("datum_desc");

  // Vsi nalogi UI
  const [nalogSearch,setNalogSearch]=useState("");
  const [nalogFilter,setNalogFilter]=useState("nefakturirano");
  const [nalogDetail,setNalogDetail]=useState(null);

  // ─── Fetch data ───
  useEffect(()=>{
    async function load(){
      setLoading(true);
      const [r,n,cmr]=await Promise.all([
        supabase.from("racuni").select("*").order("created_at",{ascending:false}),
        supabase.from("nalogi").select("*"),
        supabase.from("cmr_dokumenti").select("*")
      ]);
      if(r.data)setRacuni(r.data);
      if(n.data)setNalogi(n.data);
      if(cmr.data){
        const map={};
        cmr.data.forEach(d=>{(map[d.nalog_id]||=[]).push(d);});
        setCmrByNalog(map);
      }
      setLoading(false);
    }
    load();
  },[]);

  // Fetch CMR za odprt detail (računi)
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

  // ─── Vsi nalogi computed ───
  const nefaktCount=useMemo(()=>nalogi.filter(n=>!n.fakturirano_bernarda).length,[nalogi]);
  const faktCount=useMemo(()=>nalogi.filter(n=>n.fakturirano_bernarda).length,[nalogi]);

  const nalogiFiltered=useMemo(()=>{
    let items=[...nalogi];
    if(nalogFilter==="nefakturirano")items=items.filter(n=>!n.fakturirano_bernarda).sort((a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0));
    else if(nalogFilter==="fakturirano")items=items.filter(n=>n.fakturirano_bernarda).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
    else items=items.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
    if(nalogSearch.trim()){
      const q=nalogSearch.toLowerCase().trim();
      items=items.filter(n=>[n.stevilka_naloga,n.stranka,n.blago,n.nak_kraj,n.raz_kraj,n.nak_firma,n.raz_firma,n.sq_racun,n.nak_referenca].some(f=>String(f||"").toLowerCase().includes(q)));
    }
    return items;
  },[nalogi,nalogFilter,nalogSearch]);

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

  async function toggleFakturirano(n){
    const nova=!n.fakturirano_bernarda;
    const{error}=await supabase.from("nalogi").update({fakturirano_bernarda:nova}).eq("id",n.id);
    if(!error)setNalogi(prev=>prev.map(x=>x.id===n.id?{...x,fakturirano_bernarda:nova}:x));
  }
  async function shraniSq(nId,val){
    const{error}=await supabase.from("nalogi").update({sq_racun:val||null}).eq("id",nId);
    if(!error)setNalogi(prev=>prev.map(x=>x.id===nId?{...x,sq_racun:val}:x));
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
  const nalogSC={
    nov:{label:"Nov",color:c.muted,bg:"#f8fafc"},
    poslan:{label:"Poslan vozniku",color:c.accent,bg:"#eff6ff"},
    sprejet:{label:"Sprejeto",color:c.orange,bg:"#fffbeb"},
    zakljucen:{label:"Zaključeno",color:c.green,bg:"#f0fdf4"},
    za_fakturo:{label:"Za fakturo",color:"#9333ea",bg:"#faf5ff"},
    fakturirano:{label:"Fakturirano",color:c.green,bg:"#dcfce7"},
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
              <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>MATJAŽ JURJEVEC, s.p. · Bernarda Jurjevec</div>
            </div>
            <div style={{fontSize:11,color:"#94a3b8",textAlign:"right"}}>
              <div>{fmt(new Date().toISOString())}</div>
            </div>
          </div>
          {/* TABS */}
          <div style={{display:"flex",gap:8,marginTop:16}}>
            {[["nalogi","📋 Vsi nalogi"],["racuni","💰 Računi"]].map(([id,lb])=>(
              <button key={id} onClick={()=>setTab(id)} style={{padding:"9px 18px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:tab===id?"#fff":"rgba(255,255,255,0.12)",color:tab===id?c.primary:"#fff"}}>{lb}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"20px 16px"}}>

        {/* ════════ VSI NALOGI ════════ */}
        {tab==="nalogi"&&<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:16}}>
            <div style={{background:c.card,borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:10,color:c.light,textTransform:"uppercase",letterSpacing:1}}>⏳ Še ne fakturirano</div>
              <div style={{fontSize:24,fontWeight:800,color:c.orange,marginTop:4}}>{nefaktCount}</div>
            </div>
            <div style={{background:c.card,borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:10,color:c.light,textTransform:"uppercase",letterSpacing:1}}>✅ Fakturirano</div>
              <div style={{fontSize:24,fontWeight:800,color:c.green,marginTop:4}}>{faktCount}</div>
            </div>
            <div style={{background:c.card,borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:10,color:c.light,textTransform:"uppercase",letterSpacing:1}}>📦 Skupaj nalogov</div>
              <div style={{fontSize:24,fontWeight:800,color:c.accent,marginTop:4}}>{nalogi.length}</div>
            </div>
          </div>

          {/* Iskalnik + filtri */}
          <div style={{background:c.card,borderRadius:12,padding:16,marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <div style={{position:"relative",marginBottom:12}}>
              <input value={nalogSearch} onChange={e=>setNalogSearch(e.target.value)} placeholder="🔍 Išči po stranki, številki, kraju, blagu, SQ št..." style={{width:"100%",padding:"10px 12px",border:`1px solid ${c.border}`,borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              {nalogSearch&&<button onClick={()=>setNalogSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:c.border,border:"none",borderRadius:"50%",width:20,height:20,fontSize:11,cursor:"pointer",color:c.muted}}>✕</button>}
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[["nefakturirano","⏳ Še ne fakturirano ("+nefaktCount+")"],["fakturirano","✅ Fakturirano ("+faktCount+")"],["vsi","Vsi ("+nalogi.length+")"]].map(([v,l])=>(
                <button key={v} onClick={()=>setNalogFilter(v)} style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${nalogFilter===v?c.accent:c.border}`,background:nalogFilter===v?c.accent:"#fff",color:nalogFilter===v?"#fff":c.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>{l}</button>
              ))}
            </div>
          </div>

          {/* Seznam nalogov */}
          {nalogiFiltered.length===0&&<div style={{textAlign:"center",padding:40,color:c.light}}>Ni nalogov.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {nalogiFiltered.map(n=>{
              const sc=nalogSC[n.status]||nalogSC.nov;
              const origUrl=getOriginalUrl(n);
              const cmrArr=cmrByNalog[n.id]||[];
              const zOrig=getZnesekOriginal(n);
              const jeSlo=n.je_slovenska_ddv!==false;
              const osnova=zOrig?parseZnesek(zOrig):0;
              const skupaj=jeSlo?osnova*1.22:osnova;
              const fakt=!!n.fakturirano_bernarda;
              const dniStari=Math.floor((Date.now()-new Date(n.created_at||Date.now()).getTime())/86400000);
              const star=!fakt&&dniStari>=14;
              return(
                <div key={n.id} style={{background:c.card,borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",borderLeft:`4px solid ${fakt?c.green:(star?c.red:c.orange)}`}}>
                  <div onClick={()=>setNalogDetail(n)} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",cursor:"pointer"}}>
                    <div style={{flex:"1 1 280px",minWidth:0}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                        <span style={{fontSize:12,fontFamily:"monospace",fontWeight:700,color:c.accent}}>{n.stevilka_naloga||"—"}</span>
                        <span style={{padding:"2px 8px",borderRadius:10,background:sc.bg,color:sc.color,fontSize:10,fontWeight:700}}>{sc.label}</span>
                        {fakt&&<span style={{padding:"2px 8px",borderRadius:10,background:"#dcfce7",color:c.green,fontSize:10,fontWeight:700}}>✅ Fakturirano</span>}
                        {star&&<span style={{padding:"2px 8px",borderRadius:10,background:dniStari>=30?"#fee2e2":"#fef3c7",color:dniStari>=30?c.red:"#b45309",fontSize:10,fontWeight:700}}>⚠️ {dniStari} dni</span>}
                      </div>
                      <div style={{fontWeight:700,fontSize:15,color:c.primary}}>{n.stranka||"—"}</div>
                      <div style={{fontSize:12,color:c.muted,marginTop:2}}>📍 {n.nak_kraj||"?"} → {n.raz_kraj||"?"}</div>
                      {n.blago&&<div style={{fontSize:11,color:c.light,marginTop:1}}>📦 {n.blago}</div>}
                      {(n.nak_datum||n.raz_datum)&&<div style={{fontSize:11,color:c.light,marginTop:3,display:"flex",gap:10,flexWrap:"wrap"}}>{n.nak_datum&&<span>📅 Nakl: {fmt(n.nak_datum)}</span>}{n.raz_datum&&<span>🏁 Razkl: {fmt(n.raz_datum)}</span>}</div>}
                    </div>
                    {zOrig&&<div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:18,fontWeight:800,color:c.green}}>{skupaj.toFixed(2)} €</div>
                      <div style={{fontSize:10,color:c.light}}>{jeSlo?"z DDV 22%":"reverse charge"}</div>
                    </div>}
                  </div>

                  {/* Akcije */}
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginTop:12,paddingTop:12,borderTop:`1px solid ${c.bgSoft}`}}>
                    <button onClick={()=>natisniDok(origUrl,n.stevilka_naloga)} disabled={!origUrl} style={{padding:"7px 12px",borderRadius:8,border:`1px solid ${origUrl?"#bfdbfe":c.border}`,background:origUrl?"#eff6ff":"#f8fafc",color:origUrl?c.accent:c.light,fontSize:12,fontWeight:700,cursor:origUrl?"pointer":"not-allowed"}}>{origUrl&&!jeTiskljiv(origUrl)?"📄 Prenesi original":"🖨️ Natisni original"}</button>
                    <button onClick={()=>natisniCMRji(cmrArr.map(getCmrUrl),"CMR "+(n.stevilka_naloga||""))} disabled={cmrArr.length===0} style={{padding:"7px 12px",borderRadius:8,border:`1px solid ${cmrArr.length?c.border:c.border}`,background:cmrArr.length?"#f1f5f9":"#f8fafc",color:cmrArr.length?c.primary:c.light,fontSize:12,fontWeight:700,cursor:cmrArr.length?"pointer":"not-allowed"}}>🖨️ Natisni CMR{cmrArr.length>0?` (${cmrArr.length})`:""}</button>
                    <SqInput nalog={n} onSave={shraniSq} c={c}/>
                    <button onClick={()=>toggleFakturirano(n)} style={{padding:"7px 14px",borderRadius:8,border:"none",background:fakt?"#e2e8f0":c.green,color:fakt?c.muted:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",marginLeft:"auto"}}>{fakt?"↩️ Prekliči fakturirano":"☑️ Označi fakturirano"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>}

        {/* ════════ RAČUNI (obstoječi pogled) ════════ */}
        {tab==="racuni"&&<>
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
        </>}
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

              <Section title="🏢 Stranka">
                <div style={{fontWeight:700,fontSize:14,color:c.primary}}>{detail.stranka}</div>
                {(detail.kontaktEmail||detail.kontakt_email)&&<div style={{fontSize:12,color:c.muted,marginTop:3}}>✉️ {detail.kontaktEmail||detail.kontakt_email}</div>}
                {reverseCharge&&<span style={{display:"inline-block",marginTop:6,fontSize:10,background:"#fef3c7",color:"#92400e",padding:"2px 8px",borderRadius:4,fontWeight:600}}>Reverse charge</span>}
              </Section>

              {povezanNalog&&<Section title="🚚 Povezan nalog">
                <div style={{fontFamily:"monospace",fontWeight:700,fontSize:13,color:c.accent}}>{povezanNalog.stevilka_naloga||povezanNalog.id}</div>
                <div style={{fontSize:12,color:c.muted,marginTop:3}}>📍 {povezanNalog.nak_kraj} → {povezanNalog.raz_kraj}</div>
                {povezanNalog.blago&&<div style={{fontSize:11,color:c.light,marginTop:2}}>Blago: {povezanNalog.blago}</div>}
              </Section>}

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

              <Section title="💶 Razčlenitev">
                <div style={{border:`1px solid ${c.border}`,borderRadius:8,overflow:"hidden",fontSize:13}}>
                  <Row label={`Prevoz${povezanNalog?` (${povezanNalog.nak_kraj} → ${povezanNalog.raz_kraj})`:""}`} value={`${osnova.toFixed(2)} €`}/>
                  <Row label="Osnova" value={`${osnova.toFixed(2)} €`} light/>
                  <Row label={`DDV ${reverseCharge?"(reverse charge)":"(22%)"}`} value={`${ddv.toFixed(2)} €`} light/>
                  <Row label="Skupaj" value={`${(detail.znesek||0).toFixed(2)} €`} bold/>
                </div>
              </Section>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                <MiniCard label="📅 Izdan" value={fmt(detail.datum||detail.created_at)}/>
                {detail.datum_placila||detail.datumPlacila?
                  <MiniCard label="✅ Plačano" value={fmt(detail.datum_placila||detail.datumPlacila)} green/>:
                  <MiniCard label="⏳ Status" value="Neplačano"/>}
              </div>

              {(detail.opombe)&&<Section title="📝 Opombe">
                <div style={{fontSize:13,color:c.primary}}>{detail.opombe}</div>
              </Section>}

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

      {/* DETAJL NALOGA (Bernarda) */}
      {nalogDetail&&(()=>{
        const n=nalogDetail;
        const sc=nalogSC[n.status]||nalogSC.nov;
        const origUrl=getOriginalUrl(n);
        const cmrArr=cmrByNalog[n.id]||[];
        const zOrig=getZnesekOriginal(n);
        const jeSlo=n.je_slovenska_ddv!==false;
        const osnova=zOrig?parseZnesek(zOrig):0;
        const skupaj=jeSlo?osnova*1.22:osnova;
        const fakt=!!n.fakturirano_bernarda;
        const RowD=({k,v})=>v?<div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #eef2f6",fontSize:13}}><span style={{color:c.light}}>{k}</span><span style={{color:"#1e293b",fontWeight:600,textAlign:"right"}}>{v}</span></div>:null;
        return(<div style={{position:"fixed",inset:0,zIndex:150,background:"rgba(0,0,0,0.5)",display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"30px 16px",overflowY:"auto"}} onClick={()=>setNalogDetail(null)}>
          <div style={{background:c.card,borderRadius:16,maxWidth:700,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.2)",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:`linear-gradient(135deg, ${c.primary} 0%, #0f2744 100%)`,color:"#fff",padding:"20px 24px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:c.light}}>Nalog</div>
                  <div style={{fontSize:20,fontWeight:800,fontFamily:"monospace",marginTop:2}}>{n.stevilka_naloga||"—"}</div>
                  <div style={{fontSize:15,fontWeight:700,marginTop:8}}>🏢 {n.stranka||"—"}</div>
                  <div style={{marginTop:8,display:"flex",gap:6,flexWrap:"wrap"}}>
                    <span style={{padding:"3px 10px",borderRadius:10,background:sc.bg,color:sc.color,fontSize:11,fontWeight:700}}>{sc.label}</span>
                    {fakt&&<span style={{padding:"3px 10px",borderRadius:10,background:"#dcfce7",color:c.green,fontSize:11,fontWeight:700}}>✅ Fakturirano</span>}
                  </div>
                </div>
                <button onClick={()=>setNalogDetail(null)} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:32,height:32,borderRadius:8,fontSize:16,cursor:"pointer"}}>✕</button>
              </div>
            </div>
            <div style={{padding:"20px 24px"}}>
              <Section title="📍 Naklad">
                <RowD k="Firma" v={n.nak_firma}/>
                <RowD k="Kraj" v={n.nak_kraj}/>
                <RowD k="Naslov" v={n.nak_naslov}/>
                <RowD k="Datum" v={n.nak_datum?(n.nak_cas?`${fmt(n.nak_datum)} ${n.nak_cas}`:fmt(n.nak_datum)):""}/>
                <RowD k="Referenca" v={n.nak_referenca}/>
              </Section>
              <Section title="🏁 Razklad">
                <RowD k="Firma" v={n.raz_firma}/>
                <RowD k="Kraj" v={n.raz_kraj}/>
                <RowD k="Naslov" v={n.raz_naslov}/>
                <RowD k="Datum" v={n.raz_datum?(n.raz_cas?`${fmt(n.raz_datum)} ${n.raz_cas}`:fmt(n.raz_datum)):""}/>
                <RowD k="Referenca" v={n.raz_referenca}/>
              </Section>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Section title="📦 Blago">
                  <div style={{fontSize:13,color:"#1e293b"}}>{n.blago||"—"}{n.kolicina?` · ${n.kolicina}`:""}{n.teza?` · ${n.teza}`:""}</div>
                </Section>
                {zOrig&&<Section title="💶 Cena">
                  <div style={{fontSize:16,fontWeight:800,color:c.green}}>{skupaj.toFixed(2)} €</div>
                  <div style={{fontSize:11,color:c.light}}>{jeSlo?"z DDV 22%":"reverse charge"}</div>
                </Section>}
              </div>
              {n.navodila&&<Section title="⚠️ Navodila">
                <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:10,fontSize:13,color:"#78350f",whiteSpace:"pre-wrap"}}>{n.navodila}</div>
              </Section>}
              {n.sq_racun&&<Section title="🧾 Št. računa (SQ Trans)">
                <div style={{fontFamily:"monospace",fontWeight:700,fontSize:14,color:c.accent}}>{n.sq_racun}</div>
              </Section>}
              {origUrl&&<Section title="📄 Original nalog">
                <a href={origUrl} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:12,background:c.bgSoft,border:`1px solid ${c.border}`,borderRadius:8,padding:12,textDecoration:"none",color:"inherit"}}>
                  <div style={{width:36,height:36,borderRadius:6,background:"#fef2f2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📄</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,color:c.primary}}>{decodeURIComponent(origUrl.split("/").pop()||"nalog")}</div>
                    <div style={{fontSize:11,color:c.muted}}>Odpri ↗</div>
                  </div>
                </a>
              </Section>}
              {cmrArr.length>0&&<Section title={`📎 CMR dokumenti (${cmrArr.length})`}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:8}}>
                  {cmrArr.map(cmr=>{
                    const url=getCmrUrl(cmr);
                    const isImg=/\.(jpg|jpeg|png|webp|gif)$/i.test(cmr.ime_datoteke||"");
                    return(<div key={cmr.id} onClick={()=>{if(isImg&&url)setImgPreview(url);else if(url)window.open(url,"_blank");}} style={{background:c.bgSoft,border:`1px solid ${c.border}`,borderRadius:8,padding:4,cursor:"pointer",textAlign:"center"}}>
                      {isImg&&url?<img src={url} alt="" style={{width:"100%",height:70,objectFit:"cover",borderRadius:4}}/>:<div style={{height:70,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📄</div>}
                      <div style={{fontSize:9,color:c.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:3}}>{cmr.ime_datoteke}</div>
                    </div>);
                  })}
                </div>
              </Section>}
              <div style={{display:"flex",gap:8,flexWrap:"wrap",paddingTop:12,borderTop:`1px solid ${c.border}`}}>
                <button onClick={()=>natisniDok(origUrl,n.stevilka_naloga)} disabled={!origUrl} style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${origUrl?"#bfdbfe":c.border}`,background:origUrl?"#eff6ff":"#f8fafc",color:origUrl?c.accent:c.light,fontSize:12,fontWeight:700,cursor:origUrl?"pointer":"not-allowed"}}>{origUrl&&!jeTiskljiv(origUrl)?"📄 Prenesi original":"🖨️ Natisni original"}</button>
                <button onClick={()=>natisniCMRji(cmrArr.map(getCmrUrl),"CMR "+(n.stevilka_naloga||""))} disabled={cmrArr.length===0} style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${c.border}`,background:cmrArr.length?"#f1f5f9":"#f8fafc",color:cmrArr.length?c.primary:c.light,fontSize:12,fontWeight:700,cursor:cmrArr.length?"pointer":"not-allowed"}}>🖨️ Natisni CMR{cmrArr.length>0?` (${cmrArr.length})`:""}</button>
                <button onClick={()=>{toggleFakturirano(n);setNalogDetail(d=>d?{...d,fakturirano_bernarda:!d.fakturirano_bernarda}:d);}} style={{padding:"8px 16px",borderRadius:8,border:"none",background:fakt?"#e2e8f0":c.green,color:fakt?c.muted:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",marginLeft:"auto"}}>{fakt?"↩️ Prekliči fakturirano":"☑️ Označi fakturirano"}</button>
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
function SqInput({nalog,onSave,c}){
  const [v,setV]=useState(nalog.sq_racun||"");
  useEffect(()=>{setV(nalog.sq_racun||"");},[nalog.id]);
  return(
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <span style={{fontSize:11,color:c.muted,fontWeight:600}}>SQ št.:</span>
      <input value={v} onChange={e=>setV(e.target.value)} onBlur={()=>{if(v!==(nalog.sq_racun||""))onSave(nalog.id,v);}} placeholder="—" style={{width:120,padding:"6px 8px",border:`1px solid ${c.border}`,borderRadius:6,fontSize:12,outline:"none",fontFamily:"monospace"}}/>
    </div>
  );
}

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
