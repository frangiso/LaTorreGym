// Ejecutar una sola vez para crear la config inicial en Firestore
// Importar y llamar seedGimnasio() desde un componente temporal, o desde la consola del browser

import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function seedGimnasio() {
  const ref = doc(db, "config", "gimnasio");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    console.log("Config ya existe, no se sobreescribe.");
    return;
  }
  await setDoc(ref, {
    nombre: "La Torre Gym",
    alias: "complejo.latorre",
    whatsapp: "", // completar después
    reglamento: [
      "Presentar DNI o credencial en cada ingreso.",
      "Ropa deportiva y calzado obligatorio.",
      "Reservar turno con al menos 2 horas de anticipación.",
      "La cuota vence el día 5 de cada mes.",
      "Respetar los horarios de entrada y salida.",
    ],
    planes: [
      { id: "2dias", nombre: "2 días por semana", precioTransferencia: 45000, precioEfectivo: 40000, diasSemana: 2 },
      { id: "3dias", nombre: "3 días por semana", precioTransferencia: 48000, precioEfectivo: 43000, diasSemana: 3 },
      { id: "lv", nombre: "Lunes a viernes + sábados", precioTransferencia: 55000, precioEfectivo: 50000, diasSemana: 6 },
      { id: "suelta", nombre: "Clase suelta (1 día)", precioTransferencia: 10000, precioEfectivo: 10000, diasSemana: 1 },
    ],
  });
  console.log("Config inicial creada.");
}

// Genera los slots semanales fijos en Firestore
// Formato: slots/{LUNES|MARTES|...|SABADO}_{HH00}
export async function seedSlots() {
  const diasLV = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"];
  const horasLV = [];
  for (let h = 7; h <= 22; h++) horasLV.push(`${String(h).padStart(2, "0")}:00`);

  const horasSab = [];
  for (let h = 8; h <= 13; h++) horasSab.push(`${String(h).padStart(2, "0")}:00`);

  const batch = [];

  for (const dia of diasLV) {
    for (const hora of horasLV) {
      const id = `${dia}_${hora.replace(":", "")}`;
      batch.push({ id, dia, hora, cupo: 15 });
    }
  }
  for (const hora of horasSab) {
    const id = `SABADO_${hora.replace(":", "")}`;
    batch.push({ id, dia: "SABADO", hora, cupo: 15 });
  }

  for (const slot of batch) {
    await setDoc(doc(db, "slots", slot.id), slot);
  }
  console.log(`${batch.length} slots creados.`);
}
