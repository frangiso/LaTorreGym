import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

export default function PagosPendientes() {
  const [pendientes, setPendientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [rechazando, setRechazando] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "usuarios"), where("estado", "==", "pago_pendiente"));
    const unsub = onSnapshot(q, snap => {
      setPendientes(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
      setCargando(false);
    });
    return () => unsub();
  }, []);

  async function confirmar(alumno) {
    setProcesando(alumno.uid);
    // Calcular vencimiento: 1 mes desde hoy
    const vence = new Date();
    vence.setMonth(vence.getMonth() + 1);
    vence.setDate(5); // vence el día 5
    await updateDoc(doc(db, "usuarios", alumno.uid), {
      estado: "activo",
      fechaActivacion: serverTimestamp(),
      fechaVencimiento: vence,
    });
    setProcesando(null);
  }

  async function rechazar(alumno) {
    if (!motivoRechazo.trim()) return;
    setProcesando(alumno.uid);
    await updateDoc(doc(db, "usuarios", alumno.uid), {
      estado: "pendiente",
      planId: null,
      planNombre: null,
      metodoPago: null,
      montoPagado: null,
      fechaSolicitud: null,
      motivoRechazo: motivoRechazo,
    });
    setRechazando(null);
    setMotivoRechazo("");
    setProcesando(null);
  }

  if (cargando) return <p style={{ color: "#888" }}>Cargando...</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Pagos pendientes</h2>
        <span style={{
          background: pendientes.length > 0 ? "#F5C400" : "#f0f0f0",
          color: pendientes.length > 0 ? "#111" : "#888",
          fontSize: 13, fontWeight: 500, padding: "4px 12px", borderRadius: 20
        }}>
          {pendientes.length} {pendientes.length === 1 ? "pendiente" : "pendientes"}
        </span>
      </div>

      {pendientes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 12, opacity: 0.4 }}>
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p style={{ fontSize: 14 }}>No hay pagos pendientes</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pendientes.map(alumno => (
            <div key={alumno.uid} style={{
              background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "16px 18px"
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", background: "#F5C400",
                    color: "#111", fontSize: 14, fontWeight: 500,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                  }}>
                    {(alumno.nombre || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "#111" }}>
                      {alumno.nombre} {alumno.apellido}
                    </div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{alumno.email}</div>
                    {alumno.telefono && (
                      <div style={{ fontSize: 12, color: "#888" }}>{alumno.telefono}</div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ background: "#f5f5f5", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#555" }}>
                    {alumno.planNombre}
                  </span>
                  <span style={{
                    background: alumno.metodoPago === "transferencia" ? "#FFF8DC" : "#f0f0f0",
                    borderRadius: 6, padding: "4px 10px", fontSize: 12,
                    color: alumno.metodoPago === "transferencia" ? "#7a5c00" : "#555",
                    textTransform: "capitalize"
                  }}>
                    {alumno.metodoPago}
                  </span>
                  {alumno.montoPagado && (
                    <span style={{ background: "#FFF8DC", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 500, color: "#7a5c00" }}>
                      ${alumno.montoPagado.toLocaleString("es-AR")}
                    </span>
                  )}
                </div>
              </div>

              {rechazando === alumno.uid ? (
                <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    value={motivoRechazo}
                    onChange={e => setMotivoRechazo(e.target.value)}
                    placeholder="Motivo del rechazo (opcional)"
                    style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8, border: "0.5px solid #e0e0e0", fontSize: 13 }}
                  />
                  <button onClick={() => rechazar(alumno)} disabled={procesando === alumno.uid}
                    style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>
                    Confirmar rechazo
                  </button>
                  <button onClick={() => { setRechazando(null); setMotivoRechazo(""); }}
                    style={{ background: "transparent", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "#888" }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                  <button onClick={() => confirmar(alumno)} disabled={procesando === alumno.uid}
                    style={{
                      background: "#F5C400", color: "#111", border: "none",
                      borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer"
                    }}>
                    {procesando === alumno.uid ? "Procesando..." : "✓ Confirmar pago"}
                  </button>
                  <button onClick={() => setRechazando(alumno.uid)}
                    style={{
                      background: "transparent", border: "0.5px solid #e0e0e0",
                      borderRadius: 8, padding: "9px 18px", fontSize: 13, color: "#888", cursor: "pointer"
                    }}>
                    ✗ Rechazar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
