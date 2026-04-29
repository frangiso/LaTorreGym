import { collection, addDoc, query, where, getDocs, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const CUPO  = 15;

function getLunesDeSemana(base) {
  const d = new Date(base); d.setHours(0,0,0,0);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow===0 ? 6 : dow-1));
  return d;
}

function getFechaDia(lunes, dia) {
  const idx = DIAS.indexOf(dia);
  if (idx===-1) return null;
  const d = new Date(lunes);
  d.setDate(lunes.getDate() + idx);
  return d.toISOString().split("T")[0];
}

// Crea reservas fijas para las proximas N semanas
export async function crearReservasFijas(alumnoUid, nombreAlumno, turnos, semanas=4) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);

  for (let s=0; s<semanas; s++) {
    const lunes = getLunesDeSemana(hoy);
    lunes.setDate(lunes.getDate() + s*7);

    for (const turno of turnos) {
      const fecha = getFechaDia(lunes, turno.dia);
      if (!fecha) continue;
      if (new Date(fecha+"T"+turno.hora) < hoy) continue;

      // Verificar cupo y duplicados en una sola query
      const q = query(
        collection(db,"reservas"),
        where("fecha","==",fecha),
        where("hora","==",turno.hora)
      );
      const snap = await getDocs(q);
      if (snap.docs.some(d=>d.data().alumnoId===alumnoUid)) continue; // ya existe
      if (snap.size >= CUPO) continue; // lleno

      await addDoc(collection(db,"reservas"), {
        alumnoId: alumnoUid,
        nombreAlumno: nombreAlumno.trim(),
        dia: turno.dia, hora: turno.hora, fecha,
        esFijo: true, esRecuperacion: false,
        creadoEn: serverTimestamp(),
      });
    }
  }
}

// Borra reservas fijas futuras del alumno (cuando vence el plan o cambia turnos)
export async function borrarReservasFijas(alumnoUid) {
  const hoy = new Date().toISOString().split("T")[0];
  const q = query(
    collection(db,"reservas"),
    where("alumnoId","==",alumnoUid),
    where("esFijo","==",true)
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    if (d.data().fecha >= hoy) await deleteDoc(doc(db,"reservas",d.id));
  }
}

// Alias para compatibilidad con codigo anterior
export async function generarReservasFijas(alumno, semanas=4) {
  if (!alumno.uid || !alumno.turnosFijos?.length) return;
  if (alumno.turnosFijosEstado !== "aprobado") return;
  const nombre = (alumno.nombre||"") + " " + (alumno.apellido||"");
  await crearReservasFijas(alumno.uid, nombre, alumno.turnosFijos, semanas);
}
