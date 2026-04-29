import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";

export default function MiHistorial() {
  const { user } = useAuth();
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "reservas"),
      where("alumnoId", "==", user.uid),
      orderBy("fecha", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setReservas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCargando(false);
    });
    return () => unsub();
  }, [user]);

  const hoy = new Date().toISOString().split("T")[0];
  const pasadas = reservas.filter(r => r.fecha < hoy);
  const presentes = pasadas.filter(r => r.asistio === true).length;
  const ausentes  = pasadas.filter(r => r.asistio === false).length;
  const sinMarcar = pasadas.filter(r => r.asistio == null).length;
  const pct = pasadas.length > 0 ? Math.round((presentes / pasadas.length) * 100) : null;

  const DIAS_ES = { LUNES:"Lun", MARTES:"Mar", MIERCOLES:"Mie", JUEVES:"Jue", VIERNES:"Vie", SABADO:"Sab" };

  if (cargando) return <div style={{ padding: "32px 0", textAlign: "center", color: "#aaa" }}>Cargando historial...</div>;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 0 40px" }}>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 16px" }}>Mi historial</h2>

      {/* Stats */}
      {pasadas.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 500, color: "#10b981" }}>{presentes}</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Presentes</div>
          </div>
          <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 500, color: "#ef4444" }}>{ausentes}</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Ausentes</div>
          </div>
          <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 500, color: pct >= 70 ? "#10b981" : "#f59e0b" }}>{pct ?? "-"}%</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Asistencia</div>
          </div>
        </div>
      )}

      {reservas.length === 0 ? (
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "40px", textAlign: "center", color: "#aaa" }}>
          <p style={{ fontSize: 14 }}>Todavía no tenés reservas registradas.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {reservas.map(r => {
            const isPast = r.fecha < hoy;
            return (
              <div key={r.id} style={{
                background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12,
                padding: "12px 16px", display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: 12,
                opacity: isPast ? 1 : 0.7,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ textAlign: "center", minWidth: 40 }}>
                    <div style={{ fontSize: 11, color: "#aaa" }}>{DIAS_ES[r.dia] || r.dia}</div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "#111" }}>{r.hora}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: "#111" }}>{r.fecha}</div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>
                      {r.esFijo ? "Turno fijo" : r.esRecuperacion ? "Recuperación" : "Reserva"}
                    </div>
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20,
                  background: !isPast
                    ? "#f0f0f0"
                    : r.asistio === true
                      ? "#dcfce7"
                      : r.asistio === false
                        ? "#fee2e2"
                        : "#f5f5f5",
                  color: !isPast
                    ? "#888"
                    : r.asistio === true
                      ? "#065f46"
                      : r.asistio === false
                        ? "#991b1b"
                        : "#aaa",
                }}>
                  {!isPast ? "Próximo" : r.asistio === true ? "Presente" : r.asistio === false ? "Ausente" : "Sin marcar"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
