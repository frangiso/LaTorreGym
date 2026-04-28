import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [perfil, setPerfil] = useState(undefined); // undefined = cargando, null = no existe

  useEffect(() => {
    let unsubPerfil = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Limpiar listener anterior si cambia el usuario
      if (unsubPerfil) { unsubPerfil(); unsubPerfil = null; }

      if (!firebaseUser) {
        setUser(null);
        setPerfil(null);
        return;
      }

      setUser(firebaseUser);

      const ref = doc(db, "usuarios", firebaseUser.uid);
      unsubPerfil = onSnapshot(ref,
        (snap) => {
          if (snap.exists()) {
            setPerfil({ uid: snap.id, ...snap.data() });
          } else {
            // El usuario existe en Auth pero NO en Firestore
            // (caso del profe recién creado que no tiene documento todavía)
            setPerfil(null);
          }
        },
        (error) => {
          console.error("Error leyendo perfil:", error);
          setPerfil(null);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubPerfil) unsubPerfil();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, perfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
