import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import InstructivoPlanes from "./pages/InstructivoPlanes";
import PagoInstructivo from "./pages/PagoInstructivo";
import EsperaAprobacion from "./pages/EsperaAprobacion";
import PanelAlumno from "./pages/alumno/PanelAlumno";
import PanelProfe from "./pages/profe/PanelProfe";

function RutaProtegida({ children }) {
  const { user, perfil } = useAuth();
  if (user === undefined) return <Cargando />;
  if (!user) return <Navigate to="/login" replace />;

  // Sin perfil aún (recién creado)
  if (!perfil) return <Cargando />;

  const estado = perfil.estado;
  const rol = perfil.rol;

  if (rol === "profe") return children;

  // Flujo alumno según estado
  if (estado === "pendiente") return <Navigate to="/instructivo" replace />;
  if (estado === "pago_pendiente") return <Navigate to="/espera" replace />;
  if (estado === "activo") return children;
  if (estado === "inactivo" || estado === "suspendido")
    return <Navigate to="/espera" replace />;

  return children;
}

function Cargando() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#111"
    }}>
      <div style={{ textAlign: "center" }}>
        <LogoMark />
        <p style={{ color: "#888", fontSize: 13, marginTop: 16 }}>Cargando...</p>
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <svg width="32" height="36" viewBox="0 0 40 44" fill="none">
        <rect x="2" y="16" width="36" height="26" rx="5" fill="#F5C400" />
        <path d="M14 16V10a6 6 0 0 1 12 0v6" stroke="#111" strokeWidth="3" strokeLinecap="round" />
        <rect x="15" y="24" width="10" height="10" rx="2" fill="#111" />
      </svg>
      <div>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 500, lineHeight: 1.1 }}>La Torre</div>
        <div style={{ background: "#F5C400", color: "#111", fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 3, letterSpacing: "0.08em" }}>GYM</div>
      </div>
    </div>
  );
}

export default function App() {
  const { user, perfil } = useAuth();

  // Redirigir automáticamente según rol/estado al entrar
  function HomeRedirect() {
    if (user === undefined || (user && !perfil)) return <Cargando />;
    if (!user) return <Navigate to="/login" replace />;
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
        <Route path="/alumno/*" element={
          <RutaProtegida><PanelAlumno /></RutaProtegida>
        } />
        <Route path="/profe/*" element={
          <RutaProtegida><PanelProfe /></RutaProtegida>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
