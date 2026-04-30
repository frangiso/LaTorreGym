import { exportarBackupExcel } from "../../utils/exportarExcel";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } , getDocs, collection from "firebase/firestore";
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

  const [haciendoBackup, setHaciendoBackup] = useState(false);
  const [resultadoBackup, setResultadoBackup] = useState(null);

  async function realizarBackup() {
    setHaciendoBackup(true);
    setResultadoBackup(null);
    try {
      // Traer alumnos
      const snapAlumnos = await getDocs(collection(db, "usuarios"));
      const alumnos = snapAlumnos.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(u => u.rol === "alumno");

      // Traer reservas del mes
      const hoy   = new Date();
      const anio  = hoy.getFullYear();
      const mes   = String(hoy.getMonth() + 1).padStart(2, "0");
      const desde = anio + "-" + mes + "-01";
      const hasta = anio + "-" + mes + "-31";
      const qRes  = query(collection(db, "reservas"), where("fecha", ">=", desde), where("fecha", "<=", hasta));
      const snapRes = await getDocs(qRes);
      const reservas = snapRes.docs.map(d => ({ id: d.id, ...d.data() }));

      await exportarBackupExcel(alumnos, reservas);
      setResultadoBackup({ alumnos: alumnos.length, reservas: reservas.length });
    } catch(e) {
      console.error(e);
      alert("Error al hacer backup: " + e.message);
    }
    setHaciendoBackup(false);
  }

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
      {/* ====== BACKUP ====== */}
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #e0e0e0" }}>
        <h3 style={{ fontSize: 15, fontWeight: 500, color: "#111", margin: "0 0 6px" }}>Copia de seguridad</h3>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px", lineHeight: 1.5 }}>
          Descargá un archivo JSON con todos los datos del sistema: alumnos, reservas, config, avisos y feriados.
          Guardalo en un lugar seguro por si necesitás recuperar información.
        </p>

        {resultadoBackup && (
          <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#065f46", marginBottom: 6 }}>✓ Backup descargado correctamente</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#065f46", background: "#f0fdf4", padding: "2px 10px", borderRadius: 20 }}>
                {resultadoBackup.alumnos} alumnos
              </span>
              <span style={{ fontSize: 12, color: "#065f46", background: "#f0fdf4", padding: "2px 10px", borderRadius: 20 }}>
                {resultadoBackup.reservas} reservas del mes
              </span>
            </div>
          </div>
        )}

        <button onClick={realizarBackup} disabled={haciendoBackup}
          style={{
            background: haciendoBackup ? "#e0e0e0" : "#111",
            color: haciendoBackup ? "#aaa" : "#F5C400",
            border: "none", borderRadius: 10, padding: "12px 24px",
            fontSize: 14, fontWeight: 500, cursor: haciendoBackup ? "default" : "pointer",
            display: "flex", alignItems: "center", gap: 8,
          }}>
          {haciendoBackup ? "Generando backup..." : "💾 Descargar copia de seguridad"}
        </button>
      </div>
    </div>
  );
}