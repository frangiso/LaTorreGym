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
import MisRutinas from "./MisRutinas";
import SolicitarTurnosFijos from "./SolicitarTurnosFijos";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const DIAS_LABEL = { LUNES:"Lunes", MARTES:"Martes", MIERCOLES:"Miercoles", JUEVES:"Jueves", VIERNES:"Viernes", SABADO:"Sabado" };
const DIAS_CORTO = { LUNES:"Lun", MARTES:"Mar", MIERCOLES:"Mie", JUEVES:"Jue", VIERNES:"Vie", SABADO:"Sab" };

const CLASES_POR_PLAN = { "2dias": 8, "3dias": 12, "lv": 999, "suelta": 1 };

function getInicioSemana(offset = 0) {
  const hoy = new Date();
  const dia = hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dia === 0 ? 6 : dia - 1) + offset * 7);
  lunes.setHours(0, 0, 0, 0);
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

function getHorasDia(dia) {
  const [ini, fin] = dia === "SABADO" ? [8, 13] : [7, 22];
  return Array.from({ length: fin - ini + 1 }, (_, i) => String(i + ini).padStart(2, "0") + ":00");
}

export default function PanelAlumno() {
  const { user, perfil } = useAuth();
  const navigate = useNavigate();
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [reservasPorSlot, setReservasPorSlot] = useState({});
  const [misReservas, setMisReservas] = useState({});
  const [feriados, setFeriados] = useState({});
  const [procesando, setProcesando] = useState(null);
  const [slotPendiente, setSlotPendiente] = useState(null);
  const [vistaAlumno, setVistaAlumno] = useState("turnos");
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);

  const inicioSemana = getInicioSemana(semanaOffset);
  const fechas = getFechasDeSemana(inicioSemana);
  const hoy = new Date().toISOString().split("T")[0];

  const planId = perfil?.planId || "";
  const clasesDelPlan = CLASES_POR_PLAN[planId] ?? 999;
  const clasesUsadas = perfil?.clasesUsadasMes ?? 0;
  const clasesRestantes = Math.max(0, clasesDelPlan - clasesUsadas);
  const planAgotado = clasesRestantes <= 0 && planId !== "lv";

  // Seleccionar hoy por defecto
  useEffect(() => {
    const diaHoy = new Date().getDay();
    const diasIdx = [0,1,2,3,4,5,6]; // dom=0
    // Mapear a nuestros DIAS
    const mapDia = [null,"LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
    const d = mapDia[diaHoy];
    setDiaSeleccionado(d || "LUNES");
  }, []);

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
    if (planId !== "lv") {
      setSlotPendiente({ dia, hora, fecha, key });
      return;
    }
    setProcesando(key);
    try {
      const esTurnoFijo = (perfil?.turnosFijos || []).some(t => t.dia === dia && t.hora === hora);
      const esRecuperacion = perfil?.turnosFijosEstado === "aprobado" && !esTurnoFijo;
      if (esRecuperacion) {
        const recUsadas = perfil?.recuperacionesUsadas ?? 0;
        if (recUsadas >= 2) {
          alert("Ya usaste tus 2 clases de recuperacion de este mes.");
          setProcesando(null);
          return;
        }
      }
      await addDoc(collection(db, "reservas"), {
        alumnoId: user.uid,
        nombreAlumno: perfil.nombre + " " + perfil.apellido,
        dia, hora, fecha,
        esRecuperacion: esRecuperacion || false,
        creadoEn: serverTimestamp(),
      });
      if (esRecuperacion) {
        await updateDoc(doc(db, "usuarios", user.uid), {
          recuperacionesUsadas: (perfil.recuperacionesUsadas || 0) + 1,
        });
      }
    } finally { setProcesando(null); }
  }

  async function confirmarReserva() {
    if (!slotPendiente || procesando) return;
    const { dia, hora, fecha, key } = slotPendiente;
    setProcesando(key);
    try {
      await addDoc(collection(db, "reservas"), {
        alumnoId: user.uid,
        nombreAlumno: perfil.nombre + " " + perfil.apellido,
        dia, hora, fecha, creadoEn: serverTimestamp(),
      });
      const nuevasUsadas = (perfil.clasesUsadasMes || 0) + 1;
      const updates = { clasesUsadasMes: nuevasUsadas };
      if (nuevasUsadas >= clasesDelPlan && planId !== "lv") {
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
    if (new Date(fecha + "T" + hora) - new Date() < 2 * 60 * 60 * 1000) {
      alert("No podes cancelar con menos de 2 horas de anticipacion."); return;
    }
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

  // Dias de la semana para el selector
  const diasDisponibles = DIAS.filter(d => {
    const fecha = fechas[d];
    return !feriados[fecha];
  });

  const horasDiaSeleccionado = diaSeleccionado ? getHorasDia(diaSeleccionado) : [];
  const fechaDiaSeleccionado = diaSeleccionado ? fechas[diaSeleccionado] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f7" }}>
      <LtHeader rol="alumno" onLogout={() => signOut(auth).then(() => navigate("/login"))} />

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 12px 60px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 10, marginBottom: 16, overflow: "hidden" }}>
          {[["turnos","Turnos"], ["fijos","Turnos fijos"], ["rutinas","Mis rutinas"]].map(([k, l]) => (
            <button key={k} onClick={() => setVistaAlumno(k)}
              style={{
                flex: 1, background: vistaAlumno === k ? "#111" : "transparent",
                color: vistaAlumno === k ? "#fff" : "#888",
                border: "none", padding: "11px", fontSize: 14,
                fontWeight: vistaAlumno === k ? 500 : 400, cursor: "pointer",
              }}>
              {l}
            </button>
          ))}
        </div>

        {vistaAlumno === "rutinas" && <MisRutinas />}
        {vistaAlumno === "fijos" && <SolicitarTurnosFijos perfil={perfil} user={user} reservasPorSlot={reservasPorSlot} feriados={feriados} />}

        {vistaAlumno === "turnos" && (<>

          {/* Info plan */}
          <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em" }}>Tu plan</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "#111", marginTop: 2 }}>{perfil?.planNombre || "Sin plan"}</div>
              </div>
              {vence && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em" }}>Vence</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#111", marginTop: 2 }}>{vence}</div>
                </div>
              )}
              {planId && planId !== "lv" && (
                <div style={{ background: clasesRestantes <= 2 ? "#fef3c7" : "#f5f5f5", borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 500, color: clasesRestantes <= 2 ? "#92400e" : "#111" }}>{clasesRestantes}</div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>clases restantes</div>
                </div>
              )}
              {planId === "lv" && (
                <div style={{ background: "#dcfce7", color: "#065f46", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500 }}>Ilimitado</div>
              )}
            </div>
          </div>

          {/* Alerta plan agotado */}
          {planAgotado && (
            <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: "#92400e" }}>
              <strong>Agotaste tus clases del mes.</strong> Renova tu plan para seguir entrenando.
            </div>
          )}
          {!planAgotado && clasesRestantes <= 2 && planId && planId !== "lv" && (
            <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#9a3412" }}>
              Te quedan solo {clasesRestantes} clase{clasesRestantes !== 1 ? "s" : ""} este mes.
            </div>
          )}

          {/* Confirmacion pendiente */}
          {slotPendiente && (
            <div style={{ background: "#111", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ color: "#F5C400", fontWeight: 500, fontSize: 14, marginBottom: 4 }}>Confirmar reserva</div>
              <div style={{ color: "#aaa", fontSize: 13 }}>{slotPendiente.dia} {slotPendiente.hora} — {slotPendiente.fecha}</div>
              <div style={{ color: "#666", fontSize: 12, marginTop: 4, marginBottom: 12 }}>
                Se descuenta 1 clase. Quedan {clasesRestantes - 1} despues de esta.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={confirmarReserva} disabled={!!procesando}
                  style={{ flex: 1, background: "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  Confirmar
                </button>
                <button onClick={() => setSlotPendiente(null)}
                  style={{ background: "transparent", border: "1px solid #333", borderRadius: 8, padding: "11px 16px", fontSize: 13, color: "#888", cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Nav semana */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button onClick={() => { setSemanaOffset(o => o-1); }}
              style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 15 }}>←</button>
            <span style={{ fontSize: 13, color: "#888" }}>
              {fmt(fechas["LUNES"])} — {fmt(fechas["SABADO"])}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setSemanaOffset(o => o+1)}
                style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 15 }}>→</button>
              <button onClick={() => setSemanaOffset(0)}
                style={{ background: "#F5C400", border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>Hoy</button>
            </div>
          </div>

          {/* Selector de dias - pills horizontales */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
            {DIAS.map(dia => {
              const fecha = fechas[dia];
              const esFeriado = feriados[fecha];
              const esHoy = fecha === hoy;
              const seleccionado = diaSeleccionado === dia;
              const fechaPasada = new Date(fecha) < new Date(hoy);
              // Contar mis reservas en este dia
              const tengoReservaEnDia = Object.keys(misReservas).some(k => k.startsWith(dia + "_") && k.endsWith("_" + fecha));

              return (
                <button key={dia} onClick={() => !esFeriado && setDiaSeleccionado(dia)}
                  disabled={esFeriado}
                  style={{
                    flexShrink: 0,
                    background: seleccionado ? "#111" : esFeriado ? "#fee2e2" : "#fff",
                    color: seleccionado ? "#fff" : esFeriado ? "#dc2626" : esHoy ? "#F5C400" : "#555",
                    border: seleccionado ? "none" : esHoy ? "2px solid #F5C400" : "0.5px solid #e0e0e0",
                    borderRadius: 10, padding: "8px 12px", cursor: esFeriado ? "not-allowed" : "pointer",
                    textAlign: "center", minWidth: 52,
                  }}>
                  <div style={{ fontSize: 11, fontWeight: 500 }}>{DIAS_CORTO[dia]}</div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>{fmt(fecha)}</div>
                  {tengoReservaEnDia && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#F5C400", margin: "3px auto 0" }} />}
                  {esFeriado && <div style={{ fontSize: 9, color: "#dc2626", marginTop: 2 }}>Feriado</div>}
                </button>
              );
            })}
          </div>

          {/* Horarios del dia seleccionado */}
          {diaSeleccionado && fechaDiaSeleccionado && !feriados[fechaDiaSeleccionado] && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h3 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 8px", color: "#111" }}>
                {DIAS_LABEL[diaSeleccionado]} {fmt(fechaDiaSeleccionado)}
              </h3>

              {horasDiaSeleccionado.map(hora => {
                const key = diaSeleccionado + "_" + hora.replace(":", "") + "_" + fechaDiaSeleccionado;
                const ocupados = reservasPorSlot[key] || 0;
                const cupo = 15;
                const tengoReserva = !!misReservas[key];
                const lleno = ocupados >= cupo && !tengoReserva;
                const isPast = new Date(fechaDiaSeleccionado + "T" + hora) < new Date();
                const bloqueado = planAgotado && !tengoReserva;
                const esPendiente = slotPendiente?.key === key;

                let estado = "libre";
                if (isPast) estado = "pasado";
                else if (bloqueado) estado = "bloqueado";
                else if (tengoReserva) estado = "reservado";
                else if (lleno) estado = "lleno";
                else if (ocupados > 10) estado = "pocosLugares";

                const colores = {
                  libre:        { bg: "#fff",     border: "#e0e0e0", texto: "#111",    badge: null },
                  pasado:       { bg: "#f9f9f9",  border: "#f0f0f0", texto: "#ccc",    badge: null },
                  bloqueado:    { bg: "#f9f9f9",  border: "#f0f0f0", texto: "#ccc",    badge: null },
                  reservado:    { bg: "#FFFBEA",  border: "#F5C400", texto: "#111",    badge: { text: "Reservado", color: "#7a5c00", bg: "#FFF8DC" } },
                  lleno:        { bg: "#fef9f0",  border: "#f59e0b", texto: "#92400e", badge: { text: "Sin lugares", color: "#92400e", bg: "#fef3c7" } },
                  pocosLugares: { bg: "#fff",     border: "#e0e0e0", texto: "#111",    badge: { text: cupo - ocupados + " lugares", color: "#9a3412", bg: "#fff7ed" } },
                  pendiente:    { bg: "#FFF8DC",  border: "#F5C400", texto: "#111",    badge: null },
                };

                const c = esPendiente ? colores.pendiente : colores[estado];

                return (
                  <div key={hora}
                    onClick={() => {
                      if (isPast || bloqueado || procesando === key) return;
                      if (tengoReserva) cancelar(diaSeleccionado, hora, fechaDiaSeleccionado);
                      else if (!lleno) reservar(diaSeleccionado, hora, fechaDiaSeleccionado);
                    }}
                    style={{
                      background: c.bg,
                      border: "1.5px solid " + c.border,
                      borderRadius: 12, padding: "14px 16px",
                      cursor: (isPast || bloqueado || lleno) ? "default" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      transition: "border 0.15s",
                    }}>
                    {/* Hora */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ fontSize: 18, fontWeight: 500, color: isPast || bloqueado ? "#ccc" : "#111", minWidth: 52 }}>{hora}</div>
                      {/* Barrita de ocupacion */}
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", maxWidth: 120 }}>
                        {Array.from({ length: Math.min(cupo, 15) }, (_, i) => (
                          <span key={i} style={{
                            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                            background: i < ocupados
                              ? (tengoReserva ? "#F5C400" : lleno ? "#f59e0b" : "#10b981")
                              : "#e8e8e8"
                          }}/>
                        ))}
                      </div>
                    </div>

                    {/* Badge derecha */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "#aaa" }}>{ocupados}/{cupo}</span>
                      {c.badge && (
                        <span style={{ background: c.badge.bg, color: c.badge.color, fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 20 }}>
                          {c.badge.text}
                        </span>
                      )}
                      {tengoReserva && (
                        <span style={{ fontSize: 11, color: "#dc2626", background: "#fee2e2", borderRadius: 20, padding: "3px 8px" }}>
                          Toca para cancelar
                        </span>
                      )}
                      {!isPast && !bloqueado && !tengoReserva && !lleno && (
                        <span style={{ fontSize: 20, color: "#e0e0e0" }}>+</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </>)}
      </div>
    </div>
  );
}
