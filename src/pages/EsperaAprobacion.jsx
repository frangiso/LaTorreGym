import { useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import LtLayout from "../components/LtLayout";
import LtHeader from "../components/LtHeader";

export default function EsperaAprobacion() {
  const { perfil } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (perfil?.estado === "activo") navigate("/alumno");
  }, [perfil]);

  return (
    <LtLayout>
      <LtHeader />
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "48px 16px", textAlign: "center" }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%", background: "#FFF8DC",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px"
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#F5C400" strokeWidth="1.5" />
            <path d="M12 7v5l3 3" stroke="#F5C400" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 500, color: "#111", margin: "0 0 8px" }}>
          Pago en verificación
        </h1>
        <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 24px" }}>
          Tu solicitud fue registrada. El profe revisará tu pago y activará tu cuenta a la brevedad.
          Podés cerrar esta pantalla y volver más tarde.
        </p>

        {perfil?.planNombre && (
          <div style={{
            background: "#f5f5f5", borderRadius: 12, padding: "14px 18px",
            marginBottom: 24, textAlign: "left"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#888" }}>Plan</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{perfil.planNombre}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#888" }}>Método</span>
              <span style={{ fontSize: 13, color: "#111", textTransform: "capitalize" }}>{perfil.metodoPago}</span>
            </div>
            {perfil.montoPagado && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#888" }}>Monto</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#F5C400" }}>
                  ${perfil.montoPagado.toLocaleString("es-AR")}
                </span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 32 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F5C400", display: "inline-block" }} />
          <span style={{ fontSize: 13, color: "#888" }}>Esperando confirmación del profe</span>
        </div>

        <button onClick={() => signOut(auth).then(() => navigate("/login"))}
          style={{
            background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8,
            padding: "10px 20px", fontSize: 13, color: "#888", cursor: "pointer"
          }}>
          Cerrar sesión
        </button>
      </div>
    </LtLayout>
  );
}
