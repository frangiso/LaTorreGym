import { collection, addDoc, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];

function getLunesDeSemana(base) {
  const d = new Date(base);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getFechaDia(lunes, dia) {
  const idx = DIAS.indexOf(dia);
  if (idx === -1) return null;
  const d = new Date(lunes);
  d.setDate(lunes.getDate() + idx);
  return d.toISOString().split("T")[0];
}

export async function generarReservasFijas(alumno, semanas = 4) {
  if (!alumno.uid || !alumno.turnosFijos || alumno.turnosFijos.length === 0) return;
  if (alumno.turnosFijosEstado !== "aprobado") return;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const nombreAlumno = (alumno.nombre || "") + " " + (alumno.apellido || "");

  for (let s = 0; s < semanas; s++) {
    const lunes = getLunesDeSemana(hoy);
    lunes.setDate(lunes.getDate() + s * 7);

    for (const turno of alumno.turnosFijos) {
      const fecha = getFechaDia(lunes, turno.dia);
      if (!fecha) continue;

      // No crear reservas pasadas
      if (new Date(fecha + "T" + turno.hora) < hoy) continue;

      // Traer todas las reservas de esa fecha+hora - una sola query sin índice compuesto
      const qSlot = query(
        collection(db, "reservas"),
        where("fecha", "==", fecha),
        where("hora", "==", turno.hora)
      );
      const snapSlot = await getDocs(qSlot);

      // Verificar si ya tiene reserva en ese slot
      const yaExiste = snapSlot.docs.some(d => d.data().alumnoId === alumno.uid);
      if (yaExiste) continue;

      // Verificar cupo
      if (snapSlot.size >= 15) continue;

      await addDoc(collection(db, "reservas"), {
        alumnoId:     alumno.uid,
        nombreAlumno: nombreAlumno.trim(),
        dia:          turno.dia,
        hora:         turno.hora,
        fecha,
        esFijo:       true,
        esRecuperacion: false,
        creadoEn:     serverTimestamp(),
      });
    }
  }
}
