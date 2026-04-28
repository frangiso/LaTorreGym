import LtLogo from "./LtLogo";

export default function LtHeader({ rol, onLogout }) {
  return (
    <header style={{
      background: "#111", borderBottom: "1px solid #2a2a2a",
      padding: "0 20px", height: 58,
      display: "flex", alignItems: "center", justifyContent: "space-between"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <LtLogo size="sm" />
        {rol && (
          <span style={{
            fontSize: 12, color: "#555",
            borderLeft: "1px solid #2a2a2a", paddingLeft: 14
          }}>
            {rol === "profe" ? "Panel profesional" : "Mi cuenta"}
          </span>
        )}
      </div>
      {onLogout && (
        <button onClick={onLogout}
          style={{
            background: "transparent", border: "1px solid #2a2a2a",
            borderRadius: 6, padding: "5px 14px", color: "#666",
            fontSize: 12, cursor: "pointer"
          }}>
          Cerrar sesión
        </button>
      )}
    </header>
  );
}
