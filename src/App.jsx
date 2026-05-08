import { useState, useEffect, useRef } from "react";
import { supabase } from './supabase';
import DispecarPlasca from './DispecarPlascaV3';
import VoznikApp from './VoznikApp';
import FinanceApp from './FinanceApp';
import VzdrzevanjeApp from './VzdrzevanjeApp';

const LS_SESSION = "transapp_session_v2";
const LS_PIN_BLOCKED = "transapp_pin_blocked_until";
const LS_DISP_BLOCKED = "transapp_disp_blocked_until";
const getSession = () => { try { return JSON.parse(localStorage.getItem(LS_SESSION)); } catch { return null; } };
const setSession = (u) => { try { localStorage.setItem(LS_SESSION, JSON.stringify(u)); } catch {} };
const clearSession = () => { try { localStorage.removeItem(LS_SESSION); } catch {} };

const getPinBlockedUntil = () => { try { return parseInt(localStorage.getItem(LS_PIN_BLOCKED)) || 0; } catch { return 0; } };
const setPinBlockedUntil = (ts) => { try { localStorage.setItem(LS_PIN_BLOCKED, String(ts)); } catch {} };

const getDispBlockedUntil = () => { try { return parseInt(localStorage.getItem(LS_DISP_BLOCKED)) || 0; } catch { return 0; } };
const setDispBlockedUntil = (ts) => { try { localStorage.setItem(LS_DISP_BLOCKED, String(ts)); } catch {} };

// Pretvori ime voznika v URL slug: "Nijaz" → "nijaz", "Sulejman" → "sulejman", "Müller" → "muller"
const imeVSlug = (ime) => {
  if (!ime) return "";
  return ime
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // odstrani diakritike (š→s, č→c, ž→z, ć→c, ä→a)
    .replace(/[^a-z0-9]/g, ""); // samo črke a-z in števke
};

