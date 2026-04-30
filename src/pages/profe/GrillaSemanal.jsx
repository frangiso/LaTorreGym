import { useEffect, useState } from "react";
import ModalAgregarAlumno from "./ModalAgregarAlumno";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useData } from "../../context/DataContext";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const DIAS_LABEL = { LUNES:"Lun", MARTES:"Mar", MIERCOLES:"Mié", JUEVES:"Jue", VIERNES:"Vie", SABADO:"Sáb" };

function getInicioSemana(offset = 0) {
  const hoy = new Date();
  const dia = hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dia === 0 ? 6 : dia - 1) + offset * 7);
  lunes.setHours(0,0,0,0);
  return lunes;
}

function getFechasDeSemana(inicio) {
  const f = {};
  DIAS.forEach((dia, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    f[dia] = d.toISOString().split("T")[0];
  });
  return f;
}

const CUPO = 15;

export default function GrillaSemanal() {
  const { feriados: feriadosCtx }       = useData();
  const [feriados, setFeriados]         = useState({});
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [reservasPorSlot, setReservasPorSlot] = useState({});
  const [feriados, setFeriados] = useState({});
  const [modalSlot, setModalSlot] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [modalAgregar, setModalAgregar] = useState(false);

  // Sincronizar con contexto (actualizaciones del profe se reflejan de inmediato)
  useEffect(() => { setFeriados(feriadosCtx); }, [feriadosCtx]);

  const inicioSemana = getInicioSemana(semanaOffset);
  const fechas = getFechasDeSemana(inicioSemana);
  const hoy = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const fechasArr = Object.values(fechas);
    const q = query(collection(db, "reservas"), where("fecha", "in", fechasArr));
    const unsub = onSnapshot(q, snap => {
      const map = {};
      snap.docs.forEach(d => {
        const r = d.data();
        const key = `${r.dia}_${r.hora.replace(":","")}_${r.fecha}`;
        if (!map[key]) map[key] = [];
        map[key].push({ id: d.id, ...r });
      });
      setReservasPorSlot(map);
      setCargando(false);
    });
    return () => unsub();
  }, [semanaOffset]);

  async function toggleFeriado(fecha) {
    if (feriados[fecha]) {
      await deleteDoc(doc(db, "feriados", fecha));
      setFeriados(f => { const n={...f}; delete n[fecha]; return n; });
    } else {
      await setDoc(doc(db, "feriados", fecha), { fecha, creadoEn: new Date() });
      setFeriados(f => ({ ...f, [fecha]: true }));
    }
  }

  const fmt = iso => { const [,m,d] = iso.split("-"); return `${d}/${m}`; };

  // Horas: L-V 7 a 22, Sáb 8 a 13
  const todasLasHoras = Array.from({ length: 16 }, (_, i) => `${String(i+7).padStart(2,"0")}:00`);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Grilla semanal</h2>
        <div style={{ display:"flex", gap: 8, alignItems:"center" }}>
          <button onClick={() => setModalAgregar(true)}
            style={{ background:"#F5C400", color:"#111", border:"none", borderRadius:8, padding:"7px 14px", fontSize:13, fontWeight:500, cursor:"pointer" }}>
            + Agregar alumno
          </button>
          <button onClick={() => setSemanaOffset(o => o-1)}
            style={{ background:"#fff", border:"0.5px solid #e0e0e0", borderRadius:8, padding:"7px 14px", cursor:"pointer", fontSize:14 }}>←</button>
          <span style={{ fontSize:13, color:"#888", minWidth:130, textAlign:"center" }}>
            {fmt(fechas["LUNES"])} — {fmt(fechas["SABADO"])}
          </span>
          <button onClick={() => setSemanaOffset(o => o+1)}
            style={{ background:"#fff", border:"0.5px solid #e0e0e0", borderRadius:8, padding:"7px 14px", cursor:"pointer", fontSize:14 }}>→</button>
          <button onClick={() => setSemanaOffset(0)}
            style={{ background:"#F5C400", border:"none", borderRadius:8, padding:"7px 14px", cursor:"pointer", fontSize:13, fontWeight:500 }}>
            Hoy
          </button>
        </div>
      </div>

      <div style={{ overflowX:"auto", background:"#fff", borderRadius:12, border:"0.5px solid #e0e0e0" }}>
        <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:0, minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom:"0.5px solid #e0e0e0" }}>
              <th style={{ width:56, padding:"10px 8px", fontSize:11, color:"#aaa", fontWeight:400 }}></th>
              {DIAS.map(dia => {
                const fecha = fechas[dia];
                const esFeriado = feriados[fecha];
                const esHoy = fecha === hoy;
                return (
                  <th key={dia} style={{ padding:"10px 4px", minWidth: 90 }}>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                      <span style={{ fontSize:12, fontWeight:500, color: esHoy ? "#F5C400" : "#444" }}>{DIAS_LABEL[dia]}</span>
                      <span style={{ fontSize:11, color: esHoy ? "#F5C400" : "#aaa" }}>{fmt(fecha)}</span>
                      <button onClick={() => toggleFeriado(fecha)}
                        style={{
                          background: esFeriado ? "#fee2e2" : "transparent",
                          border:"0.5px solid "+(esFeriado?"#fca5a5":"#e0e0e0"),
                          borderRadius:4, padding:"2px 6px", fontSize:10,
                          color: esFeriado?"#dc2626":"#ccc", cursor:"pointer"
                        }}>
                        {esFeriado ? "Feriado ✕" : "+ Feriado"}
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {todasLasHoras.map((hora, hi) => {
              const h = parseInt(hora);
              return (
                <tr key={hora} style={{ borderBottom: "0.5px solid #f0f0f0" }}>
                  <td style={{ padding:"4px 8px", fontSize:12, color:"#aaa", textAlign:"right", whiteSpace:"nowrap", fontWeight:400 }}>
                    {hora}
                  </td>
                  {DIAS.map(dia => {
                    const [hIni, hFin] = dia==="SABADO" ? [8,13] : [7,22];
                    if (h < hIni || h > hFin) {
                      return <td key={dia} style={{ background:"#f9f9f9", padding:4 }} />;
                    }
                    const fecha = fechas[dia];
                    if (feriados[fecha]) {
                      return <td key={dia} style={{ padding:4 }}>
                        <div style={{ background:"#fee2e2", borderRadius:6, height:44 }} />
                      </td>;
                    }
                    const key = `${dia}_${hora.replace(":","")}_${fecha}`;
                    const reservas = reservasPorSlot[key] || [];
                    const ocupados = reservas.length;
                    const lleno = ocupados >= CUPO;
                    const isPast = new Date(fecha+"T"+hora) < new Date();

                    return (
                      <td key={dia} style={{ padding:4 }}>
                        <button
                          onClick={() => setModalSlot({ dia, hora, fecha, reservas })}
                          style={{
                            width:"100%", height:44, borderRadius:8, border:"none", cursor:"pointer",
                            background: isPast ? "#f5f5f5" : lleno ? "#fef3c7" : ocupados>0 ? "#dcfce7" : "#f5f5f5",
                            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                            gap:3, padding:"4px 2px", transition:"background 0.1s"
                          }}>
                          {/* Puntos */}
                          <div style={{ display:"flex", flexWrap:"wrap", gap:3, justifyContent:"center", maxWidth:60 }}>
                            {Array.from({ length: Math.min(CUPO, 12) }, (_, i) => (
                              <span key={i} style={{
                                width:8, height:8, borderRadius:"50%", flexShrink:0,
                                background: i < Math.min(ocupados, 12)
                                  ? (lleno ? "#f59e0b" : "#10b981")
                                  : "#e0e0e0"
                              }}/>
                            ))}
                          </div>
                          {/* Contador */}
                          <span style={{ fontSize:10, color: lleno?"#92400e": ocupados>0?"#065f46":"#aaa", fontWeight:500 }}>
                            {ocupados}/{CUPO}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div style={{ display:"flex", gap:16, marginTop:12, flexWrap:"wrap" }}>
        {[
          { color:"#dcfce7", label:"Con reservas" },
          { color:"#fef3c7", label:"Cupo lleno" },
          { color:"#f5f5f5", label:"Sin reservas" },
          { color:"#fee2e2", label:"Feriado" },
        ].map(l => (
          <div key={l.label} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:12, height:12, borderRadius:3, background:l.color, border:"0.5px solid #e0e0e0", display:"inline-block" }}/>
            <span style={{ fontSize:12, color:"#888" }}>{l.label}</span>
          </div>
        ))}
      </div>

      {modalSlot && <ModalSlot slot={modalSlot} onClose={() => setModalSlot(null)} />}
      {modalAgregar && <ModalAgregarAlumno onClose={() => setModalAgregar(false)} />}
    </div>
  );
}

function ModalSlot({ slot, onClose }) {
  const { dia, hora, fecha } = slot;
  const [reservas, setReservas] = useState(slot.reservas || []);
  const [cancelando, setCancelando] = useState(null);

  async function cancelarReserva(reservaId) {
    setCancelando(reservaId);
    await deleteDoc(doc(db, "reservas", reservaId));
    setReservas(prev => prev.filter(r => r.id !== reservaId));
    setCancelando(null);
  }

  async function marcar(reservaId, valor) {
    await updateDoc(doc(db, "reservas", reservaId), { asistio: valor });
    setReservas(prev => prev.map(r => r.id === reservaId ? { ...r, asistio: valor } : r));
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}
      onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:16, padding:"24px", maxWidth:440, width:"90%", maxHeight:"85vh", overflowY:"auto" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <div>
            <h3 style={{ fontSize:16, fontWeight:500, margin:"0 0 2px" }}>{dia} {hora}</h3>
            <p style={{ fontSize:13, color:"#888", margin:0 }}>{fecha}</p>
          </div>
          <span style={{
            background: reservas.length >= CUPO ? "#fef3c7" : "#dcfce7",
            color: reservas.length >= CUPO ? "#92400e" : "#065f46",
            fontSize:12, fontWeight:500, padding:"3px 10px", borderRadius:20
          }}>
            {reservas.length}/{CUPO} lugares
          </span>
        </div>

        {reservas.length === 0 ? (
          <p style={{ color:"#aaa", fontSize:14, textAlign:"center", padding:"16px 0" }}>Sin reservas.</p>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {reservas.map(r => (
              <div key={r.id} style={{ background:"#f9f9f9", borderRadius:10, padding:"10px 12px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <div style={{ width:30, height:30, borderRadius:"50%", background:"#F5C400", color:"#111", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {(r.nombreAlumno||"?").charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:"#111" }}>{r.nombreAlumno}</div>
                    <div style={{ fontSize:11, color:"#aaa" }}>
                      {r.esFijo ? "Turno fijo" : r.esRecuperacion ? "Recuperación" : "Reserva normal"}
                    </div>
                  </div>
                </div>
                {/* Asistencia */}
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  <button onClick={() => marcar(r.id, r.asistio === true ? null : true)}
                    style={{
                      background: r.asistio === true ? "#10b981" : "transparent",
                      color: r.asistio === true ? "#fff" : "#10b981",
                      border:"1px solid #10b981", borderRadius:6,
                      padding:"4px 10px", fontSize:11, cursor:"pointer", fontWeight:500
                    }}>✓ Presente</button>
                  <button onClick={() => marcar(r.id, r.asistio === false ? null : false)}
                    style={{
                      background: r.asistio === false ? "#ef4444" : "transparent",
                      color: r.asistio === false ? "#fff" : "#ef4444",
                      border:"1px solid #ef4444", borderRadius:6,
                      padding:"4px 10px", fontSize:11, cursor:"pointer"
                    }}>✗ Ausente</button>
                  <button onClick={() => cancelarReserva(r.id)} disabled={cancelando === r.id}
                    style={{ background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer", marginLeft:"auto" }}>
                    {cancelando === r.id ? "..." : "Cancelar turno"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} style={{ width:"100%", marginTop:16, background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px", fontSize:13, cursor:"pointer" }}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
