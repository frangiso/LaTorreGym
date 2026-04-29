import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const DIAS_FULL = { LUNES:"Lunes", MARTES:"Martes", MIERCOLES:"Miercoles", JUEVES:"Jueves", VIERNES:"Viernes", SABADO:"Sabado" };
const TURNOS_POR_PLAN = { "2dias": 2, "3dias": 3, "lv": 6, "suelta": 0 };

function getHorasDia(dia) {
  const [ini, fin] = dia === "SABADO" ? [8, 13] : [7, 22];
  return Array.from({ length: fin - ini + 1 }, (_, i) => String(i + ini).padStart(2, "0") + ":00");
}

export default function TurnosFijosPanel() {
  const [pendientes, setPendientes]   = useState([]);
  const [aprobados, setAprobados]     = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [procesando, setProcesando]   = useState(null);
  const [rechazandoUid, setRechazandoUid] = useState(null);
  const [motivo, setMotivo]           = useState("");
  const [asignandoA, setAsignandoA]   = useState(null); // alumno al que profe le asigna fijos
  const [diaActivo, setDiaActivo]     = useState("LUNES");
  const [selProfe, setSelProfe]       = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "usuarios"), snap => {
      const alumnos = snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(u => u.rol === "alumno");
      setPendientes(alumnos.filter(a => a.turnosFijosEstado === "pendiente" && (a.turnosFijos||[]).length > 0));
      setAprobados(alumnos.filter(a => a.turnosFijosEstado === "aprobado" && (a.turnosFijos||[]).length > 0));
      setCargando(false);
    });
    return () => unsub();
  }, []);

  async function aprobar(alumno) {
    setProcesando(alumno.uid);
    await updateDoc(doc(db, "usuarios", alumno.uid), {
      turnosFijosEstado: "aprobado",
      motivoRechazoFijos: null,
    });
    setProcesando(null);
  }

  async function rechazar(alumno) {
    setProcesando(alumno.uid);
    await updateDoc(doc(db, "usuarios", alumno.uid), {
      turnosFijosEstado: "rechazado",
      turnosFijos: [],
      motivoRechazoFijos: motivo || "El profe rechazo los turnos solicitados.",
    });
    setRechazandoUid(null); setMotivo(""); setProcesando(null);
  }

  async function quitarFijos(alumno) {
    if (!confirm("Quitar los turnos fijos de " + alumno.nombre + "?")) return;
    await updateDoc(doc(db, "usuarios", alumno.uid), {
      turnosFijosEstado: null, turnosFijos: [],
    });
  }

  // Profe asigna turnos fijos directamente
  function toggleProfe(dia, hora) {
    const planId = asignandoA?.planId || "";
    const cantMax = TURNOS_POR_PLAN[planId] ?? 0;
    const existe = selProfe.find(s => s.dia === dia && s.hora === hora);
    if (existe) { setSelProfe(prev => prev.filter(s => !(s.dia === dia && s.hora === hora))); return; }
    if (planId === "lv") {
      setSelProfe(prev => [...prev.filter(s => s.dia !== dia), { dia, hora }]);
      return;
    }
    if (selProfe.length >= cantMax) return;
    setSelProfe(prev => [...prev, { dia, hora }]);
  }

  async function guardarAsignacion() {
    if (!asignandoA) return;
    setProcesando(asignandoA.uid);
    await updateDoc(doc(db, "usuarios", asignandoA.uid), {
      turnosFijos: selProfe,
      turnosFijosEstado: "aprobado",
    });
    setAsignandoA(null); setSelProfe([]); setProcesando(null);
  }

  if (cargando) return <p style={{ color: "#888" }}>Cargando...</p>;

  // Modal de asignacion del profe
  if (asignandoA) {
    const planId   = asignandoA.planId || "";
    const cantMax  = TURNOS_POR_PLAN[planId] ?? 0;
    const horas    = getHorasDia(diaActivo);
    const lleno    = planId !== "lv" && selProfe.length >= cantMax;

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#111" }}>
              Asignar turnos — {asignandoA.nombre} {asignandoA.apellido}
            </div>
            <div style={{ fontSize: 13, color: "#888" }}>
              {planId === "lv" ? "1 horario por dia" : selProfe.length + "/" + cantMax + " turnos elegidos"}
            </div>
          </div>
          <button onClick={() => { setAsignandoA(null); setSelProfe([]); }}
            style={{ background: "transparent", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "7px 12px", fontSize: 13, color: "#888", cursor: "pointer" }}>
            Cancelar
          </button>
        </div>

        {/* Chips seleccionados */}
        {selProfe.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {selProfe.map((s, i) => (
              <span key={i} onClick={() => toggleProfe(s.dia, s.hora)}
                style={{ background: "#F5C400", color: "#111", fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 20, cursor: "pointer" }}>
                {(DIAS_FULL[s.dia]||s.dia).slice(0,3)} {s.hora} ✕
              </span>
            ))}
          </div>
        )}

        {/* Dias */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
          {DIAS.map(dia => {
            const activo = diaActivo === dia;
            const tiene  = selProfe.some(s => s.dia === dia);
            return (
              <button key={dia} onClick={() => setDiaActivo(dia)}
                style={{
                  flexShrink: 0, background: activo ? "#111" : "#fff",
                  color: activo ? "#fff" : "#555",
                  border: "0.5px solid " + (activo ? "#111" : "#e0e0e0"),
                  borderRadius: 10, padding: "8px 14px", cursor: "pointer",
                  fontSize: 13, position: "relative",
                }}>
                {(DIAS_FULL[dia]||dia).slice(0,3)}
                {tiene && <span style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: "#F5C400" }}/>}
              </button>
            );
          })}
        </div>

        {/* Horarios */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
          {horas.map(hora => {
            const sel   = selProfe.some(s => s.dia === diaActivo && s.hora === hora);
            const block = lleno && !sel;
            return (
              <button key={hora} onClick={() => !block && toggleProfe(diaActivo, hora)} disabled={block}
                style={{
                  background: sel ? "#FFFBEA" : block ? "#f9f9f9" : "#fff",
                  border: "1.5px solid " + (sel ? "#F5C400" : "#e0e0e0"),
                  borderRadius: 10, padding: "13px 16px", cursor: block ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                <span style={{ fontSize: 16, fontWeight: 500, color: block ? "#ccc" : "#111" }}>{hora}</span>
                <span style={{ fontSize: 18, color: sel ? "#F5C400" : block ? "#e0e0e0" : "#ccc" }}>{sel ? "✓" : "+"}</span>
              </button>
            );
          })}
        </div>

        <button onClick={guardarAsignacion}
          disabled={selProfe.length === 0 || !!procesando}
          style={{
            width: "100%",
            background: selProfe.length > 0 ? "#F5C400" : "#e0e0e0",
            color: selProfe.length > 0 ? "#111" : "#aaa",
            border: "none", borderRadius: 10, padding: "13px",
            fontSize: 15, fontWeight: 700, cursor: selProfe.length > 0 ? "pointer" : "default",
          }}>
          {procesando ? "Guardando..." : "Guardar y aprobar turnos"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 20px" }}>Turnos fijos</h2>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Solicitudes pendientes</h3>
            <span style={{ background: "#F5C400", color: "#111", fontSize: 12, fontWeight: 500, padding: "2px 10px", borderRadius: 20 }}>
              {pendientes.length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pendientes.map(a => (
              <div key={a.uid} style={{ background: "#fff", border: "1px solid #F5C400", borderRadius: 12, padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F5C400", color: "#111", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {(a.nombre||"?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{a.nombre} {a.apellido}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{a.planNombre || "Sin plan"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {(a.turnosFijos||[]).map((t, i) => (
                    <div key={i} style={{ background: "#FFFBEA", border: "1px solid #F5C400", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 500, color: "#7a5c00" }}>
                      {DIAS_FULL[t.dia]||t.dia} {t.hora}
                    </div>
                  ))}
                </div>
                {rechazandoUid === a.uid ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input value={motivo} onChange={e => setMotivo(e.target.value)}
                      placeholder="Motivo del rechazo (opcional)"
                      style={{ padding: "9px 12px", borderRadius: 8, border: "0.5px solid #e0e0e0", fontSize: 13 }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => rechazar(a)} disabled={procesando === a.uid}
                        style={{ flex: 1, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                        Confirmar rechazo
                      </button>
                      <button onClick={() => { setRechazandoUid(null); setMotivo(""); }}
                        style={{ background: "transparent", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#888", cursor: "pointer" }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => aprobar(a)} disabled={procesando === a.uid}
                      style={{ flex: 1, background: "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      {procesando === a.uid ? "..." : "✓ Aprobar"}
                    </button>
                    <button onClick={() => setRechazandoUid(a.uid)}
                      style={{ background: "transparent", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#888", cursor: "pointer" }}>
                      ✗ Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aprobados */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 12px" }}>Turnos fijos activos ({aprobados.length})</h3>
        {aprobados.length === 0 ? (
          <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "28px", textAlign: "center", color: "#aaa" }}>
            <p style={{ fontSize: 13 }}>Ningun alumno tiene turnos fijos activos.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {aprobados.map(a => (
              <div key={a.uid} style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#F5C400", color: "#111", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {(a.nombre||"?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{a.nombre} {a.apellido}</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>{a.planNombre} · Rec. usadas: {a.recuperacionesUsadas ?? 0}/2</div>
                    </div>
                  </div>
                  <span style={{ background: "#dcfce7", color: "#065f46", fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20 }}>Activo</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {(a.turnosFijos||[]).map((t, i) => (
                    <span key={i} style={{ background: "#FFFBEA", color: "#7a5c00", fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 20 }}>
                      {DIAS_FULL[t.dia]||t.dia} {t.hora}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setAsignandoA(a); setSelProfe(a.turnosFijos||[]); setDiaActivo("LUNES"); }}
                    style={{ background: "#f5f5f5", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, color: "#555", cursor: "pointer" }}>
                    Editar turnos
                  </button>
                  <button onClick={() => quitarFijos(a)}
                    style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, color: "#dc2626", cursor: "pointer" }}>
                    Quitar fijos
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sin nada */}
      {pendientes.length === 0 && aprobados.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#aaa" }}>
          <p style={{ fontSize: 14 }}>No hay solicitudes ni turnos fijos activos.</p>
        </div>
      )}
    </div>
  );
}