// Preberi slug iz URL-ja (npr. /nijaz → "nijaz")
const getUrlSlug = () => {
  const path = window.location.pathname;
  if (path === "/" || path === "") return null;
  // Preskoči rezervirane poti
  if (path === "/vzdrzevanje" || path === "/finance") return null;
  const slug = path.replace(/^\//, "").replace(/\/$/, "").toLowerCase();
  return slug || null;
};

export default function App() {
  const [session, setSessionState] = useState(getSession);
  const [vozniki, setVozniki] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState("");
  const [vloga, setVloga] = useState("");
  const [pin, setPin] = useState("");
  const [pinNapaka, setPinNapaka] = useState(false);
  const [napacniPoskusi, setNapacniPoskusi] = useState(0);
  const [blokiranDo, setBlokiranDo] = useState(getPinBlockedUntil());
  const [zdaj, setZdaj] = useState(Date.now());
  const [korakPrijave, setKorakPrijave] = useState("vloga"); // vloga | voznik | pin | dispecer
  
  // Dispečer geslo
  const [dispGeslo, setDispGeslo] = useState("");
  const [dispGesloShow, setDispGesloShow] = useState(false);
  const [dispNapaka, setDispNapaka] = useState(false);
  const [dispLoading, setDispLoading] = useState(false);
  const [dispNapacniPoskusi, setDispNapacniPoskusi] = useState(0);
  const [dispBlokiranDo, setDispBlokiranDo] = useState(getDispBlockedUntil());

  // Posodobi čas vsako sekundo (za odštevanje, če je blokiran)
  useEffect(() => {
    if (blokiranDo > zdaj) {
      const id = setInterval(() => setZdaj(Date.now()), 1000);
      return () => clearInterval(id);
    }
  }, [blokiranDo, zdaj]);

  useEffect(() => {
    supabase.from('vozniki').select('*').eq('aktiven', true).order('priimek').then(({ data }) => {
      if (data) {
        setVozniki(data);
        // Če je v URL-ju slug, avtomatsko izberi voznika in pojdi na PIN screen
        const slug = getUrlSlug();
        if (slug && !session) {
          const najden = data.find(v => imeVSlug(v.ime) === slug);
          if (najden) {
            setVloga("voznik");
            setSel(najden.id);
            setKorakPrijave("pin");
          }
        }
      }
      setLoading(false);
    });
  }, []);

  const izberiVlogo = (v) => {
    setVloga(v);
    setSel("");
    setPin("");
    setPinNapaka(false);
    if (v === "dispecer") {
      setKorakPrijave("dispecer");
    } else if (v === "voznik") {
      setKorakPrijave("voznik");
    }
  };

  const izberiVoznika = (vId) => {
    setSel(vId);
    setPin("");
    setPinNapaka(false);
    setKorakPrijave("pin");
  };

  const dodajPinStevko = (st) => {
    if (pin.length >= 4) return;
    setPinNapaka(false);
    const novPin = pin + st;
    setPin(novPin);
    if (novPin.length === 4) {
      // Avtomatsko preverimo PIN
      setTimeout(() => preveriPin(novPin), 100);
    }
  };

  const odstraniZadnjoStevko = () => {
    setPin(pin.slice(0, -1));
    setPinNapaka(false);
  };

  const preveriPin = (vpisanPin) => {
    const v = vozniki.find(x => x.id === sel);
    if (!v) return;
    
    if (String(v.pin_koda) === String(vpisanPin)) {
      // PIN je pravilen
      setNapacniPoskusi(0);
      setPinBlockedUntil(0);
      const ses = { 
        vloga: "voznik", 
        ime: `${v.ime} ${v.priimek}`, 
        vozilo: v.vozilo || "", 
        id: v.id 
      };
      setSession(ses);
      setSessionState(ses);
    } else {
      // PIN je napačen
      const novNapacni = napacniPoskusi + 1;
      setNapacniPoskusi(novNapacni);
      setPinNapaka(true);
      setPin("");
      
      if (novNapacni >= 3) {
        // Blokiraj za 5 minut
        const blokDo = Date.now() + 5 * 60 * 1000;
        setBlokiranDo(blokDo);
        setPinBlockedUntil(blokDo);
        setNapacniPoskusi(0);
      }
    }
  };

  const prijavaDispecer = async () => {
    if (!dispGeslo) {
      setDispNapaka(true);
      return;
    }
    setDispLoading(true);
    setDispNapaka(false);
    try {
      // Preberi geslo iz Supabase
      const { data, error } = await supabase
        .from('app_settings')
        .select('vrednost')
        .eq('kljuc', 'dispecer_geslo')
        .single();
      
      if (error || !data) {
        console.error("Napaka pri branju gesla:", error);
        setDispNapaka(true);
        setDispLoading(false);
        return;
      }
      
      if (data.vrednost === dispGeslo) {
        // Pravilno geslo
        setDispNapacniPoskusi(0);
        setDispBlockedUntil(0);
        setDispGeslo("");
        const ses = { vloga: "dispecer", ime: "Dispečer", id: null };
        setSession(ses);
        setSessionState(ses);
      } else {
        // Napačno geslo
        const novNapacni = dispNapacniPoskusi + 1;
        setDispNapacniPoskusi(novNapacni);
        setDispNapaka(true);
        setDispGeslo("");
        
        if (novNapacni >= 3) {
          // Blokiraj za 10 minut (dlje kot voznik, ker je bolj kritično)
          const blokDo = Date.now() + 10 * 60 * 1000;
          setDispBlokiranDo(blokDo);
          setDispBlockedUntil(blokDo);
          setDispNapacniPoskusi(0);
        }
      }
    } catch (err) {
      console.error("Napaka pri prijavi:", err);
      setDispNapaka(true);
    }
    setDispLoading(false);
  };

  const odjava = () => {
    clearSession();
    setSessionState(null);
    setSel("");
    setVloga("");
    setPin("");
    setPinNapaka(false);
    setDispGeslo("");
    setDispNapaka(false);
    setKorakPrijave("vloga");
    // Če je voznik prišel preko slug-a, ga preusmeri nazaj na slug (da se spet avtomatsko prijavi)
    // Sicer pa na default
    const slug = getUrlSlug();
    if (!slug) {
      setKorakPrijave("vloga");
    }
  };

  const nazajNaVlogo = () => {
    setVloga("");
    setSel("");
    setPin("");
    setPinNapaka(false);
    setKorakPrijave("vloga");
  };

  const nazajNaVoznika = () => {
    setSel("");
    setPin("");
    setPinNapaka(false);
    setKorakPrijave("voznik");
  };

  // Finance app (ločen URL za Bernardo)
  if (window.location.pathname === "/vzdrzevanje") return <VzdrzevanjeApp />;
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

  // Blokada zaradi 3 napačnih PIN-ov
  const jeBlokiran = blokiranDo > zdaj;
  const sekundDoOdblokade = jeBlokiran ? Math.ceil((blokiranDo - zdaj) / 1000) : 0;
  const minutDoOdblokade = Math.floor(sekundDoOdblokade / 60);
  const preostaleSek = sekundDoOdblokade % 60;

  // ========== KORAK: PIN VPIS ==========
  if (korakPrijave === "pin" && sel) {
    const izbVoznik = vozniki.find(x => x.id === sel);

    if (jeBlokiran) {
      return (
        <div style={s.loginWrap}>
          <div style={s.loginTop}>
            <div style={{fontSize:48,marginBottom:8}}>🔒</div>
            <div style={{fontSize:24,fontWeight:800,color:"#fff"}}>Prijava blokirana</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,0.7)",marginTop:8}}>3 napačni PIN poskusi</div>
          </div>
          <div style={s.loginCard}>
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{fontSize:36,fontWeight:800,color:"#dc2626",marginBottom:8,fontFamily:"monospace"}}>
                {String(minutDoOdblokade).padStart(2,"0")}:{String(preostaleSek).padStart(2,"0")}
              </div>
              <div style={{fontSize:13,color:"#64748b",marginBottom:16}}>Počakaj do konca odštevanja in poskusi znova</div>
              <button style={s.btnSec} onClick={odjava}>← Nazaj na izbiro vloge</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={s.loginWrap}>
        <div style={s.loginTop}>
          <div style={{fontSize:48,marginBottom:8}}>🚛</div>
          <div style={{fontSize:20,fontWeight:800,color:"#fff"}}>{izbVoznik?.ime} {izbVoznik?.priimek}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",marginTop:4}}>{izbVoznik?.vozilo}</div>
        </div>
        
        <div style={s.loginCard}>
          <div style={{fontWeight:700,fontSize:16,color:"#0f2744",marginBottom:14,textAlign:"center"}}>
            Vpiši svoj PIN
          </div>

          {/* PIN prikazne pike */}
          <div style={{display:"flex",justifyContent:"center",gap:12,marginBottom:18}}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                width:48,
                height:56,
                borderRadius:10,
                border: pinNapaka ? "2px solid #dc2626" : "2px solid #e2e8f0",
                background: pinNapaka ? "#fef2f2" : (pin.length > i ? "#eff6ff" : "#f8fafc"),
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                fontSize:24,
                fontWeight:800,
                color: pinNapaka ? "#dc2626" : "#1d4ed8",
                transition:"all 0.15s"
              }}>
                {pin.length > i ? "•" : ""}
              </div>
            ))}
          </div>

          {pinNapaka && (
            <div style={{textAlign:"center",fontSize:13,color:"#dc2626",fontWeight:600,marginBottom:14}}>
              ❌ Napačen PIN! {napacniPoskusi > 0 && `(${3 - napacniPoskusi} poskus${3 - napacniPoskusi === 1 ? "" : "i/a"} pred blokado)`}
            </div>
          )}

          {/* Številčnica */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button 
                key={n} 
                style={s.pinBtn}
                onClick={() => dodajPinStevko(String(n))}
                disabled={pin.length >= 4}
              >
                {n}
              </button>
            ))}
            <button 
              style={{...s.pinBtn, background:"#f1f5f9", color:"#64748b"}}
              onClick={odstraniZadnjoStevko}
              disabled={pin.length === 0}
            >
              ⌫
            </button>
            <button 
              style={s.pinBtn}
              onClick={() => dodajPinStevko("0")}
              disabled={pin.length >= 4}
            >
              0
            </button>
            <button 
              style={{...s.pinBtn, background:"#f1f5f9", color:"#64748b", fontSize:18}}
              onClick={nazajNaVoznika}
            >
              ←
            </button>
          </div>
        </div>

        <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:16}}>
          Če si pozabil PIN, kontaktiraj dispečerja
        </div>
      </div>
    );
  }

  // ========== KORAK: IZBIRA VOZNIKA ==========
  if (korakPrijave === "voznik") {
    return (
      <div style={s.loginWrap}>
        <div style={s.loginTop}>
          <div style={{fontSize:48,marginBottom:8}}>🚛</div>
          <div style={{fontSize:24,fontWeight:800,color:"#fff"}}>Izberi voznika</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",marginTop:4}}>Klikni svoje ime</div>
        </div>

        <div style={s.loginCard}>
          {loading ? (
            <div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>⏳ Nalagam...</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:"50vh",overflowY:"auto"}}>
              {vozniki.map(v => (
                <button 
                  key={v.id} 
                  style={s.voznikBtn}
                  onClick={() => izberiVoznika(v.id)}
                >
                  <div style={{
                    width:36,
                    height:36,
                    borderRadius:"50%",
                    background:"linear-gradient(135deg,#0f2744,#1d4ed8)",
                    color:"#fff",
                    fontSize:14,
                    fontWeight:800,
                    display:"flex",
                    alignItems:"center",
                    justifyContent:"center",
                    flexShrink:0
                  }}>
                    {v.ime.charAt(0)}
                  </div>
                  <div style={{flex:1,textAlign:"left"}}>
                    <div style={{fontWeight:700,fontSize:14,color:"#0f2744"}}>{v.ime} {v.priimek}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{v.vozilo}</div>
                  </div>
                  <div style={{fontSize:18,color:"#94a3b8"}}>›</div>
                </button>
              ))}
            </div>
          )}

          <button style={{...s.btnSec, marginTop:14}} onClick={nazajNaVlogo}>
            ← Nazaj
          </button>
        </div>
      </div>
    );
  }

  // ========== KORAK: DISPEČER (vpis gesla) ==========
  if (korakPrijave === "dispecer") {
    const dispJeBlokiran = dispBlokiranDo > zdaj;
    const dispSekundDoOdblokade = dispJeBlokiran ? Math.ceil((dispBlokiranDo - zdaj) / 1000) : 0;
    const dispMinutDoOdblokade = Math.floor(dispSekundDoOdblokade / 60);
    const dispPreostaleSek = dispSekundDoOdblokade % 60;

    if (dispJeBlokiran) {
      return (
        <div style={s.loginWrap}>
          <div style={s.loginTop}>
            <div style={{fontSize:48,marginBottom:8}}>🔒</div>
            <div style={{fontSize:24,fontWeight:800,color:"#fff"}}>Prijava blokirana</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,0.7)",marginTop:8}}>3 napačni vpisi gesla</div>
          </div>
          <div style={s.loginCard}>
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{fontSize:36,fontWeight:800,color:"#dc2626",marginBottom:8,fontFamily:"monospace"}}>
                {String(dispMinutDoOdblokade).padStart(2,"0")}:{String(dispPreostaleSek).padStart(2,"0")}
              </div>
              <div style={{fontSize:13,color:"#64748b",marginBottom:16}}>Počakaj do konca odštevanja in poskusi znova</div>
              <button style={s.btnSec} onClick={odjava}>← Nazaj na izbiro vloge</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={s.loginWrap}>
        <div style={s.loginTop}>
          <div style={{fontSize:48,marginBottom:8}}>⚡</div>
          <div style={{fontSize:24,fontWeight:800,color:"#fff"}}>Dispečer</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",marginTop:4}}>Vpiši geslo za prijavo</div>
        </div>

        <div style={s.loginCard}>
          <div style={{fontWeight:700,fontSize:16,color:"#0f2744",marginBottom:14,textAlign:"center"}}>
            🔐 Geslo
          </div>

          <div style={{position:"relative",marginBottom:dispNapaka?6:14}}>
            <input
              type={dispGesloShow ? "text" : "password"}
              value={dispGeslo}
              onChange={e => { setDispGeslo(e.target.value); setDispNapaka(false); }}
              onKeyDown={e => { if (e.key === "Enter" && dispGeslo) prijavaDispecer(); }}
              placeholder="Vpiši geslo..."
              autoFocus
              style={{
                width:"100%",
                border: dispNapaka ? "2px solid #dc2626" : "2px solid #e2e8f0",
                borderRadius:12,
                padding:"14px 50px 14px 16px",
                fontSize:16,
                outline:"none",
                background: dispNapaka ? "#fef2f2" : "#f8fafc",
                color:"#0f2744",
                fontWeight:600,
                boxSizing:"border-box",
                transition:"all 0.15s"
              }}
            />
            <button
              type="button"
              onClick={() => setDispGesloShow(!dispGesloShow)}
              style={{
                position:"absolute",
                right:8,
                top:"50%",
                transform:"translateY(-50%)",
                background:"none",
                border:"none",
                cursor:"pointer",
                fontSize:18,
                padding:6,
                color:"#64748b"
              }}
              tabIndex={-1}
              aria-label="Prikaži/skrij geslo"
            >
              {dispGesloShow ? "🙈" : "👁️"}
            </button>
          </div>

          {dispNapaka && (
            <div style={{textAlign:"center",fontSize:13,color:"#dc2626",fontWeight:600,marginBottom:14}}>
              ❌ Napačno geslo! {dispNapacniPoskusi > 0 && `(${3 - dispNapacniPoskusi} poskus${3 - dispNapacniPoskusi === 1 ? "" : "i/a"} pred blokado)`}
            </div>
          )}

          <button 
            style={{...s.btnP, opacity: (dispGeslo && !dispLoading) ? 1 : 0.5}} 
            onClick={prijavaDispecer}
            disabled={!dispGeslo || dispLoading}
          >
            {dispLoading ? "⏳ Preverjam..." : "Prijavi se →"}
          </button>

          <button style={{...s.btnSec, marginTop:10}} onClick={nazajNaVlogo}>
            ← Nazaj
          </button>
        </div>

        <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:16}}>
          Po 3 napačnih poskusih bo prijava blokirana za 10 minut
        </div>
      </div>
    );
  }

  // ========== KORAK: IZBIRA VLOGE (privzeti zaslon) ==========
  return (
    <div style={s.loginWrap}>
      <div style={s.loginTop}>
        <div style={{fontSize:48,marginBottom:8}}>🚛</div>
        <div style={{fontSize:28,fontWeight:800,color:"#fff"}}>TransApp</div>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.7)",marginTop:4}}>Jurjevec Transport</div>
      </div>

      <div style={s.loginCard}>
        <div style={{fontWeight:700,fontSize:18,color:"#0f2744",marginBottom:16,textAlign:"center"}}>
          Kdo si?
        </div>

        <div style={s.vlogaRow}>
          <button 
            style={s.vlogaBtn} 
            onClick={() => izberiVlogo("dispecer")}
          >
            <div style={{fontSize:32,marginBottom:6}}>⚡</div>
            <div style={{fontWeight:700,fontSize:14,color:"#0f2744"}}>Dispečer</div>
            <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Upravljanje</div>
          </button>
          <button 
            style={s.vlogaBtn} 
            onClick={() => izberiVlogo("voznik")}
          >
            <div style={{fontSize:32,marginBottom:6}}>🚛</div>
            <div style={{fontWeight:700,fontSize:14,color:"#0f2744"}}>Voznik</div>
            <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Moji nalogi</div>
          </button>
        </div>
      </div>

      <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:16}}>
        TransApp · Jurjevec Transport · 2026
      </div>
    </div>
  );
}

