import LtLogo from "./LtLogo";

export default function LtHeader({ rol, onLogout }) {
  return (
    <header style={{
      background: "#111",
      borderBottom: "1px solid #222",
      padding: "4px 16px",
      height: 64,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}>
      <LtLogo size="sm" />

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {onLogout && (
          <button onClick={onLogout}
            style={{
              background: "transparent",
              border: "1px solid #333",
              borderRadius: 7,
              padding: "6px 14px",
              color: "#fff",
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}>
            Salir
          </button>
        )}
      </div>
    </header>
  );
}
