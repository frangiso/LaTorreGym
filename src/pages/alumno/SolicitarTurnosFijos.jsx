import { useState, useEffect } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const DIAS_LABEL = { LUNES:"Lunes", MARTES:"Martes", MIERCOLES:"Miercoles", JUEVES:"Jueves", VIERNES:"Viernes", SABADO:"Sabado" };

function getHorasDia(dia) {
  const [ini, fin] = dia === "SABADO" ? [8, 13] : [7, 22];
  return Array.from({ length: fin - ini + 1 }, (_, i) => String(i + ini).padStart(2, "0") + ":00");
}

// Cuantos turnos fijos debe elegir segun plan
const TURNOS_POR_PLAN = { "2dias": 2, "3dias": 3, "lv": 0, "suelta": 0 };

export default function SolicitarTurnosFijos({ perfil, user, reservasPorSlot = {}, feriados = {} }) {
  const [paso, setPaso] = useState("ver"); // ver | elegir
  const [diaActivo, setDiaActivo] = useState("LUNES");
  const [seleccionados, setSeleccionados] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [ocupacionFija, setOcupacionFija] = useState({});

  const planId = perfil?.planId || "";
  const cantTurnos = TURNOS_POR_PLAN[planId] ?? 0;
  const turnosFijos = perfil?.turnosFijos || [];
  const turnosFijosEstado = perfil?.turnosFijosEstado || null;
  const recuperacionesUsadas = perfil?.recuperacionesUsadas ?? 0;

  // Cargar ocupacion de turnos fijos de otros alumnos
  useEffect(() => {
    async function cargarOcupacion() {
      const snap = await getDoc(doc(db, "config", "gimnasio"));
      // Usamos reservasPorSlot que ya tiene los datos de esta semana
      setOcupacionFija(reservasPorSlot);
    }
    cargarOcupacion();
  }, [reservasPorSlot]);

  function toggleSlot(dia, hora) {
    const existe = seleccionados.find(s => s.dia === dia && s.hora === hora);
    if (existe) {
      setSeleccionados(prev => prev.filter(s => !(s.dia === dia && s.hora === hora)));
    } else {
      if (seleccionados.length >= cantTurnos) return; // no puede elegir mas
      setSeleccionados(prev => [...prev, { dia, hora }]);
    }
  }

  function estaSeleccionado(dia, hora) {
    return seleccionados.some(s => s.dia === dia && s.hora === hora);
  }

  // Simular cupo para turno fijo: contar cuantos alumnos ya tienen ese slot fijo
  function cupoFijo(dia, hora) {
    const cupo = 15;
    // Usamos la ocupacion real de reservas como aproximacion
    const key = dia + "_" + hora.replace(":", "") + "_fijo";
    const ocupados = ocupacionFija[key] || 0;
    return { ocupados, libre: cupo - ocupados > 0 };
  }

  async function solicitarTurnos() {
    if (seleccionados.length !== cantTurnos) return;
    setGuardando(true);
    await updateDoc(doc(db, "usuarios", user.uid), {
      turnosFijos: seleccionados,
      turnosFijosEstado: "pendiente",
    });
    setGuardando(false);
    setOk(true);
    setPaso("ver");
    setTimeout(() => setOk(false), 2000);
  }

  // Vista: ya tiene turnos fijos aprobados
  if (turnosFijosEstado === "aprobado" && turnosFijos.length > 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ background: "#dcfce7", color: "#065f46", fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 20 }}>Turnos fijos activos</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {turnosFijos.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#FFFBEA", border: "1.5px solid #F5C400", borderRadius: 10 }}>
                <span style={{ fontSize: 20 }}>📌</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{DIAS_LABEL[t.dia] || t.dia}</div>
                  <div style={{ fontSize: 13, color: "#888" }}>{t.hora} hs</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#aaa", marginTop: 12 }}>
            Para cambiar tus turnos fijos comunicate con el profe.
          </p>
        </div>

        {/* Recuperaciones */}
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "16px" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#111", marginBottom: 6 }}>Clases de recuperacion</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1].map(i => (
                <div key={i} style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: i < recuperacionesUsadas ? "#fee2e2" : "#dcfce7",
                  border: "2px solid " + (i < recuperacionesUsadas ? "#fca5a5" : "#86efac"),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16,
                }}>
                  {i < recuperacionesUsadas ? "✗" : "✓"}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>
                {2 - recuperacionesUsadas} recuperacion{2 - recuperacionesUsadas !== 1 ? "es" : ""} disponible{2 - recuperacionesUsadas !== 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 12, color: "#aaa" }}>Se renuevan cada mes</div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>
            Si no podes ir a tu turno fijo, podes reservar hasta 2 clases de recuperacion por mes en cualquier horario libre.
            Las recuperaciones se reservan desde la pantalla de Turnos.
          </p>
        </div>
      </div>
    );
  }

  // Vista: solicitud pendiente
  if (turnosFijosEstado === "pendiente") {
    return (
      <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "20px 16px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#111", marginBottom: 6 }}>Solicitud enviada</div>
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>
            Pediste los siguientes turnos fijos. El profe los revisara y te confirmara.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "16px 0" }}>
          {turnosFijos.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#f9f9f9", borderRadius: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{DIAS_LABEL[t.dia] || t.dia}</div>
                <div style={{ fontSize: 13, color: "#888" }}>{t.hora} hs</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#aaa", textAlign: "center" }}>
          Mientras tanto podes reservar turnos normales desde la pantalla de Turnos.
        </p>
      </div>
    );
  }

  // Vista: solicitud rechazada o sin turnos
  if (turnosFijosEstado === "rechazado") {
    return (
      <div style={{ background: "#fff", border: "1px solid #fca5a5", borderRadius: 12, padding: "20px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "#111", marginBottom: 6 }}>Solicitud rechazada</div>
        <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginBottom: 16 }}>
          {perfil?.motivoRechazoFijos || "El profe rechazo tu solicitud de turnos fijos. Podes pedir otros horarios."}
        </p>
        <button onClick={() => { setSeleccionados([]); setPaso("elegir"); }}
          style={{ background: "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "11px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          Elegir nuevos turnos
        </button>
      </div>
    );
  }

  // Vista: no tiene turnos fijos aun — puede solicitarlos si su plan lo permite
  if (paso === "ver") {
    if (cantTurnos === 0) {
      return (
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "24px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "#888" }}>Tu plan no incluye turnos fijos.</p>
        </div>
      );
    }
    return (
      <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "20px 16px" }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: "#111", marginBottom: 6 }}>Turnos fijos</div>
        <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6, marginBottom: 20 }}>
          Tu plan incluye <strong>{cantTurnos} turno{cantTurnos !== 1 ? "s" : ""} fijo{cantTurnos !== 1 ? "s" : ""} por semana</strong>.
          Elegis los dias y horarios y quedan reservados automaticamente cada semana.
          Ademas tenes 2 clases de recuperacion por mes para cuando no puedas ir.
        </p>
        {ok && <p style={{ color: "#10b981", fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Solicitud enviada al profe</p>}
        <button onClick={() => { setSeleccionados([]); setPaso("elegir"); }}
          style={{ width: "100%", background: "#F5C400", color: "#111", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Elegir mis turnos fijos
        </button>
      </div>
    );
  }

  // Vista: eligiendo turnos
  if (paso === "elegir") {
    const horasDia = getHorasDia(diaActivo);
    return (
      <div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#111" }}>Elegir turnos fijos</div>
            <div style={{ fontSize: 13, color: "#888" }}>Elegis {cantTurnos} turno{cantTurnos !== 1 ? "s" : ""} — {seleccionados.length}/{cantTurnos} seleccionado{seleccionados.length !== 1 ? "s" : ""}</div>
          </div>
          <button onClick={() => setPaso("ver")}
            style={{ background: "transparent", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "7px 12px", fontSize: 13, color: "#888", cursor: "pointer" }}>
            Cancelar
          </button>
        </div>

        {/* Seleccionados hasta ahora */}
        {seleccionados.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {seleccionados.map((s, i) => (
              <span key={i}
                onClick={() => setSeleccionados(prev => prev.filter((_,j) => j !== i))}
                style={{ background: "#F5C400", color: "#111", fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 20, cursor: "pointer" }}>
                {(s.dia || "").slice(0,3)} {s.hora} ✕
              </span>
            ))}
          </div>
        )}

        {/* Selector de dias */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
          {DIAS.map(dia => {
            const activo = diaActivo === dia;
            const tieneSel = seleccionados.some(s => s.dia === dia);
            return (
              <button key={dia} onClick={() => setDiaActivo(dia)}
                style={{
                  flexShrink: 0, background: activo ? "#111" : "#fff",
                  color: activo ? "#fff" : "#555",
                  border: "0.5px solid " + (activo ? "#111" : "#e0e0e0"),
                  borderRadius: 10, padding: "8px 14px", cursor: "pointer",
                  fontSize: 13, fontWeight: activo ? 500 : 400, position: "relative",
                }}>
                {(DIAS_LABEL[dia] || dia).slice(0, 3)}
                {tieneSel && <span style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: "#F5C400" }} />}
              </button>
            );
          })}
        </div>

        {/* Horarios */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
          {horasDia.map(hora => {
            const sel = estaSeleccionado(diaActivo, hora);
            const lleno = seleccionados.length >= cantTurnos && !sel;
            return (
              <button key={hora} onClick={() => !lleno && toggleSlot(diaActivo, hora)}
                disabled={lleno}
                style={{
                  background: sel ? "#FFFBEA" : lleno ? "#f9f9f9" : "#fff",
                  border: "1.5px solid " + (sel ? "#F5C400" : "#e0e0e0"),
                  borderRadius: 10, padding: "14px 16px", cursor: lleno ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                <span style={{ fontSize: 17, fontWeight: 500, color: lleno ? "#ccc" : "#111" }}>{hora}</span>
                <span style={{ fontSize: 20, color: sel ? "#F5C400" : lleno ? "#e0e0e0" : "#ccc" }}>
                  {sel ? "✓" : "+"}
                </span>
              </button>
            );
          })}
        </div>

        <button onClick={solicitarTurnos}
          disabled={seleccionados.length !== cantTurnos || guardando}
          style={{
            width: "100%",
            background: seleccionados.length === cantTurnos ? "#F5C400" : "#e0e0e0",
            color: seleccionados.length === cantTurnos ? "#111" : "#aaa",
            border: "none", borderRadius: 10, padding: "14px",
            fontSize: 15, fontWeight: 700, cursor: seleccionados.length === cantTurnos ? "pointer" : "default",
          }}>
          {guardando ? "Enviando..." : "Solicitar turnos fijos →"}
        </button>
      </div>
    );
  }

  return null;
}i
