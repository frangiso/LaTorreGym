import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

import { useData } from "../context/DataContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LtLayout from "../components/LtLayout";
import LtHeader from "../components/LtHeader";

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

        {/* Bienvenida */}
        <div style={{
          background: "#1a1a1a", borderRadius: 16, padding: "24px 20px",
          marginBottom: 24, textAlign: "center", border: "1px solid #2a2a2a"
        }}>
          <div style={{ marginBottom: 8 }}>
            <svg width="40" height="44" viewBox="0 0 40 44" fill="none">
              <rect x="2" y="16" width="36" height="26" rx="5" fill="#F5C400" />
              <path d="M14 16V10a6 6 0 0 1 12 0v6" stroke="#111" strokeWidth="3" strokeLinecap="round" />
              <rect x="15" y="24" width="10" height="10" rx="2" fill="#111" />
            </svg>
          </div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 500, margin: "0 0 4px" }}>
            Bienvenido a{" "}
            <span style={{ color: "#F5C400" }}>{config.nombre}</span>
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
