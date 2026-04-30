import { useEffect, useState } from "react";
import { collection, addDoc, serverTimestamp, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { useData } from "../../context/DataContext";

export default function ModalAgregarAlumno({ onClose }) {
  const [form, setForm] = useState({
    nombre: "", apellido: "", telefono: "",
    telefonoEmergencia: "", nombreEmergencia: "",
    planId: "", metodoPago: "efectivo"
  });
  const { config } = useData();
  const planes = config?.planes || [];
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);


  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function guardar() {
    if (!form.nombre || !form.apellido) return;
    setGuardando(true);
    const plan = planes.find(p => p.id === form.planId);
    const vence = new Date();
    vence.setMonth(vence.getMonth() + 1);

    await addDoc(collection(db, "usuarios"), {
      nombre: form.nombre,
      apellido: form.apellido,
      telefono: form.telefono,
      telefonoEmergencia: form.telefonoEmergencia,
      nombreEmergencia: form.nombreEmergencia,
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
      setForm({ nombre: "", apellido: "", telefono: "", telefonoEmergencia: "", nombreEmergencia: "", planId: "", metodoPago: "efectivo" });
    }, 1500);
    setGuardando(false);
  }

  const inp = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "0.5px solid #e0e0e0", fontSize: 13,
    boxSizing: "border-box", outline: "none", background: "#fff",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 20px" }}>Agregar alumno</h3>

        {/* Datos personales */}
        <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>Datos personales</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Nombre *</label>
            <input name="nombre" value={form.nombre} onChange={handleChange} style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Apellido *</label>
            <input name="apellido" value={form.apellido} onChange={handleChange} style={inp} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Telefono del alumno</label>
          <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="2664XXXXXXX" style={inp} />
        </div>

        {/* Contacto de emergencia */}
        <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>Contacto de emergencia</p>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Nombre del contacto</label>
          <input name="nombreEmergencia" value={form.nombreEmergencia} onChange={handleChange} placeholder="Ej: Maria Perez (madre)" style={inp} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Telefono del contacto</label>
          <input name="telefonoEmergencia" value={form.telefonoEmergencia} onChange={handleChange} placeholder="2664XXXXXXX" style={inp} />
        </div>

        {/* Plan */}
        <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>Plan y pago</p>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Plan</label>
          <select name="planId" value={form.planId} onChange={handleChange} style={{ ...inp }}>
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
                    flex: 1, padding: "9px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                    fontWeight: form.metodoPago === m ? 500 : 400,
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

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={guardar} disabled={guardando || !form.nombre || !form.apellido}
            style={{
              flex: 1,
              background: ok ? "#10b981" : (!form.nombre || !form.apellido) ? "#e0e0e0" : "#F5C400",
              color: (!form.nombre || !form.apellido) ? "#aaa" : "#111",
              border: "none", borderRadius: 8, padding: "12px",
              fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}>
            {ok ? "Guardado" : guardando ? "Guardando..." : "Agregar alumno"}
          </button>
          <button onClick={onClose}
            style={{ background: "transparent", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#888", cursor: "pointer" }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
