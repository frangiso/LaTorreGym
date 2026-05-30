import { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot, doc,
  updateDoc, deleteDoc, serverTimestamp, addDoc
} from "firebase/firestore";
import { db } from "../../firebase";
import { useData } from "../../context/DataContext";
import { correrMantenimiento, alumnosProximosAVencer } from "../../utils/mantenimiento";
import { exportarAlumnos, exportarPlanillaDia, exportarPlanillaSemanal } from "../../utils/exportarExcel";
import ModalAgregarAlumno from "./ModalAgregarAlumno";

const DIAS_ES = ["DOMINGO","LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];

function getHoy() {
  const hoy = new Date();
  return {
    fecha: hoy.toISOString().split("T")[0],
    dia:   DIAS_ES[hoy.getDay()],
    label: hoy.toLocaleDateString("es-AR", { weekday:"long", year:"numeric", month:"long", day:"numeric" }),
  };
}

export default function Dashboard() {
  const { fecha, dia, label } = getHoy();
  const { alumnos, avisos, config } = useData(); // ya viene del contexto, 0 lecturas extra
  const cupoMax = config?.cupoMaximo ?? 15;
  const [reservasHoy, setReservasHoy]   = useState([]);
  const [listaEspera, setListaEspera]   = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [modalAgregar, setModalAgregar] = useState(false);
  const [exportando, setExportando]     = useState(false);
  const [reservasSemana, setReservasSemana] = useState([]);

  useEffect(() => { correrMantenimiento().catch(console.error); }, []);

  // Reservas de hoy
  useEffect(() => {
    if (dia === "DOMINGO") { setCargando(false); return; }
    const q = query(collection(db, "reservas"), where("fecha", "==", fecha));
    const fn = onSnapshot(q, snap => {
      setReservasHoy(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.hora.localeCompare(b.hora)));
      setCargando(false);
    });
    return fn;
  }, [fecha]);

  // Listener reservas de la semana
  useEffect(() => {
    const hoy = new Date();
    const dow = hoy.getDay();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1));
    const fechasSemana = Array.from({length:6}, (_,i) => {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      return d.toISOString().split("T")[0];
    });
    const q = query(collection(db, "reservas"), where("fecha", "in", fechasSemana));
    const fn = onSnapshot(q, snap => {
      setReservasSemana(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return fn;
  }, []);

  // Lista de espera — solo notificados (filtrado en Firestore)
  useEffect(() => {
    const q = query(collection(db, "listaEspera"), where("notificado", "==", true));
    const fn = onSnapshot(q, snap => {
      setListaEspera(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return fn;
  }, []);

  async function marcarAsistencia(id, val) {
    await updateDoc(doc(db, "reservas", id), { asistio: val });
  }

  // Stats calculados del contexto (sin lecturas extra)
  const activos         = alumnos.filter(a => a.estado === "activo").length;
  const pagosPendientes = alumnos.filter(a => a.estado === "pago_pendiente").length;
  const proximosVencer  = alumnosProximosAVencer(alumnos, 7);
  const yaVencidos      = alumnos.filter(a => a.cuotaVencida === true);

  const porHora = reservasHoy.reduce((acc, r) => {
    if (!acc[r.hora]) acc[r.hora] = [];
    acc[r.hora].push(r);
    return acc;
  }, {});

  const TIPOS = {
    info:    { bg:"#dbeafe", color:"#1e40af", borde:"#93c5fd" },
    alerta:  { bg:"#fef3c7", color:"#92400e", borde:"#fcd34d" },
    urgente: { bg:"#fee2e2", color:"#991b1b", borde:"#fca5a5" },
  };

  return (
    <div>
      {avisos.map(a => {
        const t = TIPOS[a.tipo] || TIPOS.info;
        return (
          <div key={a.id} style={{background:t.bg, border:"1px solid "+t.borde, borderRadius:10, padding:"10px 16px", marginBottom:10, fontSize:13, color:t.color, lineHeight:1.5}}>
            {a.tipo==="urgente"?"🚨 ":a.tipo==="alerta"?"⚠️ ":"ℹ️ "}{a.texto}
          </div>
        );
      })}

      {listaEspera.length > 0 && (
        <div style={{background:"#dbeafe", border:"1px solid #93c5fd", borderRadius:10, padding:"12px 16px", marginBottom:12}}>
          <div style={{fontSize:13, fontWeight:500, color:"#1e40af", marginBottom:6}}>🔔 Lista de espera con lugar disponible</div>
          {listaEspera.map(e => (
            <div key={e.id} style={{fontSize:12, color:"#1e40af", marginBottom:3}}>
              {e.nombreAlumno} — {e.dia} {e.hora} ({e.fecha})
            </div>
          ))}
        </div>
      )}

      {proximosVencer.length > 0 && (
        <div style={{background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:10, padding:"12px 16px", marginBottom:16}}>
          <div style={{fontSize:13, fontWeight:500, color:"#92400e", marginBottom:8}}>
            ⚠️ {proximosVencer.length} alumno{proximosVencer.length!==1?"s":""} vence{proximosVencer.length!==1?"n":""} esta semana
          </div>
          {proximosVencer.map(a => {
            const vRaw = new Date(a.fechaVencimiento.toDate?.() || a.fechaVencimiento);
            // Normalizar a fecha local sin hora para evitar desfase UTC
            const v    = new Date(vRaw.getFullYear(), vRaw.getMonth(), vRaw.getDate());
            const hoy  = new Date(); hoy.setHours(0,0,0,0);
            const dias = Math.round((v - hoy) / (1000*60*60*24));
            const telLimpio = (a.telefono || "").replace(/^0/, "").replace(/\s/g, "");
            const whatsapp = telLimpio ? `https://wa.me/54${telLimpio}?text=${encodeURIComponent(`Hola ${a.nombre}, te avisamos que tu plan vence el ${v.toLocaleDateString("es-AR")}. ¡Renovalo para seguir entrenando! 💪`)}` : null;
            return (
              <div key={a.uid} style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6, flexWrap:"wrap", gap:6}}>
                <div>
                  <span style={{fontSize:13, color:"#92400e", fontWeight:500}}>{a.nombre} {a.apellido}</span>
                  <span style={{fontSize:12, color:"#b45309", marginLeft:8}}>
                    vence {v.toLocaleDateString("es-AR")}
                    {dias <= 0 ? " — HOY" : dias === 1 ? " — mañana" : ` — en ${dias} días`}
                  </span>
                </div>
                {whatsapp && (
                  <a href={whatsapp} target="_blank" rel="noreferrer"
                    style={{fontSize:11, background:"#25D366", color:"#fff", padding:"3px 10px", borderRadius:20, textDecoration:"none", fontWeight:500, flexShrink:0}}>
                    WhatsApp
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {yaVencidos.length > 0 && (
        <div style={{background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:10, padding:"12px 16px", marginBottom:16}}>
          <div style={{fontSize:13, fontWeight:500, color:"#991b1b", marginBottom:8}}>
            🚨 {yaVencidos.length} alumno{yaVencidos.length!==1?"s":""} con plan vencido
          </div>
          {yaVencidos.map(a => {
            const telLimpio2 = (a.telefono || "").replace(/^0/, "").replace(/\s/g, "");
                const whatsapp = telLimpio2 ? `https://wa.me/54${telLimpio2}?text=${encodeURIComponent(`Hola ${a.nombre}, tu plan venció. ¡Renovalo para seguir entrenando en La Torre Gym! 💪`)}` : null;
            return (
              <div key={a.uid} style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4, flexWrap:"wrap", gap:6}}>
                <span style={{fontSize:13, color:"#991b1b"}}>{a.nombre} {a.apellido}</span>
                {whatsapp && (
                  <a href={whatsapp} target="_blank" rel="noreferrer"
                    style={{fontSize:11, background:"#25D366", color:"#fff", padding:"3px 10px", borderRadius:20, textDecoration:"none", fontWeight:500}}>
                    WhatsApp
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24}}>
        <StatCard label="Turnos hoy"       valor={reservasHoy.length} color="#F5C400"/>
        <StatCard label="Alumnos activos"  valor={activos}             color="#10b981"/>
        <StatCard label="Pagos pendientes" valor={pagosPendientes}     color={pagosPendientes>0?"#f59e0b":"#aaa"}/>
      </div>

      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10}}>
        <div>
          <h2 style={{fontSize:18, fontWeight:500, margin:"0 0 2px"}}>Hoy</h2>
          <p style={{fontSize:13, color:"#888", margin:0, textTransform:"capitalize"}}>{label}</p>
        </div>
        <div style={{display:"flex", gap:8}}>
          <button onClick={async () => {
            setExportando(true);
            try {
              const { getDocs, collection, query, where } = await import("firebase/firestore");
              const { db: _db } = await import("../../firebase");
              const hoy2 = new Date();
              const dow2 = hoy2.getDay();
              const lun2 = new Date(hoy2);
              lun2.setDate(hoy2.getDate() - (dow2===0?6:dow2-1));
              const fechas2 = Array.from({length:6},(_,i)=>{const d=new Date(lun2);d.setDate(lun2.getDate()+i);return d.toISOString().split("T")[0];});
              const snap2 = await getDocs(query(collection(_db,"reservas"), where("fecha","in",fechas2)));
              const reservas2 = snap2.docs.map(d=>({id:d.id,...d.data()}));
              await exportarPlanillaSemanal(reservas2, null);
            } catch(e){ console.error(e); alert("Error al exportar"); }
            setExportando(false);
          }}
            disabled={exportando}
            style={{background:"#fff", border:"0.5px solid #e0e0e0", borderRadius:8, padding:"8px 14px", fontSize:13, cursor:"pointer", color:"#555"}}>
            {exportando ? "..." : "📋 Planilla semanal"}
          </button>
          <button onClick={() => { setExportando(true); exportarAlumnos(alumnos).finally(() => setExportando(false)); }}
            disabled={exportando}
            style={{background:"#fff", border:"0.5px solid #e0e0e0", borderRadius:8, padding:"8px 14px", fontSize:13, cursor:"pointer", color:"#555"}}>
            {exportando ? "..." : "📊 Excel alumnos"}
          </button>
          <button onClick={() => setModalAgregar(true)}
            style={{background:"#F5C400", color:"#111", border:"none", borderRadius:8, padding:"9px 16px", fontSize:13, fontWeight:500, cursor:"pointer"}}>
            + Alumno
          </button>
        </div>
      </div>

      {cargando ? <p style={{color:"#aaa"}}>Cargando...</p>
       : dia === "DOMINGO" ? <p style={{textAlign:"center", color:"#aaa", padding:"32px 0"}}>Hoy es domingo — el gimnasio no abre.</p>
       : Object.keys(porHora).length === 0 ? <p style={{textAlign:"center", color:"#aaa", padding:"32px 0"}}>No hay turnos reservados para hoy.</p>
       : (
        <div style={{display:"flex", flexDirection:"column", gap:16}}>
          {Object.keys(porHora).sort().map(hora => (
            <div key={hora} style={{background:"#fff", border:"0.5px solid #e0e0e0", borderRadius:12, overflow:"hidden"}}>
              <div style={{background:"#111", padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                <span style={{color:"#F5C400", fontSize:16, fontWeight:500}}>{hora}</span>
                <span style={{color:"#888", fontSize:12}}>{porHora[hora].length}/{cupoMax} — {porHora[hora].filter(r=>r.asistio===true).length} presentes</span>
              </div>
              <div style={{padding:"8px 12px", display:"flex", flexDirection:"column", gap:6}}>
                {porHora[hora].map(r => (
                  <div key={r.id} style={{
                    display:"flex", alignItems:"center", justifyContent:"space-between",
                    padding:"8px 10px", borderRadius:8, flexWrap:"wrap", gap:8,
                    background: r.asistio===true?"#f0fdf4":r.asistio===false?"#fef2f2":"#f9f9f9"
                  }}>
                    <div style={{display:"flex", alignItems:"center", gap:10}}>
                      <div style={{width:30,height:30,borderRadius:"50%",background:"#F5C400",color:"#111",fontSize:11,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {(r.nombreAlumno||"?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{fontSize:13,color:"#111"}}>{r.nombreAlumno}</div>
                        <div style={{fontSize:10,color:"#aaa"}}>{r.esFijo?"Fijo":r.esRecuperacion?"Recuperación":"Reserva"}</div>
                      </div>
                    </div>
                    <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                      <button onClick={() => marcarAsistencia(r.id, r.asistio===true?null:true)}
                        style={{background:r.asistio===true?"#10b981":"transparent",color:r.asistio===true?"#fff":"#10b981",border:"1px solid #10b981",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:"pointer",fontWeight:500}}>
                        ✓ Presente
                      </button>
                      <button onClick={() => marcarAsistencia(r.id, r.asistio===false?null:false)}
                        style={{background:r.asistio===false?"#ef4444":"transparent",color:r.asistio===false?"#fff":"#ef4444",border:"1px solid #ef4444",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:"pointer"}}>
                        ✗ Ausente
                      </button>
                      <CancelarBtn reservaId={r.id} reserva={r}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {modalAgregar && <ModalAgregarAlumno onClose={() => setModalAgregar(false)}/>}
    </div>
  );
}

function CancelarBtn({ reservaId, reserva }) {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  if (confirm) return (
    <div style={{display:"flex", gap:4}}>
      <button onClick={async () => {
          setLoading(true);
          const r = reserva || {};
          await deleteDoc(doc(db,"reservas",reservaId));
          if (r.alumnoId) {
            await addDoc(collection(db,"notificaciones"), {
              alumnoId: r.alumnoId,
              tipo: r.esFijo ? "fijo_cancelado" : "turno_cancelado",
              dia: r.dia, hora: r.hora, fecha: r.fecha,
              leido: false, creadoEn: serverTimestamp(),
            });
          }
        }} disabled={loading}
        style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>
        {loading?"...":"Sí"}
      </button>
      <button onClick={() => setConfirm(false)}
        style={{background:"transparent",border:"0.5px solid #e0e0e0",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer",color:"#888"}}>
        No
      </button>
    </div>
  );
  return (
    <button onClick={() => setConfirm(true)}
      style={{background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>
      Cancelar
    </button>
  );
}

function StatCard({ label, valor, color }) {
  return (
    <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px"}}>
      <div style={{fontSize:28,fontWeight:500,color}}>{valor}</div>
      <div style={{fontSize:12,color:"#888",marginTop:4}}>{label}</div>
    </div>
  );
}
