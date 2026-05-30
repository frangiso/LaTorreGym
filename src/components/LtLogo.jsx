export default function LtLogo({ size = "md" }) {
  const widths = { sm: 88, md: 220, lg: 320 };
  const w = widths[size] || 220;

  // Kettlebell dimensions proporcionales
  const kbW = w * 0.27;
  const kbH = w * 0.40;

  return (
    <div style={{ width: w, display: "flex", flexDirection: "column", userSelect: "none" }}>

      {/* Linea 1: LA */}
      <div style={{
        fontFamily: "'Arial Black', 'Arial Bold', Impact, sans-serif",
        fontWeight: 900,
        color: "#ffffff",
        fontSize: w * 0.195,
        letterSpacing: "0.01em",
        lineHeight: 1.05,
      }}>LA</div>

      {/* Linea 2: T + kettlebell + RRE */}
      <div style={{
        display: "flex",
        alignItems: "center",
        marginTop: w * -0.025,
        lineHeight: 1,
      }}>
        <span style={{
          fontFamily: "'Arial Black', 'Arial Bold', Impact, sans-serif",
          fontWeight: 900,
          color: "#ffffff",
          fontSize: w * 0.355,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}>T</span>

        {/* Kettlebell: anillo redondo + cuello + cuerpo */}
        <svg
          width={kbW}
          height={kbH}
          viewBox="0 0 100 148"
          fill="none"
          style={{ flexShrink: 0, marginLeft: w * -0.008, marginRight: w * -0.012 }}
        >
          {/* Anillo exterior */}
          <circle cx="50" cy="38" r="29" fill="#F5C400"/>
          {/* Agujero del anillo */}
          <circle cx="50" cy="38" r="17" fill="#111111"/>
          {/* Cuello */}
          <rect x="21" y="53" width="58" height="20" fill="#F5C400" rx="3"/>
          {/* Cuerpo redondo */}
          <ellipse cx="50" cy="108" rx="44" ry="38" fill="#F5C400"/>
        </svg>

        <span style={{
          fontFamily: "'Arial Black', 'Arial Bold', Impact, sans-serif",
          fontWeight: 900,
          color: "#ffffff",
          fontSize: w * 0.355,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}>RRE</span>
      </div>

      {/* Barra GYM */}
      <div style={{
        background: "#F5C400",
        textAlign: "center",
        padding: size === "sm" ? "2px 0" : "4px 0",
        marginTop: w * 0.008,
      }}>
        <span style={{
          fontFamily: "'Arial Black', 'Arial Bold', Impact, sans-serif",
          fontWeight: 900,
          fontSize: w * 0.125,
          color: "#111111",
          letterSpacing: "0.18em",
        }}>GYM</span>
      </div>

    </div>
  );
}
