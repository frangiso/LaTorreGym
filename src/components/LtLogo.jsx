export default function LtLogo({ size = "md" }) {
  const scales = { sm: 0.5, md: 0.82, lg: 1.2 };
  const s = scales[size] || 0.82;
  const w = Math.round(300 * s);
  const h = Math.round(160 * s);

  return (
    <svg width={w} height={h} viewBox="0 0 300 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* "LA" blanco */}
      <text x="0" y="88"
        fontFamily="'Arial Black', 'Impact', sans-serif"
        fontWeight="900" fontSize="90" fill="white" letterSpacing="-3">LA</text>

      {/* Espacio para la T + kettlebell + O fusionados */}
      {/* T en blanco */}
      <text x="122" y="88"
        fontFamily="'Arial Black', 'Impact', sans-serif"
        fontWeight="900" fontSize="90" fill="white" letterSpacing="-3">T</text>

      {/* Kettlebell amarillo encima de donde iría la O, tamaño similar */}
      {/* Asa */}
      <path d="M168 30 C168 8 212 8 212 30" stroke="#F5C400" strokeWidth="12" strokeLinecap="round" fill="none"/>
      {/* Cuerpo redondeado */}
      <ellipse cx="190" cy="62" rx="28" ry="26" fill="#F5C400"/>
      {/* Agujero del asa */}
      <ellipse cx="190" cy="28" rx="11" ry="9" fill="#111111"/>

      {/* "RRE" blanco */}
      <text x="218" y="88"
        fontFamily="'Arial Black', 'Impact', sans-serif"
        fontWeight="900" fontSize="90" fill="white" letterSpacing="-3">RRE</text>

      {/* Barra GYM amarilla */}
      <rect x="0" y="98" width="300" height="56" fill="#F5C400"/>
      <text x="150" y="141"
        fontFamily="'Arial Black', 'Impact', sans-serif"
        fontWeight="900" fontSize="36" fill="#111111"
        textAnchor="middle" letterSpacing="6">GYM</text>
    </svg>
  );
}
