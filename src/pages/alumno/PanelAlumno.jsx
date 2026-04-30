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
import { useData } from "../../context/DataContext";
import MisRutinas from "./MisRutinas";
import MiHistorial from "./MiHistorial";
import { agregarListaEspera, salirListaEspera } from "../../utils/listaEspera";
import SolicitarTurnosFijos from "./SolicitarTurnosFijos";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const DIAS_CORTO = { LUNES:"Lun", MARTES:"Mar", MIERCOLES:"Mie", JUEVES:"Jue", VIERNES:"Vie", SABADO:"Sab" };
const DIAS_FULL  = { LUNES:"Lunes", MARTES:"Martes", MIERCOLES:"Miercoles", JUEVES:"Jueves", VIERNES:"Viernes", SABADO:"Sabado" };

function getInicioSemana(offset = 0) {
  const hoy = new Date();
  const dow = hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
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

const fmt = iso => { const [,m,d] = iso.split("-"); return d + "/" + m; };

export default function PanelAlumno() {
  const { user, perfil } = useAuth();
  const navigate = useNavigate();
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [reservasPorSlot, setReservasPorSlot] = useState({});
  const [misReservas, setMisReservas]         = useState({});
  const [procesando, setProcesando]           = useState(null);
  const [confirmando, setConfirmando]         = useState(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [vistaAlumno, setVistaAlumno]         = useState("turnos");
  const { avisos, feriados }                  = useData();
  const [enEspera, setEnEspera]               = useState({});

  const inicioSemana = getInicioSemana(semanaOffset);
  const fechas       = getFechasDeSemana(inicioSemana);
  const hoy          = new Date().toISOString().split("T")[0];

  const planId           = perfil?.planId || "";
  const esSuelta         = planId === "suelta";
  const tienesFijos      = perfil?.turnosFijosEstado === "aprobado";
  const turnosFijos      = perfil?.turnosFijos || [];
  const recUsadas        = perfil?.recuperacionesUsadas ?? 0;
  const recDisp          = Math.max(0, 2 - recUsadas);
  const necesitaFijos    = !esSuelta && planId && !tienesFijos && perfil?.turnosFijosEstado !== "pendiente";
  const pendienteFijos   = perfil?.turnosFijosEstado === "pendiente";

  const vence = perfil?.fechaVencimiento
    ? new Date(perfil.fechaVencimiento.toDate?.() || perfil.fechaVencimiento).toLocaleDateString("es-AR")
    : null;

  useEffect(() => {
    const map = [null,"LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
    setDiaSeleccionado(map[new Date().getDay()] || "LUNES");
  }, []);

  // Lista de espera del alumno (esta semana)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "listaEspera"), where("alumnoId", "==", user.uid));
    const unsub = onSnapshot(q, snap => {
      const map = {};
      snap.docs.forEach(d => {
        const e = d.data();
        map[e.fecha + "_" + e.hora] = d.id;
      });
      setEnEspera(map);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fechasArr = Object.values(fechas);
    const q = query(collection(db, "reservas"), where("fecha", "in", fechasArr));
    const unsub = onSnapshot(q, snap => {
      const map = {}; const mias = {};
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

  // ---- Lógica de estado de cada slot ----
  function esMiFijo(dia, hora) {
    return turnosFijos.some(t => t.dia === dia && t.hora === hora);
  }

  function estadoSlot(dia, hora, fecha) {
    const key     = dia + "_" + hora.replace(":", "") + "_" + fecha;
    const tengo   = !!misReservas[key];
    const ocupados = reservasPorSlot[key] || 0;
    const lleno   = ocupados >= 15 && !tengo;
    const pasado  = new Date(fecha + "T" + hora) < new Date();
    const feriad  = !!feriados[fecha];

    if (tengo)  return { accion: "cancelar" };
    if (pasado) return { accion: "nada", motivo: "pasado" };
    if (lleno)  return { accion: enEspera[fecha + "_" + hora] ? "en_espera" : "lleno", motivo: "lleno" };

    // CLASE SUELTA: cualquier horario libre
    if (esSuelta) {
      if (Object.keys(misReservas).length > 0) return { accion: "nada", motivo: "suelta_usada" };
      return { accion: "reservar_suelta" };
    }

    // PLANES CON FIJOS: si no tiene fijos, no puede reservar nada
    if (!tienesFijos) return { accion: "nada", motivo: "sin_fijos" };

    // Es su turno fijo
    if (esMiFijo(dia, hora)) {
      if (feriad) return { accion: "recuperacion", motivo: "feriado_en_fijo" };
      return { accion: "reservar_fijo" };
    }

    // Slot libre pero no es su fijo — usa recuperacion
    if (recDisp <= 0) return { accion: "nada", motivo: "sin_recuperaciones" };
    return { accion: "recuperacion" };
  }

  function handleClickSlot(dia, hora, fecha) {
    const { accion } = estadoSlot(dia, hora, fecha);
    if (accion === "cancelar") { cancelar(dia, hora, fecha); return; }
    if (accion === "nada")     return;
    if (accion === "en_espera") {
      if (confirm("Salir de la lista de espera para " + dia + " " + hora + "?"))
        salirListaEspera(user.uid, fecha, hora);
      return;
    }
    if (accion === "lleno") {
      if (confirm("El turno está lleno. ¿Querés anotarte en lista de espera?"))
        agregarListaEspera(user.uid, (perfil?.nombre || "") + " " + (perfil?.apellido || ""), dia, hora, fecha);
      return;
    }
    setConfirmando({ dia, hora, fecha, tipo: accion });
  }

  // ---- Acciones ----
  async function confirmar() {
    if (!confirmando || procesando) return;
    const { dia, hora, fecha, tipo } = confirmando;
    const key = dia + "_" + hora.replace(":", "") + "_" + fecha;
    setProcesando(key);
    setConfirmando(null);
    try {
      await addDoc(collection(db, "reservas"), {
        alumnoId:       user.uid,
        nombreAlumno:   (perfil?.nombre || "") + " " + (perfil?.apellido || ""),
        dia, hora, fecha,
        esFijo:         tipo === "reservar_fijo",
        esRecuperacion: tipo === "recuperacion",
        creadoEn:       serverTimestamp(),
      });
      if (tipo === "recuperacion") {
        await updateDoc(doc(db, "usuarios", user.uid), {
          recuperacionesUsadas: recUsadas + 1,
        });
      }
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
      // Leer si era recuperacion para devolver el contador
      const q = query(
        collection(db, "reservas"),
        where("alumnoId", "==", user.uid),
        where("fecha",    "==", fecha),
        where("hora",     "==", hora)
      );
      const snap = await getDocs(q);
      const esRec = snap.docs[0]?.data()?.esRecuperacion || false;
      await deleteDoc(doc(db, "reservas", reservaId));
      if (esRec) {
        await updateDoc(doc(db, "usuarios", user.uid), {
          recuperacionesUsadas: Math.max(0, recUsadas - 1),
        });
      }
    } finally { setProcesando(null); }
  }

  // ---- Render ----
  const horasDia  = diaSeleccionado ? getHorasDia(diaSeleccionado) : [];
  const fechaDia  = diaSeleccionado ? fechas[diaSeleccionado] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f7" }}>
      <LtHeader rol="alumno" onLogout={() => signOut(auth).then(() => navigate("/login"))} />

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 12px 80px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 10, marginBottom: 16, overflow: "hidden" }}>
          {[["turnos","Turnos"], ["fijos","Turnos fijos"], ["historial","Historial"], ["rutinas","Rutinas"]].map(([k, l]) => (
            <button key={k} onClick={() => setVistaAlumno(k)}
              style={{
                flex: 1, background: vistaAlumno === k ? "#111" : "transparent",
                color: vistaAlumno === k ? "#fff" : "#888",
                border: "none", padding: "11px 4px", fontSize: 13,
                fontWeight: vistaAlumno === k ? 500 : 400, cursor: "pointer",
              }}>
              {l}
            </button>
          ))}
        </div>

        {/* Rutinas */}
        {vistaAlumno === "rutinas" && <MisRutinas />}

        {/* Historial */}
        {vistaAlumno === "historial" && <MiHistorial />}

        {/* Turnos fijos */}
        {vistaAlumno === "fijos" && (
          <SolicitarTurnosFijos perfil={perfil} user={user} />
        )}

        {/* Turnos */}
        {vistaAlumno === "turnos" && (<>

          {/* Avisos */}
          {avisos.map(a => {
            const colores = {
              info:    { bg: "#dbeafe", color: "#1e40af", borde: "#93c5fd" },
              alerta:  { bg: "#fef3c7", color: "#92400e", borde: "#fcd34d" },
              urgente: { bg: "#fee2e2", color: "#991b1b", borde: "#fca5a5" },
            };
            const t = colores[a.tipo] || colores.info;
            return (
              <div key={a.id} style={{ background: t.bg, border: "1px solid " + t.borde, borderRadius: 10, padding: "10px 14px", marginBottom: 8, fontSize: 13, color: t.color, lineHeight: 1.5 }}>
                {a.tipo === "urgente" ? "🚨 " : a.tipo === "alerta" ? "⚠️ " : "ℹ️ "}
                {a.texto}
              </div>
            );
          })}

        {/* Info plan */}
          <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em" }}>Plan</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "#111", marginTop: 2 }}>{perfil?.planNombre || "Sin plan"}</div>
                {vence && <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>Vence {vence}</div>}
              </div>
              {!esSuelta && tienesFijos && (
                <div style={{ textAlign: "center", background: recDisp === 0 ? "#fee2e2" : "#f0fdf4", borderRadius: 10, padding: "8px 14px" }}>
                  <div style={{ fontSize: 20, fontWeight: 500, color: recDisp === 0 ? "#dc2626" : "#16a34a" }}>{recDisp}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>recuper. disponibles</div>
                </div>
              )}
            </div>
          </div>

          {/* Avisos de estado */}
          {necesitaFijos && (
            <div style={{ background: "#fff", border: "1.5px solid #F5C400", borderRadius: 12, padding: "20px 16px", textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📌</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#111", marginBottom: 6 }}>Primero elegí tus turnos fijos</div>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginBottom: 16 }}>
                Con tu plan debés elegir los días y horarios fijos. El profe los aprueba y quedan reservados cada semana.
              </p>
              <button onClick={() => setVistaAlumno("fijos")}
                style={{ background: "#F5C400", color: "#111", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Elegir turnos fijos →
              </button>
            </div>
          )}

          {pendienteFijos && (
            <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "20px", textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#111", marginBottom: 4 }}>Solicitud pendiente</div>
              <p style={{ fontSize: 13, color: "#888" }}>El profe está revisando tu solicitud de turnos fijos.</p>
            </div>
          )}

          {/* Solo mostrar grilla si puede reservar */}
          {(esSuelta || tienesFijos) && (<>

            {/* Banner confirmacion */}
            {confirmando && (
              <div style={{ background: "#111", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ color: "#F5C400", fontWeight: 500, fontSize: 14, marginBottom: 4 }}>
                  {confirmando.tipo === "recuperacion" ? "Usar clase de recuperación" :
                   confirmando.tipo === "suelta"       ? "Confirmar clase suelta" : "Confirmar reserva"}
                </div>
                <div style={{ color: "#aaa", fontSize: 13, marginBottom: 4 }}>
                  {DIAS_FULL[confirmando.dia]} {confirmando.hora} — {confirmando.fecha}
                </div>
                {confirmando.tipo === "recuperacion" && (
                  <div style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>
                    Usás 1 recuperación. Te quedan {recDisp - 1} después de esta.
                  </div>
                )}
                {confirmando.tipo === "suelta" && (
                  <div style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>Esta es tu única clase. No podrás reservar más.</div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={confirmar} disabled={!!procesando}
                    style={{ flex: 1, background: "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                    Confirmar
                  </button>
                  <button onClick={() => setConfirmando(null)}
                    style={{ background: "transparent", border: "1px solid #333", borderRadius: 8, padding: "11px 16px", fontSize: 13, color: "#888", cursor: "pointer" }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Nav semana */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button onClick={() => setSemanaOffset(o => o-1)}
                style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>←</button>
              <span style={{ fontSize: 13, color: "#888" }}>{fmt(fechas["LUNES"])} — {fmt(fechas["SABADO"])}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setSemanaOffset(o => o+1)}
                  style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>→</button>
                <button onClick={() => setSemanaOffset(0)}
                  style={{ background: "#F5C400", border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>Hoy</button>
              </div>
            </div>

            {/* Pills dias */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
              {DIAS.map(dia => {
                const fecha    = fechas[dia];
                const esFer    = !!feriados[fecha];
                const esHoy    = fecha === hoy;
                const sel      = diaSeleccionado === dia;
                const tengoEnDia = Object.keys(misReservas).some(k => k.startsWith(dia + "_") && k.endsWith("_" + fecha));
                const fixoEnDia  = tienesFijos && turnosFijos.some(t => t.dia === dia);
                return (
                  <button key={dia} onClick={() => setDiaSeleccionado(dia)}
                    style={{
                      flexShrink: 0, minWidth: 52,
                      background: sel ? "#111" : esFer ? "#fee2e2" : "#fff",
                      color:      sel ? "#fff" : esFer ? "#dc2626" : esHoy ? "#F5C400" : "#555",
                      border:     sel ? "none" : esHoy ? "2px solid #F5C400" : "0.5px solid #e0e0e0",
                      borderRadius: 10, padding: "8px 10px", cursor: "pointer", textAlign: "center",
                    }}>
                    <div style={{ fontSize: 11, fontWeight: 500 }}>{DIAS_CORTO[dia]}</div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>{fmt(fecha)}</div>
                    <div style={{ display: "flex", gap: 3, justifyContent: "center", marginTop: 3 }}>
                      {fixoEnDia   && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F5C400", display: "inline-block" }}/>}
                      {tengoEnDia  && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981",  display: "inline-block" }}/>}
                    </div>
                    {esFer && <div style={{ fontSize: 9, color: "#dc2626", marginTop: 1 }}>Feriado</div>}
                  </button>
                );
              })}
            </div>

            {/* Lista horarios */}
            {diaSeleccionado && fechaDia && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111", marginBottom: 4 }}>
                  {DIAS_FULL[diaSeleccionado]} {fmt(fechaDia)}
                  {feriados[fechaDia] && <span style={{ marginLeft: 8, fontSize: 12, color: "#dc2626", fontWeight: 400 }}>· Feriado</span>}
                </div>

                {horasDia.map(hora => {
                  const key      = diaSeleccionado + "_" + hora.replace(":", "") + "_" + fechaDia;
                  const ocupados = reservasPorSlot[key] || 0;
                  const cupo     = 15;
                  const tengo    = !!misReservas[key];
                  const { accion, motivo } = estadoSlot(diaSeleccionado, hora, fechaDia);
                  const esFijo   = esMiFijo(diaSeleccionado, hora);
                  const clickable = accion !== "nada" && accion !== "cancelar" && !procesando;
                  const isProcesando = procesando === key;

                  // Estilos por estado
                  let bg = "#fff", borde = "#e0e0e0", badge = null;
                  if (tengo) {
                    bg = "#FFFBEA"; borde = "#F5C400";
                    badge = { text: "Reservado · toca para cancelar", color: "#7a5c00", bg: "#FFF8DC" };
                  } else if (accion === "reservar_fijo") {
                    bg = "#FFFBEA"; borde = "#F5C400";
                    badge = { text: "Tu turno fijo", color: "#7a5c00", bg: "#FFF8DC" };
                  } else if (accion === "recuperacion") {
                    badge = { text: "Recuperación · " + recDisp + " disp.", color: "#1e40af", bg: "#dbeafe" };
                  } else if (accion === "reservar_suelta") {
                    badge = { text: "Reservar", color: "#065f46", bg: "#dcfce7" };
                  } else if (accion === "en_espera") {
                    bg = "#dbeafe"; borde = "#93c5fd";
                    badge = { text: "En lista de espera · toca para salir", color: "#1e40af", bg: "#dbeafe" };
                  } else if (motivo === "lleno") {
                    bg = "#f9f9f9"; borde = "#f0f0f0";
                    badge = { text: "Sin lugares · toca para anotarte en espera", color: "#92400e", bg: "#fef3c7" };
                  } else if (motivo === "sin_recuperaciones") {
                    bg = "#f9f9f9"; borde = "#f0f0f0";
                    badge = { text: "Sin recuperaciones", color: "#991b1b", bg: "#fee2e2" };
                  } else if (motivo === "suelta_usada") {
                    bg = "#f9f9f9"; borde = "#f0f0f0";
                    badge = { text: "Clase ya usada", color: "#991b1b", bg: "#fee2e2" };
                  } else if (motivo === "pasado") {
                    bg = "#f9f9f9"; borde = "#f0f0f0";
                  }

                  return (
                    <div key={hora}
                      onClick={() => {
                        if (isProcesando) return;
                        if (tengo) cancelar(diaSeleccionado, hora, fechaDia);
                        else if (clickable) handleClickSlot(diaSeleccionado, hora, fechaDia);
                      }}
                      style={{
                        background: bg,
                        border: "1.5px solid " + borde,
                        borderRadius: 12, padding: "12px 14px",
                        cursor: (tengo || clickable) && !isProcesando ? "pointer" : "default",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        opacity: isProcesando ? 0.6 : 1,
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ minWidth: 52 }}>
                          <div style={{ fontSize: 17, fontWeight: 500, color: accion === "nada" && !tengo ? "#ccc" : "#111" }}>{hora}</div>
                          {esFijo && !tengo && <div style={{ fontSize: 9, color: "#F5C400", fontWeight: 600, letterSpacing: "0.05em" }}>FIJO</div>}
                        </div>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", maxWidth: 110 }}>
                          {Array.from({ length: Math.min(cupo, 15) }, (_, i) => (
                            <span key={i} style={{
                              width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                              background: i < ocupados
                                ? (tengo ? "#F5C400" : ocupados >= cupo ? "#f59e0b" : "#10b981")
                                : "#e8e8e8"
                            }}/>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "#ccc" }}>{ocupados}/{cupo}</span>
                        {badge && (
                          <span style={{ background: badge.bg, color: badge.color, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20, textAlign: "right" }}>
                            {badge.text}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>)}
        </>)}
      </div>
    </div>
  );
}
