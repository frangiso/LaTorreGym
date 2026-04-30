import { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user, perfil } = useAuth();
  const esProfe = perfil?.rol === "profe";
  const esAlumno = perfil?.rol === "alumno";

  const [alumnos, setAlumnos]     = useState([]);   // solo profe
  const [avisos, setAvisos]       = useState([]);   // todos
  const [feriados, setFeriados]   = useState({});   // todos
  const [config, setConfig]       = useState(null); // todos

  // ---- Config del gimnasio (una sola vez) ----
  useEffect(() => {
    if (!user) return;
    const fn = onSnapshot(doc(db, "config", "gimnasio"), snap => {
      if (snap.exists()) setConfig(snap.data());
    });
    return fn;
  }, [user?.uid]);

  // ---- Avisos activos (compartido) ----
  useEffect(() => {
    if (!user) return;
    const fn = onSnapshot(collection(db, "avisos"), snap => {
      setAvisos(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(a => a.activo === true)
          .sort((a,b) => (b.creadoEn?.seconds||0) - (a.creadoEn?.seconds||0))
      );
    });
    return fn;
  }, [user?.uid]);

  // ---- Feriados (una sola vez, no cambian seguido) ----
  useEffect(() => {
    if (!user) return;
    const fn = onSnapshot(collection(db, "feriados"), snap => {
      const f = {};
      snap.docs.forEach(d => { f[d.id] = true; });
      setFeriados(f);
    });
    return fn;
  }, [user?.uid]);

  // ---- Alumnos (solo profe, una sola suscripción para todos los paneles) ----
  useEffect(() => {
    if (!esProfe) return;
    const fn = onSnapshot(collection(db, "usuarios"), snap => {
      setAlumnos(
        snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => u.rol === "alumno")
          .sort((a,b) => (a.apellido||"").localeCompare(b.apellido||""))
      );
    });
    return fn;
  }, [esProfe]);

  const value = { alumnos, avisos, feriados, config };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
