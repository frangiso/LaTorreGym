import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import LtHeader from "../components/LtHeader";

export default function EsperaAprobacion() {
  const { user, perfil } = useAuth();
  const navigate = useNavigate();
  const { config } = useData();
  const [planSeleccionado, setPlanSeleccionado] = useState(null);
  const [metodo, setMetodo] = useState("transferencia");
  const [enviando, setEnviando] = useState(false);
  const [paso, setPaso] = useState("espera"); // "espera" | "elegirPlan"

  const planAgotado = perfil?.estado === "pago_pendiente" && !perfil?.planId;

  useEffect(() => {
    if (perfil?.estado === "activo") navigate("/alumno");
  }, [perfil]);

  useEffect(() => {
    if (config?.planes?.length) setPlanSeleccionado(p => p || config.planes[0]);
  }, [config]);

  async function enviarRenovacion() {
    if (!planSeleccionado || !user) return;
    setEnviando(true);
    await updateDoc(doc(db, "usuarios", user.uid), {
      estado: "pago_pendiente",
      planId: planSeleccionado.id,
      planNombre: planSeleccionado.nombre,
      metodoPago: metodo,
      montoPagado: metodo === "transferencia" ? planSeleccionado.precioTransferencia : planSeleccionado.precioEfectivo,
      fechaSolicitud: serverTimestamp(),
      clasesUsadasMes: 0,
    });
    setEnviando(false);
    setPaso("espera");
  }

  function abrirWhatsApp() {
    if (!config?.whatsapp || !planSeleccionado) return;
    const nombre = perfil ? perfil.nombre + " " + perfil.apellido : "";
    const precio = metodo === "transferencia" ? planSeleccionado.precioTransferencia : planSeleccionado.precioEfectivo;
    const texto = encodeURIComponent(
      "Hola! Soy " + nombre + " y quiero renovar el plan \"" + planSeleccionado.nombre + "\" ($" + precio.toLocaleString("es-AR") + ") por " + metodo + ". Te mando el comprobante."
    );
    window.open("https://wa.me/549" + config.whatsapp + "?text=" + texto, "_blank");
  }

  if (!config) return <div style={{ minHeight: "100vh", background: "#f7f7f7" }} />;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f7" }}>
      <LtHeader rol="alumno" onLogout={() => signOut(auth).then(() => navigate("/login"))} />

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 16px", textAlign: "center" }}>

        {paso === "espera" && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#FFF8DC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#F5C400" strokeWidth="1.5"/>
                <path d="M12 7v5l3 3" stroke="#F5C400" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>

            {planAgotado ? (
              <>
                <h1 style={{ fontSize: 20, fontWeight: 500, color: "#111", margin: "0 0 8px" }}>Plan agotado</h1>
                <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 24px" }}>
                  Consumiste todas las clases de tu plan. Para seguir entrenando, renova eligiendo un nuevo plan.
                </p>
                <button onClick={() => setPaso("elegirPlan")}
                  style={{ background: "#F5C400", color: "#111", border: "none", borderRadius: 10, padding: "13px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}>
                  Renovar plan →
                </button>
              </>
            ) : (
              <>
                <h1 style={{ fontSize: 20, fontWeight: 500, color: "#111", margin: "0 0 8px" }}>Pago en verificacion</h1>
                <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 24px" }}>
                  Tu solicitud fue registrada. El profe revisara tu pago y activara tu cuenta a la brevedad.
                </p>
              </>
            )}

            {perfil?.planNombre && (
              <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px 18px", marginBottom: 24, textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#888" }}>Plan</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{perfil.planNombre}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#888" }}>Metodo</span>
                  <span style={{ fontSize: 13, color: "#111", textTransform: "capitalize" }}>{perfil.metodoPago}</span>
                </div>
                {perfil.montoPagado && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#888" }}>Monto</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#F5C400" }}>${perfil.montoPagado.toLocaleString("es-AR")}</span>
                  </div>
                )}
              </div>
            )}

            {!planAgotado && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 32 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F5C400", display: "inline-block" }}/>
                <span style={{ fontSize: 13, color: "#888" }}>Esperando confirmacion del profe</span>
              </div>
            )}

            <button onClick={() => signOut(auth).then(() => navigate("/login"))}
              style={{ background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, padding: "10px 20px", fontSize: 13, color: "#888", cursor: "pointer" }}>
              Cerrar sesion
            </button>
          </>
        )}

        {paso === "elegirPlan" && (
          <div style={{ textAlign: "left" }}>
            <button onClick={() => setPaso("espera")} style={{ background: "transparent", border: "none", color: "#888", fontSize: 13, cursor: "pointer", marginBottom: 16 }}>← Volver</button>
            <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 20px" }}>Renovar plan</h2>

            {/* Planes */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {config.planes?.map(plan => (
                <div key={plan.id} onClick={() => setPlanSeleccionado(plan)}
                  style={{ border: planSeleccionado?.id === plan.id ? "2px solid #F5C400" : "0.5px solid #e0e0e0", borderRadius: 10, padding: "12px 14px", cursor: "pointer", background: planSeleccionado?.id === plan.id ? "#FFFBEA" : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{plan.nombre}</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#F5C400" }}>
                      ${(metodo === "transferencia" ? plan.precioTransferencia : plan.precioEfectivo).toLocaleString("es-AR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Metodo */}
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Metodo de pago</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {["transferencia", "efectivo"].map(m => (
                <div key={m} onClick={() => setMetodo(m)}
                  style={{ border: metodo === m ? "2px solid #F5C400" : "1px solid #e0e0e0", borderRadius: 10, padding: "12px", textAlign: "center", cursor: "pointer", background: metodo === m ? "#FFFBEA" : "#fff" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{m.charAt(0).toUpperCase() + m.slice(1)}</div>
                </div>
              ))}
            </div>

            {/* Alias */}
            {metodo === "transferencia" && config.alias && (
              <div style={{ background: "#111", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>Alias</div>
                <div style={{ fontSize: 17, fontWeight: 500, color: "#F5C400", fontFamily: "monospace" }}>{config.alias}</div>
              </div>
            )}

            {/* WhatsApp */}
            {metodo === "transferencia" && config.whatsapp && (
              <button onClick={abrirWhatsApp}
                style={{ width: "100%", background: "#25D366", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="8" cy="8" r="7.5" fill="#25D366"/>
                  <path d="M11.4 9.7c-.23-.12-1.37-.68-1.58-.76-.21-.08-.37-.12-.52.12-.16.23-.6.76-.74.91-.14.16-.27.17-.5.06-.23-.12-.96-.35-1.83-1.13-.68-.6-1.13-1.35-1.27-1.57-.13-.23 0-.35.1-.47l.34-.4c.11-.13.14-.23.21-.38.07-.15.04-.29-.02-.4-.06-.12-.52-1.24-.71-1.7-.19-.45-.38-.39-.52-.4H4.1c-.14 0-.37.05-.56.27-.2.22-.75.73-.75 1.78s.77 2.06.87 2.2c.11.15 1.5 2.3 3.64 3.22.51.22.91.35 1.22.45.51.16.98.14 1.35.08.41-.07 1.26-.51 1.44-1.01.18-.5.18-.93.12-1.01-.06-.09-.21-.14-.44-.25z" fill="white"/>
                </svg>
                Enviar comprobante por WhatsApp
              </button>
            )}

            <button onClick={enviarRenovacion} disabled={!planSeleccionado || enviando}
              style={{ width: "100%", background: "#F5C400", color: "#111", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              {enviando ? "Registrando..." : "Confirmar y esperar aprobacion →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
