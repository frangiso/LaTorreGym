import { exportarBackupExcel } from "../../utils/exportarExcel";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, getDocs, deleteDoc, collection, query, where, writeBatch, addDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useData } from "../../context/DataContext";
import { crearReservasFijas } from "../../reservasFijas";

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

      

      {/* Capacidad */}
      <Section title="Capacidad del gimnasio">
        <Field label="Cupo máximo por turno (personas)">
          <input style={inp} type="number" min="1" max="100"
            value={config.cupoMaximo ?? 15}
            onChange={e => setConfig(c => ({ ...c, cupoMaximo: Number(e.target.value) }))} />
        </Field>
        <p style={{ fontSize: 12, color: "#aaa", margin: "4px 0 0" }}>
          Cantidad máxima de alumnos que pueden reservar el mismo horario.
        </p>
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

      {/* Migración de historial de pagos */}
      <MigrarHistorialPagos />

      {/* Reset de datos */}
      <ResetDatos />

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
  const { alumnos } = useData();
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

      // Regenerar turnos fijos de alumnos activos con plan vigente
      const hoy = new Date().toISOString().split("T")[0];
      const conFijos = alumnos.filter(a =>
        a.turnosFijosEstado === "aprobado" &&
        (a.turnosFijos || []).length > 0 &&
        a.estado === "activo" &&
        (!a.fechaVencimiento || (a.fechaVencimiento?.toDate?.() || new Date(a.fechaVencimiento)).toISOString().split("T")[0] >= hoy)
      );
      for (const a of conFijos) {
        await crearReservasFijas(a.uid, (a.nombre + " " + a.apellido).trim(), a.turnosFijos, 4);
      }

      setResultado({ levantado: true, fechas: aEliminar.length, regenerados: conFijos.length });
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
            {resultado.levantado
              ? "✓ Cierre levantado — " + resultado.fechas + " días liberados. Turnos fijos regenerados para " + resultado.regenerados + " alumno" + (resultado.regenerados !== 1 ? "s" : "") + "."
              : "✓ " + resultado.fechas + " días bloqueados — " + resultado.canceladas + " reservas canceladas."}
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

function MigrarHistorialPagos() {
  const [migrando, setMigrando] = useState(false);
  const [resultado, setResultado] = useState(null);

  async function migrar() {
    setMigrando(true);
    setResultado(null);
    try {
      const snapAlumnos = await getDocs(query(collection(db, "usuarios"), where("rol", "==", "alumno")));
      let creados = 0, saltados = 0;
      for (const d of snapAlumnos.docs) {
        const al = d.data();
        if (!al.fechaActivacion || !al.montoPagado) continue;
        // Idempotente: si el alumno ya tiene algún pago en el historial, no se migra de nuevo.
        const yaExiste = await getDocs(query(collection(db, "pagos"), where("alumnoUid", "==", d.id)));
        if (!yaExiste.empty) { saltados++; continue; }
        await addDoc(collection(db, "pagos"), {
          alumnoUid:           d.id,
          alumnoNombre:        al.nombre || "",
          alumnoApellido:      al.apellido || "",
          planId:              al.planId || null,
          planNombre:          al.planNombre || null,
          montoEfectivo:       al.montoEfectivo ?? (al.metodoPago === "efectivo" ? al.montoPagado : 0),
          montoTransferencia:  al.montoTransferencia ?? (al.metodoPago === "transferencia" ? al.montoPagado : 0),
          montoTotal:          al.montoPagado,
          descuentoAplicado:   al.descuentoAplicado || null,
          inscripcionCobrada:  !!al.inscripcionPagada,
          montoInscripcion:    0,
          nroRecibo:           al.nroRecibo || null,
          fechaVencimientoResultante: al.fechaVencimiento || null,
          fechaPago:           al.fechaActivacion,
          confirmadoPorUid:    null,
          confirmadoPorNombre: "Migración automática",
          migrado:             true,
        });
        creados++;
      }
      setResultado({ creados, saltados });
    } catch(e) {
      alert("Error al migrar: " + e.message);
    }
    setMigrando(false);
  }

  return (
    <div style={{ paddingTop: 24, borderTop: "1px solid #e0e0e0", marginBottom: 32 }}>
      <h3 style={{ fontSize: 15, fontWeight: 500, color: "#111", margin: "0 0 6px" }}>Migrar historial de pagos</h3>
      <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px", lineHeight: 1.5 }}>
        Copia el último pago registrado de cada alumno al nuevo historial de pagos, para que no se pierda.
        Es seguro apretarlo más de una vez: a los alumnos que ya tengan algún pago migrado no se les vuelve a crear.
      </p>
      {resultado && (
        <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: "#065f46", margin: 0 }}>
            ✓ {resultado.creados} pago{resultado.creados !== 1 ? "s" : ""} migrado{resultado.creados !== 1 ? "s" : ""}
            {resultado.saltados > 0 ? ` — ${resultado.saltados} ya tenían historial y se saltearon` : ""}.
          </p>
        </div>
      )}
      <button onClick={migrar} disabled={migrando}
        style={{ background: migrando ? "#e0e0e0" : "#F5C400", color: migrando ? "#aaa" : "#111",
          border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 500,
          cursor: migrando ? "default" : "pointer" }}>
        {migrando ? "Migrando..." : "📋 Migrar pagos existentes"}
      </button>
    </div>
  );
}

