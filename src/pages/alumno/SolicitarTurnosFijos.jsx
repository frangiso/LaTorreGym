import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const DIAS_FULL  = { LUNES:"Lunes", MARTES:"Martes", MIERCOLES:"Miercoles", JUEVES:"Jueves", VIERNES:"Viernes", SABADO:"Sabado" };

function getHorasDia(dia) {
  const [ini, fin] = dia === "SABADO" ? [8, 13] : [7, 22];
  return Array.from({ length: fin - ini + 1 }, (_, i) => String(i + ini).padStart(2, "0") + ":00");
}

// Cuantos turnos fijos debe elegir segun plan
const TURNOS_POR_PLAN = { "2dias": 2, "3dias": 3, "lv": 6, "suelta": 0 };

export default function SolicitarTurnosFijos({ perfil, user }) {
  const [paso, setPaso]             = useState("ver");
  const [diaActivo, setDiaActivo]   = useState("LUNES");
  const [seleccionados, setSel]     = useState([]);
  const [guardando, setGuardando]   = useState(false);
  const [ok, setOk]                 = useState(false);

  const planId      = perfil?.planId || "";
  const cantTurnos  = TURNOS_POR_PLAN[planId] ?? 0;
  const turnosFijos = perfil?.turnosFijos || [];
  const estado      = perfil?.turnosFijosEstado || null;
  const recUsadas   = perfil?.recuperacionesUsadas ?? 0;
  const esSuelta    = planId === "suelta";

  function toggle(dia, hora) {
    const existe = seleccionados.find(s => s.dia === dia && s.hora === hora);
    if (existe) {
      setSel(prev => prev.filter(s => !(s.dia === dia && s.hora === hora)));
    } else {
      // Para plan lv: 1 horario por dia max
      if (planId === "lv") {
        const yaTieneDia = seleccionados.find(s => s.dia === dia);
        if (yaTieneDia) {
          setSel(prev => [...prev.filter(s => s.dia !== dia), { dia, hora }]);
          return;
        }
      }
      if (seleccionados.length >= cantTurnos) return;
      setSel(prev => [...prev, { dia, hora }]);
    }
  }

  function seleccionado(dia, hora) {
    return seleccionados.some(s => s.dia === dia && s.hora === hora);
  }

  async function solicitar() {
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

  // Plan suelta: no tiene turnos fijos
  if (esSuelta) {
    return (
      <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "24px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "#888" }}>Tu plan de clase suelta no requiere turno fijo.</p>
      </div>
    );
  }

  // Sin plan
  if (!planId) {
    return (
      <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "24px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "#888" }}>No tenes un plan activo.</p>
      </div>
    );
  }

  // Aprobado
  if (estado === "aprobado" && turnosFijos.length > 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ background: "#dcfce7", color: "#065f46", fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 20 }}>
              Turnos fijos activos
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {turnosFijos.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#FFFBEA", border: "1.5px solid #F5C400", borderRadius: 10 }}>
                <span style={{ fontSize: 18 }}>📌</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{DIAS_FULL[t.dia] || t.dia}</div>
                  <div style={{ fontSize: 13, color: "#888" }}>{t.hora} hs</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#aaa", marginTop: 12, lineHeight: 1.5 }}>
            Para cambiar tus turnos fijos habla con el profe.
          </p>
        </div>

        {/* Estado recuperaciones */}
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "16px" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#111", marginBottom: 10 }}>Clases de recuperacion</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            {[0, 1].map(i => (
              <div key={i} style={{
                width: 40, height: 40, borderRadius: "50%",
                background: i < recUsadas ? "#fee2e2" : "#dcfce7",
                border: "2px solid " + (i < recUsadas ? "#fca5a5" : "#86efac"),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 500,
              }}>
                {i < recUsadas ? "✗" : "✓"}
              </div>
            ))}
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>
                {2 - recUsadas} disponible{2 - recUsadas !== 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 12, color: "#aaa" }}>Se renuevan cada mes</div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
            Si no podes ir a tu turno fijo, podes usar hasta 2 recuperaciones por mes en cualquier horario libre.
            Si tu dia fijo cae en feriado, no se te consume y podes usar una recuperacion.
          </p>
        </div>
      </div>
    );
  }

  // Pendiente
  if (estado === "pendiente") {
    return (
      <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "24px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "#111", marginBottom: 6 }}>Solicitud enviada</div>
        <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginBottom: 16 }}>
          Pediste los siguientes turnos. El profe los va a revisar.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {turnosFijos.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f9f9f9", borderRadius: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{DIAS_FULL[t.dia] || t.dia}</div>
              <div style={{ fontSize: 13, color: "#888" }}>{t.hora} hs</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Rechazado
  if (estado === "rechazado") {
    return (
      <div style={{ background: "#fff", border: "1px solid #fca5a5", borderRadius: 12, padding: "24px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>❌</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "#111", marginBottom: 6 }}>Solicitud rechazada</div>
        <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginBottom: 16 }}>
          {perfil?.motivoRechazoFijos || "El profe rechazo tu solicitud. Podes elegir otros horarios."}
        </p>
        <button onClick={() => { setSel([]); setPaso("elegir"); }}
          style={{ background: "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "11px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          Elegir nuevos turnos
        </button>
      </div>
    );
  }

  // Sin turnos aun — pantalla inicial
  if (paso === "ver") {
    const descripcion = planId === "lv"
      ? "Elige 1 horario por dia de lunes a sabado. Esos seran tus turnos fijos cada semana."
      : "Tu plan incluye " + cantTurnos + " turno" + (cantTurnos !== 1 ? "s" : "") + " fijo" + (cantTurnos !== 1 ? "s" : "") + " por semana. Elegis los dias y horarios que van a quedar reservados cada semana.";

    return (
      <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "20px 16px" }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: "#111", marginBottom: 8 }}>Turnos fijos</div>
        <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6, marginBottom: 20 }}>{descripcion}</p>
        {ok && <p style={{ color: "#10b981", fontSize: 13, fontWeight: 500, marginBottom: 12 }}>✓ Solicitud enviada al profe</p>}
        <button onClick={() => { setSel([]); setPaso("elegir"); }}
          style={{ width: "100%", background: "#F5C400", color: "#111", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Elegir mis turnos fijos
        </button>
      </div>
    );
  }

  // Eligiendo turnos
  const horasDia = getHorasDia(diaActivo);
  const lleno = seleccionados.length >= cantTurnos;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#111" }}>Elegir turnos fijos</div>
          <div style={{ fontSize: 13, color: "#888" }}>
            {planId === "lv"
              ? "1 horario por dia · " + seleccionados.length + "/" + cantTurnos + " elegidos"
              : seleccionados.length + "/" + cantTurnos + " turno" + (cantTurnos !== 1 ? "s" : "") + " elegido" + (seleccionados.length !== 1 ? "s" : "")}
          </div>
        </div>
        <button onClick={() => setPaso("ver")}
          style={{ background: "transparent", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "7px 12px", fontSize: 13, color: "#888", cursor: "pointer" }}>
          Cancelar
        </button>
      </div>

      {/* Chips de seleccionados */}
      {seleccionados.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {seleccionados.map((s, i) => (
            <span key={i} onClick={() => toggle(s.dia, s.hora)}
              style={{ background: "#F5C400", color: "#111", fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 20, cursor: "pointer" }}>
              {(DIAS_FULL[s.dia] || s.dia).slice(0,3)} {s.hora} ✕
            </span>
          ))}
        </div>
      )}

      {/* Selector dias */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {DIAS.map(dia => {
          const activo = diaActivo === dia;
          const tieneEnDia = seleccionados.some(s => s.dia === dia);
          return (
            <button key={dia} onClick={() => setDiaActivo(dia)}
              style={{
                flexShrink: 0,
                background: activo ? "#111" : "#fff",
                color: activo ? "#fff" : "#555",
                border: "0.5px solid " + (activo ? "#111" : "#e0e0e0"),
                borderRadius: 10, padding: "8px 14px", cursor: "pointer",
                fontSize: 13, fontWeight: activo ? 500 : 400, position: "relative",
              }}>
              {(DIAS_FULL[dia] || dia).slice(0, 3)}
              {tieneEnDia && (
                <span style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: "#F5C400" }}/>
              )}
            </button>
          );
        })}
      </div>

      {/* Horarios */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
        {horasDia.map(hora => {
          const sel = seleccionado(diaActivo, hora);
          const bloqueado = lleno && !sel;
          return (
            <button key={hora} onClick={() => !bloqueado && toggle(diaActivo, hora)}
              disabled={bloqueado}
              style={{
                background: sel ? "#FFFBEA" : bloqueado ? "#f9f9f9" : "#fff",
                border: "1.5px solid " + (sel ? "#F5C400" : "#e0e0e0"),
                borderRadius: 10, padding: "14px 16px", cursor: bloqueado ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
              <span style={{ fontSize: 17, fontWeight: 500, color: bloqueado ? "#ccc" : "#111" }}>{hora}</span>
              <span style={{ fontSize: 20, color: sel ? "#F5C400" : bloqueado ? "#e0e0e0" : "#ccc" }}>
                {sel ? "✓" : "+"}
              </span>
            </button>
          );
        })}
      </div>

      <button onClick={solicitar}
        disabled={seleccionados.length !== cantTurnos || guardando}
        style={{
          width: "100%",
          background: seleccionados.length === cantTurnos ? "#F5C400" : "#e0e0e0",
          color: seleccionados.length === cantTurnos ? "#111" : "#aaa",
          border: "none", borderRadius: 10, padding: "14px",
          fontSize: 15, fontWeight: 700,
          cursor: seleccionados.length === cantTurnos ? "pointer" : "default",
        }}>
        {guardando ? "Enviando..." : "Solicitar turnos fijos →"}
      </button>
    </div>
  );
}
