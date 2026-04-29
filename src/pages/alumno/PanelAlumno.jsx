import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  collection, query, where, onSnapshot, addDoc, deleteDoc,
  doc, getDocs, serverTimestamp, updateDoc, getDoc
} from "firebase/firestore";
import LtHeader from "../../components/LtHeader";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const DIAS_LABEL = { LUNES:"Lun", MARTES:"Mar", MIERCOLES:"Mie", JUEVES:"Jue", VIERNES:"Vie", SABADO:"Sab" };

// Clases incluidas por plan por mes (4 semanas)
const CLASES_POR_PLAN = {
  "2dias":  8,   // 2 x 4 semanas
  "3dias":  12,  // 3 x 4 semanas
  "lv":     26,  // L-V + Sab aprox
  "suelta": 1,
};

function getInicioSemana(offset = 0) {
  const hoy = new Date();
  const dia = hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dia === 0 ? 6 : dia - 1) + offset * 7);
  lunes.setHours(0,0,0,0);
  return lunes;
}

function getFechasDeSemana(inicio) {
  const f = {};
  DIAS.forEach((dia, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    f[dia] = d.toISOString().split("T")[0];
  });
  return f;
}

export default function PanelAlumno() {
  const { user, perfil } = useAuth();
  const navigate = useNavigate();
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [reservasPorSlot, setReservasPorSlot] = useState({});
  const [misReservas, setMisReservas] = useState({});
  const [feriados, setFeriados] = useState({});
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(null);
  const [slotPendiente, setSlotPendiente] = useState(null);
  const [misReservasDelMes, setMisReservasDelMes] = useState(0);

  const inicioSemana = getInicioSemana(semanaOffset);
  const fechas = getFechasDeSemana(inicioSemana);
  const hoy = new Date().toISOString().split("T")[0];
  const planId = perfil?.planId || "";
  const clasesDelPlan = CLASES_POR_PLAN[planId] ?? 999;
  const clasesUsadas = perfil?.clasesUsadasMes ?? 0;
  const clasesRestantes = Math.max(0, clasesDelPlan - clasesUsadas);
  const planAgotado = clasesRestantes <= 0 && planId !== "lv";

  // Contar mis reservas del mes actual
  useEffect(() => {
    if (!user) return;
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split("T")[0];
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).toISOString().split("T")[0];
    const q = query(
      collection(db, "reservas"),
      where("alumnoId", "==", user.uid),
      where("fecha", ">=", inicioMes),
      where("fecha", "<=", finMes)
    );
    const unsub = onSnapshot(q, snap => {
      setMisReservasDelMes(snap.size);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    getDocs(collection(db, "feriados")).then(snap => {
      const f = {};
      snap.docs.forEach(d => { f[d.id] = true; });
      setFeriados(f);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const fechasArr = Object.values(fechas);
    const q = query(collection(db, "reservas"), where("fecha", "in", fechasArr));
    const unsub = onSnapshot(q, snap => {
      const map = {};
      const mias = {};
      snap.docs.forEach(d => {
        const r = d.data();
        const key = r.dia + "_" + r.hora.replace(":", "") + "_" + r.fecha;
        if (!map[key]) map[key] = 0;
        map[key]++;
        if (r.alumnoId === user.uid) mias[key] = d.id;
      });
      setReservasPorSlot(map);
      setMisReservas(mias);
      setCargando(false);
    });
    return () => unsub();
  }, [semanaOffset, user]);

  async function reservar(dia, hora, fecha) {
    if (!user || procesando) return;
    const key = dia + "_" + hora.replace(":", "") + "_" + fecha;
    if (misReservas[key]) return;

    const ahora = new Date();
    const claseDate = new Date(fecha + "T" + hora);
    if (claseDate < ahora) { alert("Esta clase ya paso."); return; }
    if (claseDate - ahora < 2 * 60 * 60 * 1000) { alert("Solo podes reservar hasta 2 horas antes."); return; }

    // Para planes con limite o suelta: pedir confirmacion
    if (planId !== "lv") {
      setSlotPendiente({ dia, hora, fecha, key });
      return;
    }

    setProcesando(key);
    try {
      await addDoc(collection(db, "reservas"), {
        alumnoId: user.uid,
        nombreAlumno: perfil.nombre + " " + perfil.apellido,
        dia, hora, fecha, creadoEn: serverTimestamp(),
      });
      await updateDoc(doc(db, "usuarios", user.uid), {
        clasesUsadasMes: (perfil.clasesUsadasMes || 0) + 1,
      });
    } finally { setProcesando(null); }
  }

  async function confirmarReserva() {
    if (!slotPendiente || procesando) return;
    const { dia, hora, fecha, key } = slotPendiente;
    const ahora = new Date();
    const claseDate = new Date(fecha + "T" + hora);
    if (claseDate < ahora) { alert("Esta clase ya paso."); setSlotPendiente(null); return; }
    if (claseDate - ahora < 2 * 60 * 60 * 1000) { alert("Solo podes reservar hasta 2 horas antes."); setSlotPendiente(null); return; }

    setProcesando(key);
    try {
      await addDoc(collection(db, "reservas"), {
        alumnoId: user.uid,
        nombreAlumno: perfil.nombre + " " + perfil.apellido,
        dia, hora, fecha, creadoEn: serverTimestamp(),
      });
      const nuevasUsadas = (perfil.clasesUsadasMes || 0) + 1;
      const updates = { clasesUsadasMes: nuevasUsadas };
      // Si agoto el plan, volver a pendiente de pago
      if (nuevasUsadas >= clasesDelPlan) {
        updates.estado = "pago_pendiente";
        updates.planId = null;
        updates.planNombre = null;
        updates.clasesUsadasMes = 0;
      }
      await updateDoc(doc(db, "usuarios", user.uid), updates);
      setSlotPendiente(null);
    } finally { setProcesando(null); }
  }

  async function cancelar(dia, hora, fecha) {
    const key = dia + "_" + hora.replace(":", "") + "_" + fecha;
    const reservaId = misReservas[key];
    if (!reservaId || procesando) return;
    const claseDate = new Date(fecha + "T" + hora);
    if (claseDate - new Date() < 2 * 60 * 60 * 1000) { alert("No podes cancelar con menos de 2 horas de anticipacion."); return; }
    setProcesando(key);
    try {
      await deleteDoc(doc(db, "reservas", reservaId));
      await updateDoc(doc(db, "usuarios", user.uid), {
        clasesUsadasMes: Math.max(0, (perfil.clasesUsadasMes || 0) - 1),
      });
    } finally { setProcesando(null); }
  }

  const fmt = iso => { const [,m,d] = iso.split("-"); return d + "/" + m; };
  const vence = perfil?.fechaVencimiento
    ? new Date(perfil.fechaVencimiento.toDate?.() || perfil.fechaVencimiento).toLocaleDateString("es-AR")
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f7" }}>
      <LtHeader rol="alumno" onLogout={() => signOut(auth).then(() => navigate("/login"))} />

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 48px" }}>

        {/* Info plan */}
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "16px 20px", marginBottom: 16, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, color: "#888" }}>Tu plan</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: "#111", marginTop: 2 }}>{perfil?.planNombre || "Sin plan"}</div>
          </div>
          {vence && (
            <div>
              <div style={{ fontSize: 12, color: "#888" }}>Vence</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#111", marginTop: 2 }}>{vence}</div>
            </div>
          )}
          {planId && planId !== "lv" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#888" }}>Clases este mes</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: clasesRestantes <= 2 ? "#f59e0b" : "#111", marginTop: 2 }}>
                {clasesRestantes} <span style={{ fontSize: 13, color: "#aaa", fontWeight: 400 }}>/ {clasesDelPlan}</span>
              </div>
            </div>
          )}
          {planId === "lv" && (
            <div style={{ background: "#dcfce7", color: "#065f46", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500 }}>
              Acceso ilimitado
            </div>
          )}
        </div>

        {/* Alerta plan agotado */}
        {planAgotado && (
          <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#92400e", marginBottom: 4 }}>Agotaste tus clases del mes</div>
            <div style={{ fontSize: 13, color: "#78350f" }}>Para seguir entrenando, renova tu plan. El profe lo activara cuando confirme el pago.</div>
          </div>
        )}

        {/* Alerta clases por agotar */}
        {!planAgotado && clasesRestantes <= 2 && planId && planId !== "lv" && (
          <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#9a3412" }}>
            Te quedan solo {clasesRestantes} clase{clasesRestantes !== 1 ? "s" : ""} este mes.
          </div>
        )}

        {/* Banner confirmacion */}
        {slotPendiente && (
          <div style={{ background: "#111", borderRadius: 12, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ color: "#F5C400", fontWeight: 500, fontSize: 14 }}>Confirmar reserva</div>
              <div style={{ color: "#aaa", fontSize: 13, marginTop: 2 }}>
                {slotPendiente.dia} {slotPendiente.hora} — {slotPendiente.fecha}
              </div>
              <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                Te descontara 1 clase. Te quedan {clasesRestantes - 1} despues de esta.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmarReserva} disabled={!!procesando}
                style={{ background: "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Confirmar
              </button>
              <button onClick={() => setSlotPendiente(null)}
                style={{ background: "transparent", border: "1px solid #333", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#888", cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Nav semana */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Reservar turno</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setSemanaOffset(o => o-1)} style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>←</button>
            <span style={{ fontSize: 13, color: "#888", minWidth: 120, textAlign: "center" }}>
              {fmt(fechas["LUNES"])} — {fmt(fechas["SABADO"])}
            </span>
            <button onClick={() => setSemanaOffset(o => o+1)} style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>→</button>
            <button onClick={() => setSemanaOffset(0)} style={{ background: "#F5C400", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Hoy</button>
          </div>
        </div>

        {/* Grilla */}
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, border: "0.5px solid #e0e0e0" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid #e0e0e0" }}>
                <th style={{ width: 52, padding: "10px 8px", fontSize: 11, color: "#aaa", fontWeight: 400 }}></th>
                {DIAS.map(dia => {
                  const fecha = fechas[dia];
                  const esHoy = fecha === hoy;
                  return (
                    <th key={dia} style={{ padding: "10px 4px", minWidth: 80 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: esHoy ? "#F5C400" : "#444" }}>{DIAS_LABEL[dia]}</div>
                        <div style={{ fontSize: 11, color: esHoy ? "#F5C400" : "#aaa" }}>{fmt(fecha)}</div>
                        {feriados[fecha] && <div style={{ fontSize: 9, color: "#dc2626", marginTop: 2 }}>Feriado</div>}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 16 }, (_, i) => i + 7).map(h => {
                const hora = String(h).padStart(2, "0") + ":00";
                return (
                  <tr key={hora} style={{ borderBottom: "0.5px solid #f5f5f5" }}>
                    <td style={{ padding: "3px 8px", fontSize: 12, color: "#aaa", textAlign: "right" }}>{hora}</td>
                    {DIAS.map(dia => {
                      const [hIni, hFin] = dia === "SABADO" ? [8,13] : [7,22];
                      if (h < hIni || h > hFin) return <td key={dia} style={{ background: "#f9f9f9", padding: 3 }} />;
                      const fecha = fechas[dia];
                      if (feriados[fecha]) return <td key={dia} style={{ padding: 3 }}><div style={{ background: "#fee2e2", borderRadius: 6, height: 44 }} /></td>;

                      const key = dia + "_" + hora.replace(":", "") + "_" + fecha;
                      const ocupados = reservasPorSlot[key] || 0;
                      const cupo = 15;
                      const tengoReserva = !!misReservas[key];
                      const lleno = ocupados >= cupo && !tengoReserva;
                      const isPast = new Date(fecha + "T" + hora) < new Date();
                      const esPendiente = slotPendiente?.key === key;
                      const bloqueado = planAgotado && !tengoReserva;

                      return (
                        <td key={dia} style={{ padding: 3 }}>
                          <button
                            onClick={() => {
                              if (isPast || lleno || bloqueado || procesando === key) return;
                              if (tengoReserva) cancelar(dia, hora, fecha);
                              else reservar(dia, hora, fecha);
                            }}
                            disabled={isPast || lleno || bloqueado || procesando === key}
                            style={{
                              width: "100%", height: 44, borderRadius: 8,
                              border: (esPendiente || tengoReserva) ? "2px solid #F5C400" : "none",
                              cursor: (isPast || lleno || bloqueado) ? "default" : "pointer",
                              background: isPast ? "#f5f5f5" : bloqueado ? "#f5f5f5" : esPendiente ? "#FFF8DC" : tengoReserva ? "#FFFBEA" : lleno ? "#fef3c7" : ocupados > 0 ? "#dcfce7" : "#f9f9f9",
                              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "3px 2px"
                            }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center", maxWidth: 64 }}>
                              {Array.from({ length: Math.min(cupo, 10) }, (_, i) => (
                                <span key={i} style={{
                                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                                  background: i < Math.min(ocupados, 10)
                                    ? (tengoReserva ? "#F5C400" : lleno ? "#f59e0b" : "#10b981")
                                    : "#e0e0e0"
                                }}/>
                              ))}
                            </div>
                            <span style={{ fontSize: 10, color: lleno ? "#92400e" : ocupados > 0 ? "#065f46" : "#ccc", fontWeight: 500 }}>
                              {ocupados}/{cupo}
                            </span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
          {[
            { color: "#FFFBEA", border: "2px solid #F5C400", label: "Mi reserva" },
            { color: "#dcfce7", label: "Con lugares" },
            { color: "#fef3c7", label: "Cupo lleno" },
            { color: "#f9f9f9", label: "Sin reservas" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: l.color, border: l.border || "0.5px solid #e0e0e0", display: "inline-block" }}/>
              <span style={{ fontSize: 12, color: "#888" }}>{l.label}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#aaa", marginTop: 8 }}>
          Podes reservar y cancelar hasta 2 horas antes de la clase.
        </p>
      </div>
    </div>
  );
}
