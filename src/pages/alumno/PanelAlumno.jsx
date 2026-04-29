import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  collection, query, where, onSnapshot, addDoc, deleteDoc,
  doc, getDocs, serverTimestamp, updateDoc
} from "firebase/firestore";
import LtHeader from "../../components/LtHeader";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const DIAS_LABEL = { LUNES:"Lun", MARTES:"Mar", MIERCOLES:"Mie", JUEVES:"Jue", VIERNES:"Vie", SABADO:"Sab" };

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
  // Para clase suelta: slot preseleccionado esperando confirmacion
  const [slotPendiente, setSlotPendiente] = useState(null);

  const inicioSemana = getInicioSemana(semanaOffset);
  const fechas = getFechasDeSemana(inicioSemana);
  const hoy = new Date().toISOString().split("T")[0];
  const esSuelta = perfil?.planId === "suelta";

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

  // Para clase suelta: el alumno selecciona el slot y aparece boton de confirmar
  function seleccionarSlotSuelta(dia, hora, fecha) {
    const key = dia + "_" + hora.replace(":", "") + "_" + fecha;
    if (misReservas[key]) return; // ya reservado
    setSlotPendiente({ dia, hora, fecha, key });
  }

  async function confirmarClaseSuelta() {
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
        dia, hora, fecha,
        creadoEn: serverTimestamp(),
      });
      // Marcar la clase suelta como usada
      await updateDoc(doc(db, "usuarios", user.uid), {
        claseSueltaUsada: true,
        estado: "activo", // sigue activo pero sin mas reservas
      });
      setSlotPendiente(null);
    } finally {
      setProcesando(null);
    }
  }

  async function reservar(dia, hora, fecha) {
    const key = dia + "_" + hora.replace(":", "") + "_" + fecha;
    if (procesando || misReservas[key]) return;
    const ahora = new Date();
    const claseDate = new Date(fecha + "T" + hora);
    if (claseDate < ahora) { alert("Esta clase ya paso."); return; }
    if (claseDate - ahora < 2 * 60 * 60 * 1000) { alert("Solo podes reservar hasta 2 horas antes."); return; }
    setProcesando(key);
    try {
      await addDoc(collection(db, "reservas"), {
        alumnoId: user.uid,
        nombreAlumno: perfil.nombre + " " + perfil.apellido,
        dia, hora, fecha,
        creadoEn: serverTimestamp(),
      });
    } finally {
      setProcesando(null);
    }
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
      // Si era clase suelta, devolver el uso
      if (esSuelta) {
        await updateDoc(doc(db, "usuarios", user.uid), { claseSueltaUsada: false });
      }
    } finally {
      setProcesando(null);
    }
  }

  const fmt = iso => { const [,m,d] = iso.split("-"); return d + "/" + m; };
  const vence = perfil?.fechaVencimiento
    ? new Date(perfil.fechaVencimiento.toDate?.() || perfil.fechaVencimiento).toLocaleDateString("es-AR")
    : null;

  const claseSueltaYaUsada = esSuelta && perfil?.claseSueltaUsada === true;
  const totalMisReservas = Object.keys(misReservas).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f7" }}>
      <LtHeader rol="alumno" onLogout={() => signOut(auth).then(() => navigate("/login"))} />

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 48px" }}>

        {/* Info plan */}
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, color: "#888" }}>Tu plan</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: "#111", marginTop: 2 }}>{perfil?.planNombre || "Sin plan"}</div>
          </div>
          {vence && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#888" }}>Vence</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#111", marginTop: 2 }}>{vence}</div>
            </div>
          )}
          {esSuelta && (
            <div style={{
              background: claseSueltaYaUsada ? "#fee2e2" : "#dcfce7",
              color: claseSueltaYaUsada ? "#991b1b" : "#065f46",
              borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500,
            }}>
              {claseSueltaYaUsada ? "Clase ya utilizada" : "1 clase disponible"}
            </div>
          )}
        </div>

        {/* Alerta clase suelta ya usada */}
        {claseSueltaYaUsada && (
          <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
            Ya usaste tu clase suelta. Para seguir entrenando, comunicate con el profe para renovar tu plan.
          </div>
        )}

        {/* Confirmacion clase suelta pendiente */}
        {slotPendiente && (
          <div style={{ background: "#111", borderRadius: 12, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ color: "#F5C400", fontWeight: 500, fontSize: 14 }}>Confirmar clase suelta</div>
              <div style={{ color: "#aaa", fontSize: 13, marginTop: 2 }}>
                {slotPendiente.dia} {slotPendiente.hora} — {slotPendiente.fecha}
              </div>
              <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>Esta sera tu unica clase. No podras reservar mas.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmarClaseSuelta} disabled={!!procesando}
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
            <button onClick={() => setSemanaOffset(o => o-1)}
              style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>←</button>
            <span style={{ fontSize: 13, color: "#888", minWidth: 120, textAlign: "center" }}>
              {fmt(fechas["LUNES"])} — {fmt(fechas["SABADO"])}
            </span>
            <button onClick={() => setSemanaOffset(o => o+1)}
              style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>→</button>
            <button onClick={() => setSemanaOffset(0)}
              style={{ background: "#F5C400", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
              Hoy
            </button>
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
                      const bloqueado = claseSueltaYaUsada && !tengoReserva;

                      function handleClick() {
                        if (isPast || lleno || bloqueado) return;
                        if (tengoReserva) { cancelar(dia, hora, fecha); return; }
                        if (esSuelta) {
                          seleccionarSlotSuelta(dia, hora, fecha);
                        } else {
                          reservar(dia, hora, fecha);
                        }
                      }

                      return (
                        <td key={dia} style={{ padding: 3 }}>
                          <button
                            onClick={handleClick}
                            disabled={isPast || lleno || bloqueado || procesando === key}
                            title={tengoReserva ? "Cancelar reserva" : lleno ? "Sin lugares" : "Reservar"}
                            style={{
                              width: "100%", height: 44, borderRadius: 8, border: esPendiente ? "2px solid #F5C400" : tengoReserva ? "2px solid #F5C400" : "none",
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

        {/* Leyenda */}
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
          {esSuelta ? "Clase suelta: selecciona un turno y confirma. Solo podes reservar 1 clase." : "Podes reservar y cancelar hasta 2 horas antes de la clase."}
        </p>
      </div>
    </div>
  );
}
