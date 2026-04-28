// Logo fiel al original: kettlebell amarillo, LA TORRE en blanco, barra amarilla GYM negro
export default function LtLogo({ size = "md" }) {
  const scales = { sm: 0.55, md: 0.85, lg: 1.3 };
  const s = scales[size] || 0.85;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      {/* Fila superior: LA + kettlebell + RRE */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 0 }}>
        {/* "LA" */}
        <svg width={Math.round(72 * s)} height={Math.round(52 * s)} viewBox="0 0 72 52" fill="none">
          {/* L */}
          <text x="2" y="44" fontFamily="Arial Black, Impact, sans-serif" fontWeight="900"
            fontSize="46" fill="white" letterSpacing="-2">LA</text>
        </svg>

        {/* Kettlebell (reemplaza la O de TORRE) */}
        <svg width={Math.round(68 * s)} height={Math.round(86 * s)} viewBox="0 0 68 86" fill="none">
          {/* Asa del kettlebell */}
          <path d="M14 36 C14 16 54 16 54 36" stroke="#F5C400" strokeWidth="10" strokeLinecap="round" fill="none"/>
          {/* Cuerpo del kettlebell */}
          <ellipse cx="34" cy="60" rx="28" ry="24" fill="#F5C400"/>
          {/* Agujero del asa */}
          <ellipse cx="34" cy="34" rx="10" ry="8" fill="#111111"/>
        </svg>

        {/* "RRE" */}
        <svg width={Math.round(108 * s)} height={Math.round(52 * s)} viewBox="0 0 108 52" fill="none">
          <text x="0" y="44" fontFamily="Arial Black, Impact, sans-serif" fontWeight="900"
            fontSize="46" fill="white" letterSpacing="-2">RRE</text>
        </svg>
      </div>

      {/* Barra GYM */}
      <div style={{
        background: "#F5C400",
        width: "100%",
        padding: `${Math.round(5 * s)}px ${Math.round(24 * s)}px`,
        textAlign: "center",
        marginTop: Math.round(-4 * s),
      }}>
        <span style={{
          fontFamily: "Arial Black, Impact, sans-serif",
          fontWeight: 900,
          fontSize: Math.round(28 * s),
          color: "#111111",
          letterSpacing: Math.round(4 * s),
        }}>GYM</span>
      </div>
    </div>
  );
}
