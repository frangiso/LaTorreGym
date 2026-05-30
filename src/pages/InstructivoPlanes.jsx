import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

import { useData } from "../context/DataContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LtLayout from "../components/LtLayout";
import LtHeader from "../components/LtHeader";
import LtLogo from "../components/LtLogo";

export default function InstructivoPlanes() {
  const { perfil } = useAuth();
  const { config } = useData();
  const [aceptado, setAceptado] = useState(false);
  const navigate = useNavigate();

  // Si ya pagó, no volver acá
  useEffect(() => {
    if (perfil?.estado === "pago_pendiente") navigate("/espera");
    if (perfil?.estado === "activo") navigate("/alumno");
  }, [perfil]);

  if (!config) return <div style={{ minHeight: "100vh", background: "#111" }} />;

  return (
    <LtLayout>
      <LtHeader onLogout={() => signOut(auth)} />
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px 48px" }}>

        {/* Clase de cortesía */}
        <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 12, padding: "14px 18px", marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 18, marginBottom: 4 }}>🎁</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#065f46" }}>Primera clase de cortesía gratis</div>
          <div style={{ fontSize: 13, color: "#047857", marginTop: 4 }}>Podés probar una clase sin costo antes de inscribirte.</div>
        </div>

        {/* Inscripción */}
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>📋 Inscripción al gimnasio: $15.000</div>
          <div style={{ fontSize: 12, color: "#b45309", lineHeight: 1.5 }}>Se abona una única vez al registrarte, en recepción junto con tu primera cuota.</div>
        </div>

        {/* Pagos presenciales */}
        <div style={{ background: "#f0f4ff", border: "1px solid #c7d2fe", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#3730a3", marginBottom: 4 }}>💳 Los pagos son presenciales en recepción</div>
          <div style={{ fontSize: 12, color: "#4338ca", lineHeight: 1.5 }}>
            Tanto la inscripción como la cuota mensual se abonan en efectivo o transferencia directamente en La Torre Gym.<br/>
            Una vez que el personal confirme tu pago, quedás habilitado para usar el gimnasio.
          </div>
        </div>

        {/* Bienvenida */}
        <div style={{
          background: "#1a1a1a", borderRadius: 16, padding: "24px 20px",
          marginBottom: 24, textAlign: "center", border: "1px solid #2a2a2a"
        }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
            <LtLogo size="md" />
          </div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 500, margin: "0 0 4px" }}>
            Bienvenido
          </h1>
          <p style={{ color: "#888", fontSize: 14, margin: 0 }}>
            Leé el reglamento, elegí tu plan y coordiná el pago para activar tu cuenta.
          </p>
        </div>

        {/* Reglamento */}
        {config.reglamento?.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #e0e0e0", padding: "18px 20px", marginBottom: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 12px" }}>
              Reglamento
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {config.reglamento.map((item, i) => (
                <li key={i} style={{ display: "flex", gap: 10, fontSize: 14, color: "#333", lineHeight: 1.5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F5C400", marginTop: 6, flexShrink: 0 }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Beneficios familiares */}
        <div style={{ background: "#fffbea", border: "2px solid #F5C400", borderRadius: 12, padding: "16px 18px", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#7a5c00", marginBottom: 10 }}>🏅 Beneficios para familias de alumnos de La Torre</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: "#fff", borderRadius: 10, padding: "12px 14px", border: "1px solid #fcd34d" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 3 }}>15% de descuento en la cuota</div>
              <div style={{ fontSize: 12, color: "#b45309", lineHeight: 1.5 }}>
                Si sos papá o mamá de un alumno inscripto en La Torre, tenés un 15% de descuento permanente en tu cuota mensual. Avisale al profe al momento de registrar tu pago.
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: 10, padding: "12px 14px", border: "1px solid #fcd34d" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 3 }}>⚡ 2x1 este mes para la familia</div>
              <div style={{ fontSize: 12, color: "#b45309", lineHeight: 1.5 }}>
                Por este mes, si sos papá o mamá de un alumno de La Torre, pagás solo la mitad de la cuota. Preguntale al profe al momento de confirmar tu pago.
              </div>
            </div>
          </div>
        </div>

        {/* Planes */}
        <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #e0e0e0", padding: "18px 20px", marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 14px" }}>
            Planes disponibles
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {config.planes?.map((plan, i) => (
              <div key={i} style={{
                borderRadius: 10, border: i === 1 ? "2px solid #F5C400" : "0.5px solid #e0e0e0",
                padding: "12px 14px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{plan.nombre}</span>
                  {i === 1 && (
                    <span style={{ background: "#F5C400", color: "#111", fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 20 }}>
                      Popular
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div style={{ background: "#FFF8DC", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "#7a5c00" }}>
                      ${plan.precioTransferencia.toLocaleString("es-AR")}
                    </div>
                    <div style={{ fontSize: 11, color: "#a07800" }}>Transferencia</div>
                  </div>
                  <div style={{ background: "#f5f5f5", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "#333" }}>
                      ${plan.precioEfectivo.toLocaleString("es-AR")}
                    </div>
                    <div style={{ fontSize: 11, color: "#888" }}>Efectivo</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alias */}
        {config.alias && (
          <div style={{ background: "#1a1a1a", borderRadius: 12, border: "1px solid #2a2a2a", padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>Alias para transferencia</div>
              <div style={{ fontSize: 17, fontWeight: 500, color: "#F5C400", fontFamily: "monospace" }}>{config.alias}</div>
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(config.alias)}
              style={{ background: "transparent", border: "1px solid #333", borderRadius: 8, padding: "6px 10px", color: "#888", fontSize: 12, cursor: "pointer" }}>
              Copiar
            </button>
          </div>
        )}

        {/* Checkbox + botón */}
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20, cursor: "pointer" }}>
          <input type="checkbox" checked={aceptado} onChange={e => setAceptado(e.target.checked)}
            style={{ marginTop: 3, accentColor: "#F5C400", width: 16, height: 16 }} />
          <span style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>
            Leí y acepto el reglamento del gimnasio.
          </span>
        </label>

        {!aceptado && (
          <p style={{ fontSize: 13, color: "#F5C400", textAlign: "center", margin: "0 0 8px", fontWeight: 500 }}>
            ↑ Aceptá el reglamento para continuar
          </p>
        )}
        <button
          onClick={() => navigate("/pago")}
          disabled={!aceptado}
          style={{
            width: "100%", background: aceptado ? "#F5C400" : "#e0e0e0",
            color: aceptado ? "#111" : "#999", border: "none", borderRadius: 10,
            padding: "14px", fontSize: 15, fontWeight: 500, cursor: aceptado ? "pointer" : "not-allowed",
            transition: "background 0.2s"
          }}>
          Elegir plan y pagar →
        </button>
      </div>
    </LtLayout>
  );
}
