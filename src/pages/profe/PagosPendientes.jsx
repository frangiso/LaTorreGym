import { useEffect, useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useData } from "../../context/DataContext";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function PagosPendientes() {
  const { alumnos: todosAlumnos }       = useData();
  const pendientes                      = todosAlumnos.filter(a => a.estado === "pago_pendiente");
  const [procesando, setProcesando]     = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [rechazando, setRechazando]     = useState(null);
  const [mesVer, setMesVer]             = useState(new Date().getMonth());
  const [anioVer, setAnioVer]           = useState(new Date().getFullYear());

  async function confirmar(alumno) {
    setProcesando(alumno.uid);
    const vence = new Date();
    vence.setMonth(vence.getMonth() + 1);
    await updateDoc(doc(db, "usuarios", alumno.uid), {
      estado: "activo",
      fechaActivacion: serverTimestamp(),
      fechaVencimiento: vence,
      cuotaVencida: false,
    });
    setProcesando(null);
  }

  async function rechazar(alumno) {
    if (!motivoRechazo.trim()) return;
    setProcesando(alumno.uid);
    await updateDoc(doc(db, "usuarios", alumno.uid), {
      estado: "pendiente",
      planId: null, planNombre: null,
      metodoPago: null, montoPagado: null,
      fechaSolicitud: null,
      motivoRechazo: motivoRechazo,
    });
    setRechazando(null); setMotivoRechazo(""); setProcesando(null);
  }

  // ---- REPORTE DE CAJA ----
  // Filtramos alumnos que pagaron en el mes/año seleccionado
  // Usamos fechaActivacion como referencia del mes en que se cobró
  const pagosDelMes = todosAlumnos.filter(a => {
    if (!a.fechaActivacion || !a.montoPagado) return false;
    const fecha = new Date(a.fechaActivacion.toDate?.() || a.fechaActivacion);
    return fecha.getMonth() === mesVer && fecha.getFullYear() === anioVer;
  });

  const totalEfectivo      = pagosDelMes.filter(a => a.metodoPago === "efectivo").reduce((s, a) => s + (a.montoPagado || 0), 0);
  const totalTransferencia = pagosDelMes.filter(a => a.metodoPago === "transferencia").reduce((s, a) => s + (a.montoPagado || 0), 0);
  const totalGeneral       = totalEfectivo + totalTransferencia;

  function cambiarMes(dir) {
    let m = mesVer + dir;
    let a = anioVer;
    if (m < 0)  { m = 11; a--; }
    if (m > 11) { m = 0;  a++; }
    setMesVer(m); setAnioVer(a);
  }

  return (
    <div>

      {/* ====== CAJA DEL MES ====== */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Caja del mes</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => cambiarMes(-1)}
              style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>←</button>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#111", minWidth: 130, textAlign: "center" }}>
              {MESES[mesVer]} {anioVer}
            </span>
            <button onClick={() => cambiarMes(1)}
              style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>→</button>
          </div>
        </div>

        {/* Total grande */}
        <div style={{ background: "#111", borderRadius: 16, padding: "24px 20px", marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Total ingresado — {MESES[mesVer]} {anioVer}
          </div>
          <div style={{ fontSize: 36, fontWeight: 500, color: "#F5C400" }}>
            ${totalGeneral.toLocaleString("es-AR")}
          </div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
            {pagosDelMes.length} pago{pagosDelMes.length !== 1 ? "s" : ""} confirmado{pagosDelMes.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Desglose efectivo / transferencia */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "16px" }}>
            <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Efectivo</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: "#111" }}>${totalEfectivo.toLocaleString("es-AR")}</div>
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
              {pagosDelMes.filter(a => a.metodoPago === "efectivo").length} pago{pagosDelMes.filter(a => a.metodoPago === "efectivo").length !== 1 ? "s" : ""}
            </div>
          </div>
          <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "16px" }}>
            <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Transferencia</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: "#111" }}>${totalTransferencia.toLocaleString("es-AR")}</div>
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
              {pagosDelMes.filter(a => a.metodoPago === "transferencia").length} pago{pagosDelMes.filter(a => a.metodoPago === "transferencia").length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Detalle de pagos del mes */}
        {pagosDelMes.length > 0 && (
          <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #f0f0f0" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>Detalle de pagos</span>
            </div>
            {pagosDelMes
              .sort((a,b) => {
                const fa = new Date(a.fechaActivacion?.toDate?.() || a.fechaActivacion);
                const fb = new Date(b.fechaActivacion?.toDate?.() || b.fechaActivacion);
                return fb - fa;
              })
              .map((a, i) => {
                const fecha = new Date(a.fechaActivacion?.toDate?.() || a.fechaActivacion);
                return (
                  <div key={a.uid} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 16px", gap: 12,
                    borderBottom: i < pagosDelMes.length - 1 ? "0.5px solid #f5f5f5" : "none",
                    background: i % 2 === 0 ? "#fff" : "#fafafa"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#F5C400", color: "#111", fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {(a.nombre || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{a.nombre} {a.apellido}</div>
                        <div style={{ fontSize: 11, color: "#aaa" }}>
                          {a.planNombre} · {fecha.toLocaleDateString("es-AR")}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 500,
                        background: a.metodoPago === "transferencia" ? "#FFF8DC" : "#f0f0f0",
                        color: a.metodoPago === "transferencia" ? "#7a5c00" : "#555"
                      }}>
                        {a.metodoPago === "transferencia" ? "Transf." : "Efectivo"}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>
                        ${(a.montoPagado || 0).toLocaleString("es-AR")}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {pagosDelMes.length === 0 && (
          <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "32px", textAlign: "center", color: "#aaa" }}>
            <p style={{ fontSize: 13 }}>No hay pagos registrados en {MESES[mesVer]} {anioVer}.</p>
          </div>
        )}
      </div>

      {/* ====== PAGOS PENDIENTES ====== */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
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
        <div style={{ textAlign: "center", padding: "32px 0", color: "#aaa" }}>
          <p style={{ fontSize: 14 }}>No hay pagos pendientes</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pendientes.map(alumno => (
            <div key={alumno.uid} style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#F5C400", color: "#111", fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {(alumno.nombre || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "#111" }}>{alumno.nombre} {alumno.apellido}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{alumno.email}</div>
                    {alumno.telefono && <div style={{ fontSize: 12, color: "#888" }}>{alumno.telefono}</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ background: "#f5f5f5", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#555" }}>{alumno.planNombre}</span>
                  <span style={{
                    background: alumno.metodoPago === "transferencia" ? "#FFF8DC" : "#f0f0f0",
                    borderRadius: 6, padding: "4px 10px", fontSize: 12,
                    color: alumno.metodoPago === "transferencia" ? "#7a5c00" : "#555",
                    textTransform: "capitalize"
                  }}>{alumno.metodoPago}</span>
                  {alumno.montoPagado && (
                    <span style={{ background: "#FFF8DC", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 500, color: "#7a5c00" }}>
                      ${alumno.montoPagado.toLocaleString("es-AR")}
                    </span>
                  )}
                </div>
              </div>

              {rechazando === alumno.uid ? (
                <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)}
                    placeholder="Motivo del rechazo (opcional)"
                    style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8, border: "0.5px solid #e0e0e0", fontSize: 13 }} />
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
                    style={{ background: "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                    {procesando === alumno.uid ? "Procesando..." : "✓ Confirmar pago"}
                  </button>
                  <button onClick={() => setRechazando(alumno.uid)}
                    style={{ background: "transparent", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "9px 18px", fontSize: 13, color: "#888", cursor: "pointer" }}>
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
