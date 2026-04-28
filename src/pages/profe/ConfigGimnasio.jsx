import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function ConfigGimnasio() {
  const [config, setConfig] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [nuevoItem, setNuevoItem] = useState("");

  useEffect(() => {
    getDoc(doc(db, "config", "gimnasio")).then(snap => {
      if (snap.exists()) setConfig(snap.data());
    });
  }, []);

  async function guardar() {
    setGuardando(true);
    await setDoc(doc(db, "config", "gimnasio"), config, { merge: true });
    setGuardando(false);
    setOk(true);
    setTimeout(() => setOk(false), 2500);
  }

  function actualizarPlan(i, campo, valor) {
    setConfig(c => {
      const planes = [...c.planes];
      planes[i] = { ...planes[i], [campo]: campo.includes("precio") ? Number(valor) : valor };
      return { ...c, planes };
    });
  }

  function agregarReglamento() {
    if (!nuevoItem.trim()) return;
    setConfig(c => ({ ...c, reglamento: [...(c.reglamento || []), nuevoItem.trim()] }));
    setNuevoItem("");
  }

  function eliminarReglamento(i) {
    setConfig(c => ({ ...c, reglamento: c.reglamento.filter((_, idx) => idx !== i) }));
  }

  if (!config) return <p style={{ color: "#888" }}>Cargando configuración...</p>;

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 24 }}>Configuración del gimnasio</h2>

      {/* Datos básicos */}
      <Section title="Datos del negocio">
        <Field label="Nombre del gimnasio">
          <input className="lt-input" value={config.nombre || ""} onChange={e => setConfig(c => ({ ...c, nombre: e.target.value }))} />
        </Field>
        <Field label="Alias de transferencia">
          <input className="lt-input" value={config.alias || ""} onChange={e => setConfig(c => ({ ...c, alias: e.target.value }))} placeholder="complejo.latorre" />
        </Field>
        <Field label="WhatsApp del gimnasio (sin +54, sin 0, sin 15)">
          <input className="lt-input" value={config.whatsapp || ""} onChange={e => setConfig(c => ({ ...c, whatsapp: e.target.value }))} placeholder="Ej: 2664123456" />
        </Field>
      </Section>

      {/* Reglamento */}
      <Section title="Reglamento">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {(config.reglamento || []).map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F5C400", marginTop: 7, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, color: "#333", lineHeight: 1.5 }}>{item}</span>
              <button onClick={() => eliminarReglamento(i)}
                style={{ background: "transparent", border: "none", color: "#ccc", cursor: "pointer", fontSize: 16, padding: "0 4px", lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={nuevoItem}
            onChange={e => setNuevoItem(e.target.value)}
            onKeyDown={e => e.key === "Enter" && agregarReglamento()}
            placeholder="Nueva regla..."
            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "0.5px solid #e0e0e0", fontSize: 13 }}
          />
          <button onClick={agregarReglamento}
            style={{ background: "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            + Agregar
          </button>
        </div>
      </Section>

      {/* Planes */}
      <Section title="Planes y precios">
        {(config.planes || []).map((plan, i) => (
          <div key={plan.id} style={{ background: "#f9f9f9", borderRadius: 10, padding: "14px", marginBottom: 12 }}>
            <Field label="Nombre del plan">
              <input className="lt-input" value={plan.nombre} onChange={e => actualizarPlan(i, "nombre", e.target.value)} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
              <Field label="Precio transferencia ($)">
                <input className="lt-input" type="number" value={plan.precioTransferencia} onChange={e => actualizarPlan(i, "precioTransferencia", e.target.value)} />
              </Field>
              <Field label="Precio efectivo ($)">
                <input className="lt-input" type="number" value={plan.precioEfectivo} onChange={e => actualizarPlan(i, "precioEfectivo", e.target.value)} />
              </Field>
            </div>
          </div>
        ))}
      </Section>

      {/* Guardar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={guardar} disabled={guardando}
          style={{ background: "#F5C400", color: "#111", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
        {ok && <span style={{ color: "#10b981", fontSize: 13, fontWeight: 500 }}>✓ Guardado</span>}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 13, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>{title}</h3>
      <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "16px 18px" }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
