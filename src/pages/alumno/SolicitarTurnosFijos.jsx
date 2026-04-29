import { useEffect, useState, useCallback } from "react";
import {
  doc, updateDoc, collection, query, where,
  onSnapshot, addDoc, deleteDoc, getDocs, serverTimestamp
} from "firebase/firestore";
import { db } from "../../firebase";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const DIAS_FULL  = { LUNES:"Lunes", MARTES:"Martes", MIERCOLES:"Miercoles",
                     JUEVES:"Jueves", VIERNES:"Viernes", SABADO:"Sabado" };
const DIAS_CORTO = { LUNES:"Lun", MARTES:"Mar", MIERCOLES:"Mie",
                     JUEVES:"Jue", VIERNES:"Vie", SABADO:"Sab" };
const TURNOS_POR_PLAN = { "2dias":2, "3dias":3, "lv":6, "suelta":0 };
const CUPO = 15;

function getHorasDia(dia) {
  const [ini, fin] = dia === "SABADO" ? [8,13] : [7,22];
  return Array.from({ length: fin-ini+1 }, (_,i) => String(i+ini).padStart(2,"0")+":00");
}

// Proximas N semanas de fechas para un dia de semana
function getProximasFechas(dia, semanas=5) {
  const idx = DIAS.indexOf(dia);
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const dow = hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dow===0 ? 6 : dow-1));
  const out = [];
  for (let s=0; s<semanas; s++) {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + s*7 + idx);
    if (d >= hoy) out.push(d.toISOString().split("T")[0]);
  }
  return out;
}

async function crearReservasFijas(alumnoUid, nombreAlumno, turnos) {
  for (const t of turnos) {
    const fechas = getProximasFechas(t.dia, 4);
    for (const fecha of fechas) {
      // Ver cupo real
      const q = query(
        collection(db,"reservas"),
        where("fecha","==",fecha),
        where("hora","==",t.hora)
      );
      const snap = await getDocs(q);
      // No duplicar
      if (snap.docs.some(d => d.data().alumnoId === alumnoUid)) continue;
      if (snap.size >= CUPO) continue;
      await addDoc(collection(db,"reservas"), {
        alumnoId: alumnoUid,
        nombreAlumno,
        dia: t.dia, hora: t.hora, fecha,
        esFijo: true, esRecuperacion: false,
        creadoEn: serverTimestamp(),
      });
    }
  }
}

async function borrarReservasFijas(alumnoUid) {
  const hoy = new Date().toISOString().split("T")[0];
  const q = query(
    collection(db,"reservas"),
    where("alumnoId","==",alumnoUid),
    where("esFijo","==",true)
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    if (d.data().fecha >= hoy) await deleteDoc(doc(db,"reservas",d.id));
  }
}