const s = {
  loginWrap:{
    fontFamily:"'Segoe UI',system-ui,sans-serif",
    background:"linear-gradient(135deg,#0f2744,#1d4ed8)",
    minHeight:"100vh",
    display:"flex",
    flexDirection:"column",
    alignItems:"center",
    justifyContent:"center",
    padding:20
  },
  loginTop:{textAlign:"center",marginBottom:24},
  loginCard:{
    background:"#fff",
    borderRadius:20,
    padding:24,
    width:"100%",
    maxWidth:380,
    boxShadow:"0 20px 60px rgba(0,0,0,0.3)"
  },
  vlogaRow:{display:"flex",gap:12},
  vlogaBtn:{
    flex:1,
    padding:"22px 10px",
    borderRadius:14,
    border:"2px solid #e2e8f0",
    background:"#f8fafc",
    cursor:"pointer",
    textAlign:"center",
    transition:"all 0.2s"
  },
  voznikBtn:{
    display:"flex",
    alignItems:"center",
    gap:12,
    width:"100%",
    padding:"10px 12px",
    borderRadius:12,
    border:"1.5px solid #e2e8f0",
    background:"#fff",
    cursor:"pointer",
    transition:"all 0.15s"
  },
  pinBtn:{
    padding:"16px 0",
    borderRadius:12,
    border:"none",
    background:"linear-gradient(135deg,#0f2744,#1d4ed8)",
    color:"#fff",
    fontSize:22,
    fontWeight:700,
    cursor:"pointer",
    transition:"all 0.1s"
  },
  btnP:{
    width:"100%",
    background:"linear-gradient(135deg,#0f2744,#1d4ed8)",
    color:"#fff",
    border:"none",
    borderRadius:12,
    padding:14,
    fontSize:15,
    fontWeight:700,
    cursor:"pointer"
  },
  btnSec:{
    width:"100%",
    background:"#f1f5f9",
    color:"#475569",
    border:"none",
    borderRadius:12,
    padding:11,
    fontSize:13,
    fontWeight:600,
    cursor:"pointer"
  },
  topBar:{
    background:"#0f2744",
    color:"#fff",
    padding:"10px 16px",
    display:"flex",
    justifyContent:"space-between",
    alignItems:"center",
    fontSize:14,
    fontWeight:600
  },
  topBarIme:{},
  odjavaBtn:{
    background:"rgba(255,255,255,0.15)",
    border:"none",
    color:"#fff",
    padding:"5px 12px",
    borderRadius:8,
    fontSize:12,
    cursor:"pointer"
  },
};
