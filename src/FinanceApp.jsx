import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://yxaqnvxihfxhpebsgflc.supabase.co",
  "sb_publishable_MK8IOnYCZKYC_gggJCZjFw_ypRV5wWm"
);

function fmt(d){if(!d)return"—";try{return new Date(d).toLocaleDateString("sl-SI",{day:"2-digit",month:"2-digit",year:"numeric"})}catch{return"—"}}
function parseZnesek(s){if(!s)return 0;if(typeof s==="number")return s;let n=String(s).replace(/[^\d,.\s]/g," ").trim().replace(/\s/g,"").replace(/\.(?=\d{3}(\D|$))/g,"").replace(",",".");return parseFloat(n)||0}
function izvleciEmail(t){if(!t)return"";const m=t.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);return m?m[0]:""}

export default function FinanceApp(){
  const [nalogi,setNalogi]=useState([]);
  const [cmrDocs,setCmrDocs]=useState({});
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [tab,setTab]=useState("za_fakturo");
  const [detail,setDetail]=useState(null);
  const [imgPreview,setImgPreview]=useState(null);
  const [cmrLoading,setCmrLoading]=useState(false);

  useEffect(()=>{
    async function load(){
      setLoading(true);
      const{data}=await supabase.from("nalogi").select("*").in("status",["za_fakturo","fakturirano"]).order("created_at",{ascending:false});
      if(data)setNalogi(data);
      setLoading(false);
    }
    load();
  },[]);

  useEffect(()=>{
    if(!detail?.id)return;
    if(cmrDocs[detail.id])return;
    setCmrLoading(true);
    supabase.from("cmr_dokumenti").select("*").eq("nalog_id",detail.id).order("created_at",{ascending:false}).then(({data})=>{
      if(data)setCmrDocs(prev=>({...prev,[detail.id]:data}));
      setCmrLoading(false);
    });
  },[detail?.id]);

  const cmrList=useMemo(()=>detail?.id?cmrDocs[detail.id]||[]:[], [detail?.id,cmrDocs]);
  const zaFakturo=useMemo(()=>nalogi.filter(n=>n.status==="za_fakturo"),[nalogi]);
  const fakturirano=useMemo(()=>nalogi.filter(n=>n.status==="fakturirano"),[nalogi]);

  const filtered=useMemo(()=>{
    const items=tab==="za_fakturo"?zaFakturo:fakturirano;
    if(!search.trim())return items;
    const q=search.toLowerCase().trim();
    return items.filter(n=>
      (n.stranka||"").toLowerCase().includes(q)||
      (n.stevilka_naloga||"").toLowerCase().includes(q)||
      (n.nak_referenca||"").toLowerCase().includes(q)||
      (n.nak_kraj||"").toLowerCase().includes(q)||
      (n.raz_kraj||"").toLowerCase().includes(q)
    );
  },[tab,zaFakturo,fakturirano,search]);

  async function oznaciFakturirano(id){
    const{error}=await supabase.from("nalogi").update({status:"fakturirano"}).eq("id",id);
    if(!error){setNalogi(prev=>prev.map(n=>n.id===id?{...n,status:"fakturirano"}:n));setDetail(null);}
  }

  async function vrniNaZaFakturo(id){
    const{error}=await supabase.from("nalogi").update({status:"za_fakturo"}).eq("id",id);
    if(!error){setNalogi(prev=>prev.map(n=>n.id===id?{...n,status:"za_fakturo"}:n));setDetail(null);}
  }

  function getCmrUrl(cmr){
    if(!cmr?.storage_pot)return null;
    if(cmr.storage_pot.startsWith("http"))return cmr.storage_pot;
    const{data}=supabase.storage.from("cmr-dokumenti").getPublicUrl(cmr.storage_pot);
    return data?.publicUrl||null;
  }

  // Print helper za CMR sliko
  function printSliko(url){
    const w=window.open("","_blank","width=800,height=900");
    if(!w){alert("Brskalnik blokira pop-up okna. Dovoli pop-up za to stran.");return;}
    w.document.write(`<html><head><title>CMR dokument</title><style>body{margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}img{max-width:100%;max-height:100vh;object-fit:contain}@media print{body{padding:0}img{max-width:100%;page-break-inside:avoid}}</style></head><body><img src="${url}" onload="window.print();"/></body></html>`);
    w.document.close();
  }

  if(loading)return(
    <div style={{minHeight:"100vh",background:"#f0f2f5",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:12}}>📋</div>
        <div style={{fontSize:15,color:"#64748b"}}>Nalagam podatke...</div>
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:"#f0f2f5",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      {/* HEADER */}
      <div style={{background:"linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)",color:"#fff",padding:"16px 24px"}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:20,fontWeight:800}}>📋 Dokumenti za fakturiranje</div>
            <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>MATJAŽ JURJEVEC, s.p.</div>
          </div>
          <div style={{fontSize:11,color:"#94a3b8",textAlign:"right"}}>
            <div>Bernarda Jurjevec</div>
            <div>{fmt(new Date().toISOString())}</div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:900,margin:"0 auto",padding:"20px 16px"}}>
        {/* ŠTEVEC */}
        <div style={{display:"flex",gap:12,marginBottom:20}}>
          <div style={{flex:1,background:"#fff",borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",textAlign:"center"}}>
            <div style={{fontSize:24,fontWeight:800,color:"#d97706"}}>{zaFakturo.length}</div>
            <div style={{fontSize:11,color:"#94a3b8"}}>Za fakturiranje</div>
          </div>
          <div style={{flex:1,background:"#fff",borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",textAlign:"center"}}>
            <div style={{fontSize:24,fontWeight:800,color:"#16a34a"}}>{fakturirano.length}</div>
            <div style={{fontSize:11,color:"#94a3b8"}}>Fakturirano</div>
          </div>
        </div>

        {/* TABS */}
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <button onClick={()=>setTab("za_fakturo")} style={{padding:"10px 20px",borderRadius:10,border:"none",background:tab==="za_fakturo"?"#d97706":"#fff",color:tab==="za_fakturo"?"#fff":"#64748b",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            📋 Za fakturiranje ({zaFakturo.length})
          </button>
          <button onClick={()=>setTab("fakturirano")} style={{padding:"10px 20px",borderRadius:10,border:"none",background:tab==="fakturirano"?"#16a34a":"#fff",color:tab==="fakturirano"?"#fff":"#64748b",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            ✅ Fakturirano ({fakturirano.length})
          </button>
          <button onClick={()=>setTab("obracuni")} style={{padding:"10px 20px",borderRadius:10,border:"none",background:tab==="obracuni"?"#1d4ed8":"#fff",color:tab==="obracuni"?"#fff":"#64748b",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            💶 Obračuni
          </button>
          <button onClick={()=>setTab("dopusti")} style={{padding:"10px 20px",borderRadius:10,border:"none",background:tab==="dopusti"?"#15803d":"#fff",color:tab==="dopusti"?"#fff":"#64748b",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            🌴 Dopusti
          </button>
        </div>

        {(tab === "za_fakturo" || tab === "fakturirano") && <>
        {/* ISKALNIK */}
        <div style={{position:"relative",marginBottom:16}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Išči po stranki, številki naloga, referenci, kraju..." style={{width:"100%",padding:"10px 14px",border:"1px solid #e2e8f0",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box",background:"#fff"}}/>
          {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"#e2e8f0",border:"none",borderRadius:"50%",width:20,height:20,fontSize:11,cursor:"pointer",color:"#64748b"}}>✕</button>}
        </div>

        {/* SEZNAM */}
        {filtered.length===0&&<div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>{tab==="za_fakturo"?"Vse fakturirano! 🎉":"Ni fakturiranih nalogov."}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(n=>{
            const zOrig=n.znesek_original?parseZnesek(n.znesek_original):null;
            const ref=n.nak_referenca||null;
            const email=n.navodila?izvleciEmail(n.navodila):"";
            const jeSloDdv=n.je_slovenska_ddv!==false;
            return(
              <div key={n.id} onClick={()=>setDetail(n)} style={{background:"#fff",borderRadius:12,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",transition:"all 0.15s",borderLeft:`4px solid ${tab==="za_fakturo"?"#d97706":"#16a34a"}`}} onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.1)"} onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)"}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>{n.stranka}</div>
                    <div style={{fontSize:12,color:"#64748b",marginTop:3}}>
                      <span style={{fontFamily:"monospace",fontWeight:600,color:"#2563eb"}}>{n.stevilka_naloga}</span>
                      <span style={{margin:"0 6px"}}>·</span>
                      {n.nak_kraj} → {n.raz_kraj}
                    </div>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:5}}>
                      {ref&&<span style={{fontSize:11,color:"#64748b"}}>📋 Ref: <span style={{fontFamily:"monospace",fontWeight:600,color:"#2563eb"}}>{ref}</span></span>}
                      {email&&<span style={{fontSize:11,color:"#64748b"}}>✉️ {email}</span>}
                      {n.original_pdf_url&&<span style={{fontSize:11,color:"#16a34a",fontWeight:600}}>📄 PDF</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    {zOrig&&<div style={{fontSize:18,fontWeight:800,color:"#0f2744"}}>{zOrig.toFixed(2)} €</div>}
                    {zOrig&&jeSloDdv&&<div style={{fontSize:10,color:"#d97706"}}>+ 22% DDV</div>}
                    {zOrig&&!jeSloDdv&&<div style={{fontSize:10,color:"#64748b"}}>reverse charge</div>}
                    <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>{fmt(n.created_at)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>}
        {tab === "obracuni" && <ObracuniPanel/>}
        {tab === "dopusti" && <DopustiPanel/>}
      </div>

      {/* DETAIL MODAL */}
      {detail&&(()=>{
        const ref=detail.nak_referenca||null;
        const email=detail.navodila?izvleciEmail(detail.navodila):"";
        const zOrig=detail.znesek_original?parseZnesek(detail.znesek_original):null;
        const jeSloDdv=detail.je_slovenska_ddv!==false;
        const originalUrl=detail.original_pdf_url||null;

        return(<div style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.5)",display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"24px 16px",overflowY:"auto"}} onClick={()=>setDetail(null)}>
          <div style={{background:"#fff",borderRadius:16,maxWidth:800,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.2)",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>

            {/* Header */}
            <div style={{background:"linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)",color:"#fff",padding:"20px 24px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8"}}>Nalog za fakturiranje</div>
                  <div style={{fontSize:20,fontWeight:800,marginTop:2}}>{detail.stranka}</div>
                  <div style={{fontSize:13,color:"#94a3b8",marginTop:4,fontFamily:"monospace"}}>{detail.stevilka_naloga}</div>
                  {ref&&<div style={{marginTop:4,fontSize:12,color:"#94a3b8"}}>📋 Ref: <span style={{color:"#fbbf24",fontWeight:700}}>{ref}</span></div>}
                </div>
                <button onClick={()=>setDetail(null)} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:32,height:32,borderRadius:8,fontSize:16,cursor:"pointer"}}>✕</button>
              </div>
            </div>

            <div style={{padding:"20px 24px"}}>
              {/* NAKLAD / RAZKLAD */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
                <InfoCard label="📍 Naklad" value={`${detail.nak_firma||""}\n${detail.nak_naslov||""}\n${detail.nak_kraj||""}`} sub={`Datum: ${fmt(detail.nak_datum)}`}/>
                <InfoCard label="📍 Razklad" value={`${detail.raz_firma||""}\n${detail.raz_naslov||""}\n${detail.raz_kraj||""}`} sub={`Datum: ${fmt(detail.raz_datum)}`}/>
              </div>

              {/* BLAGO + CENA */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
                <InfoCard label="📦 Blago" value={detail.blago||"—"} sub={`Količina: ${detail.kolicina||"—"} · Teža: ${detail.teza||"—"} kg`}/>
                <div style={{background:"#f8fafc",borderRadius:10,padding:14}}>
                  <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8",marginBottom:6}}>💶 Cena iz naloga</div>
                  {zOrig?<>
                    <div style={{fontSize:24,fontWeight:800,color:"#0f2744"}}>{zOrig.toFixed(2)} €</div>
                    <div style={{fontSize:12,color:jeSloDdv?"#d97706":"#64748b",fontWeight:600,marginTop:2}}>
                      {jeSloDdv?`+ 22% DDV = ${(zOrig*1.22).toFixed(2)} €`:"Reverse charge (brez DDV)"}
                    </div>
                  </>:<div style={{fontSize:14,color:"#94a3b8",fontStyle:"italic"}}>Ni cene v nalogu</div>}
                </div>
              </div>

              {/* NAVODILA */}
              {(email||detail.navodila)&&<div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:14,marginBottom:20}}>
                <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#92400e",marginBottom:6,fontWeight:700}}>⚠️ Navodila za fakturiranje</div>
                {email&&<div style={{fontSize:13,color:"#0f2744",fontWeight:700,marginBottom:4}}>✉️ Račun pošlji na: <span style={{color:"#2563eb"}}>{email}</span></div>}
                {detail.navodila&&<div style={{fontSize:12,color:"#78350f",whiteSpace:"pre-wrap",lineHeight:1.5}}>{detail.navodila}</div>}
              </div>}

              {/* DOKUMENTI */}
              <div style={{fontSize:14,fontWeight:700,color:"#0f2744",marginBottom:12,paddingBottom:8,borderBottom:"2px solid #e2e8f0"}}>📎 Dokumenti</div>

              {/* Original PDF */}
              {originalUrl?<a href={originalUrl} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:14,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:14,textDecoration:"none",color:"inherit",marginBottom:10,transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.background="#eff6ff";e.currentTarget.style.borderColor="#2563eb";}} onMouseLeave={e=>{e.currentTarget.style.background="#f8fafc";e.currentTarget.style.borderColor="#e2e8f0";}}>
                <div style={{width:44,height:44,borderRadius:8,background:"#fef2f2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>📄</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#0f2744"}}>Original nalog (PDF)</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{decodeURIComponent(originalUrl.split("/").pop()||"nalog.pdf")}</div>
                </div>
                <div style={{fontSize:12,color:"#2563eb",fontWeight:600,flexShrink:0}}>Odpri ↗</div>
              </a>:
              <div style={{background:"#fef2f2",border:"1px dashed #fecaca",borderRadius:10,padding:14,marginBottom:10,textAlign:"center",fontSize:12,color:"#dc2626"}}>
                ⚠️ Original nalog ni naložen
              </div>}

              {/* CMR */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:8}}>CMR dokumenti {cmrList.length>0&&`(${cmrList.length})`}</div>
                {cmrLoading?<div style={{textAlign:"center",padding:16,color:"#94a3b8",fontSize:12}}>Nalagam CMR...</div>:
                  cmrList.length===0?<div style={{background:"#fef2f2",border:"1px dashed #fecaca",borderRadius:10,padding:14,textAlign:"center",fontSize:12,color:"#dc2626"}}>
                    ⚠️ Šofer še ni naložil CMR dokumenta
                  </div>:
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8}}>
                    {cmrList.map(cmr=>{
                      const url=getCmrUrl(cmr);
                      const isImg=/\.(jpg|jpeg|png|webp|gif)$/i.test(cmr.ime_datoteke||"");
                      return(<div key={cmr.id} onClick={()=>{if(isImg&&url)setImgPreview(url);else if(url)window.open(url,"_blank");}} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:6,cursor:"pointer",textAlign:"center",transition:"all 0.15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="#2563eb"} onMouseLeave={e=>e.currentTarget.style.borderColor="#e2e8f0"}>
                        {isImg&&url?<img src={url} alt="" style={{width:"100%",height:80,objectFit:"cover",borderRadius:4}} onError={e=>{e.target.style.display="none"}}/>:
                          <div style={{height:80,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>📄</div>}
                        <div style={{fontSize:9,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:3}}>{cmr.ime_datoteke}</div>
                      </div>);
                    })}
                  </div>}
              </div>

              {/* GUMB */}
              <div style={{display:"flex",gap:8,paddingTop:16,borderTop:"1px solid #e2e8f0"}}>
                {detail.status==="za_fakturo"&&<button onClick={()=>oznaciFakturirano(detail.id)} style={{flex:1,padding:"12px 20px",borderRadius:10,border:"none",background:"#16a34a",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background="#15803d"} onMouseLeave={e=>e.currentTarget.style.background="#16a34a"}>
                  ✅ Račun napisan — označi kot fakturirano
                </button>}
                {detail.status==="fakturirano"&&<button onClick={()=>vrniNaZaFakturo(detail.id)} style={{flex:1,padding:"12px 20px",borderRadius:10,border:"1px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                  ↩️ Vrni nazaj na "za fakturiranje"
                </button>}
              </div>
            </div>
          </div>
        </div>);
      })()}

      {/* Lightbox z gumbi: Print, Download, Open in new tab */}
      {imgPreview&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setImgPreview(null)}>
        <img src={imgPreview} alt="CMR preview" style={{maxWidth:"95%",maxHeight:"85vh",objectFit:"contain",borderRadius:8,boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}/>
        {/* Action buttons */}
        <div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",display:"flex",gap:10,background:"rgba(0,0,0,0.6)",padding:"10px 14px",borderRadius:30,backdropFilter:"blur(10px)"}} onClick={e=>e.stopPropagation()}>
          <button
            style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:20,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
            onClick={()=>printSliko(imgPreview)}
          >🖨️ Natisni</button>
          <a
            href={imgPreview}
            download={`CMR-${Date.now()}.jpg`}
            style={{background:"#16a34a",color:"#fff",border:"none",borderRadius:20,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,textDecoration:"none"}}
            onClick={e=>e.stopPropagation()}
          >⬇️ Prenesi</a>
          <a
            href={imgPreview}
            target="_blank"
            rel="noopener noreferrer"
            style={{background:"rgba(255,255,255,0.2)",color:"#fff",border:"none",borderRadius:20,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,textDecoration:"none"}}
            onClick={e=>e.stopPropagation()}
          >🔗 Nov zavihek</a>
        </div>
        <button style={{position:"absolute",top:20,right:20,background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",width:40,height:40,borderRadius:20,fontSize:18,cursor:"pointer"}} onClick={()=>setImgPreview(null)}>✕</button>
      </div>}
    </div>
  );
}

function ObracuniPanel(){
  const [obracuni,setObracuni]=useState([]);
  const [loading,setLoading]=useState(true);
  const [selOb,setSelOb]=useState(null);
  const [filter,setFilter]=useState("vsi");
  const [search,setSearch]=useState("");
  const [mesec,setMesec]=useState(()=>new Date().toISOString().slice(0,7));
  const [odprtiVozniki,setOdprtiVozniki]=useState({});

  useEffect(()=>{
    setLoading(true);
    supabase.from("tedenski_obracuni").select("*, vozniki(id,ime,priimek,vozilo)").order("datum_od",{ascending:false}).then(({data})=>{
      if(data)setObracuni(data);
      setLoading(false);
    });
  },[]);

  const TARIFA_KM=0.185;
  const TARIFA_STR=20;
  const TARIFA_DOPUST=40;
  const MESECI_IMENA=["Januar","Februar","Marec","April","Maj","Junij","Julij","Avgust","September","Oktober","November","December"];
  const mesecLabel=(ym)=>{const[y,m]=ym.split("-");return`${MESECI_IMENA[parseInt(m,10)-1]} ${y}`;};
  const razpolozljiviMeseci=[...new Set(obracuni.map(o=>(o.datum_od||"").slice(0,7)).filter(Boolean))].sort().reverse();

  const filtered=obracuni.filter(o=>{
    if(mesec!=="vsi" && (o.datum_od||"").slice(0,7)!==mesec) return false;
    if(filter==="osnutek" && o.status!=="osnutek") return false;
    if(filter==="poslan" && o.status!=="poslan") return false;
    if(!search.trim()) return true;
    const q=search.toLowerCase();
    const v=o.vozniki;
    const ime=v?`${v.ime} ${v.priimek}`.toLowerCase():"";
    const vozilo=v?.vozilo?.toLowerCase()||"";
    return ime.includes(q)||vozilo.includes(q);
  });

  const skupajKm=filtered.reduce((a,o)=>a+(o.km_prevozeni||0),0);
  const skupajZnesek=filtered.reduce((a,o)=>a+(o.sestevek||0),0);

  if(selOb){
    const o=selOb;
    const v=o.vozniki;
    const prevozi=o.prevozi||[];
    const tankanja=o.tankanja||[];
    const stroski=o.drugi_stroski||[];
    const zaslKm=(o.km_prevozeni||0)*TARIFA_KM;
    const zaslStr=(o.stevilo_strank||0)*TARIFA_STR;
    const zaslDop=(o.dopust_dni||0)*TARIFA_DOPUST;
    const zaslStr2=stroski.reduce((a,x)=>a+(parseFloat(x.znesek)||0),0);

    return(
      <div>
        <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } html,body { margin:0; padding:0; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; } body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: absolute; left: 0; top: 0; width: 190mm; max-width: 190mm; box-sizing: border-box; padding: 0; margin: 0; -webkit-print-color-adjust:exact; print-color-adjust:exact; } .print-area * { box-sizing: border-box !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; } .no-print { display: none !important; } }`}</style>

        <div className="no-print" style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
          <button onClick={()=>setSelOb(null)} style={{padding:"8px 14px",borderRadius:10,border:"1px solid #e2e8f0",background:"#fff",fontSize:13,fontWeight:600,color:"#64748b",cursor:"pointer"}}>← Nazaj</button>
          <button onClick={()=>window.print()} style={{marginLeft:"auto",padding:"8px 16px",borderRadius:10,border:"none",background:"#16a34a",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>🖨️ Natisni / PDF</button>
        </div>

        <div className="print-area">
          <div style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:18,color:"#fff",marginBottom:14}}>
            <div style={{fontSize:18,fontWeight:800}}>{v?`${v.ime} ${v.priimek}`:"Voznik"}</div>
            <div style={{fontSize:12,opacity:0.7,marginTop:2}}>{v?.vozilo||""} · {fmt(o.datum_od)} – {fmt(o.datum_do)}</div>
            <div style={{fontSize:10,marginTop:6,padding:"3px 10px",borderRadius:20,display:"inline-block",background:o.status==="poslan"?"rgba(22,163,74,0.3)":"rgba(255,255,255,0.15)",color:o.status==="poslan"?"#86efac":"#fff"}}>{o.status==="poslan"?"✅ Poslan":"⏳ Osnutek"}</div>
          </div>

          <Sec2 title="🛣️ Kilometri">
            <R2 label="Začetni km" val={o.km_zacetek?.toLocaleString()||"–"}/>
            <R2 label="Končni km" val={o.km_konec?.toLocaleString()||"–"}/>
            <R2 label="Prevoženi km" val={`${(o.km_prevozeni||0).toLocaleString()} km`} bold/>
            <R2 label={`× ${TARIFA_KM} €`} val={`${zaslKm.toFixed(2)} €`} bold/>
          </Sec2>

          <Sec2 title="👥 Stranke">
            <R2 label="Število strank" val={o.stevilo_strank||0}/>
            <R2 label={`× ${TARIFA_STR} €`} val={`${zaslStr.toFixed(2)} €`} bold/>
          </Sec2>

          {prevozi.length>0 && <Sec2 title="🚛 Prevozi">
            {prevozi.map((p,i)=><R2 key={i} label={`#${p.st||i+1}`} val={`${p.nakKraj||""} → ${p.razKraj||""}`}/>)}
          </Sec2>}

          {tankanja.length>0 && <Sec2 title="⛽ Tankanja">
            {tankanja.map((t,i)=><R2 key={i} label={t.dan?fmt(t.dan):`#${i+1}`} val={`${t.kolicina||"?"} L · ${t.lokacija||"?"}`}/>)}
          </Sec2>}

          {(o.dopust_dni>0||o.bolniska_dni>0||o.cakanje_opis) && <Sec2 title="📋 Ostalo">
            {o.dopust_dni>0 && <R2 label="Dopust" val={`${o.dopust_dni} dni × ${TARIFA_DOPUST} € = ${zaslDop.toFixed(2)} €`}/>}
            {o.bolniska_dni>0 && <R2 label="Bolniška" val={`${o.bolniska_dni} dni`}/>}
            {o.cakanje_opis && <R2 label="Čakanje" val={o.cakanje_opis}/>}
          </Sec2>}

          {stroski.length>0 && <Sec2 title="🧾 Drugi stroški">
            {stroski.map((x,i)=><R2 key={i} label={x.opis||"Strošek"} val={`${parseFloat(x.znesek).toFixed(2)} €`}/>)}
          </Sec2>}

          <div style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:18,color:"#fff",marginTop:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:14,opacity:0.85,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
              <span>Km ({(o.km_prevozeni||0).toLocaleString()} × {TARIFA_KM} €)</span>
              <span>{zaslKm.toFixed(2)} €</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:14,opacity:0.85,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
              <span>Stranke ({o.stevilo_strank||0} × {TARIFA_STR} €)</span>
              <span>{zaslStr.toFixed(2)} €</span>
            </div>
            {zaslDop>0 && <div style={{display:"flex",justifyContent:"space-between",fontSize:14,opacity:0.85,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
              <span>Dopust</span>
              <span>{zaslDop.toFixed(2)} €</span>
            </div>}
            {zaslStr2>0 && <div style={{display:"flex",justifyContent:"space-between",fontSize:14,opacity:0.85,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
              <span>Drugi stroški</span>
              <span>+ {zaslStr2.toFixed(2)} €</span>
            </div>}
            <div style={{display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:22,paddingTop:12}}>
              <span>SEŠTEVEK</span>
              <span>{(o.sestevek||0).toFixed(2)} €</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:16,color:"#0f2744"}}>💶 Obračuni voznikov</div>
      </div>

      <div style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:"16px 20px",marginBottom:14,color:"#fff",display:"flex",justifyContent:"space-around"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:800}}>{filtered.length}</div>
          <div style={{fontSize:11,opacity:0.7}}>Obračunov</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:800}}>{skupajKm.toLocaleString()} km</div>
          <div style={{fontSize:11,opacity:0.7}}>Skupaj km</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:800,color:"#86efac"}}>{skupajZnesek.toFixed(0)} €</div>
          <div style={{fontSize:11,opacity:0.7}}>Za izplačilo</div>
        </div>
      </div>

      <div style={{position:"relative",marginBottom:10}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Išči po vozniku ali vozilu..." style={{width:"100%",padding:"10px 14px",border:"1px solid #e2e8f0",borderRadius:10,fontSize:13,outline:"none",boxSizing:"border-box",background:"#fff"}}/>
        {search && <button onClick={()=>setSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"#e2e8f0",border:"none",borderRadius:"50%",width:20,height:20,fontSize:11,cursor:"pointer",color:"#64748b"}}>✕</button>}
      </div>

      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",overflowX:"auto"}}>
        <button onClick={()=>setMesec("vsi")} style={{padding:"6px 12px",borderRadius:20,border:"1.5px solid #e2e8f0",background:mesec==="vsi"?"#0f2744":"#fff",color:mesec==="vsi"?"#fff":"#475569",fontSize:12,fontWeight:mesec==="vsi"?700:500,cursor:"pointer",whiteSpace:"nowrap"}}>📅 Vsi meseci</button>
        {razpolozljiviMeseci.map(ym=>(
          <button key={ym} onClick={()=>setMesec(ym)} style={{padding:"6px 12px",borderRadius:20,border:"1.5px solid #e2e8f0",background:mesec===ym?"#0f2744":"#fff",color:mesec===ym?"#fff":"#475569",fontSize:12,fontWeight:mesec===ym?700:500,cursor:"pointer",whiteSpace:"nowrap"}}>{mesecLabel(ym)}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {[["vsi","Vsi"],["poslan","✅ Poslani"],["osnutek","⏳ Osnutki"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{padding:"6px 12px",borderRadius:20,border:"1.5px solid #e2e8f0",background:filter===v?"#0f2744":"#fff",color:filter===v?"#fff":"#475569",fontSize:12,fontWeight:filter===v?700:500,cursor:"pointer"}}>{l}</button>
        ))}
      </div>

      {loading && <div style={{textAlign:"center",padding:20,color:"#94a3b8"}}>⏳ Nalagam...</div>}
      {!loading && filtered.length===0 && <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Ni obračunov za prikaz.</div>}
      {!loading && filtered.length>0 && (()=>{
        const skupine={};
        filtered.forEach(o=>{
          const vid=o.voznik_id||o.vozniki?.id||"neznan";
          if(!skupine[vid]) skupine[vid]={voznik:o.vozniki,obracuni:[]};
          skupine[vid].obracuni.push(o);
        });
        const stEnota=(n)=>n===1?"obračun":n===2?"obračuna":n<5?"obračuni":"obračunov";
        const seznam=Object.entries(skupine).map(([vid,g])=>({
          vid, voznik:g.voznik,
          obracuni:g.obracuni.sort((a,b)=>(b.datum_od||"").localeCompare(a.datum_od||"")),
          skupajZnesek:g.obracuni.reduce((a,o)=>a+(o.sestevek||0),0),
          skupajKm:g.obracuni.reduce((a,o)=>a+(o.km_prevozeni||0),0),
        })).sort((a,b)=>{
          const an=a.voznik?`${a.voznik.ime} ${a.voznik.priimek}`:""; const bn=b.voznik?`${b.voznik.ime} ${b.voznik.priimek}`:"";
          return an.localeCompare(bn);
        });
        return seznam.map(g=>{
          const odprt=odprtiVozniki[g.vid];
          const v=g.voznik;
          return(<div key={g.vid} style={{background:"#fff",borderRadius:12,marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",overflow:"hidden"}}>
            <button onClick={()=>setOdprtiVozniki(p=>({...p,[g.vid]:!p[g.vid]}))} style={{width:"100%",background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#0f2744,#1d4ed8)",color:"#fff",fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{v?v.ime.charAt(0):"?"}</div>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>{v?`${v.ime} ${v.priimek}`:"Voznik"} <span style={{fontSize:11,color:"#94a3b8",fontWeight:500}}>· {v?.vozilo||""}</span></div>
                  <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{g.obracuni.length} {stEnota(g.obracuni.length)} · {g.skupajKm.toLocaleString()} km</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{fontWeight:800,fontSize:17,color:"#16a34a"}}>{g.skupajZnesek.toFixed(2)} €</div>
                <span style={{fontSize:16,color:"#94a3b8",display:"inline-block",transform:odprt?"rotate(180deg)":"none",transition:"transform 0.15s"}}>▼</span>
              </div>
            </button>
            {odprt&&<div style={{borderTop:"1px solid #f1f5f9"}}>
              {g.obracuni.map(o=>(
                <button key={o.id} onClick={()=>setSelOb(o)} style={{width:"100%",background:"#f8fafc",border:"none",borderBottom:"1px solid #f1f5f9",cursor:"pointer",textAlign:"left",padding:"11px 16px 11px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderLeft:`4px solid ${o.status==="poslan"?"#16a34a":"#d97706"}`}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"#0f2744"}}>{fmt(o.datum_od)} – {fmt(o.datum_do)}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{(o.km_prevozeni||0).toLocaleString()} km · {o.stevilo_strank||0} strank · {o.status==="poslan"?"✅ Poslan":"⏳ Osnutek"}</div>
                  </div>
                  <div style={{fontWeight:700,fontSize:15,color:"#16a34a"}}>{(o.sestevek||0).toFixed(2)} €</div>
                </button>
              ))}
            </div>}
          </div>);
        });
      })()}
    </div>
  );
}

function Sec2({title,children}){
  return(<div style={{background:"#fff",borderRadius:12,padding:"13px 14px",marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
    <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>{title}</div>
    {children}
  </div>);
}

function R2({label,val,bold}){
  return(<div style={{display:"flex",justifyContent:"space-between",paddingBottom:5,marginBottom:5,borderBottom:"1px solid #f8fafc"}}>
    <span style={{fontSize:12,color:"#94a3b8"}}>{label}</span>
    <span style={{fontSize:13,color:"#1e293b",textAlign:"right",...(bold?{fontWeight:700,color:"#0f2744"}:{})}}>{val||"–"}</span>
  </div>);
}

function DopustiPanel(){
  const [dopusti,setDopusti]=useState([]);
  const [vozniki,setVozniki]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({voznik_id:"",datum_od:"",datum_do:"",opomba:""});
  const [saving,setSaving]=useState(false);
  const [showPretekli,setShowPretekli]=useState(false);

  async function load(){
    setLoading(true);
    const [{data:dop},{data:voz}]=await Promise.all([
      supabase.from("dopusti").select("*").order("datum_od",{ascending:false}),
      supabase.from("vozniki").select("id,ime,priimek,vozilo").eq("aktiven",true).order("priimek"),
    ]);
    if(dop)setDopusti(dop);
    if(voz)setVozniki(voz);
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  const danes=new Date().toISOString().slice(0,10);
  const trenutni=dopusti.filter(d=>d.datum_od<=danes&&d.datum_do>=danes);
  const prihodnji=dopusti.filter(d=>d.datum_od>danes);
  const pretekli=dopusti.filter(d=>d.datum_do<danes);

  const steviloDni=(od,do_)=>Math.floor((new Date(do_)-new Date(od))/86400000)+1;
  const dniLabel=(n)=>n===1?"dan":n===2?"dneva":"dni";
  const voznikIme=(id)=>{const v=vozniki.find(x=>x.id===id);return v?`${v.ime} ${v.priimek}`:"Neznan voznik";};
  const voznikVozilo=(id)=>vozniki.find(x=>x.id===id)?.vozilo||"";

  const odpriNovi=()=>{setForm({voznik_id:"",datum_od:danes,datum_do:danes,opomba:""});setModal("novi");};
  const odpriUredi=(d)=>{setForm({voznik_id:d.voznik_id,datum_od:d.datum_od,datum_do:d.datum_do,opomba:d.opomba||""});setModal(d.id);};

  async function shrani(){
    if(!form.voznik_id) return alert("Izberi voznika!");
    if(!form.datum_od||!form.datum_do) return alert("Izberi datume!");
    if(form.datum_do<form.datum_od) return alert("Datum 'do' mora biti za datumom 'od'!");
    setSaving(true);
    try{
      if(modal==="novi"){
        const{error}=await supabase.from("dopusti").insert([{voznik_id:form.voznik_id,datum_od:form.datum_od,datum_do:form.datum_do,opomba:form.opomba||null}]);
        if(error) throw error;
      }else{
        const{error}=await supabase.from("dopusti").update({voznik_id:form.voznik_id,datum_od:form.datum_od,datum_do:form.datum_do,opomba:form.opomba||null}).eq("id",modal);
        if(error) throw error;
      }
      setModal(null);
      await load();
    }catch(err){alert("Napaka: "+err.message);}
    setSaving(false);
  }

  async function izbrisi(id,ime){
    if(!window.confirm(`Izbrišem dopust ${ime?"za "+ime:""}?`)) return;
    const{error}=await supabase.from("dopusti").delete().eq("id",id);
    if(error){alert("Napaka pri brisanju!");return;}
    await load();
  }

  const renderRow=(d,theme)=>{
    const dniSkupaj=steviloDni(d.datum_od,d.datum_do);
    const ime=voznikIme(d.voznik_id);
    return(
      <div key={d.id} style={{background:theme.bg,borderRadius:10,padding:14,marginBottom:8,borderLeft:`4px solid ${theme.color}`,opacity:theme.opacity||1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>🚛 {ime}</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{voznikVozilo(d.voznik_id)}</div>
            <div style={{fontWeight:600,fontSize:13,color:theme.color,marginTop:6}}>{fmt(d.datum_od)} – {fmt(d.datum_do)} <span style={{fontWeight:500,color:"#64748b"}}>({dniSkupaj} {dniLabel(dniSkupaj)})</span></div>
            {d.opomba&&<div style={{fontSize:12,color:"#64748b",marginTop:4}}>📝 {d.opomba}</div>}
          </div>
          <div style={{display:"flex",gap:4}}>
            <button style={{background:"none",border:"none",color:"#2563eb",cursor:"pointer",fontSize:16,padding:4}} onClick={()=>odpriUredi(d)}>✏️</button>
            <button style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:16,padding:4}} onClick={()=>izbrisi(d.id,ime)}>🗑️</button>
          </div>
        </div>
      </div>
    );
  };

  if(loading) return <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>⏳ Nalagam dopuste...</div>;

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:16,color:"#0f2744"}}>🌴 Dopusti voznikov</div>
        <button onClick={odpriNovi} style={{background:"#15803d",color:"#fff",border:"none",borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Dodaj dopust</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
        <div style={{background:"#fff",borderRadius:12,padding:"14px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
          <div style={{fontSize:24,fontWeight:800,color:"#dc2626"}}>{trenutni.length}</div>
          <div style={{fontSize:11,color:"#94a3b8"}}>🔴 Danes</div>
        </div>
        <div style={{background:"#fff",borderRadius:12,padding:"14px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
          <div style={{fontSize:24,fontWeight:800,color:"#16a34a"}}>{prihodnji.length}</div>
          <div style={{fontSize:11,color:"#94a3b8"}}>📅 Prihodnji</div>
        </div>
        <div style={{background:"#fff",borderRadius:12,padding:"14px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
          <div style={{fontSize:24,fontWeight:800,color:"#94a3b8"}}>{pretekli.length}</div>
          <div style={{fontSize:11,color:"#94a3b8"}}>📋 Pretekli</div>
        </div>
      </div>

      {dopusti.length===0&&<div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Ni vpisanih dopustov.</div>}

      {trenutni.length>0&&<>
        <div style={{fontSize:11,fontWeight:700,color:"#dc2626",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>🔴 Trenutno na dopustu</div>
        {trenutni.map(d=>renderRow(d,{bg:"#fef2f2",color:"#dc2626"}))}
      </>}

      {prihodnji.length>0&&<>
        <div style={{fontSize:11,fontWeight:700,color:"#16a34a",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8,marginTop:14}}>📅 Prihodnji dopusti</div>
        {prihodnji.sort((a,b)=>a.datum_od.localeCompare(b.datum_od)).map(d=>renderRow(d,{bg:"#f0fdf4",color:"#16a34a"}))}
      </>}

      {pretekli.length>0&&<>
        <button style={{marginTop:14,marginBottom:8,width:"100%",padding:"8px 14px",borderRadius:10,border:"1px solid #e2e8f0",background:"#fff",fontSize:12,fontWeight:600,color:"#64748b",cursor:"pointer"}} onClick={()=>setShowPretekli(!showPretekli)}>{showPretekli?"▲ Skrij":"▼ Prikaži"} pretekle dopuste ({pretekli.length})</button>
        {showPretekli&&pretekli.map(d=>renderRow(d,{bg:"#f8fafc",color:"#94a3b8",opacity:0.85}))}
      </>}

      {modal&&<div style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.5)",display:"flex",justifyContent:"center",alignItems:"center",padding:"24px 16px"}} onClick={()=>setModal(null)}>
        <div style={{background:"#fff",borderRadius:16,maxWidth:500,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
          <div style={{background:"linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)",color:"#fff",padding:"18px 20px",borderRadius:"16px 16px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:16,fontWeight:800}}>{modal==="novi"?"🌴 Nov dopust":"✏️ Uredi dopust"}</div>
            <button onClick={()=>setModal(null)} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:30,height:30,borderRadius:8,fontSize:14,cursor:"pointer"}}>✕</button>
          </div>
          <div style={{padding:20}}>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:5}}>🚛 Voznik *</label>
              <select value={form.voznik_id} onChange={e=>setForm(f=>({...f,voznik_id:e.target.value}))} style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 12px",fontSize:13,background:"#fff",boxSizing:"border-box"}}>
                <option value="">– Izberi voznika –</option>
                {vozniki.map(v=><option key={v.id} value={v.id}>{v.ime} {v.priimek} · {v.vozilo}</option>)}
              </select>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:5}}>📅 Datum od *</label>
                <input type="date" value={form.datum_od} onChange={e=>setForm(f=>({...f,datum_od:e.target.value}))} style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 12px",fontSize:13,boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:5}}>📅 Datum do *</label>
                <input type="date" value={form.datum_do} onChange={e=>setForm(f=>({...f,datum_do:e.target.value}))} style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 12px",fontSize:13,boxSizing:"border-box"}}/>
              </div>
            </div>
            {form.datum_od&&form.datum_do&&form.datum_do>=form.datum_od&&(
              <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,fontWeight:700,color:"#16a34a",textAlign:"center"}}>
                ⏱️ {steviloDni(form.datum_od,form.datum_do)} {dniLabel(steviloDni(form.datum_od,form.datum_do))}
              </div>
            )}
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:5}}>📝 Opomba (opcijsko)</label>
              <input value={form.opomba} onChange={e=>setForm(f=>({...f,opomba:e.target.value}))} placeholder="npr. družinski dogodek" style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 12px",fontSize:13,boxSizing:"border-box"}}/>
            </div>
            <button onClick={shrani} disabled={saving} style={{width:"100%",background:"#16a34a",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer",opacity:saving?0.5:1}}>
              {saving?"⏳ Shranjevanje...":(modal==="novi"?"💾 Dodaj dopust":"💾 Shrani spremembe")}
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
}

function InfoCard({label,value,sub}){
  return(<div style={{background:"#f8fafc",borderRadius:10,padding:14}}>
    <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8",marginBottom:6}}>{label}</div>
    <div style={{fontSize:13,color:"#0f2744",whiteSpace:"pre-wrap",lineHeight:1.4}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:"#64748b",marginTop:4}}>{sub}</div>}
  </div>);
}
