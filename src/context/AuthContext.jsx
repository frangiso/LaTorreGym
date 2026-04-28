import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [perfil, setPerfil] = useState(undefined);

  useEffect(() => {
    let unsubPerfil = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubPerfil) { unsubPerfil(); unsubPerfil = null; }

      if (!firebaseUser) {
        setUser(null);
        setPerfil(null);
        return;
      }

      setUser(firebaseUser);
      setPerfil(undefined); // resetear mientras carga

      const ref = doc(db, "usuarios", firebaseUser.uid);
      unsubPerfil = onSnapshot(ref,
        (snap) => {
          if (snap.exists()) {
            setPerfil({ uid: snap.id, ...snap.data() });
          } else {
            // Esperar 3 segundos antes de declarar que no existe
            // (Firestore puede tardar en devolver el primer snapshot)
            setTimeout(() => {
              setPerfil((prev) => {
                if (prev === undefined) return null;
                return prev;
              });
            }, 3000);
          }
        },
        (error) => {
          console.error("Error leyendo perfil:", error);
          setTimeout(() => setPerfil(null), 3000);
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
