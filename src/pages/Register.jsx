import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import LtLayout from "../components/LtLayout";

export default function Register() {
  const [form, setForm] = useState({ nombre: "", apellido: "", email: "", telefono: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Las contraseñas no coinciden."); return; }
    if (form.password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        telefono: form.telefono,
        rol: "alumno",
        estado: "pendiente",
        planId: null,
        planNombre: null,
        metodoPago: null,
        fechaSolicitud: null,
        fechaActivacion: null,
        fechaVencimiento: null,
        creadoEn: serverTimestamp(),
      });
      navigate("/instructivo");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") setError("Ese email ya está registrado.");
      else setError("Error al registrarse. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LtLayout centrado>
      <div className="lt-card" style={{ maxWidth: 420, width: "100%", margin: "0 auto" }}>
        <h2 className="lt-heading">Crear cuenta</h2>
        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label className="lt-label">Nombre</label>
              <input className="lt-input" name="nombre" value={form.nombre}
                onChange={handleChange} required placeholder="Juan" />
            </div>
            <div>
              <label className="lt-label">Apellido</label>
              <input className="lt-input" name="apellido" value={form.apellido}
                onChange={handleChange} required placeholder="Pérez" />
            </div>
          </div>
          <div>
            <label className="lt-label">Email</label>
            <input className="lt-input" type="email" name="email" value={form.email}
              onChange={handleChange} required placeholder="tu@email.com" />
          </div>
          <div>
            <label className="lt-label">Teléfono</label>
            <input className="lt-input" type="tel" name="telefono" value={form.telefono}
              onChange={handleChange} placeholder="2664XXXXXXX" />
          </div>
          <div>
            <label className="lt-label">Contraseña</label>
            <input className="lt-input" type="password" name="password" value={form.password}
              onChange={handleChange} required placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label className="lt-label">Confirmar contraseña</label>
            <input className="lt-input" type="password" name="confirm" value={form.confirm}
              onChange={handleChange} required placeholder="Repetí la contraseña" />
          </div>
          {error && <p className="lt-error">{error}</p>}
          <button className="lt-btn-primary" type="submit" disabled={loading}>
            {loading ? "Registrando..." : "Crear cuenta"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#888" }}>
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" style={{ color: "#F5C400", textDecoration: "none" }}>
            Iniciá sesión
          </Link>
        </p>
      </div>
    </LtLayout>
  );
}
