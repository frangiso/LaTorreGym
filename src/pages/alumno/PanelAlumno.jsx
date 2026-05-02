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
  const [modalRecFeriado, setModalRecFeriado] = useState(null); // { diaFijo, horaFijo }
  const [notificacion, setNotificacion]       = useState(null); // notif activa
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

  const fechaVence = perfil?.fechaVencimiento
    ? new Date(perfil.fechaVencimiento.toDate?.() || perfil.fechaVencimiento)
    : null;
  const vence = fechaVence ? fechaVence.toLocaleDateString("es-AR") : null;
  const diasRestantes = fechaVence
    ? Math.ceil((fechaVence - new Date()) / (1000*60*60*24))
    : null;
  const colorVence = diasRestantes === null ? "#aaa"
    : diasRestantes <= 0  ? "#dc2626"
    : diasRestantes <= 3  ? "#dc2626"
    : diasRestantes <= 7  ? "#f59e0b"
    : "#10b981";
  const textoVence = diasRestantes === null ? null
    : diasRestantes <= 0  ? "⚠️ Plan vencido — contactá al profe para renovar"
    : diasRestantes === 1 ? "⚠️ Vence mañana — " + vence
    : diasRestantes <= 7  ? "⚠️ Vence en " + diasRestantes + " días — " + vence
    : "Vence " + vence;

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

  // Listener de notificaciones del profe
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notificaciones"),
      where("alumnoId", "==", user.uid),
      where("leido", "==", false)
    );
    const fn = onSnapshot(q, snap => {
      if (!snap.empty) {
        // Mostrar la más reciente
        const notifs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a,b) => (b.creadoEn?.seconds||0) - (a.creadoEn?.seconds||0));
        setNotificacion(notifs[0]);
      } else {
        setNotificacion(null);
      }
    });
    return fn;
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
        if (r.alumnoId === user.uid) mias[key] = { id: d.id, esRecuperacion: r.esRecuperacion || false, esPorFeriado: r.esPorFeriado || false };
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

  function estadoSlot(dia, hora, fecha, fechasSemana) {
    const key     = dia + "_" + hora.replace(":", "") + "_" + fecha;
    const tengo   = !!misReservas[key]?.id;
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
      if (feriad) return { accion: "abrir_modal_feriado" };
      return { accion: "reservar_fijo" };
    }

    // Día feriado, slot que no es su fijo — bloqueado
    if (feriad) return { accion: "nada", motivo: "feriado" };

    // Slot libre en día normal — recuperación normal (descuenta)
    if (recDisp <= 0) return { accion: "nada", motivo: "sin_recuperaciones" };
    return { accion: "recuperacion" };
  }

  function handleClickSlot(dia, hora, fecha) {
    const { accion } = estadoSlot(dia, hora, fecha, fechas);
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
    if (accion === "abrir_modal_feriado") {
      setModalRecFeriado({ diaFijo: dia, horaFijo: hora });
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
        esRecuperacion: tipo === "recuperacion" || tipo === "recuperacion_feriado",
        esPorFeriado:   tipo === "recuperacion_feriado",
        creadoEn:       serverTimestamp(),
      });
      // Solo descuenta recuperacion si NO es por feriado en turno fijo
      if (tipo === "recuperacion") {
        await updateDoc(doc(db, "usuarios", user.uid), {
          recuperacionesUsadas: recUsadas + 1,
        });
      }
      // recuperacion_feriado: no descuenta del contador
    } finally { setProcesando(null); }
  }

  async function cancelar(dia, hora, fecha) {
    const key = dia + "_" + hora.replace(":", "") + "_" + fecha;
    const reservaData = misReservas[key];
    if (!reservaData?.id || procesando) return;
    if (new Date(fecha + "T" + hora) - new Date() < 2 * 60 * 60 * 1000) {
      alert("No podes cancelar con menos de 2 horas de anticipacion."); return;
    }
    setProcesando(key);
    try {
      // Usar datos ya cacheados — sin getDocs extra
      const esRec = reservaData.esRecuperacion && !reservaData.esPorFeriado;
      await deleteDoc(doc(db, "reservas", reservaData.id));
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
                {textoVence && (
                  <div style={{ fontSize: 12, color: colorVence, marginTop: 4, fontWeight: diasRestantes !== null && diasRestantes <= 7 ? 500 : 400 }}>
                    {textoVence}
                  </div>
                )}
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
                  {confirmando.tipo === "recuperacion_feriado" ? "Recuperación por feriado (gratis)" :
                   confirmando.tipo === "recuperacion" ? "Usar clase de recuperación" :
                   confirmando.tipo === "suelta"       ? "Confirmar clase suelta" : "Confirmar reserva"}
                </div>
                <div style={{ color: "#aaa", fontSize: 13, marginBottom: 4 }}>
                  {DIAS_FULL[confirmando.dia]} {confirmando.hora} — {confirmando.fecha}
                </div>
                {confirmando.tipo === "recuperacion_feriado" && (
                  <div style={{ color: "#10b981", fontSize: 12, marginBottom: 10 }}>
                    ✓ Tu día fijo es feriado — esta recuperación NO descuenta de tus 2 disponibles.
                  </div>
                )}
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
                  const tengo    = !!misReservas[key]?.id;
                  const { accion, motivo } = estadoSlot(diaSeleccionado, hora, fechaDia, fechas);
                  const esFijo   = esMiFijo(diaSeleccionado, hora);
                  const clickable = accion !== "nada" && accion !== "cancelar" && !procesando && accion !== "abrir_modal_feriado";
                  const isProcesando = procesando === key;

                  // Estilos por estado
                  let bg = "#fff", borde = "#e0e0e0", badge = null;
                  if (tengo) {
                    bg = "#FFFBEA"; borde = "#F5C400";
                    badge = { text: "Reservado · toca para cancelar", color: "#7a5c00", bg: "#FFF8DC" };
                  } else if (accion === "reservar_fijo") {
                    bg = "#FFFBEA"; borde = "#F5C400";
                    badge = { text: "Tu turno fijo", color: "#7a5c00", bg: "#FFF8DC" };
                  } else if (accion === "recuperacion_feriado") {
                    badge = { text: "Recuperar por feriado · gratis 🎁", color: "#065f46", bg: "#dcfce7" };
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
                  } else if (accion === "abrir_modal_feriado") {
                    bg = "#f0fdf4"; borde = "#86efac";
                    badge = { text: "Feriado · tocá para elegir recuperación gratis 🎁", color: "#065f46", bg: "#dcfce7" };
                  } else if (motivo === "feriado") {
                    bg = "#fee2e2"; borde = "#fecaca";
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
                        else if (accion === "abrir_modal_feriado") handleClickSlot(diaSeleccionado, hora, fechaDia);
                        else if (clickable) handleClickSlot(diaSeleccionado, hora, fechaDia);
                      }}
                      style={{
                        background: bg,
                        border: "1.5px solid " + borde,
                        borderRadius: 12, padding: "12px 14px",
                        cursor: (tengo || clickable || accion === "abrir_modal_feriado") && !isProcesando ? "pointer" : "default",
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

      {/* Modal notificación del profe */}
      {notificacion && (
        <ModalNotificacion
          notificacion={notificacion}
          perfil={perfil}
          user={user}
          feriados={feriados}
          onCerrar={async () => {
            // Marcar como leída
            await updateDoc(doc(db, "notificaciones", notificacion.id), { leido: true });
            setNotificacion(null);
          }}
        />
      )}

      {/* Modal recuperación por feriado */}
      {modalRecFeriado && (
        <ModalRecuperacionFeriado
          turnoFijo={modalRecFeriado}
          perfil={perfil}
          user={user}
          feriados={feriados}
          onCerrar={() => setModalRecFeriado(null)}
        />
      )}
    </div>
  );
}

// ---- Modal para elegir recuperación por feriado ----
function ModalRecuperacionFeriado({ turnoFijo, perfil, user, feriados, onCerrar }) {
  const DIAS       = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
  const DIAS_FULL  = { LUNES:"Lunes", MARTES:"Martes", MIERCOLES:"Miercoles", JUEVES:"Jueves", VIERNES:"Viernes", SABADO:"Sabado" };
  const DIAS_CORTO = { LUNES:"Lun", MARTES:"Mar", MIERCOLES:"Mie", JUEVES:"Jue", VIERNES:"Vie", SABADO:"Sab" };

  const [diaActivo, setDiaActivo]   = useState("LUNES");
  const [semanaOffset, setSemana]   = useState(0);
  const [reservasPorSlot, setRes]   = useState({});
  const [misReservas, setMisRes]    = useState({});
  const [procesando, setProcesando] = useState(null);
  const [ok, setOk]                 = useState(false);

  // Fechas de la semana seleccionada
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const dow = hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dow===0?6:dow-1) + semanaOffset*7);
  const fechas = {};
  DIAS.forEach((dia,i) => {
    const d = new Date(lunes); d.setDate(lunes.getDate()+i);
    fechas[dia] = d.toISOString().split("T")[0];
  });

  const fmt = iso => { const [,m,d]=iso.split("-"); return d+"/"+m; };
  const fechaLunes = fmt(fechas["LUNES"]);
  const fechaSab   = fmt(fechas["SABADO"]);

  useEffect(() => {
    const fechasArr = Object.values(fechas);
    const q = query(collection(db,"reservas"), where("fecha","in",fechasArr));
    const fn = onSnapshot(q, snap => {
      const map={}, mias={};
      snap.docs.forEach(d => {
        const r=d.data();
        const key=r.dia+"_"+r.hora.replace(":","")+"_"+r.fecha;
        if(!map[key]) map[key]=0;
        map[key]++;
        if(r.alumnoId===user.uid) mias[key]=d.id;
      });
      setRes(map); setMisRes(mias);
    });
    return fn;
  }, [semanaOffset]);

  function getHorasDia(dia) {
    const [ini,fin] = dia==="SABADO"?[8,13]:[7,22];
    return Array.from({length:fin-ini+1},(_,i)=>String(i+ini).padStart(2,"0")+":00");
  }

  async function reservarRecuperacion(dia, hora) {
    const fecha = fechas[dia];
    const key   = dia+"_"+hora.replace(":","")+"_"+fecha;
    if(misReservas[key]?.id) return;
    if((reservasPorSlot[key]||0)>=15) return;
    setProcesando(key);
    try {
      await addDoc(collection(db,"reservas"),{
        alumnoId: user.uid,
        nombreAlumno: ((perfil?.nombre||"")+" "+(perfil?.apellido||"")).trim(),
        dia, hora, fecha,
        esFijo: false, esRecuperacion: true, esPorFeriado: true,
        diaFijoOriginal: turnoFijo.diaFijo,
        horaFijoOriginal: turnoFijo.horaFijo,
        creadoEn: serverTimestamp(),
      });
      setOk(true);
      setTimeout(() => onCerrar(), 2000);
    } catch(e) { console.error(e); alert("Error al reservar."); }
    setProcesando(null);
  }

  const horasDia = getHorasDia(diaActivo);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:600,maxHeight:"88vh",overflow:"auto",padding:"20px 16px 48px"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div>
            <div style={{fontSize:16,fontWeight:500,color:"#111"}}>Elegir recuperación por feriado</div>
            <div style={{fontSize:12,color:"#10b981",fontWeight:500}}>Gratis · no descuenta del contador 🎁</div>
          </div>
          <button onClick={onCerrar}
            style={{background:"#f5f5f5",border:"none",borderRadius:8,padding:"6px 14px",fontSize:16,cursor:"pointer",color:"#555"}}>
            ✕
          </button>
        </div>

        <div style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:10,padding:"9px 14px",marginBottom:14,fontSize:12,color:"#065f46"}}>
          Tu turno fijo del <strong>{DIAS_FULL[turnoFijo.diaFijo]} {turnoFijo.horaFijo}</strong> es feriado. Elegí en qué semana, día y horario querés recuperar.
        </div>

        {ok && (
          <div style={{background:"#dcfce7",border:"1px solid #86efac",borderRadius:10,padding:"12px",marginBottom:12,fontSize:14,fontWeight:500,color:"#065f46",textAlign:"center"}}>
            ✓ ¡Recuperación reservada!
          </div>
        )}

        {/* Nav semana */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8}}>
          <button onClick={() => setSemana(s=>s-1)}
            style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:15}}>←</button>
          <span style={{fontSize:13,color:"#888",textAlign:"center"}}>{fechaLunes} — {fechaSab}</span>
          <div style={{display:"flex",gap:6}}>
            <button onClick={() => setSemana(s=>s+1)}
              style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:15}}>→</button>
            <button onClick={() => setSemana(0)}
              style={{background:"#F5C400",border:"none",borderRadius:8,padding:"7px 10px",cursor:"pointer",fontSize:12,fontWeight:500}}>Hoy</button>
          </div>
        </div>

        {/* Selector días */}
        <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
          {DIAS.map(dia => {
            const fecha  = fechas[dia];
            const esFer  = !!feriados[fecha];
            const activo = diaActivo===dia;
            const tieneMia = Object.keys(misReservas).some(k=>k.startsWith(dia+"_")&&k.endsWith("_"+fecha));
            const pasadoDia = new Date(fecha) < new Date(new Date().toISOString().split("T")[0]);

            if (esFer) return (
              <div key={dia} style={{flexShrink:0,minWidth:52,background:"#fee2e2",borderRadius:10,padding:"8px 10px",textAlign:"center",opacity:0.5}}>
                <div style={{fontSize:11,fontWeight:500,color:"#dc2626"}}>{DIAS_CORTO[dia]}</div>
                <div style={{fontSize:11,color:"#dc2626"}}>{fmt(fecha)}</div>
                <div style={{fontSize:9,color:"#dc2626"}}>Feriado</div>
              </div>
            );
            return (
              <button key={dia} onClick={() => setDiaActivo(dia)}
                style={{flexShrink:0,minWidth:52,background:activo?"#111":"#fff",
                  color:activo?"#fff":pasadoDia?"#ccc":"#555",
                  border:"0.5px solid "+(activo?"#111":"#e0e0e0"),
                  borderRadius:10,padding:"8px 10px",cursor:"pointer",textAlign:"center",position:"relative"}}>
                <div style={{fontSize:11,fontWeight:500}}>{DIAS_CORTO[dia]}</div>
                <div style={{fontSize:11,marginTop:2}}>{fmt(fecha)}</div>
                {tieneMia&&<span style={{position:"absolute",bottom:4,left:"50%",transform:"translateX(-50%)",width:5,height:5,borderRadius:"50%",background:"#10b981",display:"block"}}/>}
              </button>
            );
          })}
        </div>

        {/* Horarios */}
        <div style={{fontSize:13,fontWeight:500,color:"#555",marginBottom:8}}>
          {DIAS_FULL[diaActivo]} {fmt(fechas[diaActivo])}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {horasDia.map(hora => {
            const fecha   = fechas[diaActivo];
            const key     = diaActivo+"_"+hora.replace(":","")+"_"+fecha;
            const ocupados= reservasPorSlot[key]||0;
            const tengo   = !!misReservas[key]?.id;
            const lleno   = ocupados>=15&&!tengo;
            const pasado  = new Date(fecha+"T"+hora)<new Date();
            const block   = lleno||pasado;
            const isProc  = procesando===key;

            return (
              <button key={hora}
                onClick={() => !block&&!isProc&&!tengo&&reservarRecuperacion(diaActivo,hora)}
                disabled={block||isProc||tengo}
                style={{
                  background: tengo?"#dcfce7":lleno?"#f9f9f9":pasado?"#f9f9f9":"#fff",
                  border:"1.5px solid "+(tengo?"#86efac":lleno||pasado?"#f0f0f0":"#e0e0e0"),
                  borderRadius:12,padding:"13px 14px",
                  cursor:block||tengo?"default":"pointer",
                  display:"flex",alignItems:"center",justifyContent:"space-between",
                  opacity:isProc?0.6:1,
                }}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:17,fontWeight:500,color:block&&!tengo?"#ccc":"#111",minWidth:52}}>{hora}</span>
                  <div style={{display:"flex",gap:3,flexWrap:"wrap",maxWidth:110}}>
                    {Array.from({length:15},(_,i)=>(
                      <span key={i} style={{width:7,height:7,borderRadius:"50%",flexShrink:0,
                        background:i<ocupados?(tengo?"#10b981":"#f59e0b"):"#e8e8e8"}}/>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                  <span style={{fontSize:11,color:"#aaa"}}>{ocupados}/15</span>
                  {tengo  && <span style={{fontSize:11,fontWeight:500,color:"#065f46",background:"#dcfce7",padding:"2px 8px",borderRadius:20}}>✓ Reservado</span>}
                  {lleno  && <span style={{fontSize:11,color:"#92400e",background:"#fef3c7",padding:"2px 8px",borderRadius:20}}>Lleno</span>}
                  {pasado && <span style={{fontSize:11,color:"#aaa",background:"#f5f5f5",padding:"2px 8px",borderRadius:20}}>Pasado</span>}
                  {!block&&!tengo && <span style={{fontSize:11,color:"#065f46",background:"#dcfce7",padding:"2px 8px",borderRadius:20}}>Gratis 🎁</span>}
                  {isProc && <span style={{fontSize:11,color:"#888"}}>Reservando...</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- Modal de Notificación del Profe ----
function ModalNotificacion({ notificacion, perfil, user, feriados, onCerrar }) {
  const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
  const DIAS_FULL = { LUNES:"Lunes", MARTES:"Martes", MIERCOLES:"Miercoles", JUEVES:"Jueves", VIERNES:"Viernes", SABADO:"Sabado" };
  const DIAS_CORTO = { LUNES:"Lun", MARTES:"Mar", MIERCOLES:"Mie", JUEVES:"Jue", VIERNES:"Vie", SABADO:"Sab" };

  const [semanaOffset, setSemana]   = useState(0);
  const [diaActivo, setDiaActivo]   = useState("LUNES");
  const [reservasPorSlot, setRes]   = useState({});
  const [misReservas, setMisRes]    = useState({});
  const [procesando, setProcesando] = useState(null);
  const [ok, setOk]                 = useState(false);
  const [mostrarGrilla, setMostrarGrilla] = useState(false);

  const esPlanVencido = notificacion.tipo === "plan_vencido";
  const esFijoCancelado = notificacion.tipo === "fijo_cancelado";

  // Fechas de la semana
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const dow = hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dow===0?6:dow-1) + semanaOffset*7);
  const fechas = {};
  DIAS.forEach((dia,i) => {
    const d = new Date(lunes); d.setDate(lunes.getDate()+i);
    fechas[dia] = d.toISOString().split("T")[0];
  });
  const fmt = iso => { const [,m,d]=iso.split("-"); return d+"/"+m; };

  useEffect(() => {
    if (!mostrarGrilla) return;
    const fechasArr = Object.values(fechas);
    const q = query(collection(db,"reservas"), where("fecha","in",fechasArr));
    const fn = onSnapshot(q, snap => {
      const map={}, mias={};
      snap.docs.forEach(d => {
        const r=d.data();
        const key=r.dia+"_"+r.hora.replace(":","")+"_"+r.fecha;
        if(!map[key]) map[key]=0; map[key]++;
        if(r.alumnoId===user.uid) mias[key]=d.id;
      });
      setRes(map); setMisRes(mias);
    });
    return fn;
  }, [semanaOffset, mostrarGrilla]);

  function getHoras(dia) {
    const [ini,fin] = dia==="SABADO"?[8,13]:[7,22];
    return Array.from({length:fin-ini+1},(_,i)=>String(i+ini).padStart(2,"0")+":00");
  }

  async function reservarExcepcion(dia, hora) {
    const fecha = fechas[dia];
    const key = dia+"_"+hora.replace(":","")+"_"+fecha;
    if(misReservas[key] || (reservasPorSlot[key]||0)>=15) return;
    setProcesando(key);
    try {
      await addDoc(collection(db,"reservas"),{
        alumnoId: user.uid,
        nombreAlumno: ((perfil?.nombre||"")+" "+(perfil?.apellido||"")).trim(),
        dia, hora, fecha,
        esFijo: false,          // NO queda fijo — es excepción
        esRecuperacion: false,
        esExcepcion: true,      // marcado como excepción por cancelación del profe
        creadoEn: serverTimestamp(),
      });
      setOk(true);
      setTimeout(() => onCerrar(), 2000);
    } catch(e) { alert("Error al reservar: "+e.message); }
    setProcesando(null);
  }

  const overlay = { position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center" };
  const sheet   = { background:"#fff",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:600,maxHeight:"90vh",overflow:"auto",padding:"20px 16px 48px" };

  // Pantalla de plan vencido
  if (esPlanVencido) return (
    <div style={overlay}>
      <div style={{...sheet, textAlign:"center", padding:"32px 24px 48px"}}>
        <div style={{fontSize:40,marginBottom:12}}>⏰</div>
        <h2 style={{fontSize:18,fontWeight:600,color:"#dc2626",marginBottom:8}}>Tu plan venció</h2>
        <p style={{fontSize:14,color:"#555",lineHeight:1.6,marginBottom:24}}>
          Tu membresía expiró. Para seguir reservando turnos necesitás renovar tu plan con el profe.
        </p>
        <button onClick={onCerrar}
          style={{background:"#F5C400",color:"#111",border:"none",borderRadius:10,padding:"12px 28px",fontSize:14,fontWeight:600,cursor:"pointer"}}>
          Entendido
        </button>
      </div>
    </div>
  );

  // Pantalla de turno cancelado
  return (
    <div style={overlay}>
      <div style={sheet}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
          <div>
            <div style={{fontSize:16,fontWeight:600,color:"#dc2626"}}>
              {esFijoCancelado ? "⚠️ Tu turno fijo fue cancelado" : "⚠️ Tu turno fue cancelado"}
            </div>
            <div style={{fontSize:13,color:"#888",marginTop:2}}>
              {DIAS_FULL[notificacion.dia]} {notificacion.hora} — {fmt(notificacion.fecha)}
            </div>
          </div>
          <button onClick={onCerrar}
            style={{background:"#f5f5f5",border:"none",borderRadius:8,padding:"6px 12px",fontSize:14,cursor:"pointer",color:"#555"}}>
            ✕
          </button>
        </div>

        {ok && (
          <div style={{background:"#dcfce7",border:"1px solid #86efac",borderRadius:10,padding:"12px",marginBottom:12,textAlign:"center",fontSize:14,fontWeight:500,color:"#065f46"}}>
            ✓ ¡Reserva realizada!
          </div>
        )}

        {!mostrarGrilla ? (
          <div style={{textAlign:"center",padding:"16px 0"}}>
            <p style={{fontSize:14,color:"#555",lineHeight:1.6,marginBottom:20}}>
              {esFijoCancelado
                ? "El profe canceló tu turno fijo de esta semana. Podés elegir otro horario como excepción (no queda fijo)."
                : "El profe canceló tu turno. Podés elegir otro horario disponible."}
            </p>
            <button onClick={() => setMostrarGrilla(true)}
              style={{background:"#111",color:"#F5C400",border:"none",borderRadius:10,padding:"12px 24px",fontSize:14,fontWeight:500,cursor:"pointer",marginRight:8}}>
              Elegir otro horario
            </button>
            <button onClick={onCerrar}
              style={{background:"transparent",border:"0.5px solid #e0e0e0",borderRadius:10,padding:"12px 16px",fontSize:14,color:"#555",cursor:"pointer"}}>
              Ahora no
            </button>
          </div>
        ) : (
          <>
            {/* Nav semana */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8}}>
              <button onClick={() => setSemana(s=>s-1)}
                style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:15}}>←</button>
              <span style={{fontSize:13,color:"#888"}}>{fmt(fechas["LUNES"])} — {fmt(fechas["SABADO"])}</span>
              <div style={{display:"flex",gap:6}}>
                <button onClick={() => setSemana(s=>s+1)}
                  style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:15}}>→</button>
                <button onClick={() => setSemana(0)}
                  style={{background:"#F5C400",border:"none",borderRadius:8,padding:"7px 10px",cursor:"pointer",fontSize:12,fontWeight:500}}>Hoy</button>
              </div>
            </div>

            {/* Selector días */}
            <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
              {DIAS.map(dia => {
                const fecha = fechas[dia];
                const esFer = !!feriados[fecha];
                const activo = diaActivo===dia;
                const tieneMia = Object.keys(misReservas).some(k=>k.startsWith(dia+"_")&&k.endsWith("_"+fecha));
                if(esFer) return (
                  <div key={dia} style={{flexShrink:0,minWidth:52,background:"#fee2e2",borderRadius:10,padding:"8px 10px",textAlign:"center",opacity:0.5}}>
                    <div style={{fontSize:11,fontWeight:500,color:"#dc2626"}}>{DIAS_CORTO[dia]}</div>
                    <div style={{fontSize:11,color:"#dc2626"}}>{fmt(fecha)}</div>
                    <div style={{fontSize:9,color:"#dc2626"}}>Feriado</div>
                  </div>
                );
                return (
                  <button key={dia} onClick={() => setDiaActivo(dia)}
                    style={{flexShrink:0,minWidth:52,background:activo?"#111":"#fff",color:activo?"#fff":"#555",
                      border:"0.5px solid "+(activo?"#111":"#e0e0e0"),borderRadius:10,padding:"8px 10px",cursor:"pointer",textAlign:"center",position:"relative"}}>
                    <div style={{fontSize:11,fontWeight:500}}>{DIAS_CORTO[dia]}</div>
                    <div style={{fontSize:11,marginTop:2}}>{fmt(fecha)}</div>
                    {tieneMia&&<span style={{position:"absolute",bottom:4,left:"50%",transform:"translateX(-50%)",width:5,height:5,borderRadius:"50%",background:"#10b981",display:"block"}}/>}
                  </button>
                );
              })}
            </div>

            {/* Horarios */}
            <div style={{fontSize:13,fontWeight:500,color:"#555",marginBottom:8}}>{DIAS_FULL[diaActivo]} {fmt(fechas[diaActivo])}</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {getHoras(diaActivo).map(hora => {
                const fecha = fechas[diaActivo];
                const key = diaActivo+"_"+hora.replace(":","")+"_"+fecha;
                const ocupados = reservasPorSlot[key]||0;
                const tengo = !!misReservas[key];
                const lleno = ocupados>=15&&!tengo;
                const pasado = new Date(fecha+"T"+hora)<new Date();
                const block = lleno||pasado;
                const isProc = procesando===key;
                return (
                  <button key={hora} onClick={() => !block&&!isProc&&!tengo&&reservarExcepcion(diaActivo,hora)}
                    disabled={block||isProc||tengo}
                    style={{background:tengo?"#dcfce7":lleno?"#f9f9f9":pasado?"#f9f9f9":"#fff",
                      border:"1.5px solid "+(tengo?"#86efac":lleno||pasado?"#f0f0f0":"#e0e0e0"),
                      borderRadius:12,padding:"13px 14px",cursor:block||tengo?"default":"pointer",
                      display:"flex",alignItems:"center",justifyContent:"space-between",opacity:isProc?0.6:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <span style={{fontSize:17,fontWeight:500,color:block&&!tengo?"#ccc":"#111",minWidth:52}}>{hora}</span>
                      <div style={{display:"flex",gap:3,flexWrap:"wrap",maxWidth:110}}>
                        {Array.from({length:15},(_,i)=>(
                          <span key={i} style={{width:7,height:7,borderRadius:"50%",flexShrink:0,
                            background:i<ocupados?(tengo?"#10b981":"#f59e0b"):"#e8e8e8"}}/>
                        ))}
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                      <span style={{fontSize:11,color:"#aaa"}}>{ocupados}/15</span>
                      {tengo  && <span style={{fontSize:11,fontWeight:500,color:"#065f46",background:"#dcfce7",padding:"2px 8px",borderRadius:20}}>✓ Reservado</span>}
                      {lleno  && <span style={{fontSize:11,color:"#92400e",background:"#fef3c7",padding:"2px 8px",borderRadius:20}}>Lleno</span>}
                      {pasado && <span style={{fontSize:11,color:"#aaa",background:"#f5f5f5",padding:"2px 8px",borderRadius:20}}>Pasado</span>}
                      {!block&&!tengo && <span style={{fontSize:11,color:"#065f46",background:"#dcfce7",padding:"2px 8px",borderRadius:20}}>Disponible</span>}
                      {isProc && <span style={{fontSize:11,color:"#888"}}>Reservando...</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
