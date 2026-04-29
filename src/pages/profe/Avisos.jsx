import { useEffect, useState } from "react";
import {
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc,
  serverTimestamp, query
} from "firebase/firestore";
import { db } from "../../firebase";

export default function Avisos() {
  const [avisos, setAvisos]       = useState([]);
  const [texto, setTexto]         = useState("");
  const [tipo, setTipo]           = useState("info"); // info | alerta | urgente
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "avisos"));
    const unsub = onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((a,b) => (b.creadoEn?.seconds||0) - (a.creadoEn?.seconds||0));
      setAvisos(lista);
    });
    return () => unsub();
  }, []);

  async function publicar() {
    if (!texto.trim()) return;
    setGuardando(true);
    await addDoc(collection(db, "avisos"), {
      texto:     texto.trim(),
      tipo,
      activo:    true,
      creadoEn:  serverTimestamp(),
    });
    setTexto("");
    setGuardando(false);
  }

  async function toggleActivo(aviso) {
    await updateDoc(doc(db, "avisos", aviso.id), { activo: !aviso.activo });
  }

  async function eliminar(id) {
    if (!confirm("Eliminar este aviso?")) return;
    await deleteDoc(doc(db, "avisos", id));
  }

  const TIPOS = {
    info:    { label: "Información", bg: "#dbeafe", color: "#1e40af", borde: "#93c5fd" },
    alerta:  { label: "Alerta",      bg: "#fef3c7", color: "#92400e", borde: "#fcd34d" },
    urgente: { label: "Urgente",     bg: "#fee2e2", color: "#991b1b", borde: "#fca5a5" },
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 20px" }}>Avisos para alumnos</h2>

      {/* Nuevo aviso */}
      <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "20px", marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "#111", margin: "0 0 12px" }}>Nuevo aviso</p>

        {/* Tipo */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {Object.entries(TIPOS).map(([k, v]) => (
            <button key={k} onClick={() => setTipo(k)}
              style={{
                background: tipo === k ? v.bg : "#f5f5f5",
                color:      tipo === k ? v.color : "#888",
                border:     tipo === k ? "1.5px solid " + v.borde : "1px solid #e0e0e0",
                borderRadius: 8, padding: "6px 14px", fontSize: 12,
                fontWeight: tipo === k ? 500 : 400, cursor: "pointer",
              }}>
              {v.label}
            </button>
          ))}
        </div>

        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escribí el aviso para tus alumnos... Ej: Mañana no hay clases por feriado."
          rows={3}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "0.5px solid #e0e0e0", fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
        />

        <button onClick={publicar} disabled={!texto.trim() || guardando}
          style={{
            marginTop: 10, background: texto.trim() ? "#F5C400" : "#e0e0e0",
            color: texto.trim() ? "#111" : "#aaa",
            border: "none", borderRadius: 8, padding: "10px 24px",
            fontSize: 13, fontWeight: 500, cursor: texto.trim() ? "pointer" : "default",
          }}>
          {guardando ? "Publicando..." : "Publicar aviso"}
        </button>
      </div>

      {/* Lista de avisos */}
      <h3 style={{ fontSize: 14, fontWeight: 500, color: "#888", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Avisos publicados ({avisos.length})
      </h3>

      {avisos.length === 0 ? (
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "32px", textAlign: "center", color: "#aaa" }}>
          <p style={{ fontSize: 13 }}>No hay avisos publicados.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {avisos.map(a => {
            const t = TIPOS[a.tipo] || TIPOS.info;
            return (
              <div key={a.id} style={{
                background: a.activo ? t.bg : "#f9f9f9",
                border: "1px solid " + (a.activo ? t.borde : "#e0e0e0"),
                borderRadius: 12, padding: "14px 16px",
                opacity: a.activo ? 1 : 0.6,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <span style={{ background: t.bg, color: t.color, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, border: "1px solid " + t.borde }}>
                        {t.label}
                      </span>
                      {!a.activo && <span style={{ fontSize: 11, color: "#aaa" }}>Inactivo</span>}
                      <span style={{ fontSize: 11, color: "#aaa" }}>
                        {a.creadoEn?.toDate?.()?.toLocaleDateString("es-AR") || ""}
                      </span>
                    </div>
                    <p style={{ fontSize: 14, color: a.activo ? "#111" : "#888", margin: 0, lineHeight: 1.5 }}>{a.texto}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => toggleActivo(a)}
                      style={{ background: a.activo ? "#f5f5f5" : "#dcfce7", color: a.activo ? "#888" : "#065f46", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>
                      {a.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button onClick={() => eliminar(a.id)}
                      style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
