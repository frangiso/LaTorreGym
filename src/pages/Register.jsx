import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import LtLogo from "../components/LtLogo";

export default function Register() {
  const [form, setForm] = useState({
    nombre: "", apellido: "", email: "",
    telefono: "", password: "", confirm: ""
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

  const inputStyle = {
    width: "100%", padding: "10px 14px", background: "#111",
    border: "1px solid #333", borderRadius: 8, fontSize: 14,
    color: "#fff", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#111",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
    }}>
      <div style={{ marginBottom: 32 }}>
        <LtLogo size="lg" />
      </div>

      <div style={{
        background: "#1a1a1a", borderRadius: 16,
        border: "1px solid #2a2a2a", padding: "32px 28px",
        width: "100%", maxWidth: 420,
      }}>
        <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 500, margin: "0 0 6px", textAlign: "center" }}>
          Crear cuenta
        </h2>
        <p style={{ color: "#666", fontSize: 13, textAlign: "center", margin: "0 0 24px" }}>
          Registrate para reservar tus turnos
        </p>

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 5 }}>Nombre *</label>
              <input name="nombre" value={form.nombre} onChange={handleChange}
                required placeholder="Juan" style={inputStyle}
                onFocus={e => e.target.style.borderColor = "#F5C400"}
                onBlur={e => e.target.style.borderColor = "#333"} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 5 }}>Apellido *</label>
              <input name="apellido" value={form.apellido} onChange={handleChange}
                required placeholder="Perez" style={inputStyle}
                onFocus={e => e.target.style.borderColor = "#F5C400"}
                onBlur={e => e.target.style.borderColor = "#333"} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 5 }}>Email *</label>
            <input type="email" name="email" value={form.email} onChange={handleChange}
              required placeholder="tu@email.com" style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#F5C400"}
              onBlur={e => e.target.style.borderColor = "#333"} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 5 }}>Telefono</label>
            <input type="tel" name="telefono" value={form.telefono} onChange={handleChange}
              placeholder="2664XXXXXXX" style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#F5C400"}
              onBlur={e => e.target.style.borderColor = "#333"} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 5 }}>Contrasena *</label>
            <input type="password" name="password" value={form.password} onChange={handleChange}
              required placeholder="Minimo 6 caracteres" style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#F5C400"}
              onBlur={e => e.target.style.borderColor = "#333"} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 5 }}>Confirmar contrasena *</label>
            <input type="password" name="confirm" value={form.confirm} onChange={handleChange}
              required placeholder="Repeti la contrasena" style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#F5C400"}
              onBlur={e => e.target.style.borderColor = "#333"} />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: "#fc8181", background: "#2d1515", borderRadius: 6, padding: "8px 12px", margin: 0 }}>
              {error}
            </p>
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
          <Link to="/login" style={{ color: "#F5C400", textDecoration: "none", fontWeight: 500 }}>
            Inicia sesion
          </Link>
        </p>
      </div>
    </div>
  );
}
