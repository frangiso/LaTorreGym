import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

const ESTADOS = ["todos", "activo", "pago_pendiente", "pendiente", "inactivo"];
const ESTADO_LABEL = { activo: "Activo", pago_pendiente: "Pago pendiente", pendiente: "Pendiente", inactivo: "Inactivo", suspendido: "Suspendido" };
const ESTADO_COLOR = {
  activo: { bg: "#d1fae5", color: "#065f46" },
  pago_pendiente: { bg: "#FFF8DC", color: "#7a5c00" },
  pendiente: { bg: "#f0f0f0", color: "#555" },
  inactivo: { bg: "#fee2e2", color: "#991b1b" },
  suspendido: { bg: "#fee2e2", color: "#991b1b" },
};

export default function PanelAlumnos() {
  const [alumnos, setAlumnos] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [expandido, setExpandido] = useState(null);

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

  async function cambiarEstado(uid, nuevoEstado) {
    await updateDoc(doc(db, "usuarios", uid), { estado: nuevoEstado });
  }

  const filtrados = alumnos.filter(a => {
    const matchEstado = filtro === "todos" || a.estado === filtro;
    const matchBusqueda = !busqueda || (
      `${a.nombre} ${a.apellido} ${a.email}`.toLowerCase().includes(busqueda.toLowerCase())
    );
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
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {ESTADOS.map(e => (
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

      {/* Búsqueda */}
      <input
        value={busqueda} onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o email..."
        style={{ width: "100%", marginBottom: 16, padding: "9px 14px", borderRadius: 8, border: "0.5px solid #e0e0e0", fontSize: 14 }}
      />

      {filtrados.length === 0 ? (
        <p style={{ color: "#aaa", textAlign: "center", padding: "32px 0", fontSize: 14 }}>Sin resultados.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtrados.map(a => {
            const colors = ESTADO_COLOR[a.estado] || { bg: "#f0f0f0", color: "#555" };
            const isExp = expandido === a.uid;
            return (
              <div key={a.uid} style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, overflow: "hidden" }}>
                <div
                  onClick={() => setExpandido(isExp ? null : a.uid)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", background: "#F5C400",
                    color: "#111", fontSize: 13, fontWeight: 500, display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0
                  }}>
                    {(a.nombre || "?").charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>
                      {a.nombre} {a.apellido}
                    </div>
                    <div style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {a.planNombre || "Sin plan asignado"}
                    </div>
                  </div>
                  <span style={{ background: colors.bg, color: colors.color, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20, flexShrink: 0 }}>
                    {ESTADO_LABEL[a.estado] || a.estado}
                  </span>
                  <span style={{ color: "#aaa", fontSize: 12 }}>{isExp ? "▲" : "▼"}</span>
                </div>

                {isExp && (
                  <div style={{ padding: "0 16px 16px", borderTop: "0.5px solid #f0f0f0" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 12, marginBottom: 14 }}>
                      {[
                        ["Email", a.email],
                        ["Teléfono", a.telefono || "—"],
                        ["Plan", a.planNombre || "—"],
                        ["Método pago", a.metodoPago || "—"],
                        ["Monto", a.montoPagado ? `$${a.montoPagado.toLocaleString("es-AR")}` : "—"],
                        ["Vencimiento", a.fechaVencimiento ? new Date(a.fechaVencimiento.toDate?.() || a.fechaVencimiento).toLocaleDateString("es-AR") : "—"],
                      ].map(([k, v]) => (
                        <div key={k} style={{ background: "#f9f9f9", borderRadius: 8, padding: "8px 10px" }}>
                          <div style={{ fontSize: 10, color: "#aaa", marginBottom: 2 }}>{k}</div>
                          <div style={{ fontSize: 13, color: "#111" }}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Acciones */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {a.estado !== "activo" && (
                        <button onClick={() => cambiarEstado(a.uid, "activo")}
                          style={{ background: "#d1fae5", color: "#065f46", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                          Activar
                        </button>
                      )}
                      {a.estado !== "inactivo" && (
                        <button onClick={() => cambiarEstado(a.uid, "inactivo")}
                          style={{ background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                          Desactivar
                        </button>
                      )}
                      {a.telefono && (
                        <a href={`https://wa.me/549${a.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                          style={{ background: "#e8f8f0", color: "#1a7a45", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
