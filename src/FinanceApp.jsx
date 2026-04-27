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
        </div>

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

      {/* Lightbox */}
      {imgPreview&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20,cursor:"pointer"}} onClick={()=>setImgPreview(null)}>
        <img src={imgPreview} alt="" style={{maxWidth:"95%",maxHeight:"95vh",objectFit:"contain",borderRadius:8,boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}/>
        <button style={{position:"absolute",top:20,right:20,background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",width:40,height:40,borderRadius:20,fontSize:18,cursor:"pointer"}} onClick={()=>setImgPreview(null)}>✕</button>
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
