import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

const ESTADO_LABEL = { activo: "Activo", pago_pendiente: "Pago pendiente", pendiente: "Pendiente", inactivo: "Inactivo" };
const ESTADO_COLOR = {
  activo:        { bg: "#dcfce7", color: "#065f46" },
  pago_pendiente:{ bg: "#fef3c7", color: "#92400e" },
  pendiente:     { bg: "#f0f0f0", color: "#555" },
  inactivo:      { bg: "#fee2e2", color: "#991b1b" },
};

export default function PanelAlumnos() {
  const [alumnos, setAlumnos] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null); // uid del alumno en edicion
  const [planes, setPlanes] = useState([]);

  useEffect(() => {
    getDoc(doc(db, "config", "gimnasio")).then(snap => {
      if (snap.exists()) setPlanes(snap.data().planes || []);
    });
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "usuarios"), snap => {
      const lista = snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(u => u.rol === "alumno")
        .sort((a, b) => (a.apellido || "").localeCompare(b.apellido || ""));
      setAlumnos(lista);
      setCargando(false);
    });
    return () => unsub();
  }, []);

  const filtrados = alumnos.filter(a => {
    const matchEstado = filtro === "todos" || a.estado === filtro;
    const matchBusqueda = !busqueda || (a.nombre + " " + a.apellido + " " + a.email).toLowerCase().includes(busqueda.toLowerCase());
    return matchEstado && matchBusqueda;
  });

  if (cargando) return <p style={{ color: "#888" }}>Cargando...</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Alumnos</h2>
        <span style={{ fontSize: 13, color: "#888" }}>{alumnos.length} registrados</span>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {["todos", "activo", "pago_pendiente", "pendiente", "inactivo"].map(e => (
          <button key={e} onClick={() => setFiltro(e)}
            style={{
              background: filtro === e ? "#111" : "#fff",
              color: filtro === e ? "#fff" : "#555",
              border: "0.5px solid " + (filtro === e ? "#111" : "#e0e0e0"),
              borderRadius: 20, padding: "5px 14px", fontSize: 12, cursor: "pointer"
            }}>
            {e === "todos" ? "Todos" : ESTADO_LABEL[e] || e}
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
    </div>
  );
}

function AlumnoCard({ alumno: a, planes, editando, onEditar, onCerrar }) {
  const colors = ESTADO_COLOR[a.estado] || { bg: "#f0f0f0", color: "#555" };
  const [form, setForm] = useState({
    nombre: a.nombre || "",
    apellido: a.apellido || "",
    telefono: a.telefono || "",
    telefonoEmergencia: a.telefonoEmergencia || "",
    nombreEmergencia: a.nombreEmergencia || "",
    estado: a.estado || "pendiente",
    planId: a.planId || "",
    metodoPago: a.metodoPago || "efectivo",
    clasesUsadasMes: a.clasesUsadasMes ?? 0,
  });
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function guardar() {
    setGuardando(true);
    const plan = planes.find(p => p.id === form.planId);
    const vence = new Date();
    vence.setMonth(vence.getMonth() + 1);
    vence.setDate(5);

    const updates = {
      nombre: form.nombre,
      apellido: form.apellido,
      telefono: form.telefono,
      telefonoEmergencia: form.telefonoEmergencia,
      nombreEmergencia: form.nombreEmergencia,
      estado: form.estado,
      planId: form.planId || null,
      planNombre: plan ? plan.nombre : null,
      metodoPago: form.metodoPago,
      clasesUsadasMes: Number(form.clasesUsadasMes),
    };

    // Si se asigna un plan nuevo, calcular precio y vencimiento
    if (form.planId && form.planId !== a.planId) {
      updates.montoPagado = form.metodoPago === "transferencia" ? plan.precioTransferencia : plan.precioEfectivo;
      updates.fechaActivacion = new Date();
      updates.fechaVencimiento = vence;
    }

    await updateDoc(doc(db, "usuarios", a.uid), updates);
    setGuardando(false);
    setOk(true);
    setTimeout(() => { setOk(false); onCerrar(); }, 1200);
  }

  const inp = {
    width: "100%", padding: "8px 12px", borderRadius: 8,
    border: "0.5px solid #e0e0e0", fontSize: 13, boxSizing: "border-box", outline: "none"
  };

  const vence = a.fechaVencimiento
    ? new Date(a.fechaVencimiento.toDate?.() || a.fechaVencimiento).toLocaleDateString("es-AR")
    : null;

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, overflow: "hidden" }}>
      {/* Fila colapsada */}
      <div onClick={editando ? undefined : onEditar}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: editando ? "default" : "pointer" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F5C400", color: "#111", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {(a.nombre || "?").charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{a.nombre} {a.apellido}</div>
          <div style={{ fontSize: 12, color: "#888" }}>{a.planNombre || "Sin plan"} {vence ? "· vence " + vence : ""}</div>
        </div>
        <span style={{ background: colors.bg, color: colors.color, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20, flexShrink: 0 }}>
          {ESTADO_LABEL[a.estado] || a.estado}
        </span>
        <span style={{ color: "#aaa", fontSize: 12 }}>{editando ? "▲" : "✏️"}</span>
      </div>

      {/* Panel de edicion */}
      {editando && (
        <div style={{ padding: "0 16px 20px", borderTop: "0.5px solid #f0f0f0" }}>

          <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", margin: "14px 0 10px" }}>Datos personales</p>
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
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>Telefono</label>
            <input name="telefono" value={form.telefono} onChange={handleChange} style={inp} />
          </div>

          <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", margin: "14px 0 10px" }}>Contacto de emergencia</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>Nombre</label>
              <input name="nombreEmergencia" value={form.nombreEmergencia} onChange={handleChange} placeholder="Ej: Maria (madre)" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>Telefono</label>
              <input name="telefonoEmergencia" value={form.telefonoEmergencia} onChange={handleChange} style={inp} />
            </div>
          </div>

          <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", margin: "14px 0 10px" }}>Plan y estado</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>Plan</label>
              <select name="planId" value={form.planId} onChange={handleChange} style={{ ...inp, background: "#fff" }}>
                <option value="">Sin plan</option>
                {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>Estado</label>
              <select name="estado" value={form.estado} onChange={handleChange} style={{ ...inp, background: "#fff" }}>
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
              <select name="metodoPago" value={form.metodoPago} onChange={handleChange} style={{ ...inp, background: "#fff" }}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 3 }}>Clases usadas este mes</label>
              <input type="number" name="clasesUsadasMes" value={form.clasesUsadasMes} onChange={handleChange} min="0" style={inp} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={guardar} disabled={guardando}
              style={{
                background: ok ? "#10b981" : "#F5C400", color: "#111",
                border: "none", borderRadius: 8, padding: "9px 20px",
                fontSize: 13, fontWeight: 500, cursor: "pointer"
              }}>
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
      )}
    </div>
  );
}
