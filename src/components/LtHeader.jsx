import LtLogo from "./LtLogo";

export default function LtHeader({ rol, onLogout }) {
  return (
    <header style={{
      background: "#111",
      borderBottom: "1px solid #222",
      padding: "0 28px",
      height: 62,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}>
      {/* Logo */}
      <LtLogo size="sm" />

      {/* Derecha: rol + cerrar sesion */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {rol && (
          <span style={{
            fontSize: 13,
            color: "#ffffff",
            opacity: 0.7,
          }}>
            {rol === "profe" ? "Panel profesional" : "Mi cuenta"}
          </span>
        )}
        {onLogout && (
          <button onClick={onLogout}
            style={{
              background: "transparent",
              border: "1px solid #444",
              borderRadius: 7,
              padding: "6px 16px",
              color: "#ffffff",
              fontSize: 13,
              cursor: "pointer",
              letterSpacing: "0.01em",
            }}>
            Cerrar sesión
          </button>
        )}
      </div>
    </header>
  );
}
