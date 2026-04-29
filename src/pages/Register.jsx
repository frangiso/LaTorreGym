import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import LtLogo from "../components/LtLogo";

export default function Register() {
  const [form, setForm] = useState({
    nombre: "", apellido: "", email: "", telefono: "",
    telefonoEmergencia: "", nombreEmergencia: "",
    password: "", confirm: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Las contrasenas no coinciden."); return; }
    if (form.password.length < 6) { setError("La contrasena debe tener al menos 6 caracteres."); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        telefono: form.telefono,
        telefonoEmergencia: form.telefonoEmergencia,
        nombreEmergencia: form.nombreEmergencia,
        rol: "alumno",
        estado: "pendiente",
        planId: null,
        planNombre: null,
        metodoPago: null,
        montoPagado: null,
        fechaSolicitud: null,
        fechaActivacion: null,
        fechaVencimiento: null,
        creadoEn: serverTimestamp(),
      });
      navigate("/instructivo");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") setError("Ese email ya esta registrado.");
      else if (err.code === "auth/invalid-email") setError("Email invalido.");
      else setError("Error al registrarse. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const inp = (extra = {}) => ({
    width: "100%", padding: "10px 14px", background: "#111",
    border: "1px solid #333", borderRadius: 8, fontSize: 14,
    color: "#fff", outline: "none", boxSizing: "border-box", ...extra
  });

  const lbl = { fontSize: 12, color: "#888", display: "block", marginBottom: 5 };

  function Field({ label, name, type = "text", placeholder }) {
    return (
      <div>
        <label style={lbl}>{label}</label>
        <input type={type} name={name} value={form[name]} onChange={handleChange}
          placeholder={placeholder} style={inp()}
          onFocus={e => e.target.style.borderColor = "#F5C400"}
          onBlur={e => e.target.style.borderColor = "#333"} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#111", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ marginBottom: 32 }}>
        <LtLogo size="lg" />
      </div>

      <div style={{ background: "#1a1a1a", borderRadius: 16, border: "1px solid #2a2a2a", padding: "32px 28px", width: "100%", maxWidth: 440 }}>
        <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 500, margin: "0 0 4px", textAlign: "center" }}>Crear cuenta</h2>
        <p style={{ color: "#555", fontSize: 13, textAlign: "center", margin: "0 0 24px" }}>Registrate para reservar tus turnos</p>

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Datos personales */}
          <p style={{ fontSize: 11, fontWeight: 500, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", margin: "4px 0 2px" }}>Datos personales</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Nombre *" name="nombre" placeholder="Juan" />
            <Field label="Apellido *" name="apellido" placeholder="Perez" />
          </div>
          <Field label="Email *" name="email" type="email" placeholder="tu@email.com" />
          <Field label="Telefono" name="telefono" placeholder="2664XXXXXXX" />

          {/* Contacto de emergencia */}
          <p style={{ fontSize: 11, fontWeight: 500, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", margin: "8px 0 2px" }}>Contacto de emergencia</p>
          <Field label="Nombre del contacto" name="nombreEmergencia" placeholder="Ej: Maria Perez (madre)" />
          <Field label="Telefono del contacto" name="telefonoEmergencia" placeholder="2664XXXXXXX" />

          {/* Contrasena */}
          <p style={{ fontSize: 11, fontWeight: 500, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", margin: "8px 0 2px" }}>Acceso</p>
          <Field label="Contrasena *" name="password" type="password" placeholder="Minimo 6 caracteres" />
          <Field label="Confirmar contrasena *" name="confirm" type="password" placeholder="Repeti la contrasena" />

          {error && (
            <p style={{ fontSize: 13, color: "#fc8181", background: "#2d1515", borderRadius: 6, padding: "8px 12px", margin: 0 }}>{error}</p>
          )}

          <button type="submit" disabled={loading}
            style={{
              width: "100%", background: loading ? "#c9a000" : "#F5C400",
              color: "#111", border: "none", borderRadius: 10,
              padding: "13px", fontSize: 15, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", marginTop: 4,
            }}>
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#555" }}>
          Ya tenes cuenta?{" "}
          <Link to="/login" style={{ color: "#F5C400", textDecoration: "none", fontWeight: 500 }}>Inicia sesion</Link>
        </p>
      </div>
    </div>
  );
}
