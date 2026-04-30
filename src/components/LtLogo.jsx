export default function LtLogo({ size = "md" }) {
  const widths = { sm: 80, md: 220, lg: 320 };
  const w = widths[size] || 220;

  return (
    <div style={{ width: w, display: "flex", flexDirection: "column", userSelect: "none" }}>
      {/* Linea 1: LA */}
      <div style={{
        fontFamily: "'Arial Black', 'Arial Bold', Gadget, sans-serif",
        fontWeight: 900,
        color: "#ffffff",
        fontSize: w * 0.21,
        letterSpacing: "-0.02em",
        lineHeight: 1,
      }}>LA</div>

      {/* Linea 2: T + kettlebell + RRE */}
      <div style={{
        display: "flex",
        alignItems: "center",
        marginTop: w * -0.03,
        lineHeight: 1,
      }}>
        <span style={{
          fontFamily: "'Arial Black', 'Arial Bold', Gadget, sans-serif",
          fontWeight: 900,
          color: "#ffffff",
          fontSize: w * 0.35,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}>T</span>

        <svg
          width={w * 0.27}
          height={w * 0.35}
          viewBox="0 0 100 130"
          fill="none"
          style={{ flexShrink: 0, marginLeft: w * -0.01, marginRight: w * -0.015 }}
        >
          <path d="M28 58 C28 20 72 20 72 58"
            stroke="#F5C400" strokeWidth="18" strokeLinecap="round" fill="none"/>
          <ellipse cx="50" cy="88" rx="38" ry="36" fill="#F5C400"/>
          <ellipse cx="50" cy="54" rx="15" ry="13" fill="#111111"/>
        </svg>

        <span style={{
          fontFamily: "'Arial Black', 'Arial Bold', Gadget, sans-serif",
          fontWeight: 900,
          color: "#ffffff",
          fontSize: w * 0.35,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}>RRE</span>
      </div>

      {/* Barra GYM */}
      <div style={{
        background: "#F5C400",
        textAlign: "center",
        padding: size === "sm" ? "2px 0" : "4px 0",
        marginTop: w * 0.01,
      }}>
        <span style={{
          fontFamily: "'Arial Black', 'Arial Bold', Gadget, sans-serif",
          fontWeight: 900,
          fontSize: w * 0.13,
          color: "#111111",
          letterSpacing: "0.1em",
        }}>GYM</span>
      </div>
    </div>
  );
}
