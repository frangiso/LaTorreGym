import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

const DIAS_ES = ["DOMINGO","LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];

function getHoy() {
  const hoy = new Date();
  return {
    fecha: hoy.toISOString().split("T")[0],
    dia: DIAS_ES[hoy.getDay()],
    label: hoy.toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
  };
}

export default function Dashboard() {
  const { fecha, dia, label } = getHoy();
  const [reservasHoy, setReservasHoy] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAgregar, setModalAgregar] = useState(false);
  const [totalActivos, setTotalActivos] = useState(0);
  const [pagosPendientes, setPagosPendientes] = useState(0);

  // Reservas de hoy en tiempo real
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

  // Stats de alumnos
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "usuarios"), snap => {
      const alumnos = snap.docs.map(d => d.data()).filter(u => u.rol === "alumno");
      setTotalActivos(alumnos.filter(a => a.estado === "activo").length);
      setPagosPendientes(alumnos.filter(a => a.estado === "pago_pendiente").length);
    });
    return () => unsub();
  }, []);

  async function marcarAsistencia(reservaId, asistio) {
    await updateDoc(doc(db, "reservas", reservaId), { asistio });
  }

  // Agrupar reservas por hora
  const porHora = reservasHoy.reduce((acc, r) => {
    if (!acc[r.hora]) acc[r.hora] = [];
    acc[r.hora].push(r);
    return acc;
  }, {});

  const horasConReservas = Object.keys(porHora).sort();

  return (
    <div>
      {/* Stats top */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Turnos hoy" valor={reservasHoy.length} color="#F5C400" />
        <StatCard label="Alumnos activos" valor={totalActivos} color="#10b981" />
        <StatCard label="Pagos pendientes" valor={pagosPendientes} color={pagosPendientes > 0 ? "#f59e0b" : "#aaa"} />
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 2px" }}>Turnos de hoy</h2>
          <p style={{ fontSize: 13, color: "#888", margin: 0, textTransform: "capitalize" }}>{label}</p>
        </div>
        <button onClick={() => setModalAgregar(true)}
          style={{ background: "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          + Agregar alumno
        </button>
      </div>

      {/* Contenido */}
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
              {/* Header hora */}
              <div style={{ background: "#111", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#F5C400", fontSize: 16, fontWeight: 500 }}>{hora}</span>
                <span style={{ color: "#888", fontSize: 12 }}>
                  {porHora[hora].length} / 15 — {porHora[hora].filter(r => r.asistio === true).length} presentes
                </span>
              </div>
              {/* Lista de alumnos */}
              <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                {porHora[hora].map(r => (
                  <div key={r.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 10px", borderRadius: 8,
                    background: r.asistio === true ? "#f0fdf4" : r.asistio === false ? "#fef2f2" : "#f9f9f9"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: "50%", background: "#F5C400",
                        color: "#111", fontSize: 11, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                      }}>
                        {(r.nombreAlumno || "?").charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 13, color: "#111" }}>{r.nombreAlumno}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => marcarAsistencia(r.id, r.asistio === true ? null : true)}
                        style={{
                          background: r.asistio === true ? "#10b981" : "transparent",
                          color: r.asistio === true ? "#fff" : "#10b981",
                          border: "1px solid #10b981", borderRadius: 6,
                          padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 500
                        }}>
                        ✓ Presente
                      </button>
                      <button
                        onClick={() => marcarAsistencia(r.id, r.asistio === false ? null : false)}
                        style={{
                          background: r.asistio === false ? "#ef4444" : "transparent",
                          color: r.asistio === false ? "#fff" : "#ef4444",
                          border: "1px solid #ef4444", borderRadius: 6,
                          padding: "4px 10px", fontSize: 12, cursor: "pointer"
                        }}>
                        ✗ Ausente
                      </button>
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

function StatCard({ label, valor, color }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 28, fontWeight: 500, color }}>{valor}</div>
      <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function ModalAgregarAlumno({ onClose }) {
  const [form, setForm] = useState({ nombre: "", apellido: "", telefono: "", planId: "", metodoPago: "efectivo" });
  const [planes, setPlanes] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "config", "gimnasio")).then(snap => {
      if (snap.exists()) setPlanes(snap.data().planes || []);
    });
  }, []);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function guardar() {
    if (!form.nombre || !form.apellido) return;
    setGuardando(true);
    const plan = planes.find(p => p.id === form.planId);
    const vence = new Date();
    vence.setMonth(vence.getMonth() + 1);
    vence.setDate(5);

    await addDoc(collection(db, "usuarios"), {
      nombre: form.nombre,
      apellido: form.apellido,
      telefono: form.telefono,
      email: "",
      rol: "alumno",
      estado: form.planId ? "activo" : "pendiente",
      planId: form.planId || null,
      planNombre: plan?.nombre || null,
      metodoPago: form.metodoPago,
      montoPagado: plan ? (form.metodoPago === "transferencia" ? plan.precioTransferencia : plan.precioEfectivo) : null,
      fechaActivacion: form.planId ? serverTimestamp() : null,
      fechaVencimiento: form.planId ? vence : null,
      creadoEn: serverTimestamp(),
      creadoPorProfe: true,
    });
    setOk(true);
    setTimeout(() => { setOk(false); setForm({ nombre: "", apellido: "", telefono: "", planId: "", metodoPago: "efectivo" }); }, 1500);
    setGuardando(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "28px 24px",
        width: "90%", maxWidth: 440
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 20px" }}>Agregar alumno manualmente</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Nombre *</label>
            <input name="nombre" value={form.nombre} onChange={handleChange}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "0.5px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Apellido *</label>
            <input name="apellido" value={form.apellido} onChange={handleChange}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "0.5px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }} />
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Teléfono</label>
          <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="2664XXXXXXX"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "0.5px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Plan (opcional)</label>
          <select name="planId" value={form.planId} onChange={handleChange}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "0.5px solid #e0e0e0", fontSize: 13 }}>
            <option value="">Sin plan asignado</option>
            {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>

        {form.planId && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Método de pago</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["transferencia", "efectivo"].map(m => (
                <button key={m} onClick={() => setForm(f => ({ ...f, metodoPago: m }))}
                  style={{
                    flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: form.metodoPago === m ? 500 : 400,
                    background: form.metodoPago === m ? "#F5C400" : "transparent",
                    border: form.metodoPago === m ? "none" : "0.5px solid #e0e0e0",
                    color: form.metodoPago === m ? "#111" : "#555"
                  }}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={guardar} disabled={guardando || !form.nombre || !form.apellido}
            style={{ flex: 1, background: ok ? "#10b981" : "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "11px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            {ok ? "✓ Guardado" : guardando ? "Guardando..." : "Agregar alumno"}
          </button>
          <button onClick={onClose}
            style={{ background: "transparent", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "11px 16px", fontSize: 13, color: "#888", cursor: "pointer" }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
