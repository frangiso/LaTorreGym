// utils/listaEspera.js
import { collection, addDoc, deleteDoc, doc, query, where, getDocs,
         onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { generarReservasFijas } from "../reservasFijas";

// Agregar a lista de espera
export async function agregarListaEspera(alumnoId, nombreAlumno, dia, hora, fecha) {
  // Verificar que no esté ya en lista
  const q = query(
    collection(db, "listaEspera"),
    where("alumnoId", "==", alumnoId),
    where("fecha",    "==", fecha),
    where("hora",     "==", hora)
  );
  const snap = await getDocs(q);
  if (!snap.empty) return { ok: false, msg: "Ya estás en lista de espera para este turno." };

  await addDoc(collection(db, "listaEspera"), {
    alumnoId, nombreAlumno, dia, hora, fecha,
    creadoEn: serverTimestamp(),
  });
  return { ok: true };
}

// Salir de lista de espera
export async function salirListaEspera(alumnoId, fecha, hora) {
  const q = query(
    collection(db, "listaEspera"),
    where("alumnoId", "==", alumnoId),
    where("fecha",    "==", fecha),
    where("hora",     "==", hora)
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) await deleteDoc(doc(db, "listaEspera", d.id));
}

// Cuando se cancela una reserva, notificar al primero en lista de espera
// (el profe o el sistema lo ve en el dashboard)
export async function procesarListaEspera(dia, hora, fecha) {
  const q = query(
    collection(db, "listaEspera"),
    where("fecha", "==", fecha),
    where("hora",  "==", hora)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;

  // Ordenar en memoria y tomar el primero
  const ordenados = snap.docs.sort((a,b) => (a.data().creadoEn?.seconds||0) - (b.data().creadoEn?.seconds||0));
  const primero = ordenados[0];
  await updateDoc(doc(db, "listaEspera", primero.id), { notificado: true });
  return primero.data();
}
