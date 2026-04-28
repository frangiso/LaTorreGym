// LtLayout.jsx
export default function LtLayout({ children, centrado }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: centrado ? "#111" : "#f7f7f7",
      display: centrado ? "flex" : "block",
      alignItems: centrado ? "center" : undefined,
      justifyContent: centrado ? "center" : undefined,
      padding: centrado ? "24px 16px" : 0,
    }}>
      {children}
    </div>
  );
}
