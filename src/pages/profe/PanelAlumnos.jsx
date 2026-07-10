import { generarReservasFijas, borrarReservasFijas } from "../../reservasFijas";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, getDoc, deleteDoc, query, where, getDocs, writeBatch, setDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { db } from "../../firebase";
import ModalAgregarAlumno from "./ModalAgregarAlumno";

const ESTADO_LABEL = { activo: "Activo", pago_pendiente: "Pago pendiente", pendiente: "Pendiente", inactivo: "Inactivo" };
const ESTADO_COLOR = {
  activo:         { bg: "#dcfce7", color: "#065f46" },
  pago_pendiente: { bg: "#fef3c7", color: "#92400e" },
  pendiente:      { bg: "#f0f0f0", color: "#555" },
  inactivo:       { bg: "#fee2e2", color: "#991b1b" },
};

export default function PanelAlumnos() {
  const { alumnos, config }         = useData();
  const { perfil: miPerfil }          = useAuth();
  const planes                      = config?.planes || [];
  const [filtro, setFiltro]         = useState("todos");
  const [busqueda, setBusqueda]     = useState("");
  const [editando, setEditando]     = useState(null);
  const [modalAgregar, setModalAgregar] = useState(false);

  const filtrados = alumnos.filter(a => {
    const matchEstado   = filtro === "todos" || a.estado === filtro;
    const matchBusqueda = !busqueda ||
      (a.nombre + " " + a.apellido + " " + a.email).toLowerCase().includes(busqueda.toLowerCase());
    return matchEstado && matchBusqueda;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 2px" }}>Alumnos</h2>
          <p style={{ fontSize: 13, color: "#888", margin: 0 }}>{alumnos.length} registrados</p>
        </div>
        <button onClick={() => setModalAgregar(true)}
          style={{ background: "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          + Agregar alumno
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {["todos", "activo", "pago_pendiente", "pendiente", "inactivo"].map(e => (
          <button key={e} onClick={() => setFiltro(e)}
            style={{
              background: filtro === e ? "#111" : "#fff",
              color:      filtro === e ? "#fff" : "#555",
              border: "0.5px solid " + (filtro === e ? "#111" : "#e0e0e0"),
              borderRadius: 20, padding: "5px 14px", fontSize: 12, cursor: "pointer"
            }}>
            {e === "todos" ? "Todos" : (ESTADO_LABEL[e] || e)}
          </button>
        ))}
      </div>

      <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o email..."
        style={{ width: "100%", marginBottom: 16, padding: "9px 14px", borderRadius: 8, border: "0.5px solid #e0e0e0", fontSize: 14, boxSizing: "border-box" }} />

      {filtrados.length === 0 ? (
        <p style={{ color: "#aaa", textAlign: "center", padding: "32px 0" }}>Sin resultados.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtrados.map(a => (
            <AlumnoCard key={a.uid} alumno={a} planes={planes}
              editando={editando === a.uid}
              onEditar={() => setEditando(a.uid)}
              onCerrar={() => setEditando(null)} />
          ))}
        </div>
      )}

      {modalAgregar && <ModalAgregarAlumno onClose={() => setModalAgregar(false)} />}
    </div>
  );
}

const DIAS_SEMANA = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const HORAS = Array.from({ length: 16 }, (_, i) => String(i + 7).padStart(2, "0") + ":00");
const HORAS_SAB = Array.from({ length: 6 }, (_, i) => String(i + 8).padStart(2, "0") + ":00");

function AlumnoCard({ alumno: a, planes, editando, onEditar, onCerrar }) {
  const colors = ESTADO_COLOR[a.estado] || { bg: "#f0f0f0", color: "#555" };
  const [tab, setTab] = useState("datos"); // "datos" | "turnos"
  const [form, setForm] = useState({
    nombre:              a.nombre || "",
    apellido:            a.apellido || "",
    telefono:            a.telefono || "",
    telefonoEmergencia:  a.telefonoEmergencia || "",
    nombreEmergencia:    a.nombreEmergencia || "",
    estado:              a.estado || "pendiente",
    planId:              a.planId || "",
    metodoPago:          a.metodoPago || "efectivo",
    clasesUsadasMes:     a.clasesUsadasMes ?? 0,
    recuperacionesUsadas: a.recuperacionesUsadas ?? 0,
    descuentoFutbol:     a.descuentoFutbol ?? false,
  });
  // turnosFijos: [{ dia, hora }]
  const [turnosFijos, setTurnosFijos]   = useState(a.turnosFijos || []);
  const [guardando, setGuardando]       = useState(false);
  const [ok, setOk]                     = useState(false);
  const [modalRenovar, setModalRenovar] = useState(false);
  const [metodoRenovar, setMetodoRenovar] = useState("efectivo");
  const [pagos, setPagos] = useState([]);
  const [cargandoPagos, setCargandoPagos] = useState(false);

  useEffect(() => {
    if (tab !== "historial" || !editando) return;
    setCargandoPagos(true);
    getDocs(query(collection(db, "pagos"), where("alumnoUid", "==", a.uid)))
      .then(snap => {
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        lista.sort((x, y) => {
          const fx = x.fechaPago?.toDate?.() || new Date(x.fechaPago || 0);
          const fy = y.fechaPago?.toDate?.() || new Date(y.fechaPago || 0);
          return fy - fx;
        });
        setPagos(lista);
      })
      .finally(() => setCargandoPagos(false));
  }, [tab, editando, a.uid]);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  function toggleTurno(dia, hora) {
    setTurnosFijos(prev => {
      const existe = prev.find(t => t.dia === dia && t.hora === hora);
      if (existe) return prev.filter(t => !(t.dia === dia && t.hora === hora));
      return [...prev, { dia, hora }];
    });
  }

  function tieneTurno(dia, hora) {
    return turnosFijos.some(t => t.dia === dia && t.hora === hora);
  }

  async function renovar() {
    if (!a.planId) { alert("Este alumno no tiene plan asignado. Editalo primero."); return; }
    setGuardando(true);
    try {
      const plan = planes.find(p => p.id === a.planId);
      await updateDoc(doc(db, "usuarios", a.uid), {
        estado:       "pago_pendiente",
        metodoPago:   metodoRenovar,
        montoPagado:  plan ? (metodoRenovar === "transferencia" ? plan.precioTransferencia : plan.precioEfectivo) : a.montoPagado,
        cuotaVencida: false,
      });
      setModalRenovar(false);
    } catch(e) {
      alert("Error al renovar. Intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function guardar() {
    setGuardando(true);
    try {
      const plan = planes.find(p => p.id === form.planId);
      const hoy = new Date();
      const vencAnterior = a.fechaVencimiento
        ? new Date(a.fechaVencimiento.toDate?.() || a.fechaVencimiento)
        : null;
      const base = vencAnterior && vencAnterior > hoy ? vencAnterior : hoy;
      const vence = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate());

      const updates = {
        nombre:             form.nombre,
        apellido:           form.apellido,
        telefono:           form.telefono,
        telefonoEmergencia: form.telefonoEmergencia,
        nombreEmergencia:   form.nombreEmergencia,
        estado:             form.estado,
        planId:             form.planId || null,
        planNombre:         plan ? plan.nombre : null,
        metodoPago:         form.metodoPago,
        clasesUsadasMes:    Number(form.clasesUsadasMes),
        recuperacionesUsadas: Number(form.recuperacionesUsadas ?? 0),
        descuentoFutbol:    form.descuentoFutbol ?? false,
        turnosFijos,
        turnosFijosEstado: turnosFijos.length > 0 ? "aprobado" : null,
      };

      if (form.planId && form.planId !== a.planId) {
        updates.montoPagado      = form.metodoPago === "transferencia" ? plan.precioTransferencia : plan.precioEfectivo;
        updates.fechaActivacion  = new Date();
        updates.fechaVencimiento = vence;
        updates.estado           = "activo";
      }

      await updateDoc(doc(db, "usuarios", a.uid), updates);
      if (turnosFijos.length > 0) {
        await generarReservasFijas({
          uid: a.uid,
          nombre: updates.nombre,
          apellido: updates.apellido,
          turnosFijos,
          turnosFijosEstado: "aprobado",
        }, 4);
      }
      setOk(true);
      setTimeout(() => { setOk(false); onCerrar(); }, 1200);
    } catch(e) {
      console.error("Error guardando alumno:", e);
      alert("Error al guardar. Intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarAlumno() {
    const nombre = a.nombre + " " + a.apellido;
    if (!confirm("¿Eliminar a " + nombre + "? Esta acción no se puede deshacer.")) return;
    if (!confirm("Segunda confirmación: ¿estás seguro de eliminar a " + nombre + "?")) return;
    setGuardando(true);
    try {
      // 1. Borrar reservas futuras
      await borrarReservasFijas(a.uid);
      // 2. Borrar reservas pasadas del alumno
      const qRes = query(collection(db, "reservas"), where("alumnoId", "==", a.uid));
      const snapRes = await getDocs(qRes);
      const batch = writeBatch(db);
      snapRes.docs.forEach(d => batch.delete(doc(db, "reservas", d.id)));
      if (snapRes.docs.length > 0) await batch.commit();
      // 3. Liberar el email para que pueda volver a registrarse
      if (a.email) {
        await setDoc(doc(db, "emailsLiberados", a.email.replace(/\./g, "_")), {
          email: a.email,
          liberadoEn: serverTimestamp(),
          nombreAnterior: nombre,
        });
      }
      // 4. Borrar perfil del usuario
      await deleteDoc(doc(db, "usuarios", a.uid));
    } catch(e) {
      console.error(e);
      alert("Error al eliminar. Intentá de nuevo.");
    }
    setGuardando(false);
  }

  const inp = {
    width: "100%", padding: "8px 12px", borderRadius: 8,
    border: "0.5px solid #e0e0e0", fontSize: 13,
    boxSizing: "border-box", outline: "none", background: "#fff",
  };

  const vence = a.fechaVencimiento
    ? new Date(a.fechaVencimiento.toDate?.() || a.fechaVencimiento).toLocaleDateString("es-AR")
    : null;

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, overflow: "hidden" }}>

      {/* Modal renovar */}
      {modalRenovar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setModalRenovar(false)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 20px", maxWidth: 360, width: "100%" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 4px" }}>
              {a.estado === "activo" ? "Registrar pago" : "Renovar plan"}
            </h3>
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px" }}>{a.nombre} {a.apellido} · {a.planNombre}</p>
            {a.estado === "activo" && vence && (
              <p style={{ fontSize: 12, color: "#888", margin: "0 0 16px", background: "#f9f9f9", borderRadius: 8, padding: "8px 12px" }}>
                Plan vigente hasta el <strong>{vence}</strong>. Al confirmar el pago se suma un mes a partir de esa fecha (no se pierden los días restantes).
              </p>
            )}
            <p style={{ fontSize: 12, fontWeight: 500, color: "#555", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Método de pago</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["efectivo", "transferencia"].map(m => (
                <button key={m} onClick={() => setMetodoRenovar(m)}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: metodoRenovar === m ? 600 : 400,
                    background: metodoRenovar === m ? "#F5C400" : "transparent",
                    border: metodoRenovar === m ? "none" : "0.5px solid #e0e0e0",
                    color: metodoRenovar === m ? "#111" : "#555" }}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            {metodoRenovar === "transferencia" && (
              <p style={{ fontSize: 12, color: "#888", margin: "0 0 16px", background: "#f9f9f9", borderRadius: 8, padding: "8px 12px" }}>
                Con transferencia no se aplican descuentos.
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={renovar} disabled={guardando}
                style={{ flex: 1, background: "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                {guardando ? "Procesando..." : a.estado === "activo" ? "Registrar pago" : "Confirmar renovación"}
              </button>
              <button onClick={() => setModalRenovar(false)}
                style={{ background: "transparent", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "11px 14px", fontSize: 13, color: "#888", cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fila colapsada */}
      <div onClick={editando ? undefined : onEditar}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: editando ? "default" : "pointer" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F5C400", color: "#111", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {(a.nombre || "?").charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{a.nombre} {a.apellido}</div>
          <div style={{ fontSize: 12, color: "#888" }}>
            {a.planNombre || "Sin plan"}
            {vence ? " · vence " + vence : ""}
            {(a.turnosFijos || []).length > 0 ? " · " + a.turnosFijos.length + " turnos fijos" : ""}
          </div>
        </div>
        <span style={{ background: colors.bg, color: colors.color, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20, flexShrink: 0 }}>
          {ESTADO_LABEL[a.estado] || a.estado}
        </span>
        {a.planId && a.estado !== "pago_pendiente" && a.estado !== "pendiente" && (
          <button onClick={e => { e.stopPropagation(); setMetodoRenovar("efectivo"); setModalRenovar(true); }}
            style={{ background: "#F5C400", color: "#111", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
            {a.estado === "activo" ? "Registrar pago" : "Renovar"}
          </button>
        )}
        <span style={{ color: "#aaa", fontSize: 12 }}>{editando ? "▲" : "✏️"}</span>
      </div>

      {/* Panel edicion */}
      {editando && (
        <div style={{ borderTop: "0.5px solid #f0f0f0" }}>

          {/* Tabs internos */}
          <div style={{ display: "flex", borderBottom: "0.5px solid #f0f0f0" }}>
            {[["datos","Datos"], ["turnos","Turnos fijos"], ["historial","Historial de pagos"]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                style={{
                  background: "transparent", border: "none",
                  borderBottom: tab === k ? "2px solid #F5C400" : "2px solid transparent",
                  padding: "10px 18px", fontSize: 13,
                  fontWeight: tab === k ? 500 : 400,
                  color: tab === k ? "#111" : "#888", cursor: "pointer"
                }}>
                {l}
              </button>
            ))}
          </div>

          <div style={{ padding: "16px 16px 20px" }}>

            {/* TAB DATOS */}
            {tab === "datos" && (
              <>
                <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>Datos personales</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>Nombre</label>
                    <input name="nombre" value={form.nombre} onChange={handleChange} style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>Apellido</label>
                    <input name="apellido" value={form.apellido} onChange={handleChange} style={inp} />
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>Telefono</label>
                  <input name="telefono" value={form.telefono} onChange={handleChange} style={inp} />
                </div>

                <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>Contacto de emergencia</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>Nombre</label>
                    <input name="nombreEmergencia" value={form.nombreEmergencia} onChange={handleChange} placeholder="Ej: Maria (madre)" style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>Telefono</label>
                    <input name="telefonoEmergencia" value={form.telefonoEmergencia} onChange={handleChange} style={inp} />
                  </div>
                </div>

                <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>Plan y estado</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>Plan</label>
                    <select name="planId" value={form.planId} onChange={handleChange} style={{ ...inp }}>
                      <option value="">Sin plan</option>
                      {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>Estado</label>
                    <select name="estado" value={form.estado} onChange={handleChange} style={{ ...inp }}>
                      <option value="activo">Activo</option>
                      <option value="pago_pendiente">Pago pendiente</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>Metodo de pago</label>
                    <select name="metodoPago" value={form.metodoPago} onChange={handleChange} style={{ ...inp }}>
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>Clases usadas este mes</label>
                    <input type="number" name="clasesUsadasMes" value={form.clasesUsadasMes} onChange={handleChange} min="0" style={inp} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 14px", background: form.descuentoFutbol ? "#dcfce7" : "#f9f9f9", borderRadius: 8, border: "0.5px solid " + (form.descuentoFutbol ? "#86efac" : "#e0e0e0") }}>
                      <input type="checkbox" checked={form.descuentoFutbol ?? false}
                        onChange={e => setForm(f => ({ ...f, descuentoFutbol: e.target.checked }))}
                        style={{ width: 16, height: 16, accentColor: "#10b981" }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: form.descuentoFutbol ? "#065f46" : "#555" }}>⚽ Familiar escuela de fútbol La Torre</div>
                        <div style={{ fontSize: 11, color: "#888" }}>Aplica 15% de descuento en la cuota mensual</div>
                      </div>
                    </label>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>
                      Recuperaciones usadas ({form.recuperacionesUsadas ?? 0}/2)
                    </label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="number" name="recuperacionesUsadas" value={form.recuperacionesUsadas ?? 0}
                        onChange={handleChange} min="0" max="2" style={{ ...inp, flex: 1 }} />
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, recuperacionesUsadas: Math.max(0, (f.recuperacionesUsadas ?? 1) - 1) }))}
                        disabled={(form.recuperacionesUsadas ?? 0) <= 0}
                        title="Devolver 1 recuperación por ausencia justificada"
                        style={{
                          background: (form.recuperacionesUsadas ?? 0) > 0 ? "#dcfce7" : "#f5f5f5",
                          color: (form.recuperacionesUsadas ?? 0) > 0 ? "#065f46" : "#ccc",
                          border: "none", borderRadius: 8, padding: "8px 10px",
                          fontSize: 12, fontWeight: 500,
                          cursor: (form.recuperacionesUsadas ?? 0) > 0 ? "pointer" : "default",
                          whiteSpace: "nowrap", flexShrink: 0,
                        }}>
                        ↩ Devolver
                      </button>
                    </div>
                    <p style={{ fontSize: 11, color: "#aaa", margin: "3px 0 0" }}>
                      Usá "Devolver" si el alumno faltó por causa justificada.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* TAB TURNOS FIJOS */}
            {tab === "turnos" && (
              <>
                <p style={{ fontSize: 13, color: "#888", margin: "0 0 14px", lineHeight: 1.5 }}>
                  Selecciona los dias y horarios fijos de este alumno. Aparecen marcados en su grilla cada semana.
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ fontSize: 11, color: "#aaa", fontWeight: 400, padding: "4px 8px", textAlign: "left" }}>Hora</th>
                        {DIAS_SEMANA.map(d => (
                          <th key={d} style={{ fontSize: 11, color: "#555", fontWeight: 500, padding: "4px 6px", textAlign: "center" }}>{d.slice(0,3)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {HORAS.map(hora => {
                        const h = parseInt(hora);
                        return (
                          <tr key={hora}>
                            <td style={{ fontSize: 11, color: "#aaa", padding: "2px 8px", whiteSpace: "nowrap" }}>{hora}</td>
                            {DIAS_SEMANA.map(dia => {
                              const [hIni, hFin] = dia === "SABADO" ? [8, 13] : [7, 22];
                              if (h < hIni || h > hFin) return <td key={dia} style={{ background: "#f9f9f9", padding: 2 }} />;
                              const activo = tieneTurno(dia, hora);
                              return (
                                <td key={dia} style={{ padding: 2 }}>
                                  <button onClick={() => toggleTurno(dia, hora)}
                                    style={{
                                      width: "100%", height: 28, borderRadius: 6, border: "none", cursor: "pointer",
                                      background: activo ? "#F5C400" : "#f0f0f0",
                                      color: activo ? "#111" : "#ccc",
                                      fontSize: 10, fontWeight: activo ? 700 : 400,
                                    }}>
                                    {activo ? "✓" : ""}
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
                {turnosFijos.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {turnosFijos.map(t => (
                      <span key={t.dia + t.hora} style={{ background: "#FFF8DC", color: "#7a5c00", fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20 }}>
                        {t.dia.slice(0,3)} {t.hora}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* TAB HISTORIAL DE PAGOS */}
            {tab === "historial" && (
              <>
                {cargandoPagos ? (
                  <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Cargando historial...</p>
                ) : pagos.length === 0 ? (
                  <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                    Todavía no hay pagos registrados para este alumno.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {pagos.map(p => {
                      const fecha = p.fechaPago?.toDate?.() || new Date(p.fechaPago);
                      return (
                        <div key={p.id} style={{ background: p.anulado ? "#fef2f2" : "#f9f9f9", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, opacity: p.anulado ? 0.7 : 1 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>
                              {fecha.toLocaleDateString("es-AR")}
                              {p.nroRecibo ? ` · Recibo #${p.nroRecibo}` : ""}
                              {p.anulado && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: "#dc2626" }}>ANULADO</span>}
                            </div>
                            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                              {p.planNombre || "Sin plan"}
                              {p.descuentoAplicado ? ` · ${p.descuentoAplicado}` : ""}
                              {p.inscripcionCobrada ? ` · + inscripción $${(p.montoInscripcion || 0).toLocaleString("es-AR")}` : ""}
                            </div>
                            <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>
                              {(p.montoEfectivo || 0) > 0 && <span>Efectivo ${p.montoEfectivo.toLocaleString("es-AR")}</span>}
                              {(p.montoEfectivo || 0) > 0 && (p.montoTransferencia || 0) > 0 && <span> · </span>}
                              {(p.montoTransferencia || 0) > 0 && <span>Transf. ${p.montoTransferencia.toLocaleString("es-AR")}</span>}
                            </div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#111", textDecoration: p.anulado ? "line-through" : "none" }}>
                            ${(p.montoTotal || 0).toLocaleString("es-AR")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Botones */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
              <button onClick={eliminarAlumno} disabled={guardando}
                style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}>
                🗑 Eliminar alumno
              </button>
              <button onClick={guardar} disabled={guardando}
                style={{ background: ok ? "#10b981" : "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                {ok ? "Guardado" : guardando ? "Guardando..." : "Guardar cambios"}
              </button>
              <button onClick={onCerrar}
                style={{ background: "transparent", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "9px 16px", fontSize: 13, color: "#888", cursor: "pointer" }}>
                Cancelar
              </button>
              {a.telefono && (
                <a href={"https://wa.me/549" + a.telefono.replace(/\D/g, "")} target="_blank" rel="noreferrer"
                  style={{ background: "#e8f8f0", color: "#1a7a45", borderRadius: 8, padding: "9px 14px", fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
