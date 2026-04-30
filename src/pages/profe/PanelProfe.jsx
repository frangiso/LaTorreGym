import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";
import LtHeader from "../../components/LtHeader";
import Dashboard from "./Dashboard";
import GrillaSemanal from "./GrillaSemanal";
import PanelAlumnos from "./PanelAlumnos";
import PagosPendientes from "./PagosPendientes";
import ConfigGimnasio from "./ConfigGimnasio";
import Rutinas from "./Rutinas";
import TurnosFijosPanel from "./TurnosFijosPanel";
import Avisos from "./Avisos";

async function autoSeed() {
  // Cachear en localStorage: si ya corrió esta semana, no volver a hacer getDocs
  try {
    const semana = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (localStorage.getItem("ltg_seed") === semana) return;
    localStorage.setItem("ltg_seed", semana);
  } catch(e) {}

  const configRef = doc(db, "config", "gimnasio");
  const configSnap = await getDoc(configRef);
  if (!configSnap.exists()) {
    await setDoc(configRef, {
      nombre: "La Torre Gym",
      alias: "complejo.latorre",
      whatsapp: "",
      reglamento: [],
      planes: [
        { id: "2dias",  nombre: "2 dias por semana",         precioTransferencia: 45000, precioEfectivo: 40000, diasSemana: 2 },
        { id: "3dias",  nombre: "3 dias por semana",         precioTransferencia: 48000, precioEfectivo: 43000, diasSemana: 3 },
        { id: "lv",     nombre: "Lunes a viernes + sabados", precioTransferencia: 55000, precioEfectivo: 50000, diasSemana: 6 },
        { id: "suelta", nombre: "Clase suelta (1 dia)",      precioTransferencia: 10000, precioEfectivo: 10000, diasSemana: 1 },
      ],
    });
  }
  const slotsSnap = await getDocs(collection(db, "slots"));
  if (slotsSnap.empty) {
    const DIAS_LV = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES"];
    const slots = [];
    for (const dia of DIAS_LV) {
      for (let h = 7; h <= 22; h++) {
        const hora = String(h).padStart(2, "0") + ":00";
        slots.push({ id: dia + "_" + hora.replace(":", ""), dia, hora, cupo: 15 });
      }
    }
    for (let h = 8; h <= 13; h++) {
      const hora = String(h).padStart(2, "0") + ":00";
      slots.push({ id: "SABADO_" + hora.replace(":", ""), dia: "SABADO", hora, cupo: 15 });
    }
    const CHUNK = 400;
    for (let i = 0; i < slots.length; i += CHUNK) {
      const batch = writeBatch(db);
      slots.slice(i, i + CHUNK).forEach(s => batch.set(doc(db, "slots", s.id), s));
      await batch.commit();
    }
  }
}

const TABS = [
  {
    key: "dashboard", label: "Hoy",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8"/>
      </svg>
    )
  },
  {
    key: "grilla", label: "Grilla",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="2" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8"/>
        <path d="M3 9h18M8 4v16" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    )
  },
  {
    key: "tfijos", label: "Fijos",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="12" cy="12" r="3" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8"/>
      </svg>
    )
  },
  {
    key: "alumnos", label: "Alumnos",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="7" r="3.5" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8"/>
        <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M19 8v6M22 11h-6" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    )
  },
  {
    key: "pagos", label: "Pagos",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="6" width="20" height="13" rx="2" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8"/>
        <path d="M2 10h20" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8"/>
        <circle cx="7" cy="15" r="1.5" fill={active ? "#F5C400" : "#888"}/>
      </svg>
    )
  },
  {
    key: "rutinas", label: "Rutinas",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 6h16M4 10h10M4 14h12M4 18h8" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    )
  },
  {
    key: "avisos", label: "Avisos",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  },
  {
    key: "config", label: "Config",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8"/>
        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
          stroke={active ? "#F5C400" : "#888"} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    )
  },
];

export default function PanelProfe() {
  const [tab, setTab] = useState("dashboard");
  const [seedListo, setSeedListo] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    autoSeed().finally(() => setSeedListo(true));
  }, []);

  if (!seedListo) {
    return (
      <div style={{ minHeight: "100vh", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <svg width="36" height="40" viewBox="0 0 40 44" fill="none">
            <rect x="2" y="16" width="36" height="26" rx="5" fill="#F5C400"/>
            <path d="M14 16V10a6 6 0 0 1 12 0v6" stroke="#111" strokeWidth="3" strokeLinecap="round"/>
            <rect x="15" y="24" width="10" height="10" rx="2" fill="#111"/>
          </svg>
          <p style={{ color: "#888", fontSize: 13, marginTop: 12 }}>Iniciando sistema...</p>
        </div>
      </div>
    );
  }

  const tabActual = TABS.find(t => t.key === tab);

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f7", paddingBottom: 72 }}>
      <LtHeader onLogout={() => signOut(auth).then(() => navigate("/login"))} />

      {/* Titulo de seccion */}
      <div style={{ background: "#fff", borderBottom: "0.5px solid #e0e0e0", padding: "10px 16px" }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: "#111" }}>{tabActual?.label}</span>
      </div>

      {/* Contenido */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 14px" }}>
        {tab === "dashboard" && <Dashboard />}
        {tab === "grilla"    && <GrillaSemanal />}
        {tab === "tfijos"   && <TurnosFijosPanel />}
        {tab === "alumnos"   && <PanelAlumnos />}
        {tab === "pagos"     && <PagosPendientes />}
        {tab === "rutinas"   && <Rutinas />}
        {tab === "avisos"    && <Avisos />}
        {tab === "config"    && <ConfigGimnasio />}
      </div>

      {/* Bottom bar — fija abajo */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "#111", borderTop: "1px solid #222",
        display: "flex", height: 64, zIndex: 50,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                flex: 1, background: "transparent", border: "none",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 3, cursor: "pointer",
                borderTop: active ? "2px solid #F5C400" : "2px solid transparent",
                transition: "border 0.15s",
              }}>
              {t.icon(active)}
              <span style={{ fontSize: 10, color: active ? "#F5C400" : "#666", fontWeight: active ? 500 : 400 }}>
                {t.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
