import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";

export default function MisRutinas() {
  const { user } = useAuth();
  const [rutinas, setRutinas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "rutinas"),
      where("alumnoId", "==", user.uid),
    );
    const unsub = onSnapshot(q, snap => {
      setRutinas(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.creadoEn?.seconds||0) - (a.creadoEn?.seconds||0)));
      setCargando(false);
    });
    return () => unsub();
  }, [user]);

  if (cargando) return (
    <div style={{ padding: "48px 16px", textAlign: "center", color: "#aaa" }}>Cargando rutinas...</div>
  );

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px 48px" }}>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 6px" }}>Mis rutinas</h2>
      <p style={{ fontSize: 13, color: "#888", margin: "0 0 24px" }}>Rutinas cargadas por tu profe.</p>

      {rutinas.length === 0 ? (
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "#aaa" }}>Tu profe aun no cargo rutinas para vos.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rutinas.map(r => (
            <div key={r.id} style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#111", marginBottom: 10 }}>{r.titulo}</div>
              {r.descripcion && (
                <pre style={{ fontSize: 13, color: "#444", margin: "0 0 12px", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.7, background: "#f9f9f9", borderRadius: 8, padding: "12px 14px" }}>
                  {r.descripcion}
                </pre>
              )}
              {r.videoUrl && (
                <a href={r.videoUrl} target="_blank" rel="noreferrer"
                  style={{ background: "#111", color: "#F5C400", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  Ver video de la rutina →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
