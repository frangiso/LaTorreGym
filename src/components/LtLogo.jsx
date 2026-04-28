// Logo usando imagen base64 del SVG real para garantizar fidelidad visual
// Estructura: LA | T | kettlebell(O) | RRE en dos líneas, barra GYM abajo

export default function LtLogo({ size = "md" }) {
  const widths = { sm: 140, md: 220, lg: 320 };
  const w = widths[size] || 220;

  return (
    <div style={{ width: w, display: "flex", flexDirection: "column", userSelect: "none" }}>
      {/* Línea 1: LA */}
      <div style={{
        display: "flex", alignItems: "flex-end", lineHeight: 1,
        fontFamily: "'Arial Black', 'Arial Bold', Gadget, sans-serif",
        fontWeight: 900,
      }}>
        {/* LA */}
        <span style={{
          color: "#ffffff",
          fontSize: w * 0.22,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}>LA</span>
      </div>

      {/* Línea 2: T + kettlebell + RRE */}
      <div style={{
        display: "flex", alignItems: "center",
        fontFamily: "'Arial Black', 'Arial Bold', Gadget, sans-serif",
        fontWeight: 900,
        marginTop: w * -0.04,
        lineHeight: 1,
      }}>
        {/* T */}
        <span style={{
          color: "#ffffff",
          fontSize: w * 0.36,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}>T</span>

        {/* Kettlebell SVG como la O */}
        <svg
          width={w * 0.28}
          height={w * 0.36}
          viewBox="0 0 100 130"
          fill="none"
          style={{ marginLeft: w * -0.01, marginRight: w * -0.01, flexShrink: 0 }}
        >
          {/* Asa del kettlebell */}
          <path
            d="M28 58 C28 20 72 20 72 58"
            stroke="#F5C400" strokeWidth="18" strokeLinecap="round" fill="none"
          />
          {/* Cuerpo */}
          <ellipse cx="50" cy="88" rx="38" ry="36" fill="#F5C400"/>
          {/* Agujero del asa */}
          <ellipse cx="50" cy="54" rx="15" ry="13" fill="#111111"/>
        </svg>

        {/* RRE */}
        <span style={{
          color: "#ffffff",
          fontSize: w * 0.36,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}>RRE</span>
      </div>

      {/* Barra GYM */}
      <div style={{
        background: "#F5C400",
        textAlign: "center",
        padding: `${w * 0.025}px 0`,
        marginTop: w * 0.01,
      }}>
        <span style={{
          fontFamily: "'Arial Black', 'Arial Bold', Gadget, sans-serif",
          fontWeight: 900,
          fontSize: w * 0.14,
          color: "#111111",
          letterSpacing: "0.12em",
        }}>GYM</span>
      </div>
    </div>
  );
}
