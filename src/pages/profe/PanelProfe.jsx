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

async function autoSeed() {
  const configRef = doc(db, "config", "gimnasio");
  const configSnap = await getDoc(configRef);
  if (!configSnap.exists()) {
    await setDoc(configRef, {
      nombre: "La Torre Gym",
      alias: "complejo.latorre",
      whatsapp: "",
      reglamento: [],
      planes: [
        { id: "2dias",  nombre: "2 dias por semana",          precioTransferencia: 45000, precioEfectivo: 40000, diasSemana: 2 },
        { id: "3dias",  nombre: "3 dias por semana",          precioTransferencia: 48000, precioEfectivo: 43000, diasSemana: 3 },
        { id: "lv",     nombre: "Lunes a viernes + sabados",  precioTransferencia: 55000, precioEfectivo: 50000, diasSemana: 6 },
        { id: "suelta", nombre: "Clase suelta (1 dia)",       precioTransferencia: 10000, precioEfectivo: 10000, diasSemana: 1 },
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
        const slotId = dia + "_" + hora.replace(":", "");
        slots.push({ id: slotId, dia, hora, cupo: 15 });
      }
    }
    for (let h = 8; h <= 13; h++) {
      const hora = String(h).padStart(2, "0") + ":00";
      const slotId = "SABADO_" + hora.replace(":", "");
      slots.push({ id: slotId, dia: "SABADO", hora, cupo: 15 });
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
  { key: "dashboard", label: "Hoy" },
  { key: "grilla",    label: "Grilla" },
  { key: "alumnos",   label: "Alumnos" },
  { key: "pagos",     label: "Pagos" },
  { key: "config",    label: "Config" },
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

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f7" }}>
      <LtHeader rol="profe" onLogout={() => signOut(auth).then(() => navigate("/login"))} />

      <div style={{ background: "#fff", borderBottom: "0.5px solid #e0e0e0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px", display: "flex", gap: 2 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                background: "transparent", border: "none",
                borderBottom: tab === t.key ? "2px solid #F5C400" : "2px solid transparent",
                padding: "14px 18px", fontSize: 14,
                fontWeight: tab === t.key ? 500 : 400,
                color: tab === t.key ? "#111" : "#888",
                cursor: "pointer", transition: "all 0.15s"
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        {tab === "dashboard" && <Dashboard />}
        {tab === "grilla"    && <GrillaSemanal />}
        {tab === "alumnos"   && <PanelAlumnos />}
        {tab === "pagos"     && <PagosPendientes />}
        {tab === "config"    && <ConfigGimnasio />}
      </div>
    </div>
  );
}
