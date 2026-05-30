const widths = { sm: 90, md: 220, lg: 320 };

export default function LtLogo({ size = "md" }) {
  const w = widths[size] || 220;
  return (
    <img
      src="/logo.jpg"
      alt="La Torre Gym"
      style={{ width: w, display: "block", userSelect: "none" }}
      draggable={false}
    />
  );
}
