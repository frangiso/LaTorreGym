import { useEffect, useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useData } from "../context/DataContext";
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

  function abrirWhatsApp() {
    if (!config?.whatsapp || !planSeleccionado) return;
    const nombre = perfil ? `${perfil.nombre} ${perfil.apellido}` : "";
    const precio = metodo === "transferencia"
      ? `$${planSeleccionado.precioTransferencia.toLocaleString("es-AR")}`
      : `$${planSeleccionado.precioEfectivo.toLocaleString("es-AR")}`;
    const texto = encodeURIComponent(
      `Hola! Soy ${nombre} y acabo de hacer la ${metodo === "transferencia" ? "transferencia" : "el pago en efectivo"} del plan "${planSeleccionado.nombre}" (${precio}). Te mando el comprobante.`
    );
    window.open(`https://wa.me/549${config.whatsapp}?text=${texto}`, "_blank");
  }

  if (!config) return <div style={{ minHeight: "100vh", background: "#111" }} />;

  const precio = planSeleccionado
    ? (metodo === "transferencia" ? planSeleccionado.precioTransferencia : planSeleccionado.precioEfectivo)
    : 0;

  return (
    <LtLayout>
      <LtHeader />
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
              { key: "transferencia", label: "Transferencia", sub: "Enviás comprobante por WhatsApp" },
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
              Una vez realizada la transferencia, enviá el comprobante por WhatsApp al gimnasio. Tu acceso se activará cuando el profe confirme el pago.
            </p>
            {config.whatsapp && (
              <button onClick={abrirWhatsApp}
                style={{
                  width: "100%", marginTop: 12, background: "#25D366", color: "#fff",
                  border: "none", borderRadius: 8, padding: "11px", fontSize: 13,
                  fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 8
                }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="8" cy="8" r="7.5" fill="#25D366" />
                  <path d="M11.4 9.7c-.23-.12-1.37-.68-1.58-.76-.21-.08-.37-.12-.52.12-.16.23-.6.76-.74.91-.14.16-.27.17-.5.06-.23-.12-.96-.35-1.83-1.13-.68-.6-1.13-1.35-1.27-1.57-.13-.23 0-.35.1-.47l.34-.4c.11-.13.14-.23.21-.38.07-.15.04-.29-.02-.4-.06-.12-.52-1.24-.71-1.7-.19-.45-.38-.39-.52-.4H4.1c-.14 0-.37.05-.56.27-.2.22-.75.73-.75 1.78s.77 2.06.87 2.2c.11.15 1.5 2.3 3.64 3.22.51.22.91.35 1.22.45.51.16.98.14 1.35.08.41-.07 1.26-.51 1.44-1.01.18-.5.18-.93.12-1.01-.06-.09-.21-.14-.44-.25z" fill="white" />
                </svg>
                Enviar comprobante por WhatsApp
              </button>
            )}
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
