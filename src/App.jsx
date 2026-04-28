import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { useAuth } from "./context/AuthContext";
import { auth } from "./firebase";
import LtLogo from "./components/LtLogo";

import Login from "./pages/Login";
import Register from "./pages/Register";
import InstructivoPlanes from "./pages/InstructivoPlanes";
import PagoInstructivo from "./pages/PagoInstructivo";
import EsperaAprobacion from "./pages/EsperaAprobacion";
import PanelAlumno from "./pages/alumno/PanelAlumno";
import PanelProfe from "./pages/profe/PanelProfe";

// Pantalla de carga con timeout de 6 segundos
export function Cargando() {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#111", gap: 32
    }}>
      <LtLogo size="md" />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
          style={{ animation: "spin 0.9s linear infinite" }}>
          <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
          <circle cx="9" cy="9" r="7" stroke="#2a2a2a" strokeWidth="2.5"/>
          <path d="M9 2 A7 7 0 0 1 16 9" stroke="#F5C400" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        <span style={{ color: "#555", fontSize: 13 }}>Cargando{dots}</span>
      </div>
    </div>
  );
}

// Pantalla cuando el usuario está en Auth pero no tiene perfil en Firestore
function SinPerfil() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#111", gap: 24, padding: 24
    }}>
      <LtLogo size="md" />
      <div style={{
        background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12,
        padding: "24px 28px", maxWidth: 380, textAlign: "center"
      }}>
        <p style={{ color: "#fff", fontSize: 15, fontWeight: 500, margin: "0 0 8px" }}>
          Perfil no encontrado
        </p>
        <p style={{ color: "#666", fontSize: 13, margin: "0 0 20px", lineHeight: 1.6 }}>
          Tu cuenta existe pero no tiene perfil en la base de datos.
          Si sos el profe, creá el documento en Firestore con{" "}
          <code style={{ color: "#F5C400", fontSize: 12 }}>rol: "profe"</code>.
        </p>
        <button onClick={() => signOut(auth)}
          style={{
            background: "#F5C400", color: "#111", border: "none", borderRadius: 8,
            padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer"
          }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function RutaProtegida({ children }) {
  const { user, perfil } = useAuth();

  if (user === undefined || perfil === undefined) return <Cargando />;
  if (!user) return <Navigate to="/login" replace />;
  if (!perfil) return <SinPerfil />;

  const { estado, rol } = perfil;
  if (rol === "profe") return children;
  if (estado === "pendiente") return <Navigate to="/instructivo" replace />;
  if (estado === "pago_pendiente") return <Navigate to="/espera" replace />;
  if (estado === "activo") return children;
  if (estado === "inactivo" || estado === "suspendido") return <Navigate to="/espera" replace />;
  return children;
}

export default function App() {
  const { user, perfil } = useAuth();

  function HomeRedirect() {
    // Todavía resolviendo auth o perfil
    if (user === undefined || (user && perfil === undefined)) return <Cargando />;

    // No logueado
    if (!user) return <Navigate to="/login" replace />;

    // Logueado pero sin perfil en Firestore
    if (!perfil) return <SinPerfil />;

    // Redirigir según rol/estado
    if (perfil.rol === "profe") return <Navigate to="/profe" replace />;
    if (perfil.estado === "pendiente") return <Navigate to="/instructivo" replace />;
    if (perfil.estado === "pago_pendiente") return <Navigate to="/espera" replace />;
    if (perfil.estado === "activo") return <Navigate to="/alumno" replace />;

    return <Navigate to="/login" replace />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/instructivo" element={<InstructivoPlanes />} />
        <Route path="/pago" element={<PagoInstructivo />} />
        <Route path="/espera" element={<EsperaAprobacion />} />
        <Route path="/alumno/*" element={<RutaProtegida><PanelAlumno /></RutaProtegida>} />
        <Route path="/profe/*" element={<RutaProtegida><PanelProfe /></RutaProtegida>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
