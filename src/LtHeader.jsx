export default function LtHeader({ rol, onLogout }) {
  return (
    <header style={{
      background: "#111", borderBottom: "1px solid #2a2a2a",
      padding: "0 20px", height: 56,
      display: "flex", alignItems: "center", justifyContent: "space-between"
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <svg width="28" height="31" viewBox="0 0 40 44" fill="none">
          <rect x="2" y="16" width="36" height="26" rx="5" fill="#F5C400" />
          <path d="M14 16V10a6 6 0 0 1 12 0v6" stroke="#111" strokeWidth="3" strokeLinecap="round" />
          <rect x="15" y="24" width="10" height="10" rx="2" fill="#111" />
        </svg>
        <div>
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 500, lineHeight: 1.1 }}>La Torre</div>
          <div style={{ background: "#F5C400", color: "#111", fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 2, letterSpacing: "0.08em", display: "inline-block" }}>GYM</div>
        </div>
        {rol && (
          <span style={{ marginLeft: 8, fontSize: 12, color: "#555", borderLeft: "1px solid #333", paddingLeft: 10 }}>
            {rol === "profe" ? "Panel profesional" : "Mi cuenta"}
          </span>
        )}
      </div>

      {/* Acciones */}
      {onLogout && (
        <button onClick={onLogout}
          style={{ background: "transparent", border: "1px solid #333", borderRadius: 6, padding: "5px 12px", color: "#888", fontSize: 12, cursor: "pointer" }}>
          Cerrar sesión
        </button>
      )}
    </header>
  );
}