async function borrarColeccion(nombreCol, filtro = null) {
  const snap = filtro
    ? await getDocs(query(collection(db, nombreCol), ...filtro))
    : await getDocs(collection(db, nombreCol));
  const lotes = [];
  for (let i = 0; i < snap.docs.length; i += 500) {
    const b = writeBatch(db);
    snap.docs.slice(i, i + 500).forEach(d => b.delete(doc(db, nombreCol, d.id)));
    lotes.push(b.commit());
  }
  await Promise.all(lotes);
  return snap.docs.length;
}

function ResetDatos() {
  const [reseteando, setReseteando] = useState(false);
  const [resultado, setResultado]   = useState(null);

  async function resetear() {
    if (!confirm("¿Borrar TODOS los alumnos, reservas y caja? Esto no se puede deshacer.")) return;
    if (!confirm("Segunda confirmación: se borrarán permanentemente todos los alumnos registrados y sus reservas.")) return;
    setReseteando(true);
    setResultado(null);
    try {
      const [alumnos, reservas, actividad, notifs, espera, emails] = await Promise.all([
        borrarColeccion("usuarios", [where("rol", "==", "alumno")]),
        borrarColeccion("reservas"),
        borrarColeccion("actividad"),
        borrarColeccion("notificaciones"),
        borrarColeccion("listaEspera"),
        borrarColeccion("emailsLiberados"),
      ]);
      setResultado({ alumnos, reservas });
    } catch(e) {
      alert("Error durante el reset: " + e.message);
    }
    setReseteando(false);
  }

  return (
    <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #e0e0e0", marginBottom: 32 }}>
      <h3 style={{ fontSize: 15, fontWeight: 500, color: "#dc2626", margin: "0 0 6px" }}>Reset de datos</h3>
      <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px", lineHeight: 1.5 }}>
        Borra todos los alumnos registrados, sus reservas y la caja. La configuración del gimnasio y los planes no se tocan.
      </p>
      {resultado && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: "#991b1b", margin: 0 }}>
            ✓ Reset completado — {resultado.alumnos} alumno{resultado.alumnos !== 1 ? "s" : ""} eliminado{resultado.alumnos !== 1 ? "s" : ""}, {resultado.reservas} reserva{resultado.reservas !== 1 ? "s" : ""} borrada{resultado.reservas !== 1 ? "s" : ""}. Caja en $0.
          </p>
        </div>
      )}
      <button onClick={resetear} disabled={reseteando}
        style={{ background: reseteando ? "#e0e0e0" : "#dc2626", color: reseteando ? "#aaa" : "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 500, cursor: reseteando ? "default" : "pointer" }}>
        {reseteando ? "Borrando..." : "🗑 Borrar alumnos y caja"}
      </button>
    </div>
  );
}
