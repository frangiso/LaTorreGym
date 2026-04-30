// utils/mantenimiento.js
// Tareas automáticas que corren al iniciar el panel del profe

import { collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

// Resetea recuperaciones el 1 de cada mes
// Marca cuota como vencida si paso la fecha
let ultimoMantenimiento = null;

export async function correrMantenimiento() {
  const hoy = new Date().toDateString();
  if (ultimoMantenimiento === hoy) return; // ya corrió hoy en esta sesión
  ultimoMantenimiento = hoy;
  const hoy = new Date();
  const snap = await getDocs(collection(db, "usuarios"));
  const alumnos = snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.rol === "alumno" && u.estado === "activo");

  for (const a of alumnos) {
    const updates = {};

    // 1. Resetear recuperaciones el 1 de cada mes
    const ultimoReset = a.ultimoResetRecuperaciones
      ? new Date(a.ultimoResetRecuperaciones.toDate?.() || a.ultimoResetRecuperaciones)
      : null;
    const esNuevoMes = !ultimoReset ||
      ultimoReset.getMonth() !== hoy.getMonth() ||
      ultimoReset.getFullYear() !== hoy.getFullYear();

    if (esNuevoMes && (a.recuperacionesUsadas ?? 0) > 0) {
      updates.recuperacionesUsadas      = 0;
      updates.ultimoResetRecuperaciones = serverTimestamp();
    }
    if (esNuevoMes && !a.ultimoResetRecuperaciones) {
      updates.ultimoResetRecuperaciones = serverTimestamp();
    }

    // 2. Resetear clases usadas del mes
    const ultimoResetClases = a.ultimoResetClases
      ? new Date(a.ultimoResetClases.toDate?.() || a.ultimoResetClases)
      : null;
    const esNuevoMesClases = !ultimoResetClases ||
      ultimoResetClases.getMonth() !== hoy.getMonth() ||
      ultimoResetClases.getFullYear() !== hoy.getFullYear();

    if (esNuevoMesClases && (a.clasesUsadasMes ?? 0) > 0) {
      updates.clasesUsadasMes      = 0;
      updates.ultimoResetClases    = serverTimestamp();
    }
    if (esNuevoMesClases && !a.ultimoResetClases) {
      updates.ultimoResetClases = serverTimestamp();
    }

    // 3. Marcar cuota vencida si paso la fecha de vencimiento
    if (a.fechaVencimiento) {
      const vence = new Date(a.fechaVencimiento.toDate?.() || a.fechaVencimiento);
      if (vence < hoy && a.estado === "activo") {
        updates.estado = "pago_pendiente";
        updates.planId = null;
        updates.planNombre = null;
        updates.cuotaVencida = true;
        // Resetear turnos fijos — debe volver a elegirlos cuando renueve
        updates.turnosFijos = [];
        updates.turnosFijosEstado = null;
        // Borrar reservas fijas futuras
        try {
          const { borrarReservasFijas } = await import("../reservasFijas.js");
          await borrarReservasFijas(a.uid);
        } catch(e) { console.error("Error borrando reservas fijas:", e); }
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(db, "usuarios", a.uid), updates);
    }
  }
}

// Retorna alumnos que vencen en los próximos N días
export function alumnosProximosAVencer(alumnos, dias = 7) {
  const hoy   = new Date();
  const limite = new Date(hoy);
  limite.setDate(hoy.getDate() + dias);

  return alumnos.filter(a => {
    if (!a.fechaVencimiento || a.estado !== "activo") return false;
    const vence = new Date(a.fechaVencimiento.toDate?.() || a.fechaVencimiento);
    return vence >= hoy && vence <= limite;
  });
}
