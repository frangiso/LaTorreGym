import { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user, perfil } = useAuth();

  const [alumnos,  setAlumnos]  = useState([]);
  const [avisos,   setAvisos]   = useState([]);
  const [feriados, setFeriados] = useState({});
  const [config,   setConfig]   = useState(null);

  const uid    = user?.uid || null;
  const rol    = perfil?.rol || null;
  const esProfe = rol === "profe";

  // Config - para todos los usuarios logueados
  useEffect(() => {
    if (!uid) return;
    const fn = onSnapshot(doc(db, "config", "gimnasio"), snap => {
      if (snap.exists()) setConfig(snap.data());
    });
    return fn;
  }, [uid]);

  // Avisos - para todos
  useEffect(() => {
    if (!uid) return;
    const fn = onSnapshot(collection(db, "avisos"), snap => {
      setAvisos(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(a => a.activo === true)
          .sort((a,b) => (b.creadoEn?.seconds||0) - (a.creadoEn?.seconds||0))
      );
    });
    return fn;
  }, [uid]);

  // Feriados - para todos
  useEffect(() => {
    if (!uid) return;
    const fn = onSnapshot(collection(db, "feriados"), snap => {
      const f = {};
      snap.docs.forEach(d => { f[d.id] = true; });
      setFeriados(f);
    });
    return fn;
  }, [uid]);

  // Alumnos - solo profe, se activa cuando rol ya está cargado
  useEffect(() => {
    // Esperar a que el perfil esté cargado y sea profe
    if (!uid || !rol) return;
    if (!esProfe) { setAlumnos([]); return; }

    const fn = onSnapshot(collection(db, "usuarios"), snap => {
      setAlumnos(
        snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => u.rol === "alumno")
          .sort((a,b) => (a.apellido||"").localeCompare(b.apellido||""))
      );
    });
    return fn;
  }, [uid, rol]); // depende de uid Y rol para re-ejecutar cuando el perfil carga

  const value = { alumnos, avisos, feriados, config };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  // Nunca retornar null para evitar crashes en componentes que no estén dentro del provider
  return ctx || { alumnos: [], avisos: [], feriados: {}, config: null };
}
