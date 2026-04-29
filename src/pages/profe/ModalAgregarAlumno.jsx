import { useEffect, useState } from "react";
import { collection, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

export default function ModalAgregarAlumno({ onClose }) {
  const [form, setForm] = useState({ nombre: "", apellido: "", telefono: "", planId: "", metodoPago: "efectivo" });
  const [planes, setPlanes] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "config", "gimnasio")).then(snap => {
      if (snap.exists()) setPlanes(snap.data().planes || []);
    });
  }, []);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function guardar() {
    if (!form.nombre || !form.apellido) return;
    setGuardando(true);
    const plan = planes.find(p => p.id === form.planId);
    const vence = new Date();
    vence.setMonth(vence.getMonth() + 1);
    vence.setDate(5);

    await addDoc(collection(db, "usuarios"), {
      nombre: form.nombre,
      apellido: form.apellido,
      telefono: form.telefono,
      email: "",
      rol: "alumno",
      estado: form.planId ? "activo" : "pendiente",
      planId: form.planId || null,
      planNombre: plan ? plan.nombre : null,
      metodoPago: form.metodoPago,
      montoPagado: plan ? (form.metodoPago === "transferencia" ? plan.precioTransferencia : plan.precioEfectivo) : null,
      fechaActivacion: form.planId ? serverTimestamp() : null,
      fechaVencimiento: form.planId ? vence : null,
      creadoEn: serverTimestamp(),
      creadoPorProfe: true,
    });

    setOk(true);
    setTimeout(() => {
      setOk(false);
      setForm({ nombre: "", apellido: "", telefono: "", planId: "", metodoPago: "efectivo" });
    }, 1500);
    setGuardando(false);
  }

  const inputStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "0.5px solid #e0e0e0", fontSize: 13,
    boxSizing: "border-box", outline: "none",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "28px 24px",
        width: "90%", maxWidth: 440
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 20px" }}>Agregar alumno</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Nombre *</label>
            <input name="nombre" value={form.nombre} onChange={handleChange} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Apellido *</label>
            <input name="apellido" value={form.apellido} onChange={handleChange} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Telefono</label>
          <input name="telefono" value={form.telefono} onChange={handleChange}
            placeholder="2664XXXXXXX" style={inputStyle} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Plan (opcional)</label>
          <select name="planId" value={form.planId} onChange={handleChange}
            style={{ ...inputStyle, background: "#fff" }}>
            <option value="">Sin plan asignado</option>
            {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>

        {form.planId && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Metodo de pago</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["transferencia", "efectivo"].map(m => (
                <button key={m} onClick={() => setForm(f => ({ ...f, metodoPago: m }))}
                  style={{
                    flex: 1, padding: "8px", borderRadius: 8, fontSize: 12,
                    cursor: "pointer", fontWeight: form.metodoPago === m ? 500 : 400,
                    background: form.metodoPago === m ? "#F5C400" : "transparent",
                    border: form.metodoPago === m ? "none" : "0.5px solid #e0e0e0",
                    color: form.metodoPago === m ? "#111" : "#555",
                  }}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={guardar} disabled={guardando || !form.nombre || !form.apellido}
            style={{
              flex: 1,
              background: ok ? "#10b981" : (!form.nombre || !form.apellido) ? "#e0e0e0" : "#F5C400",
              color: (!form.nombre || !form.apellido) ? "#aaa" : "#111",
              border: "none", borderRadius: 8, padding: "11px",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}>
            {ok ? "Guardado" : guardando ? "Guardando..." : "Agregar alumno"}
          </button>
          <button onClick={onClose}
            style={{
              background: "transparent", border: "0.5px solid #e0e0e0",
              borderRadius: 8, padding: "11px 16px", fontSize: 13,
              color: "#888", cursor: "pointer",
            }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
