import { collection, addDoc, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];

// Obtiene el lunes de la semana de una fecha dada
function getLunesDeSemana(fecha) {
  const d = new Date(fecha);
  const dia = d.getDay(); // 0=dom
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
  d.setHours(0,0,0,0);
  return d;
}

// Obtiene la fecha ISO de un dia de la semana dado el lunes
function getFechaDia(lunes, dia) {
  const idx = DIAS.indexOf(dia);
  if (idx === -1) return null;
  const d = new Date(lunes);
  d.setDate(lunes.getDate() + idx);
  return d.toISOString().split("T")[0];
}

// Genera reservas fijas para un alumno en las proximas N semanas
// Si ya existe una reserva de ese alumno en ese slot, no duplica
export async function generarReservasFijas(alumno, semanas = 4) {
  if (!alumno.turnosFijos || alumno.turnosFijos.length === 0) return;
  if (alumno.turnosFijosEstado !== "aprobado") return;

  const hoy = new Date();
  hoy.setHours(0,0,0,0);

  for (let s = 0; s < semanas; s++) {
    const lunes = getLunesDeSemana(hoy);
    lunes.setDate(lunes.getDate() + s * 7);

    for (const turno of alumno.turnosFijos) {
      const fecha = getFechaDia(lunes, turno.dia);
      if (!fecha) continue;

      // No crear reservas pasadas
      const fechaDate = new Date(fecha + "T" + turno.hora);
      if (fechaDate < hoy) continue;

      // Verificar si ya existe reserva de este alumno en este slot
      const q = query(
        collection(db, "reservas"),
        where("alumnoId", "==", alumno.uid),
        where("fecha", "==", fecha),
        where("hora", "==", turno.hora),
        where("dia", "==", turno.dia)
      );
      const snap = await getDocs(q);
      if (!snap.empty) continue; // ya existe

      // Verificar cupo (max 15)
      const qCupo = query(
        collection(db, "reservas"),
        where("fecha", "==", fecha),
        where("hora", "==", turno.hora),
        where("dia", "==", turno.dia)
      );
      const snapCupo = await getDocs(qCupo);
      if (snapCupo.size >= 15) continue; // turno lleno

      await addDoc(collection(db, "reservas"), {
        alumnoId: alumno.uid,
        nombreAlumno: alumno.nombre + " " + alumno.apellido,
        dia: turno.dia,
        hora: turno.hora,
        fecha,
        esFijo: true,
        esRecuperacion: false,
        creadoEn: serverTimestamp(),
      });
    }
  }
}
