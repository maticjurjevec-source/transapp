import { useState, useEffect } from "react";
import { supabase } from './supabase';
import DispecarPlasca from './DispecarPlascaV3';
import VoznikApp from './VoznikApp';
import FinanceApp from './FinanceApp';

const LS_SESSION = "transapp_session_v2";
const getSession = () => { try { return JSON.parse(localStorage.getItem(LS_SESSION)); } catch { return null; } };
const setSession = (u) => { try { localStorage.setItem(LS_SESSION, JSON.stringify(u)); } catch {} };
const clearSession = () => { try { localStorage.removeItem(LS_SESSION); } catch {} };

export default function App() {
  const [session, setSessionState] = useState(getSession);
  const [vozniki, setVozniki] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState("");
  const [vloga, setVloga] = useState("");

  useEffect(() => {
    supabase.from('vozniki').select('*').eq('aktiven', true).order('priimek').then(({ data }) => {
      if (data) setVozniki(data);
      setLoading(false);
    });
  }, []);

  const prijava = () => {
    if (vloga === "dispecer") {
      const ses = { vloga: "dispecer", ime: "Dispečer", id: null };
      setSession(ses);
      setSessionState(ses);
    } else if (vloga === "voznik" && sel) {
      const v = vozniki.find(x => x.id === sel);
      if (!v) return;
      const ses = { vloga: "voznik", ime: `${v.ime} ${v.priimek}`, vozilo: v.vozilo || "", id: v.id };
      setSession(ses);
      setSessionState(ses);
    }
  };

  const odjava = () => {
    clearSession();
    setSessionState(null);
    setSel("");
    setVloga("");
  };

  // Finance app (ločen URL za Bernardo)
  if (window.location.pathname === "/finance") {
    return <FinanceApp />;
  }

  // Prijavljen kot dispečer
  if (session?.vloga === "dispecer") {
    return (
      <div>
        <div style={s.topBar}>
          <span style={s.topBarIme}>⚡ Dispečer</span>
          <button style={s.odjavaBtn} onClick={odjava}>Odjava</button>
        </div>
        <DispecarPlasca />
      </div>
    );
  }

  // Prijavljen kot voznik
  if (session?.vloga === "voznik") {
    return (
      <div>
        <VoznikApp voznikId={session.id} voznikIme={session.ime} voznikVozilo={session.vozilo} onOdjava={odjava}/>
      </div>
    );
  }

  // Prijavna stran
  return (
    <div style={s.loginWrap}>
      <div style={s.loginTop}>
        <div style={{fontSize:48,marginBottom:8}}>🚛</div>
        <div style={{fontSize:28,fontWeight:800,color:"#fff"}}>TransApp</div>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.7)",marginTop:4}}>Jurjevec Transport</div>
      </div>

      <div style={s.loginCard}>
        <div style={{fontWeight:700,fontSize:18,color:"#0f2744",marginBottom:16}}>Prijava</div>

        {/* Izbira vloge */}
        <div style={s.vlogaRow}>
          <button style={{...s.vlogaBtn,...(vloga==="dispecer"?s.vlogaBtnOn:{})}} onClick={()=>{setVloga("dispecer");setSel("");}}>
            <div style={{fontSize:24,marginBottom:4}}>⚡</div>
            <div style={{fontWeight:700,fontSize:13}}>Dispečer</div>
          </button>
          <button style={{...s.vlogaBtn,...(vloga==="voznik"?s.vlogaBtnOn:{})}} onClick={()=>setVloga("voznik")}>
            <div style={{fontSize:24,marginBottom:4}}>🚛</div>
            <div style={{fontWeight:700,fontSize:13}}>Voznik</div>
          </button>
        </div>

        {/* Izbira voznika */}
        {vloga==="voznik" && (
          <div style={{marginBottom:16}}>
            <label style={s.lbl}>Izberi svoje ime</label>
            {loading ? (
              <div style={{textAlign:"center",color:"#64748b",padding:"12px 0"}}>⏳ Nalagam...</div>
            ) : (
              <select style={s.sel} value={sel} onChange={e=>setSel(e.target.value)}>
                <option value="">– Izberi voznika –</option>
                {vozniki.map(v=>(
                  <option key={v.id} value={v.id}>{v.ime} {v.priimek} · {v.vozilo}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {vloga==="dispecer" && (
          <div style={{background:"#eff6ff",borderRadius:10,padding:"12px 14px",marginBottom:16,fontSize:13,color:"#1d4ed8",fontWeight:600}}>
            ⚡ Dispečerska plošča — upravljanje vseh nalogov
          </div>
        )}

        <button
          style={{...s.btnP, opacity:(vloga==="dispecer"||(vloga==="voznik"&&sel))?1:0.4}}
          onClick={prijava}
          disabled={!(vloga==="dispecer"||(vloga==="voznik"&&sel))}
        >
          Prijava →
        </button>
      </div>

      <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:16}}>
        TransApp · Jurjevec Transport · 2026
      </div>
    </div>
  );
}

const s = {
  loginWrap:{fontFamily:"'Segoe UI',system-ui,sans-serif",background:"linear-gradient(135deg,#0f2744,#1d4ed8)",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20},
  loginTop:{textAlign:"center",marginBottom:28},
  loginCard:{background:"#fff",borderRadius:20,padding:28,width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"},
  vlogaRow:{display:"flex",gap:12,marginBottom:16},
  vlogaBtn:{flex:1,padding:"16px 10px",borderRadius:14,border:"2px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",textAlign:"center",transition:"all 0.2s"},
  vlogaBtnOn:{border:"2px solid #1d4ed8",background:"#eff6ff",color:"#1d4ed8"},
  lbl:{display:"block",fontSize:13,fontWeight:600,color:"#475569",marginBottom:6},
  sel:{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"11px 13px",fontSize:14,outline:"none",background:"#f8fafc",boxSizing:"border-box"},
  btnP:{width:"100%",background:"linear-gradient(135deg,#0f2744,#1d4ed8)",color:"#fff",border:"none",borderRadius:12,padding:14,fontSize:15,fontWeight:700,cursor:"pointer"},
  topBar:{background:"#0f2744",color:"#fff",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:14,fontWeight:600},
  topBarIme:{},
  odjavaBtn:{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",padding:"5px 12px",borderRadius:8,fontSize:12,cursor:"pointer"},
};
