import { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot, doc, updateDoc,
  addDoc, deleteDoc, serverTimestamp, getDoc, orderBy
} from "firebase/firestore";
import { db } from "../../firebase";
import { correrMantenimiento, alumnosProximosAVencer } from "../../utils/mantenimiento";
import { exportarAlumnos, exportarPlanillaDia } from "../../utils/exportarExcel";
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
  const [reservasHoy, setReservasHoy]   = useState([]);
  const [todosAlumnos, setTodosAlumnos] = useState([]);
  const [avisos, setAvisos]             = useState([]);
  const [listaEspera, setListaEspera]   = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [modalAgregar, setModalAgregar] = useState(false);
  const [exportando, setExportando]     = useState(false);

  // Mantenimiento automático al montar
  useEffect(() => {
    correrMantenimiento().catch(console.error);
  }, []);

  // Alumnos
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "usuarios"), snap => {
      setTodosAlumnos(snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.rol === "alumno"));
    });
    return () => unsub();
  }, []);

  // Reservas de hoy
  useEffect(() => {
    if (dia === "DOMINGO") { setCargando(false); return; }
    const q = query(collection(db, "reservas"), where("fecha", "==", fecha));
    const unsub = onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => a.hora.localeCompare(b.hora));
      setReservasHoy(lista);
      setCargando(false);
    });
    return () => unsub();
  }, [fecha]);

  // Avisos activos
  useEffect(() => {
    const q = query(collection(db, "avisos"), where("activo", "==", true), orderBy("creadoEn", "desc"));
    const unsub = onSnapshot(q, snap => setAvisos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  // Lista de espera notificados
  useEffect(() => {
    const q = query(collection(db, "listaEspera"), where("notificado", "==", true));
    const unsub = onSnapshot(q, snap => setListaEspera(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  async function marcarAsistencia(reservaId, asistio) {
    await updateDoc(doc(db, "reservas", reservaId), { asistio });
  }

  async function cancelarReserva(reservaId) {
    await deleteDoc(doc(db, "reservas", reservaId));
  }

  async function handleExportar() {
    setExportando(true);
    await exportarAlumnos(todosAlumnos);
    setExportando(false);
  }

  async function handleExportarDia() {
    setExportando(true);
    await exportarPlanillaDia(reservasHoy, fecha);
    setExportando(false);
  }

  const activos        = todosAlumnos.filter(a => a.estado === "activo");
  const pagosPendientes = todosAlumnos.filter(a => a.estado === "pago_pendiente").length;
  const proximosVencer  = alumnosProximosAVencer(todosAlumnos, 7);
  const porHora = reservasHoy.reduce((acc, r) => {
    if (!acc[r.hora]) acc[r.hora] = [];
    acc[r.hora].push(r);
    return acc;
  }, {});
  const horasConReservas = Object.keys(porHora).sort();

  const TIPOS_AVISO = {
    info:    { bg: "#dbeafe", color: "#1e40af", borde: "#93c5fd" },
    alerta:  { bg: "#fef3c7", color: "#92400e", borde: "#fcd34d" },
    urgente: { bg: "#fee2e2", color: "#991b1b", borde: "#fca5a5" },
  };

  return (
    <div>
      {/* Avisos activos */}
      {avisos.map(a => {
        const t = TIPOS_AVISO[a.tipo] || TIPOS_AVISO.info;
        return (
          <div key={a.id} style={{ background: t.bg, border: "1px solid " + t.borde, borderRadius: 10, padding: "12px 16px", marginBottom: 12, fontSize: 13, color: t.color, lineHeight: 1.5 }}>
            <strong>{a.tipo === "urgente" ? "🚨 " : a.tipo === "alerta" ? "⚠️ " : "ℹ️ "}</strong>
            {a.texto}
          </div>
        );
      })}

      {/* Lista de espera notificados */}
      {listaEspera.length > 0 && (
        <div style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#1e40af", marginBottom: 6 }}>🔔 Alumnos en lista de espera con lugar disponible</div>
          {listaEspera.map(e => (
            <div key={e.id} style={{ fontSize: 12, color: "#1e40af", marginBottom: 4 }}>
              {e.nombreAlumno} — {e.dia} {e.hora} ({e.fecha})
            </div>
          ))}
        </div>
      )}

      {/* Alertas de vencimiento */}
      {proximosVencer.length > 0 && (
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#92400e", marginBottom: 6 }}>
            ⚠️ {proximosVencer.length} alumno{proximosVencer.length !== 1 ? "s" : ""} vence{proximosVencer.length !== 1 ? "n" : ""} esta semana
          </div>
          {proximosVencer.map(a => {
            const v = new Date(a.fechaVencimiento.toDate?.() || a.fechaVencimiento);
            return (
              <div key={a.uid} style={{ fontSize: 12, color: "#92400e" }}>
                {a.nombre} {a.apellido} — vence {v.toLocaleDateString("es-AR")}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Turnos hoy"         valor={reservasHoy.length}  color="#F5C400" />
        <StatCard label="Alumnos activos"    valor={activos.length}       color="#10b981" />
        <StatCard label="Pagos pendientes"   valor={pagosPendientes}      color={pagosPendientes > 0 ? "#f59e0b" : "#aaa"} />
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 2px" }}>Hoy</h2>
          <p style={{ fontSize: 13, color: "#888", margin: 0, textTransform: "capitalize" }}>{label}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleExportarDia} disabled={exportando}
            style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "#555" }}>
            {exportando ? "..." : "📋 Planilla del día"}
          </button>
          <button onClick={handleExportar} disabled={exportando}
            style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "#555" }}>
            {exportando ? "Exportando..." : "📊 Alumnos Excel"}
          </button>
          <button onClick={() => setModalAgregar(true)}
            style={{ background: "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            + Agregar alumno
          </button>
        </div>
      </div>

      {/* Turnos del día */}
      {cargando ? (
        <p style={{ color: "#aaa" }}>Cargando...</p>
      ) : dia === "DOMINGO" ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa" }}>
          <p style={{ fontSize: 15 }}>Hoy es domingo — el gimnasio no abre.</p>
        </div>
      ) : horasConReservas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa" }}>
          <p style={{ fontSize: 14 }}>No hay turnos reservados para hoy.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {horasConReservas.map(hora => (
            <div key={hora} style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: "#111", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#F5C400", fontSize: 16, fontWeight: 500 }}>{hora}</span>
                <span style={{ color: "#888", fontSize: 12 }}>
                  {porHora[hora].length} / 15 — {porHora[hora].filter(r => r.asistio === true).length} presentes
                </span>
              </div>
              <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                {porHora[hora].map(r => (
                  <div key={r.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 10px", borderRadius: 8, flexWrap: "wrap", gap: 8,
                    background: r.asistio === true ? "#f0fdf4" : r.asistio === false ? "#fef2f2" : "#f9f9f9"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#F5C400", color: "#111", fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {(r.nombreAlumno || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, color: "#111" }}>{r.nombreAlumno}</div>
                        <div style={{ fontSize: 10, color: "#aaa" }}>
                          {r.esFijo ? "Fijo" : r.esRecuperacion ? "Recuperación" : "Reserva"}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => marcarAsistencia(r.id, r.asistio === true ? null : true)}
                        style={{ background: r.asistio === true ? "#10b981" : "transparent", color: r.asistio === true ? "#fff" : "#10b981", border: "1px solid #10b981", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                        ✓ Presente
                      </button>
                      <button onClick={() => marcarAsistencia(r.id, r.asistio === false ? null : false)}
                        style={{ background: r.asistio === false ? "#ef4444" : "transparent", color: r.asistio === false ? "#fff" : "#ef4444", border: "1px solid #ef4444", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>
                        ✗ Ausente
                      </button>
                      <CancelarBtn reservaId={r.id} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAgregar && <ModalAgregarAlumno onClose={() => setModalAgregar(false)} />}
    </div>
  );
}

function CancelarBtn({ reservaId }) {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  if (confirm) return (
    <div style={{ display: "flex", gap: 4 }}>
      <button onClick={async () => { setLoading(true); await deleteDoc(doc(db, "reservas", reservaId)); }}
        disabled={loading}
        style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>
        {loading ? "..." : "Sí, cancelar"}
      </button>
      <button onClick={() => setConfirm(false)}
        style={{ background: "transparent", border: "0.5px solid #e0e0e0", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", color: "#888" }}>
        No
      </button>
    </div>
  );
  return (
    <button onClick={() => setConfirm(true)}
      style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>
      Cancelar turno
    </button>
  );
}

function StatCard({ label, valor, color }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 28, fontWeight: 500, color }}>{valor}</div>
      <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{label}</div>
    </div>
  );
}
