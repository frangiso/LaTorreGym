import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, query, where } from "firebase/firestore";
import { db } from "../../firebase";

const DIAS_LABEL = { LUNES:"Lunes", MARTES:"Martes", MIERCOLES:"Miercoles", JUEVES:"Jueves", VIERNES:"Viernes", SABADO:"Sabado" };

export default function TurnosFijosPanel() {
  const [pendientes, setPendientes]   = useState([]);
  const [aprobados, setAprobados]     = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [procesando, setProcesando]   = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [rechazandoUid, setRechazandoUid] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "usuarios"), snap => {
      const alumnos = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.rol === "alumno");
      setPendientes(alumnos.filter(a => a.turnosFijosEstado === "pendiente" && (a.turnosFijos || []).length > 0));
      setAprobados(alumnos.filter(a => a.turnosFijosEstado === "aprobado" && (a.turnosFijos || []).length > 0));
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
      motivoRechazoFijos: motivoRechazo || "El profe rechazo los turnos solicitados.",
    });
    setRechazandoUid(null);
    setMotivoRechazo("");
    setProcesando(null);
  }

  async function quitarTurnosFijos(alumno) {
    if (!confirm("Quitar los turnos fijos de " + alumno.nombre + "?")) return;
    await updateDoc(doc(db, "usuarios", alumno.uid), {
      turnosFijosEstado: null,
      turnosFijos: [],
    });
  }

  if (cargando) return <p style={{ color: "#888" }}>Cargando...</p>;

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 20px" }}>Turnos fijos</h2>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: "#111" }}>Solicitudes pendientes</h3>
            <span style={{ background: "#F5C400", color: "#111", fontSize: 12, fontWeight: 500, padding: "2px 10px", borderRadius: 20 }}>
              {pendientes.length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pendientes.map(a => (
              <div key={a.uid} style={{ background: "#fff", border: "1px solid #F5C400", borderRadius: 12, padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F5C400", color: "#111", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {(a.nombre || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{a.nombre} {a.apellido}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{a.planNombre || "Sin plan"}</div>
                  </div>
                </div>

                {/* Turnos solicitados */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {(a.turnosFijos || []).map((t, i) => (
                    <div key={i} style={{ background: "#FFFBEA", border: "1px solid #F5C400", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 500, color: "#7a5c00" }}>
                      {DIAS_LABEL[t.dia] || t.dia} {t.hora}
                    </div>
                  ))}
                </div>

                {rechazandoUid === a.uid ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)}
                      placeholder="Motivo del rechazo (opcional)"
                      style={{ padding: "9px 12px", borderRadius: 8, border: "0.5px solid #e0e0e0", fontSize: 13 }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => rechazar(a)} disabled={procesando === a.uid}
                        style={{ flex: 1, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                        Confirmar rechazo
                      </button>
                      <button onClick={() => { setRechazandoUid(null); setMotivoRechazo(""); }}
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
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 12px", color: "#111" }}>
          Turnos fijos activos ({aprobados.length})
        </h3>
        {aprobados.length === 0 ? (
          <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "32px", textAlign: "center", color: "#aaa" }}>
            <p style={{ fontSize: 13 }}>Ningun alumno tiene turnos fijos activos aun.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {aprobados.map(a => (
              <div key={a.uid} style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#F5C400", color: "#111", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {(a.nombre || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{a.nombre} {a.apellido}</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>{a.planNombre}</div>
                    </div>
                  </div>
                  <span style={{ background: "#dcfce7", color: "#065f46", fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20 }}>Activo</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {(a.turnosFijos || []).map((t, i) => (
                    <span key={i} style={{ background: "#FFFBEA", color: "#7a5c00", fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 20 }}>
                      {DIAS_LABEL[t.dia] || t.dia} {t.hora}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
                  Recuperaciones usadas: {a.recuperacionesUsadas ?? 0}/2
                </div>
                <button onClick={() => quitarTurnosFijos(a)}
                  style={{ background: "transparent", border: "0.5px solid #e0e0e0", borderRadius: 6, padding: "5px 12px", fontSize: 12, color: "#888", cursor: "pointer" }}>
                  Quitar turnos fijos
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendientes.length === 0 && aprobados.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#aaa" }}>
          <p style={{ fontSize: 14 }}>No hay solicitudes ni turnos fijos activos.</p>
        </div>
      )}
    </div>
  );
}
