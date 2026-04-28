import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  collection, query, where, onSnapshot, addDoc, deleteDoc,
  doc, getDocs, serverTimestamp
} from "firebase/firestore";
import LtHeader from "../../components/LtHeader";

const DIAS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
const DIAS_LABEL = { LUNES: "Lun", MARTES: "Mar", MIERCOLES: "Mié", JUEVES: "Jue", VIERNES: "Vie", SABADO: "Sáb" };

function getInicioSemana(offsetSemanas = 0) {
  const hoy = new Date();
  const dia = hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - (dia === 0 ? 6 : dia - 1) + offsetSemanas * 7);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}

function getFechasDeSemana(inicioSemana) {
  const fechas = {};
  DIAS.forEach((dia, i) => {
    const d = new Date(inicioSemana);
    d.setDate(inicioSemana.getDate() + i);
    fechas[dia] = d.toISOString().split("T")[0];
  });
  return fechas;
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

  const inicioSemana = getInicioSemana(semanaOffset);
  const fechas = getFechasDeSemana(inicioSemana);
  const hoy = new Date().toISOString().split("T")[0];

  // Feriados
  useEffect(() => {
    getDocs(collection(db, "feriados")).then(snap => {
      const f = {};
      snap.docs.forEach(d => { f[d.id] = true; });
      setFeriados(f);
    });
  }, []);

  // Reservas de la semana + las mías
  useEffect(() => {
    if (!user) return;
    const fechasArr = Object.values(fechas);
    const q = query(collection(db, "reservas"), where("fecha", "in", fechasArr));
    const unsub = onSnapshot(q, snap => {
      const map = {};
      const mias = {};
      snap.docs.forEach(d => {
        const r = d.data();
        const key = `${r.dia}_${r.hora.replace(":", "")}_${r.fecha}`;
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
    const key = `${dia}_${hora.replace(":", "")}_${fecha}`;
    if (procesando || misReservas[key]) return;

    // Verificar cancelación mínima 2hs antes
    const ahora = new Date();
    const [h, m] = hora.split(":").map(Number);
    const claseDate = new Date(fecha + "T" + hora);
    const diffMs = claseDate - ahora;
    if (diffMs < 2 * 60 * 60 * 1000 && diffMs > 0) {
      alert("Solo podés reservar hasta 2 horas antes de la clase.");
      return;
    }
    if (diffMs < 0) {
      alert("Esta clase ya pasó.");
      return;
    }

    setProcesando(key);
    try {
      await addDoc(collection(db, "reservas"), {
        alumnoId: user.uid,
        nombreAlumno: `${perfil.nombre} ${perfil.apellido}`,
        dia, hora, fecha,
        creadoEn: serverTimestamp(),
      });
    } finally {
      setProcesando(null);
    }
  }

  async function cancelar(dia, hora, fecha) {
    const key = `${dia}_${hora.replace(":", "")}_${fecha}`;
    const reservaId = misReservas[key];
    if (!reservaId || procesando) return;

    const ahora = new Date();
    const claseDate = new Date(fecha + "T" + hora);
    const diffMs = claseDate - ahora;
    if (diffMs < 2 * 60 * 60 * 1000) {
      alert("No podés cancelar con menos de 2 horas de anticipación.");
      return;
    }

    setProcesando(key);
    try {
      await deleteDoc(doc(db, "reservas", reservaId));
    } finally {
      setProcesando(null);
    }
  }

  const formatFecha = (iso) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}`;
  };

  const vence = perfil?.fechaVencimiento
    ? new Date(perfil.fechaVencimiento.toDate?.() || perfil.fechaVencimiento).toLocaleDateString("es-AR")
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f7" }}>
      <LtHeader rol="alumno" onLogout={() => signOut(auth).then(() => navigate("/login"))} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 48px" }}>

        {/* Info del plan */}
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, color: "#888" }}>Tu plan</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: "#111", marginTop: 2 }}>{perfil?.planNombre || "—"}</div>
          </div>
          {vence && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#888" }}>Vence</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#111", marginTop: 2 }}>{vence}</div>
            </div>
          )}
        </div>

        {/* Nav semana */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Reservar turno</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setSemanaOffset(o => o - 1)}
              style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>←</button>
            <span style={{ fontSize: 13, color: "#888", minWidth: 120, textAlign: "center" }}>
              {formatFecha(fechas["LUNES"])} — {formatFecha(fechas["SABADO"])}
            </span>
            <button onClick={() => setSemanaOffset(o => o + 1)}
              style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>→</button>
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
                <th style={{ width: 48, padding: "8px 4px", fontSize: 11, color: "#888", fontWeight: 400 }}>Hora</th>
                {DIAS.map(dia => {
                  const fecha = fechas[dia];
                  const esHoy = fecha === hoy;
                  const esFeriado = feriados[fecha];
                  return (
                    <th key={dia} style={{ padding: "6px 4px", minWidth: 70 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: esHoy ? "#F5C400" : "#555" }}>{DIAS_LABEL[dia]}</div>
                        <div style={{ fontSize: 12, color: esHoy ? "#F5C400" : "#aaa" }}>{formatFecha(fecha)}</div>
                        {esFeriado && <div style={{ fontSize: 9, color: "#dc2626", marginTop: 2 }}>Feriado</div>}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 16 }, (_, i) => i + 7).map(h => {
                const hora = `${String(h).padStart(2, "0")}:00`;
                return (
                  <tr key={hora}>
                    <td style={{ padding: "3px 4px", fontSize: 11, color: "#aaa", textAlign: "right" }}>{hora}</td>
                    {DIAS.map(dia => {
                      const [hIni, hFin] = dia === "SABADO" ? [8, 13] : [7, 22];
                      if (h < hIni || h > hFin) return <td key={dia} style={{ background: "#f0f0f0" }} />;

                      const fecha = fechas[dia];
                      if (feriados[fecha]) return <td key={dia} style={{ padding: 3 }}><div style={{ background: "#fee2e2", borderRadius: 6, height: 32 }} /></td>;

                      const key = `${dia}_${hora.replace(":", "")}_${fecha}`;
                      const ocupados = reservasPorSlot[key] || 0;
                      const cupo = 15;
                      const tengoReserva = !!misReservas[key];
                      const lleno = ocupados >= cupo && !tengoReserva;
                      const isPast = new Date(fecha + "T" + hora) < new Date();

                      return (
                        <td key={dia} style={{ padding: 3 }}>
                          <button
                            onClick={() => tengoReserva ? cancelar(dia, hora, fecha) : reservar(dia, hora, fecha)}
                            disabled={lleno || isPast || procesando === key}
                            title={tengoReserva ? "Cancelar reserva" : lleno ? "Sin lugares" : `Reservar — ${cupo - ocupados} lugares`}
                            style={{
                              width: "100%", height: 32, borderRadius: 6, border: tengoReserva ? "2px solid #F5C400" : "none",
                              cursor: lleno || isPast ? "default" : "pointer",
                              background: isPast ? "#f0f0f0" : tengoReserva ? "#FFFBEA" : lleno ? "#fde68a" : ocupados > 0 ? "#d1fae5" : "#f5f5f5",
                              display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 2, padding: "2px 3px"
                            }}>
                            {/* Puntos de cupo */}
                            {Array.from({ length: Math.min(cupo, 8) }, (_, i) => (
                              <span key={i} style={{
                                width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                                background: i < Math.min(ocupados, 8)
                                  ? (tengoReserva ? "#F5C400" : ocupados >= cupo ? "#f59e0b" : "#10b981")
                                  : "#d1d5db"
                              }} />
                            ))}
                            {cupo > 8 && <span style={{ fontSize: 8, color: "#888" }}>+{cupo - 8}</span>}
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
            { color: "#FFFBEA", border: "2px solid #F5C400", label: "Mi reserva" },
            { color: "#d1fae5", label: "Con lugares" },
            { color: "#fde68a", label: "Cupo lleno" },
            { color: "#f5f5f5", label: "Sin reservas" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: l.color, border: l.border || "0.5px solid #e0e0e0", display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "#888" }}>{l.label}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#aaa", marginTop: 8 }}>
          Podés reservar y cancelar hasta 2 horas antes de la clase.
        </p>
      </div>
    </div>
  );
}
