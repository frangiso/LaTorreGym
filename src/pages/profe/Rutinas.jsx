import { useEffect, useState } from "react";
import {
  collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, orderBy, getDoc
} from "firebase/firestore";
import { db } from "../../firebase";
import { useData } from "../../context/DataContext";

export default function Rutinas() {
  const { alumnos: todosAlumnos }     = useData();
  const alumnos = todosAlumnos.filter(a => a.estado === "activo");
  const [alumnoSel, setAlumnoSel]     = useState(null);
  const [rutinas, setRutinas]         = useState([]);
  const [cargando, setCargando]       = useState(false);
  const [form, setForm]               = useState({ titulo: "", descripcion: "", videoUrl: "" });
  const [editandoId, setEditandoId]   = useState(null);
  const [guardando, setGuardando]     = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);

  // Cargar alumnos activos
  // Cargar rutinas del alumno seleccionado
  useEffect(() => {
    if (!alumnoSel) { setRutinas([]); return; }
    setCargando(true);
    const q = query(
      collection(db, "rutinas"),
      where("alumnoId", "==", alumnoSel.uid),
      orderBy("creadoEn", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setRutinas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCargando(false);
    });
    return () => unsub();
  }, [alumnoSel]);

  async function guardarRutina() {
    if (!form.titulo || !alumnoSel) return;
    setGuardando(true);
    if (editandoId) {
      await updateDoc(doc(db, "rutinas", editandoId), {
        titulo:      form.titulo,
        descripcion: form.descripcion,
        videoUrl:    form.videoUrl,
      });
      setEditandoId(null);
    } else {
      await addDoc(collection(db, "rutinas"), {
        alumnoId:        alumnoSel.uid,
        nombreAlumno:    alumnoSel.nombre + " " + alumnoSel.apellido,
        titulo:          form.titulo,
        descripcion:     form.descripcion,
        videoUrl:        form.videoUrl,
        creadoEn:        serverTimestamp(),
      });
    }
    setForm({ titulo: "", descripcion: "", videoUrl: "" });
    setMostrarForm(false);
    setGuardando(false);
  }

  function editarRutina(r) {
    setForm({ titulo: r.titulo, descripcion: r.descripcion || "", videoUrl: r.videoUrl || "" });
    setEditandoId(r.id);
    setMostrarForm(true);
  }

  async function eliminarRutina(id) {
    if (!confirm("Eliminar esta rutina?")) return;
    await deleteDoc(doc(db, "rutinas", id));
  }

  function cancelarForm() {
    setForm({ titulo: "", descripcion: "", videoUrl: "" });
    setEditandoId(null);
    setMostrarForm(false);
  }

  const inp = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "0.5px solid #e0e0e0", fontSize: 13,
    boxSizing: "border-box", outline: "none", background: "#fff",
  };

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 20px" }}>Rutinas</h2>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20, alignItems: "start" }}>

        {/* Panel izq: lista de alumnos */}
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "0.5px solid #f0f0f0" }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>Alumnos activos</p>
          </div>
          {alumnos.length === 0 ? (
            <p style={{ color: "#aaa", fontSize: 13, padding: "16px 14px" }}>Sin alumnos activos.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {alumnos.map(a => (
                <button key={a.uid} onClick={() => { setAlumnoSel(a); setMostrarForm(false); cancelarForm(); }}
                  style={{
                    background: alumnoSel?.uid === a.uid ? "#FFF8DC" : "transparent",
                    border: "none", borderBottom: "0.5px solid #f5f5f5",
                    padding: "10px 14px", textAlign: "left", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 10,
                    borderLeft: alumnoSel?.uid === a.uid ? "3px solid #F5C400" : "3px solid transparent",
                  }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#F5C400", color: "#111", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {(a.nombre || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{a.nombre} {a.apellido}</div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>{a.planNombre || "Sin plan"}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Panel der: rutinas del alumno */}
        <div>
          {!alumnoSel ? (
            <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "48px 24px", textAlign: "center", color: "#aaa" }}>
              <p style={{ fontSize: 14 }}>Selecciona un alumno para ver o agregar sus rutinas.</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 2px" }}>{alumnoSel.nombre} {alumnoSel.apellido}</h3>
                  <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{rutinas.length} rutina{rutinas.length !== 1 ? "s" : ""} cargada{rutinas.length !== 1 ? "s" : ""}</p>
                </div>
                {!mostrarForm && (
                  <button onClick={() => setMostrarForm(true)}
                    style={{ background: "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                    + Nueva rutina
                  </button>
                )}
              </div>

              {/* Formulario nueva / editar rutina */}
              {mostrarForm && (
                <div style={{ background: "#fff", border: "2px solid #F5C400", borderRadius: 12, padding: "20px", marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#111", margin: "0 0 14px" }}>
                    {editandoId ? "Editar rutina" : "Nueva rutina"}
                  </p>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Titulo *</label>
                    <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                      placeholder="Ej: Rutina tren superior semana 1" style={inp} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Descripcion / ejercicios</label>
                    <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                      placeholder={"Ej:\n- Sentadilla 4x12\n- Press banca 3x10\n- Remo 3x12"}
                      rows={6}
                      style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Link de video (YouTube, opcional)</label>
                    <input value={form.videoUrl} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))}
                      placeholder="https://youtube.com/watch?v=..." style={inp} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={guardarRutina} disabled={!form.titulo || guardando}
                      style={{ background: "#F5C400", color: "#111", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                      {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Agregar rutina"}
                    </button>
                    <button onClick={cancelarForm}
                      style={{ background: "transparent", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "#888", cursor: "pointer" }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de rutinas */}
              {cargando ? (
                <p style={{ color: "#aaa", fontSize: 13 }}>Cargando...</p>
              ) : rutinas.length === 0 ? (
                <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "32px 24px", textAlign: "center", color: "#aaa" }}>
                  <p style={{ fontSize: 13 }}>Este alumno no tiene rutinas cargadas aun.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {rutinas.map(r => (
                    <div key={r.id} style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "16px 18px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: r.descripcion ? 10 : 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{r.titulo}</div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => editarRutina(r)}
                            style={{ background: "#f5f5f5", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "#555", cursor: "pointer" }}>
                            Editar
                          </button>
                          <button onClick={() => eliminarRutina(r.id)}
                            style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "#dc2626", cursor: "pointer" }}>
                            Eliminar
                          </button>
                        </div>
                      </div>
                      {r.descripcion && (
                        <pre style={{ fontSize: 13, color: "#555", margin: "0 0 10px", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6 }}>
                          {r.descripcion}
                        </pre>
                      )}
                      {r.videoUrl && (
                        <a href={r.videoUrl} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, color: "#185FA5", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          Ver video →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
