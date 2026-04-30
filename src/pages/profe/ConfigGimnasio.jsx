import { exportarBackupExcel } from "../../utils/exportarExcel";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, getDocs, deleteDoc, collection, query, where, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";

export default function ConfigGimnasio() {
  const [config, setConfig]               = useState(null);
  const [guardando, setGuardando]         = useState(false);
  const [ok, setOk]                       = useState(false);
  const [nuevoItem, setNuevoItem]         = useState("");
  const [haciendoBackup, setHaciendoBackup] = useState(false);
  const [resultadoBackup, setResultadoBackup] = useState(null);

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

  async function realizarBackup() {
    setHaciendoBackup(true);
    setResultadoBackup(null);
    try {
      const snapAlumnos = await getDocs(collection(db, "usuarios"));
      const alumnos = snapAlumnos.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.rol === "alumno");
      const hoy  = new Date();
      const anio = hoy.getFullYear();
      const mes  = String(hoy.getMonth() + 1).padStart(2, "0");
      const qRes = query(collection(db, "reservas"), where("fecha", ">=", anio+"-"+mes+"-01"), where("fecha", "<=", anio+"-"+mes+"-31"));
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
      {!config && <p style={{ color: "#888", padding: 20 }}>Cargando configuración...</p>}
      {config && <>
      <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 24 }}>Configuración del gimnasio</h2>

      {/* Datos básicos */}
      <Section title="Datos del negocio">
        <Field label="Nombre del gimnasio">
          <input style={inp} value={config.nombre || ""} onChange={e => setConfig(c => ({ ...c, nombre: e.target.value }))} />
        </Field>
        <Field label="Alias de transferencia">
          <input style={inp} value={config.alias || ""} onChange={e => setConfig(c => ({ ...c, alias: e.target.value }))} placeholder="complejo.latorre" />
        </Field>
        <Field label="WhatsApp del gimnasio (sin +54, sin 0, sin 15)">
          <input style={inp} value={config.whatsapp || ""} onChange={e => setConfig(c => ({ ...c, whatsapp: e.target.value }))} placeholder="Ej: 2664123456" />
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
                style={{ background: "transparent", border: "none", color: "#ccc", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={nuevoItem} onChange={e => setNuevoItem(e.target.value)}
            onKeyDown={e => e.key === "Enter" && agregarReglamento()}
            placeholder="Nueva regla..." style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "0.5px solid #e0e0e0", fontSize: 13 }} />
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
              <input style={inp} value={plan.nombre} onChange={e => actualizarPlan(i, "nombre", e.target.value)} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
              <Field label="Precio transferencia ($)">
                <input style={inp} type="number" value={plan.precioTransferencia} onChange={e => actualizarPlan(i, "precioTransferencia", e.target.value)} />
              </Field>
              <Field label="Precio efectivo ($)">
                <input style={inp} type="number" value={plan.precioEfectivo} onChange={e => actualizarPlan(i, "precioEfectivo", e.target.value)} />
              </Field>
            </div>
          </div>
        ))}
      </Section>

      {/* Guardar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 32 }}>
        <button onClick={guardar} disabled={guardando}
          style={{ background: "#F5C400", color: "#111", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
        {ok && <span style={{ color: "#10b981", fontSize: 13, fontWeight: 500 }}>✓ Guardado</span>}
      </div>

      {/* Cierre temporario */}
      <CierreTemporario />

      {/* Backup */}
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #e0e0e0" }}>
        <h3 style={{ fontSize: 15, fontWeight: 500, color: "#111", margin: "0 0 6px" }}>Copia de seguridad</h3>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px", lineHeight: 1.5 }}>
          Descargá un Excel con todos los alumnos y las reservas del mes. Guardalo como respaldo.
        </p>
        {resultadoBackup && (
          <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#065f46", marginBottom: 4 }}>✓ Backup descargado</div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#065f46", background: "#f0fdf4", padding: "2px 10px", borderRadius: 20 }}>{resultadoBackup.alumnos} alumnos</span>
              <span style={{ fontSize: 12, color: "#065f46", background: "#f0fdf4", padding: "2px 10px", borderRadius: 20 }}>{resultadoBackup.reservas} reservas del mes</span>
            </div>
          </div>
        )}
        <button onClick={realizarBackup} disabled={haciendoBackup}
          style={{ background: haciendoBackup ? "#e0e0e0" : "#111", color: haciendoBackup ? "#aaa" : "#F5C400",
            border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 500,
            cursor: haciendoBackup ? "default" : "pointer" }}>
          {haciendoBackup ? "Generando..." : "💾 Descargar copia de seguridad"}
        </button>
      </div>
    </>}
    </div>
  );
}

const inp = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "0.5px solid #e0e0e0", fontSize: 14, boxSizing: "border-box" };

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 13, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>{title}</h3>
      <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "16px 18px" }}>{children}</div>
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

