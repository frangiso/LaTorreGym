import { useEffect, useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useData } from "../context/DataContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import LtLayout from "../components/LtLayout";
import LtHeader from "../components/LtHeader";

export default function PagoInstructivo() {
  const { user, perfil } = useAuth();
  const { config } = useData();
  const [metodo, setMetodo] = useState("transferencia");
  const [planSeleccionado, setPlanSeleccionado] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (config?.planes?.length) setPlanSeleccionado(p => p || config.planes[0]);
  }, [config]);

  useEffect(() => {
    if (perfil?.estado === "pago_pendiente") navigate("/espera");
    if (perfil?.estado === "activo") navigate("/alumno");
  }, [perfil]);

  async function confirmarPago() {
    if (!planSeleccionado || !user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "usuarios", user.uid), {
        estado: "pago_pendiente",
        planId: planSeleccionado.id,
        planNombre: planSeleccionado.nombre,
        metodoPago: metodo,
        montoPagado: metodo === "transferencia"
          ? planSeleccionado.precioTransferencia
          : planSeleccionado.precioEfectivo,
        fechaSolicitud: serverTimestamp(),
      });
      navigate("/espera");
    } finally {
      setLoading(false);
    }
  }


  if (!config) return <div style={{ minHeight: "100vh", background: "#111" }} />;

  const precio = planSeleccionado
    ? (metodo === "transferencia" ? planSeleccionado.precioTransferencia : planSeleccionado.precioEfectivo)
    : 0;

  return (
    <LtLayout>
      <LtHeader onLogout={() => signOut(auth).then(() => navigate("/login", { replace: true }))} />
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px 48px" }}>

        <h1 style={{ fontSize: 20, fontWeight: 500, color: "#111", marginBottom: 4 }}>Registrar pago</h1>
        <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Elegí tu plan y cómo vas a pagar.</p>

        {/* Selección de plan */}
        <div style={{ marginBottom: 20 }}>
          <label className="lt-label">Plan</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            {config.planes?.map(plan => (
              <div key={plan.id}
                onClick={() => setPlanSeleccionado(plan)}
                style={{
                  border: planSeleccionado?.id === plan.id ? "2px solid #F5C400" : "0.5px solid #e0e0e0",
                  borderRadius: 10, padding: "12px 14px", cursor: "pointer",
                  background: planSeleccionado?.id === plan.id ? "#FFFBEA" : "#fff",
                  transition: "border 0.15s"
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{plan.nombre}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#F5C400" }}>
                    ${(metodo === "transferencia" ? plan.precioTransferencia : plan.precioEfectivo).toLocaleString("es-AR")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Método de pago */}
        <div style={{ marginBottom: 20 }}>
          <label className="lt-label">Método de pago</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
            {[
              { key: "transferencia", label: "Transferencia", sub: "Pagás en el gimnasio" },
              { key: "efectivo", label: "Efectivo", sub: "Pagás en el gimnasio" }
            ].map(m => (
              <div key={m.key} onClick={() => setMetodo(m.key)}
                style={{
                  border: metodo === m.key ? "2px solid #F5C400" : "1px solid #e0e0e0",
                  borderRadius: 10, padding: "12px 10px", cursor: "pointer", textAlign: "center",
                  background: metodo === m.key ? "#FFFBEA" : "#fff"
                }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{m.label}</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Aviso pago presencial OBLIGATORIO */}
        <div style={{ background: "#fff3cd", border: "2px solid #F5C400", borderRadius: 12, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#7a5c00", marginBottom: 4 }}>El pago es obligatoriamente presencial</div>
            <div style={{ fontSize: 13, color: "#92400e", lineHeight: 1.6 }}>
              Tanto la transferencia como el efectivo se abonan <strong>en persona en La Torre Gym</strong>. No se aceptan comprobantes ni pagos a distancia. Pasá por el gimnasio y el profe confirmará tu acceso.
            </div>
          </div>
        </div>

        {/* Alias transferencia */}
        {metodo === "transferencia" && (
          <div style={{ background: "#111", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Alias para transferencia</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 18, fontWeight: 500, color: "#F5C400", fontFamily: "monospace" }}>
                {config.alias}
              </span>
              <button onClick={() => navigator.clipboard?.writeText(config.alias)}
                style={{ background: "transparent", border: "1px solid #333", borderRadius: 6, padding: "4px 10px", color: "#888", fontSize: 11, cursor: "pointer" }}>
                Copiar
              </button>
            </div>
            <p style={{ fontSize: 12, color: "#666", marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
              Pasá por el gimnasio a abonar la transferencia. Tu acceso se activará cuando el profe confirme el pago.
            </p>
          </div>
        )}

        {metodo === "efectivo" && (
          <div style={{ background: "#f5f5f5", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "#555", margin: 0, lineHeight: 1.6 }}>
              Pasá por el gimnasio a abonar{" "}
              <strong style={{ color: "#111" }}>${precio.toLocaleString("es-AR")}</strong>{" "}
              en efectivo. Avisale al profe que ya registraste tu cuenta, él confirmará tu acceso.
            </p>
          </div>
        )}

        {/* Resumen y confirmar */}
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: "#888" }}>Plan seleccionado</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#111", marginTop: 2 }}>
                {planSeleccionado?.nombre ?? "—"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#888" }}>{metodo === "transferencia" ? "Transferencia" : "Efectivo"}</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: "#F5C400", marginTop: 2 }}>
                ${precio.toLocaleString("es-AR")}
              </div>
            </div>
          </div>
        </div>

        <button onClick={confirmarPago} disabled={!planSeleccionado || loading}
          style={{
            width: "100%", background: "#F5C400", color: "#111", border: "none",
            borderRadius: 10, padding: "14px", fontSize: 15, fontWeight: 500,
            cursor: "pointer"
          }}>
          {loading ? "Registrando..." : "Confirmar y esperar aprobación →"}
        </button>
      </div>
    </LtLayout>
  );
}
