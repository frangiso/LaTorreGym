import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import LtLogo from "./components/LtLogo";

import Login from "./pages/Login";
import Register from "./pages/Register";
import InstructivoPlanes from "./pages/InstructivoPlanes";
import PagoInstructivo from "./pages/PagoInstructivo";
import EsperaAprobacion from "./pages/EsperaAprobacion";
import PanelAlumno from "./pages/alumno/PanelAlumno";
import PanelProfe from "./pages/profe/PanelProfe";

const TIMEOUT_MS = 4000;

function RutaProtegida({ children }) {
  const { user, perfil } = useAuth();
  if (user === undefined) return <Cargando />;
  if (!user) return <Navigate to="/login" replace />;
  if (!perfil) return <Cargando />;
  const { estado, rol } = perfil;
  if (rol === "profe") return children;
  if (estado === "pendiente") return <Navigate to="/instructivo" replace />;
  if (estado === "pago_pendiente") return <Navigate to="/espera" replace />;
  if (estado === "activo") return children;
  if (estado === "inactivo" || estado === "suspendido") return <Navigate to="/espera" replace />;
  return children;
}

export function Cargando() {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);
  if (timedOut) return <Navigate to="/login" replace />;
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#111", gap: 28
    }}>
      <LtLogo size="md" />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
          style={{ animation: "spin 0.8s linear infinite" }}>
          <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
          <circle cx="9" cy="9" r="7" stroke="#333" strokeWidth="2" />
          <path d="M9 2 A7 7 0 0 1 16 9" stroke="#F5C400" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span style={{ color: "#666", fontSize: 13 }}>Cargando...</span>
      </div>
    </div>
  );
}

export default function App() {
  const { user, perfil } = useAuth();

  function HomeRedirect() {
    const [timedOut, setTimedOut] = useState(false);
    useEffect(() => {
      const t = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
      return () => clearTimeout(t);
    }, []);

    if (user === undefined && !timedOut) return <Cargando />;
    if (!user || timedOut) return <Navigate to="/login" replace />;
    if (user && !perfil && !timedOut) return <Cargando />;
    if (perfil?.rol === "profe") return <Navigate to="/profe" replace />;
    if (perfil?.estado === "pendiente") return <Navigate to="/instructivo" replace />;
    if (perfil?.estado === "pago_pendiente") return <Navigate to="/espera" replace />;
    if (perfil?.estado === "activo") return <Navigate to="/alumno" replace />;
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
