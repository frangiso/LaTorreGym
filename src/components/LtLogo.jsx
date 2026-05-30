const FONT = "'Rubik', 'Arial Black', sans-serif";

export default function LtLogo({ size = "md" }) {
  const widths = { sm: 90, md: 220, lg: 320 };
  const w = widths[size] || 220;
  const kbW = w * 0.265;
  const kbH = w * 0.39;

  return (
    <div style={{ width: w, display: "flex", flexDirection: "column", userSelect: "none" }}>

      {/* LA */}
      <div style={{
        fontFamily: FONT,
        fontWeight: 900,
        color: "#fff",
        fontSize: w * 0.19,
        letterSpacing: "0.04em",
        lineHeight: 1.05,
      }}>LA</div>

      {/* T + kettlebell + RRE */}
      <div style={{
        display: "flex",
        alignItems: "center",
        marginTop: w * -0.028,
        lineHeight: 1,
      }}>
        <span style={{
          fontFamily: FONT,
          fontWeight: 900,
          color: "#fff",
          fontSize: w * 0.355,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}>T</span>

        {/* Kettlebell SVG */}
        <svg
          width={kbW}
          height={kbH}
          viewBox="0 0 100 148"
          fill="none"
          style={{ flexShrink: 0, marginLeft: w * -0.006, marginRight: w * -0.014 }}
        >
          {/* Anillo circular */}
          <circle cx="50" cy="35" r="28" fill="#F5C400"/>
          {/* Cuello recto (trapecio, lados rectos) */}
          <polygon points="22,54 78,54 90,82 10,82" fill="#F5C400"/>
          {/* Cuerpo redondo */}
          <ellipse cx="50" cy="112" rx="46" ry="36" fill="#F5C400"/>
          {/* Agujero del anillo */}
          <circle cx="50" cy="35" r="17" fill="#111"/>
        </svg>

        <span style={{
          fontFamily: FONT,
          fontWeight: 900,
          color: "#fff",
          fontSize: w * 0.355,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}>RRE</span>
      </div>

      {/* Barra GYM */}
      <div style={{
        background: "#F5C400",
        textAlign: "center",
        padding: size === "sm" ? "1px 0" : "3px 0",
        marginTop: w * 0.006,
      }}>
        <span style={{
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: w * 0.125,
          color: "#111",
          letterSpacing: "0.2em",
        }}>GYM</span>
      </div>

    </div>
  );
}
