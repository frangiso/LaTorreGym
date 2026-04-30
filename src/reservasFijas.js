import { collection, query, where, getDocs, deleteDoc, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const CUPO = 15;

function getLunesDeSemana(base) {
  const d = new Date(base); d.setHours(0,0,0,0);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

function getFechaDia(lunes, dia) {
  const idx = DIAS.indexOf(dia);
  if (idx === -1) return null;
  const d = new Date(lunes);
  d.setDate(lunes.getDate() + idx);
  return d.toISOString().split("T")[0];
}

export async function crearReservasFijas(alumnoUid, nombreAlumno, turnos, semanas = 4) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);

  // Construir candidatos
  const candidatos = [];
  for (let s = 0; s < semanas; s++) {
    const lunes = getLunesDeSemana(hoy);
    lunes.setDate(lunes.getDate() + s * 7);
    for (const turno of turnos) {
      const fecha = getFechaDia(lunes, turno.dia);
      if (!fecha) continue;
      if (new Date(fecha + "T" + turno.hora) < hoy) continue;
      candidatos.push({ dia: turno.dia, hora: turno.hora, fecha });
    }
  }

  // Verificar cupos en paralelo
  const verificados = await Promise.all(
    candidatos.map(async c => {
      const q = query(
        collection(db, "reservas"),
        where("fecha", "==", c.fecha),
        where("hora",  "==", c.hora)
      );
      const snap = await getDocs(q);
      const yaExiste = snap.docs.some(d => d.data().alumnoId === alumnoUid);
      const lleno    = snap.size >= CUPO;
      return { ...c, ok: !yaExiste && !lleno };
    })
  );

  // Escribir con batch
  const aEscribir = verificados.filter(x => x.ok);
  if (aEscribir.length === 0) return;

  const batch = writeBatch(db);
  aEscribir.forEach(r => {
    const ref = doc(collection(db, "reservas"));
    batch.set(ref, {
      alumnoId:     alumnoUid,
      nombreAlumno: nombreAlumno.trim(),
      dia:          r.dia,
      hora:         r.hora,
      fecha:        r.fecha,
      esFijo:       true,
      esRecuperacion: false,
      creadoEn:     serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function borrarReservasFijas(alumnoUid) {
  const hoy = new Date().toISOString().split("T")[0];
  const q   = query(
    collection(db, "reservas"),
    where("alumnoId", "==", alumnoUid),
    where("esFijo",   "==", true)
  );
  const snap     = await getDocs(q);
  const futuras  = snap.docs.filter(d => d.data().fecha >= hoy);
  if (futuras.length === 0) return;
  const batch = writeBatch(db);
  futuras.forEach(d => batch.delete(doc(db, "reservas", d.id)));
  await batch.commit();
}

// Alias para compatibilidad
export async function generarReservasFijas(alumno, semanas = 4) {
  if (!alumno.uid || !alumno.turnosFijos?.length) return;
  if (alumno.turnosFijosEstado !== "aprobado") return;
  const nombre = (alumno.nombre || "") + " " + (alumno.apellido || "");
  await crearReservasFijas(alumno.uid, nombre, alumno.turnosFijos, semanas);
}