export default function SolicitarTurnosFijos({ perfil, user }) {
  const [diaActivo, setDiaActivo] = useState("LUNES");
  const [seleccionados, setSel]   = useState([]);
  const [ocupacion, setOcupacion] = useState({}); // "DIA_HHmm": count
  const [guardando, setGuardando] = useState(false);
  const [modo, setModo]           = useState("ver"); // "ver"|"elegir"

  const planId      = perfil?.planId || "";
  const cantMax     = TURNOS_POR_PLAN[planId] ?? 0;
  const turnosFijos = perfil?.turnosFijos || [];
  const estado      = perfil?.turnosFijosEstado || null;
  const esSuelta    = planId === "suelta";
  const recUsadas   = perfil?.recuperacionesUsadas ?? 0;

  // Escuchar ocupacion en tiempo real
  useEffect(() => {
    if (!planId || esSuelta || cantMax === 0) return;

    // Fechas de las proximas 4 semanas
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const dow = hoy.getDay();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1));
    const fechas = [];
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < 7; i++) {
        const d = new Date(lunes);
        d.setDate(lunes.getDate() + s * 7 + i);
        fechas.push(d.toISOString().split("T")[0]);
      }
    }

    const unsubscribers = [];
    for (let i = 0; i < fechas.length; i += 7) {
      const chunk = fechas.slice(i, i + 7);
      const q = query(collection(db, "reservas"), where("fecha", "in", chunk));
      const unsub = onSnapshot(q, snap => {
        setOcupacion(prev => {
          const conteos = { ...prev };
          snap.docs.forEach(d => {
            const r = d.data();
            const k = r.dia + "_" + r.hora.replace(":", "");
            conteos[k] = (conteos[k] || 0) + 1;
          });
          return conteos;
        });
      }, err => {
        console.error("Error ocupacion alumno:", err.message);
      });
      unsubscribers.push(unsub);
    }
    return () => { unsubscribers.forEach(fn => fn()); };
  }, [planId]);

  // Pre-cargar seleccionados con los turnos actuales al editar
  useEffect(() => {
    if (modo === "elegir" && turnosFijos.length > 0) setSel([...turnosFijos]);
  }, [modo]);

  function cupo(dia, hora) {
    const k = dia+"_"+hora.replace(":","");
    return Math.max(0, CUPO - (ocupacion[k]||0));
  }

  function esSel(dia, hora) { return seleccionados.some(s=>s.dia===dia&&s.hora===hora); }
  function esFijo(dia, hora) { return turnosFijos.some(t=>t.dia===dia&&t.hora===hora); }

  function toggle(dia, hora) {
    if (esSel(dia, hora)) {
      setSel(p => p.filter(s=>!(s.dia===dia&&s.hora===hora)));
      return;
    }
    if (cupo(dia,hora) <= 0) {
      alert("Ese turno está lleno. Elegí otro horario."); return;
    }
    if (planId==="lv") {
      // 1 por dia para L-V plan
      setSel(p => [...p.filter(s=>s.dia!==dia), {dia,hora}]);
      return;
    }
    if (seleccionados.length >= cantMax) {
      alert("Ya elegiste " + cantMax + " turno"+(cantMax!==1?"s":"")+". Deseleccioná uno para cambiar.");
      return;
    }
    setSel(p => [...p, {dia,hora}]);
  }

  async function confirmarTurnos() {
    if (seleccionados.length !== cantMax && planId !== "lv") return;
    if (planId === "lv" && seleccionados.length === 0) return;
    setGuardando(true);
    try {
      // Verificar cupos finales antes de guardar
      for (const t of seleccionados) {
        if (cupo(t.dia, t.hora) <= 0 && !esFijo(t.dia, t.hora)) {
          alert("El turno " + t.dia + " " + t.hora + " se llenó mientras elegías. Por favor elegí otro.");
          setGuardando(false); return;
        }
      }
      // Borrar reservas fijas anteriores
      await borrarReservasFijas(user.uid);
      // Guardar nuevos turnos fijos en el perfil
      await updateDoc(doc(db,"usuarios",user.uid), {
        turnosFijos: seleccionados,
        turnosFijosEstado: "aprobado",
        recuperacionesUsadas: 0,
      });
      // Crear reservas reales
      const nombre = (perfil?.nombre||"") + " " + (perfil?.apellido||"");
      await crearReservasFijas(user.uid, nombre.trim(), seleccionados);
      setModo("ver");
      setOk(true); setTimeout(()=>setOk(false), 3000);
    } catch(e) {
      console.error(e);
      alert("Hubo un error. Intentá de nuevo.");
    }
    setGuardando(false);
  }

  // ---- VISTAS ----

  if (esSuelta) return (
    <div style={card}>
      <p style={{fontSize:14,color:"#888",textAlign:"center"}}>Tu plan de clase suelta no requiere turno fijo.</p>
    </div>
  );
  if (!planId) return (
    <div style={card}>
      <p style={{fontSize:14,color:"#888",textAlign:"center"}}>No tenés un plan activo.</p>
    </div>
  );

  // Vista: turnos confirmados
  if (modo==="ver" && estado==="aprobado" && turnosFijos.length>0) return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {ok && <div style={{background:"#dcfce7",border:"1px solid #86efac",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#065f46",fontWeight:500}}>✓ Turnos actualizados correctamente</div>}
      <div style={card}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <span style={{background:"#dcfce7",color:"#065f46",fontSize:12,fontWeight:500,padding:"4px 12px",borderRadius:20}}>Turnos fijos activos</span>
          <button onClick={()=>{setSel([]);setModo("elegir");}}
            style={{background:"#f5f5f5",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,color:"#555",cursor:"pointer"}}>
            Cambiar turnos
          </button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {turnosFijos.map((t,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"#FFFBEA",border:"1.5px solid #F5C400",borderRadius:10}}>
              <span style={{fontSize:20}}>📌</span>
              <div>
                <div style={{fontSize:14,fontWeight:500,color:"#111"}}>{DIAS_FULL[t.dia]||t.dia}</div>
                <div style={{fontSize:13,color:"#888"}}>{t.hora} hs</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={card}>
        <div style={{fontSize:14,fontWeight:500,color:"#111",marginBottom:10}}>Clases de recuperación</div>
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
          {[0,1].map(i=>(
            <div key={i} style={{
              width:40,height:40,borderRadius:"50%",
              background: i<recUsadas ? "#fee2e2" : "#dcfce7",
              border:"2px solid "+(i<recUsadas ? "#fca5a5":"#86efac"),
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:18
            }}>{i<recUsadas?"✗":"✓"}</div>
          ))}
          <div>
            <div style={{fontSize:13,fontWeight:500,color:"#111"}}>{2-recUsadas} disponible{2-recUsadas!==1?"s":""}</div>
            <div style={{fontSize:12,color:"#aaa"}}>Se renuevan cada mes</div>
          </div>
        </div>
        <p style={{fontSize:12,color:"#666",lineHeight:1.6}}>
          Si avisás hasta 2 horas antes que no podés ir a tu turno fijo, podés usar una recuperación en cualquier horario libre ese mes.
        </p>
      </div>
    </div>
  );

  // Vista inicial: elegir por primera vez
  if (modo==="ver" && estado!=="aprobado") return (
    <div style={card}>
      <div style={{fontSize:15,fontWeight:500,color:"#111",marginBottom:8}}>Elegí tus turnos fijos</div>
      <p style={{fontSize:13,color:"#666",lineHeight:1.6,marginBottom:20}}>
        {planId==="lv"
          ? "Elegí 1 horario por día (lunes a sábado). Esos turnos quedan reservados automáticamente cada semana."
          : "Tu plan incluye "+cantMax+" turno"+(cantMax!==1?"s fijos":"fijo")+" por semana. Quedan reservados automáticamente si hay lugar."}
      </p>
      {ok && <p style={{color:"#10b981",fontSize:13,fontWeight:500,marginBottom:12}}>✓ Turnos guardados</p>}
      <button onClick={()=>{setSel([]);setModo("elegir");}}
        style={{width:"100%",background:"#F5C400",color:"#111",border:"none",borderRadius:10,padding:"13px",fontSize:15,fontWeight:700,cursor:"pointer"}}>
        Ver grilla y elegir →
      </button>
    </div>
  );

  // Vista: eligiendo (grilla en tiempo real)
  if (modo==="elegir") {
    const horas = getHorasDia(diaActivo);
    const listo = planId==="lv" ? seleccionados.length>0 : seleccionados.length===cantMax;

    return (
      <div>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div>
            <div style={{fontSize:15,fontWeight:500,color:"#111"}}>Elegí tus turnos fijos</div>
            <div style={{fontSize:13,color:"#888"}}>
              {planId==="lv"
                ? "1 horario por día · "+seleccionados.length+"/"+cantMax+" elegidos"
                : seleccionados.length+"/"+cantMax+" elegido"+(seleccionados.length!==1?"s":"")}
            </div>
          </div>
          <button onClick={()=>{setSel([]);setModo("ver");}}
            style={{background:"transparent",border:"0.5px solid #e0e0e0",borderRadius:8,padding:"7px 12px",fontSize:13,color:"#888",cursor:"pointer"}}>
            Cancelar
          </button>
        </div>

        {/* Chips seleccionados */}
        {seleccionados.length>0 && (
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {seleccionados.map((s,i)=>(
              <span key={i} onClick={()=>toggle(s.dia,s.hora)}
                style={{background:"#F5C400",color:"#111",fontSize:12,fontWeight:500,padding:"4px 12px",borderRadius:20,cursor:"pointer"}}>
                {DIAS_CORTO[s.dia]} {s.hora} ✕
              </span>
            ))}
          </div>
        )}

        {/* Selector dias */}
        <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
          {DIAS.map(dia=>{
            const activo = diaActivo===dia;
            const tieneSel = seleccionados.some(s=>s.dia===dia);
            return (
              <button key={dia} onClick={()=>setDiaActivo(dia)}
                style={{
                  flexShrink:0,background:activo?"#111":"#fff",
                  color:activo?"#fff":"#555",
                  border:"0.5px solid "+(activo?"#111":"#e0e0e0"),
                  borderRadius:10,padding:"8px 14px",cursor:"pointer",
                  fontSize:13,position:"relative"
                }}>
                {DIAS_CORTO[dia]}
                {tieneSel && <span style={{position:"absolute",top:4,right:4,width:6,height:6,borderRadius:"50%",background:"#F5C400"}}/>}
              </button>
            );
          })}
        </div>

        {/* Horarios con cupo en tiempo real */}
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:20}}>
          {horas.map(hora=>{
            const sel     = esSel(diaActivo, hora);
            const c       = cupo(diaActivo, hora);
            const lleno   = c<=0 && !sel;
            const ocupados = CUPO - c;
            const maxSel  = seleccionados.length>=cantMax && planId!=="lv";
            const block   = lleno || (maxSel && !sel);

            return (
              <button key={hora} onClick={()=>!block&&toggle(diaActivo,hora)} disabled={block}
                style={{
                  background: sel?"#FFFBEA": lleno?"#f9f9f9":"#fff",
                  border:"1.5px solid "+(sel?"#F5C400":lleno?"#f0f0f0":"#e0e0e0"),
                  borderRadius:10,padding:"12px 14px",cursor:block?"default":"pointer",
                  display:"flex",alignItems:"center",justifyContent:"space-between",
                }}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:17,fontWeight:500,color:block&&!sel?"#ccc":"#111",minWidth:52}}>{hora}</span>
                  {/* Puntitos en tiempo real */}
                  <div style={{display:"flex",gap:3,flexWrap:"wrap",maxWidth:120}}>
                    {Array.from({length:CUPO},(_,i)=>(
                      <span key={i} style={{
                        width:7,height:7,borderRadius:"50%",flexShrink:0,
                        background: i<ocupados
                          ? (sel?"#F5C400":ocupados>=CUPO?"#f59e0b":"#10b981")
                          : "#e8e8e8"
                      }}/>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                  <span style={{fontSize:11,color:"#aaa"}}>{ocupados}/{CUPO}</span>
                  {sel && <span style={{fontSize:11,fontWeight:500,color:"#7a5c00",background:"#FFF8DC",padding:"2px 8px",borderRadius:20}}>Seleccionado ✓</span>}
                  {lleno && <span style={{fontSize:11,color:"#92400e",background:"#fef3c7",padding:"2px 8px",borderRadius:20}}>Lleno</span>}
                  {!sel && !lleno && c<=3 && <span style={{fontSize:11,color:"#92400e",background:"#fff7ed",padding:"2px 8px",borderRadius:20}}>Solo {c} lugar{c!==1?"es":""}</span>}
                </div>
              </button>
            );
          })}
        </div>

        <button onClick={confirmarTurnos} disabled={!listo||guardando}
          style={{
            width:"100%",background:listo?"#F5C400":"#e0e0e0",
            color:listo?"#111":"#aaa",border:"none",borderRadius:10,
            padding:"14px",fontSize:15,fontWeight:700,cursor:listo?"pointer":"default"
          }}>
          {guardando?"Reservando turnos...":"Confirmar y reservar →"}
        </button>
        <p style={{fontSize:12,color:"#aaa",marginTop:8,textAlign:"center"}}>
          Los turnos se reservan automáticamente si hay lugar disponible.
        </p>
      </div>
    );
  }

  return null;
}

const card = {
  background:"#fff", border:"0.5px solid #e0e0e0",
  borderRadius:12, padding:"18px 16px"
};
