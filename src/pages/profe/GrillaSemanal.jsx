import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";

const DIAS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
const DIAS_LABEL = { LUNES: "Lun", MARTES: "Mar", MIERCOLES: "Mié", JUEVES: "Jue", VIERNES: "Vie", SABADO: "Sáb" };

function getHoras(dia) {
  const horas = [];
  const [ini, fin] = dia === "SABADO" ? [8, 13] : [7, 22];
  for (let h = ini; h <= fin; h++) horas.push(`${String(h).padStart(2, "0")}:00`);
  return horas;
}

// Obtiene el lunes de la semana del offset dado (0 = esta semana)
function getInicioSemana(offsetSemanas = 0) {
  const hoy = new Date();
  const dia = hoy.getDay(); // 0=dom
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dia === 0 ? 6 : dia - 1) + offsetSemanas * 7);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}

function getFechasDeSemana(inicioSemana) {
  // Devuelve fechas ISO para LUNES a SABADO
  const fechas = {};
  DIAS.forEach((dia, i) => {
    const d = new Date(inicioSemana);
    d.setDate(inicioSemana.getDate() + i);
    fechas[dia] = d.toISOString().split("T")[0];
  });
  return fechas;
}

export default function GrillaSemanal() {
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [reservasPorSlot, setReservasPorSlot] = useState({}); // { "LUNES_0700_2024-12-02": [...alumnos] }
  const [feriados, setFeriados] = useState({}); // { "2024-12-02": true }
  const [slots, setSlots] = useState([]); // config de slots desde Firestore
  const [modalSlot, setModalSlot] = useState(null); // slot abierto
  const [cargando, setCargando] = useState(true);

  const inicioSemana = getInicioSemana(semanaOffset);
  const fechas = getFechasDeSemana(inicioSemana);

  // Cargar slots config
  useEffect(() => {
    getDocs(collection(db, "slots")).then(snap => {
      setSlots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Cargar feriados
  useEffect(() => {
    getDocs(collection(db, "feriados")).then(snap => {
      const f = {};
      snap.docs.forEach(d => { f[d.id] = true; });
      setFeriados(f);
    });
  }, []);

  // Cargar reservas de la semana en tiempo real
  useEffect(() => {
    if (!slots.length) return;
    const fechasArr = Object.values(fechas);
    const q = query(collection(db, "reservas"), where("fecha", "in", fechasArr));
    const unsub = onSnapshot(q, snap => {
      const map = {};
      snap.docs.forEach(d => {
        const r = d.data();
        const key = `${r.dia}_${r.hora.replace(":", "")}_${r.fecha}`;
        if (!map[key]) map[key] = [];
        map[key].push({ id: d.id, ...r });
      });
      setReservasPorSlot(map);
      setCargando(false);
    });
    return () => unsub();
  }, [semanaOffset, slots.length]);

  async function toggleFeriado(fecha) {
    if (feriados[fecha]) {
      await deleteDoc(doc(db, "feriados", fecha));
      setFeriados(f => { const n = { ...f }; delete n[fecha]; return n; });
    } else {
      await setDoc(doc(db, "feriados", fecha), { fecha, creadoEn: new Date() });
      setFeriados(f => ({ ...f, [fecha]: true }));
    }
  }

  const formatFecha = (iso) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}`;
  };

  const hoy = new Date().toISOString().split("T")[0];

  return (
    <div>
      {/* Header semana */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Grilla semanal</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setSemanaOffset(o => o - 1)}
            style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 14 }}>←</button>
          <span style={{ fontSize: 13, color: "#888", minWidth: 120, textAlign: "center" }}>
            {formatFecha(fechas["LUNES"])} — {formatFecha(fechas["SABADO"])}
          </span>
          <button onClick={() => setSemanaOffset(o => o + 1)}
            style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 14 }}>→</button>
          <button onClick={() => setSemanaOffset(0)}
            style={{ background: "#F5C400", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            Hoy
          </button>
        </div>
      </div>

      {/* Grilla */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{ width: 52, padding: "8px 4px", fontSize: 11, color: "#888", fontWeight: 400 }}>Hora</th>
              {DIAS.map(dia => {
                const fecha = fechas[dia];
                const esFeriado = feriados[fecha];
                const esHoy = fecha === hoy;
                return (
                  <th key={dia} style={{ padding: "6px 4px", minWidth: 80 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: esHoy ? "#F5C400" : "#555" }}>
                        {DIAS_LABEL[dia]}
                      </span>
                      <span style={{ fontSize: 12, color: esHoy ? "#F5C400" : "#aaa" }}>{formatFecha(fecha)}</span>
                      <button
                        onClick={() => toggleFeriado(fecha)}
                        title={esFeriado ? "Quitar feriado" : "Marcar feriado"}
                        style={{
                          background: esFeriado ? "#fee2e2" : "transparent",
                          border: "0.5px solid " + (esFeriado ? "#fca5a5" : "#e0e0e0"),
                          borderRadius: 4, padding: "1px 6px", fontSize: 10,
                          color: esFeriado ? "#dc2626" : "#bbb", cursor: "pointer"
                        }}>
                        {esFeriado ? "Feriado ✕" : "+ Feriado"}
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Mostrar todas las horas desde 7 a 22, para SABADO desde 8 a 13 */}
            {Array.from({ length: 16 }, (_, i) => i + 7).map(h => {
              const hora = `${String(h).padStart(2, "0")}:00`;
              return (
                <tr key={hora}>
                  <td style={{ padding: "3px 4px", fontSize: 11, color: "#aaa", textAlign: "right", whiteSpace: "nowrap" }}>
                    {hora}
                  </td>
                  {DIAS.map(dia => {
                    const [hIni, hFin] = dia === "SABADO" ? [8, 13] : [7, 22];
                    if (h < hIni || h > hFin) {
                      return <td key={dia} style={{ background: "#f0f0f0" }} />;
                    }
                    const fecha = fechas[dia];
                    const esFeriado = feriados[fecha];
                    const slotKey = `${dia}_${hora.replace(":", "")}_${fecha}`;
                    const reservas = reservasPorSlot[slotKey] || [];
                    const cupo = 15;
                    const ocupados = reservas.length;
                    const libre = cupo - ocupados;

                    if (esFeriado) {
                      return (
                        <td key={dia} style={{ padding: 3 }}>
                          <div style={{ background: "#fee2e2", borderRadius: 6, height: 32 }} />
                        </td>
                      );
                    }

                    return (
                      <td key={dia} style={{ padding: 3 }}>
                        <button
                          onClick={() => setModalSlot({ dia, hora, fecha, reservas, cupo })}
                          style={{
                            width: "100%", height: 32, borderRadius: 6, border: "none", cursor: "pointer",
                            background: ocupados === 0 ? "#f5f5f5" : ocupados >= cupo ? "#fde68a" : "#d1fae5",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                            fontSize: 11, color: ocupados >= cupo ? "#92400e" : "#065f46"
                          }}>
                          {/* Puntos estilo Anima */}
                          {Array.from({ length: cupo }, (_, i) => (
                            <span key={i} style={{
                              width: 6, height: 6, borderRadius: "50%",
                              background: i < ocupados ? (ocupados >= cupo ? "#f59e0b" : "#10b981") : "#d1d5db",
                              flexShrink: 0
                            }} />
                          )).slice(0, Math.min(cupo, 10))}
                          {cupo > 10 && <span style={{ fontSize: 9, color: "#888" }}>+{cupo - 10}</span>}
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
      <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
        {[
          { color: "#d1fae5", label: "Con reservas" },
          { color: "#fde68a", label: "Cupo lleno" },
          { color: "#f5f5f5", label: "Sin reservas" },
          { color: "#fee2e2", label: "Feriado" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: l.color, display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "#888" }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Modal slot */}
      {modalSlot && (
        <ModalSlot slot={modalSlot} onClose={() => setModalSlot(null)} />
      )}
    </div>
  );
}

function ModalSlot({ slot, onClose }) {
  const { dia, hora, fecha, reservas, cupo } = slot;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "24px", maxWidth: 400, width: "90%",
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)"
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 2px" }}>{dia} {hora}</h3>
            <p style={{ fontSize: 13, color: "#888", margin: 0 }}>{fecha}</p>
          </div>
          <span style={{
            background: reservas.length >= cupo ? "#fde68a" : "#d1fae5",
            color: reservas.length >= cupo ? "#92400e" : "#065f46",
            fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 20
          }}>
            {reservas.length}/{cupo} lugares
          </span>
        </div>
        {reservas.length === 0 ? (
          <p style={{ color: "#aaa", fontSize: 14, textAlign: "center", padding: "16px 0" }}>Sin reservas para este turno.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {reservas.map((r, i) => (
              <li key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#f5f5f5", borderRadius: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", background: "#F5C400",
                  color: "#111", fontSize: 11, fontWeight: 500,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                }}>
                  {(r.nombreAlumno || "?").charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 13, color: "#111" }}>{r.nombreAlumno || r.alumnoId}</span>
              </li>
            ))}
          </ul>
        )}
        <button onClick={onClose} style={{
          width: "100%", marginTop: 16, background: "#111", color: "#fff",
          border: "none", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer"
        }}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
