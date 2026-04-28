import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = cargando
  const [perfil, setPerfil] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setPerfil(null);
        return;
      }
      setUser(firebaseUser);
      // Escuchar perfil en tiempo real
      const ref = doc(db, "usuarios", firebaseUser.uid);
      const unsubPerfil = onSnapshot(ref, (snap) => {
        if (snap.exists()) setPerfil({ uid: snap.id, ...snap.data() });
        else setPerfil(null);
      });
      return () => unsubPerfil();
    });
    return () => unsub();
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
