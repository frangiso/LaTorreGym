import { useEffect, useState } from "react";
import {
  doc, updateDoc, collection, query, where,
  onSnapshot, writeBatch, deleteDoc, getDocs, serverTimestamp
} from "firebase/firestore";
import { db } from "../../firebase";

const DIAS      = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const DIAS_FULL = { LUNES:"Lunes", MARTES:"Martes", MIERCOLES:"Miercoles",
                    JUEVES:"Jueves", VIERNES:"Viernes", SABADO:"Sabado" };
const DIAS_CORTO= { LUNES:"Lun", MARTES:"Mar", MIERCOLES:"Mie",
                    JUEVES:"Jue", VIERNES:"Vie", SABADO:"Sab" };
const CUPO = 15;
const TURNOS_POR_PLAN = { "2dias":2, "3dias":3, "lv":6, "suelta":0 };

// ---- Helpers (fuera del componente) ----
function getHorasDia(dia) {
  const [ini, fin] = dia === "SABADO" ? [8,13] : [7,22];
  return Array.from({length: fin-ini+1}, (_,i) => String(i+ini).padStart(2,"0")+":00");
}

function getFechasSemanaActual() {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const dow  = hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({length:7}, (_,i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

async function crearReservas(uid, nombre, turnos) {
  const hoy   = new Date(); hoy.setHours(0,0,0,0);
  const dow   = hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1));

  // Primero verificar cupos en paralelo
  const candidatos = [];
  for (let s = 0; s < 4; s++) {
    for (const t of turnos) {
      const idx = DIAS.indexOf(t.dia);
      const d   = new Date(lunes);
      d.setDate(lunes.getDate() + s*7 + idx);
      const fecha = d.toISOString().split("T")[0];
      if (new Date(fecha + "T" + t.hora) < hoy) continue;
      candidatos.push({ dia: t.dia, hora: t.hora, fecha });
    }
  }

  // Verificar cupos en paralelo (mucho más rápido que secuencial)
  const verificados = await Promise.all(
    candidatos.map(async c => {
      const q    = query(collection(db,"reservas"), where("fecha","==",c.fecha), where("hora","==",c.hora));
      const snap = await getDocs(q);
      const yaExiste = snap.docs.some(x => x.data().alumnoId === uid);
      const lleno    = snap.size >= CUPO;
      return { ...c, ok: !yaExiste && !lleno };
    })
  );

  // Escribir todos de una con batch
  const aEscribir = verificados.filter(x => x.ok);
  if (aEscribir.length === 0) return;

  // Firestore batch: max 500 ops
  const batch = writeBatch(db);
  aEscribir.forEach(r => {
    const ref = doc(collection(db, "reservas"));
    batch.set(ref, {
      alumnoId: uid, nombreAlumno: nombre,
      dia: r.dia, hora: r.hora, fecha: r.fecha,
      esFijo: true, esRecuperacion: false,
      creadoEn: serverTimestamp(),
    });
  });
  await batch.commit();
}

async function borrarReservas(uid) {
  const hoy  = new Date().toISOString().split("T")[0];
  const q    = query(collection(db,"reservas"), where("alumnoId","==",uid), where("esFijo","==",true));
  const snap = await getDocs(q);
  const aFuturas = snap.docs.filter(d => d.data().fecha >= hoy);
  if (aFuturas.length === 0) return;
  const batch = writeBatch(db);
  aFuturas.forEach(d => batch.delete(doc(db,"reservas",d.id)));
  await batch.commit();
}

// ---- Componente principal ----
export default function SolicitarTurnosFijos({ perfil, user }) {
  const [diaActivo, setDia]       = useState("LUNES");
  const [seleccionados, setSel]   = useState([]);
  const [ocupacion, setOcupacion] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk]               = useState(false);
  const [modo, setModo]           = useState("ver"); // "ver" | "elegir"

  const planId      = perfil?.planId || "";
  const cantMax     = TURNOS_POR_PLAN[planId] ?? 0;
  const turnosFijos = perfil?.turnosFijos || [];
  const estado      = perfil?.turnosFijosEstado || null;
  const recUsadas   = perfil?.recuperacionesUsadas ?? 0;
  const esSuelta    = planId === "suelta";

  // Escuchar ocupación semana actual
  useEffect(() => {
    const fechas = getFechasSemanaActual();
    const q = query(collection(db,"reservas"), where("fecha","in",fechas));
    const fn = onSnapshot(q, snap => {
      const cnt = {};
      snap.docs.forEach(d => {
        const r = d.data();
        const k = r.dia + "_" + r.hora.replace(":","");
        cnt[k]  = (cnt[k] || 0) + 1;
      });
      setOcupacion(cnt);
    }, err => console.error("ocupacion:", err.message));
    return fn; // fn ES la función de cleanup directamente
  }, []);

  // Pre-cargar selección al abrir modo elegir
  useEffect(() => {
    if (modo === "elegir" && turnosFijos.length > 0) setSel([...turnosFijos]);
  }, [modo]);

  function cupo(dia, hora) {
    return Math.max(0, CUPO - (ocupacion[dia+"_"+hora.replace(":","")] || 0));
  }
  function esSel(dia, hora)  { return seleccionados.some(s => s.dia===dia && s.hora===hora); }
  function esFijo(dia, hora) { return turnosFijos.some(t => t.dia===dia && t.hora===hora); }

  function toggle(dia, hora) {
    if (esSel(dia, hora)) {
      setSel(p => p.filter(s => !(s.dia===dia && s.hora===hora)));
      return;
    }
    if (cupo(dia, hora) <= 0) { alert("Ese turno está lleno. Elegí otro."); return; }
    if (planId === "lv") {
      setSel(p => [...p.filter(s => s.dia !== dia), {dia, hora}]);
      return;
    }
    if (seleccionados.length >= cantMax) {
      alert("Ya elegiste " + cantMax + " turno" + (cantMax!==1?"s":"") + ". Deseleccioná uno para cambiar.");
      return;
    }
    setSel(p => [...p, {dia, hora}]);
  }

  async function confirmar() {
    if (seleccionados.length === 0) return;
    if (planId !== "lv" && seleccionados.length !== cantMax) return;
    setGuardando(true);
    try {
      for (const t of seleccionados) {
        if (cupo(t.dia, t.hora) <= 0 && !esFijo(t.dia, t.hora)) {
          alert("El turno " + t.dia + " " + t.hora + " se llenó. Elegí otro.");
          setGuardando(false); return;
        }
      }
      await borrarReservas(user.uid);
      await updateDoc(doc(db,"usuarios",user.uid), {
        turnosFijos: seleccionados,
        turnosFijosEstado: "aprobado",
        recuperacionesUsadas: 0,
      });
      const nombre = ((perfil?.nombre||"") + " " + (perfil?.apellido||"")).trim();
      await crearReservas(user.uid, nombre, seleccionados);
      setModo("ver");
      setOk(true);
      setTimeout(() => setOk(false), 3000);
    } catch(e) {
      console.error(e);
      alert("Hubo un error. Intentá de nuevo.");
    }
    setGuardando(false);
  }

  // ---- Sin plan / suelta ----
  if (!planId || esSuelta) return (
    <div style={card}>
      <p style={{fontSize:14, color:"#888", textAlign:"center"}}>
        {esSuelta ? "Tu plan de clase suelta no requiere turno fijo." : "No tenés un plan activo."}
      </p>
    </div>
  );

  // ---- Turnos aprobados ----
  if (modo === "ver" && estado === "aprobado" && turnosFijos.length > 0) return (
    <div style={{display:"flex", flexDirection:"column", gap:12}}>
      {ok && (
        <div style={{background:"#dcfce7", border:"1px solid #86efac", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#065f46", fontWeight:500}}>
          ✓ Turnos actualizados correctamente
        </div>
      )}
      <div style={card}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14}}>
          <span style={{background:"#dcfce7", color:"#065f46", fontSize:12, fontWeight:500, padding:"4px 12px", borderRadius:20}}>
            Turnos fijos activos
          </span>
          <button onClick={() => { setSel([]); setModo("elegir"); }}
            style={{background:"#f5f5f5", border:"none", borderRadius:8, padding:"6px 14px", fontSize:12, color:"#555", cursor:"pointer"}}>
            Cambiar
          </button>
        </div>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {turnosFijos.map((t,i) => (
            <div key={i} style={{display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"#FFFBEA", border:"1.5px solid #F5C400", borderRadius:10}}>
              <span style={{fontSize:20}}>📌</span>
              <div>
                <div style={{fontSize:14, fontWeight:500, color:"#111"}}>{DIAS_FULL[t.dia] || t.dia}</div>
                <div style={{fontSize:13, color:"#888"}}>{t.hora} hs</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{fontSize:14, fontWeight:500, color:"#111", marginBottom:10}}>Clases de recuperación</div>
        <div style={{display:"flex", gap:10, alignItems:"center", marginBottom:8}}>
          {[0,1].map(i => (
            <div key={i} style={{
              width:40, height:40, borderRadius:"50%",
              background: i < recUsadas ? "#fee2e2" : "#dcfce7",
              border:"2px solid " + (i < recUsadas ? "#fca5a5" : "#86efac"),
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:18
            }}>
              {i < recUsadas ? "✗" : "✓"}
            </div>
          ))}
          <div>
            <div style={{fontSize:13, fontWeight:500, color:"#111"}}>{2-recUsadas} disponible{2-recUsadas!==1?"s":""}</div>
            <div style={{fontSize:12, color:"#aaa"}}>Se renuevan cada mes</div>
          </div>
        </div>
        <p style={{fontSize:12, color:"#666", lineHeight:1.6}}>
          Si avisás hasta 2 horas antes que no podés asistir a tu turno fijo, podés usar una recuperación en cualquier horario libre.
        </p>
      </div>
    </div>
  );

  // ---- Primera vez / pendiente / rechazado ----
  if (modo === "ver") return (
    <div style={card}>
      <div style={{fontSize:15, fontWeight:500, color:"#111", marginBottom:8}}>Elegí tus turnos fijos</div>
      <p style={{fontSize:13, color:"#666", lineHeight:1.6, marginBottom:20}}>
        {planId === "lv"
          ? "Elegí 1 horario por día (lunes a sábado). Esos turnos quedan reservados automáticamente cada semana."
          : "Tu plan incluye " + cantMax + " turno" + (cantMax!==1?"s":"") + " fijo" + (cantMax!==1?"s":"") + " por semana. Se reservan automáticamente si hay lugar."}
      </p>
      {estado === "rechazado" && perfil?.motivoRechazoFijos && (
        <div style={{background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#991b1b"}}>
          Solicitud rechazada: {perfil.motivoRechazoFijos}
        </div>
      )}
      {ok && <p style={{color:"#10b981", fontSize:13, fontWeight:500, marginBottom:12}}>✓ Turnos guardados</p>}
      <button onClick={() => { setSel([]); setModo("elegir"); }}
        style={{width:"100%", background:"#F5C400", color:"#111", border:"none", borderRadius:10, padding:"13px", fontSize:16, fontWeight:700, cursor:"pointer"}}>
        Ver grilla y elegir →
      </button>
    </div>
  );

  // ---- Modo elegir ----
  const horas = getHorasDia(diaActivo);
  const listo = planId === "lv" ? seleccionados.length > 0 : seleccionados.length === cantMax;

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14}}>
        <div>
          <div style={{fontSize:15, fontWeight:500, color:"#111"}}>Elegí tus turnos fijos</div>
          <div style={{fontSize:13, color:"#888"}}>
            {seleccionados.length}/{cantMax} elegido{seleccionados.length!==1?"s":""}
          </div>
        </div>
        <button onClick={() => { setSel([]); setModo("ver"); }}
          style={{background:"transparent", border:"0.5px solid #e0e0e0", borderRadius:8, padding:"7px 12px", fontSize:13, color:"#888", cursor:"pointer"}}>
          Cancelar
        </button>
      </div>

      {/* Chips */}
      {seleccionados.length > 0 && (
        <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:14}}>
          {seleccionados.map((s,i) => (
            <span key={i} onClick={() => toggle(s.dia, s.hora)}
              style={{background:"#F5C400", color:"#111", fontSize:13, fontWeight:500, padding:"5px 14px", borderRadius:20, cursor:"pointer"}}>
              {DIAS_CORTO[s.dia]} {s.hora} ✕
            </span>
          ))}
        </div>
      )}

      {/* Selector de días */}
      <div style={{display:"flex", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:4}}>
        {DIAS.map(dia => {
          const activo = diaActivo === dia;
          const tiene  = seleccionados.some(s => s.dia === dia);
          return (
            <button key={dia} onClick={() => setDia(dia)}
              style={{
                flexShrink:0, background: activo ? "#111" : "#fff",
                color: activo ? "#fff" : "#555",
                border:"0.5px solid " + (activo ? "#111" : "#e0e0e0"),
                borderRadius:10, padding:"9px 14px", cursor:"pointer",
                fontSize:14, fontWeight: activo ? 500 : 400, position:"relative",
              }}>
              {DIAS_CORTO[dia]}
              {tiene && (
                <span style={{position:"absolute", top:4, right:4, width:6, height:6, borderRadius:"50%", background:"#F5C400"}}/>
              )}
            </button>
          );
        })}
      </div>

      {/* Horarios */}
      <div style={{display:"flex", flexDirection:"column", gap:8, marginBottom:20}}>
        {horas.map(hora => {
          const sel      = esSel(diaActivo, hora);
          const c        = cupo(diaActivo, hora);
          const ocupados = CUPO - c;
          const lleno    = c <= 0 && !sel;
          const maxAlc   = seleccionados.length >= cantMax && planId !== "lv" && !sel;
          const block    = lleno || maxAlc;

          return (
            <button key={hora}
              onClick={() => !block && toggle(diaActivo, hora)}
              disabled={block}
              style={{
                background: sel ? "#FFFBEA" : lleno ? "#f9f9f9" : "#fff",
                border:"1.5px solid " + (sel ? "#F5C400" : lleno ? "#f0f0f0" : "#e0e0e0"),
                borderRadius:12, padding:"14px 16px",
                cursor: block ? "default" : "pointer",
                display:"flex", alignItems:"center", justifyContent:"space-between",
              }}>
              <div style={{display:"flex", alignItems:"center", gap:12}}>
                <span style={{fontSize:18, fontWeight:500, color: block&&!sel ? "#ccc" : "#111", minWidth:54}}>
                  {hora}
                </span>
                <div style={{display:"flex", gap:3, flexWrap:"wrap", maxWidth:120}}>
                  {Array.from({length:CUPO}, (_,i) => (
                    <span key={i} style={{
                      width:7, height:7, borderRadius:"50%", flexShrink:0,
                      background: i < ocupados
                        ? (sel ? "#F5C400" : ocupados>=CUPO ? "#f59e0b" : "#10b981")
                        : "#e8e8e8"
                    }}/>
                  ))}
                </div>
              </div>
              <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3}}>
                <span style={{fontSize:12, color:"#aaa"}}>{ocupados}/{CUPO}</span>
                {sel   && <span style={{fontSize:12, fontWeight:500, color:"#7a5c00", background:"#FFF8DC", padding:"2px 10px", borderRadius:20}}>✓ Elegido</span>}
                {lleno && <span style={{fontSize:12, color:"#92400e", background:"#fef3c7", padding:"2px 10px", borderRadius:20}}>Lleno</span>}
                {!sel && !lleno && c<=3 && <span style={{fontSize:12, color:"#92400e", background:"#fff7ed", padding:"2px 10px", borderRadius:20}}>{c} lugar{c!==1?"es":""}</span>}
              </div>
            </button>
          );
        })}
      </div>

      <button onClick={confirmar} disabled={!listo || guardando || ok}
        style={{
          width:"100%",
          background: ok ? "#10b981" : listo ? "#F5C400" : "#e0e0e0",
          color: ok ? "#fff" : listo ? "#111" : "#aaa",
          border:"none", borderRadius:12, padding:"15px",
          fontSize:16, fontWeight:700, cursor: (listo && !guardando && !ok) ? "pointer" : "default",
          transition: "background 0.3s",
        }}>
        {ok ? "✓ ¡Turnos reservados!" : guardando ? "Reservando..." : "Confirmar y reservar →"}
      </button>
      <p style={{fontSize:12, color:"#aaa", marginTop:8, textAlign:"center"}}>
        Se reservan automáticamente si hay lugar disponible.
      </p>
    </div>
  );
}

const card = {
  background:"#fff", border:"0.5px solid #e0e0e0",
  borderRadius:12, padding:"18px 16px"
};