function CierreTemporario() {
  const [desde, setDesde]             = useState("");
  const [hasta, setHasta]             = useState("");
  const [procesando, setProcesando]   = useState(false);
  const [resultado, setResultado]     = useState(null);

  const inp2 = { padding: "9px 12px", borderRadius: 8, border: "0.5px solid #e0e0e0", fontSize: 14, width: "100%", boxSizing: "border-box", background: "#fff" };

  async function aplicarCierre() {
    if (!desde || !hasta) { alert("Ingresá las fechas."); return; }
    if (desde > hasta) { alert("La fecha inicio debe ser antes que la fin."); return; }
    if (!confirm("¿Bloquear del " + desde + " al " + hasta + " y cancelar todas las reservas?")) return;
    setProcesando(true); setResultado(null);
    try {
      const fechas = [];
      const d = new Date(desde + "T00:00:00"), fin = new Date(hasta + "T00:00:00");
      while (d <= fin) { fechas.push(d.toISOString().split("T")[0]); d.setDate(d.getDate() + 1); }

      const batchFer = writeBatch(db);
      fechas.forEach(f => batchFer.set(doc(db, "feriados", f), { fecha: f, creadoEn: new Date(), esCierre: true }));
      await batchFer.commit();

      let canceladas = 0;
      for (let i = 0; i < fechas.length; i += 10) {
        const chunk = fechas.slice(i, i + 10);
        const snap = await getDocs(query(collection(db, "reservas"), where("fecha", "in", chunk)));
        if (snap.docs.length > 0) {
          const b = writeBatch(db);
          snap.docs.forEach(d => b.delete(doc(db, "reservas", d.id)));
          await b.commit();
          canceladas += snap.docs.length;
        }
      }
      setResultado({ fechas: fechas.length, canceladas });
      setDesde(""); setHasta("");
    } catch(e) { alert("Error: " + e.message); }
    setProcesando(false);
  }

  async function levantarCierre() {
    if (!desde || !hasta) { alert("Ingresá las fechas."); return; }
    if (!confirm("¿Levantar el cierre del " + desde + " al " + hasta + "?")) return;
    setProcesando(true);
    try {
      const fechas = [];
      const d = new Date(desde + "T00:00:00"), fin = new Date(hasta + "T00:00:00");
      while (d <= fin) { fechas.push(d.toISOString().split("T")[0]); d.setDate(d.getDate() + 1); }

      const snap = await getDocs(query(collection(db, "feriados"), where("esCierre", "==", true)));
      const aEliminar = snap.docs.filter(d => fechas.includes(d.data().fecha));
      if (aEliminar.length > 0) {
        const b = writeBatch(db);
        aEliminar.forEach(d => b.delete(doc(db, "feriados", d.id)));
        await b.commit();
      }
      setResultado({ levantado: true, fechas: aEliminar.length });
      setDesde(""); setHasta("");
    } catch(e) { alert("Error: " + e.message); }
    setProcesando(false);
  }

  return (
    <div style={{ paddingTop: 24, borderTop: "1px solid #e0e0e0", marginBottom: 32 }}>
      <h3 style={{ fontSize: 15, fontWeight: 500, color: "#111", margin: "0 0 6px" }}>Cierre temporario</h3>
      <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px", lineHeight: 1.5 }}>
        Bloqueá un rango de fechas por vacaciones o mantenimiento. Se cancelan automáticamente todas las reservas del período.
      </p>
      {resultado && (
        <div style={{ background: resultado.levantado ? "#dcfce7" : "#fef3c7", border: "1px solid " + (resultado.levantado ? "#86efac" : "#fcd34d"), borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: resultado.levantado ? "#065f46" : "#92400e", margin: 0 }}>
            {resultado.levantado ? "✓ Cierre levantado — " + resultado.fechas + " días liberados." : "✓ " + resultado.fechas + " días bloqueados — " + resultado.canceladas + " reservas canceladas."}
          </p>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} min={new Date().toISOString().split("T")[0]} style={inp2} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} min={desde || new Date().toISOString().split("T")[0]} style={inp2} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={aplicarCierre} disabled={procesando || !desde || !hasta}
          style={{ background: desde && hasta ? "#dc2626" : "#e0e0e0", color: desde && hasta ? "#fff" : "#aaa", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 13, fontWeight: 500, cursor: desde && hasta ? "pointer" : "default" }}>
          {procesando ? "Procesando..." : "🔒 Aplicar cierre"}
        </button>
        <button onClick={levantarCierre} disabled={procesando || !desde || !hasta}
          style={{ background: "transparent", border: "0.5px solid #e0e0e0", borderRadius: 10, padding: "11px 20px", fontSize: 13, color: "#555", cursor: desde && hasta ? "pointer" : "default" }}>
          🔓 Levantar cierre
        </button>
      </div>
    </div>
  );
}
