import { useState } from "react";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, setDoc, serverTimestamp, getDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import LtLogo from "../components/LtLogo";

// Field FUERA del componente para que React no lo desmonte en cada render
function Field({ label, name, type, placeholder, value, onChange }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 5 }}>{label}</label>
      <input
        type={type || "text"}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={type === "password" ? "new-password" : "off"}
        style={{
          width: "100%", padding: "12px 14px", background: "#111",
          border: "1px solid #333", borderRadius: 8, fontSize: 16,
          color: "#fff", outline: "none", boxSizing: "border-box",
          WebkitAppearance: "none",
        }}
        onFocus={e => e.target.style.borderColor = "#F5C400"}
        onBlur={e => e.target.style.borderColor = "#333"}
      />
    </div>
  );
}

export default function Register() {
  const [emailLiberado, setEmailLiberado] = useState(false);
  const [form, setForm] = useState({
    nombre: "", apellido: "", email: "", telefono: "",
    telefonoEmergencia: "", nombreEmergencia: "",
    password: "", confirm: ""
  });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    if (!form.nombre.trim())             { setError("El nombre es obligatorio."); return; }
    if (!form.apellido.trim())            { setError("El apellido es obligatorio."); return; }
    if (!form.telefono.trim())            { setError("El teléfono es obligatorio."); return; }
    if (!form.nombreEmergencia.trim())    { setError("El nombre del contacto de emergencia es obligatorio."); return; }
    if (!form.telefonoEmergencia.trim())  { setError("El teléfono del contacto de emergencia es obligatorio."); return; }
    if (form.password !== form.confirm)   { setError("Las contraseñas no coinciden."); return; }
    if (form.password.length < 6)        { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    setLoading(true);
    try {
      // Verificar si el email fue liberado (alumno dado de baja)
      const emailKey = form.email.trim().toLowerCase().replace(/\./g, "_");
      const liberadoRef = doc(db, "emailsLiberados", emailKey);
      const liberadoSnap = await getDoc(liberadoRef);

      if (liberadoSnap.exists()) {
        // Email liberado — mandar reset de contraseña y crear nuevo perfil al iniciar sesión
        await sendPasswordResetEmail(auth, form.email.trim());
        // Guardar los datos del formulario temporalmente para cuando inicie sesión
        await setDoc(doc(db, "emailsLiberados", emailKey), {
          ...liberadoSnap.data(),
          pendienteRegistro: {
            nombre: form.nombre.trim(),
            apellido: form.apellido.trim(),
            telefono: form.telefono.trim(),
            nombreEmergencia: form.nombreEmergencia.trim(),
            telefonoEmergencia: form.telefonoEmergencia.trim(),
          }
        });
        setLoading(false);
        setError("");
        // Mostrar mensaje especial
        setEmailLiberado(true);
        return;
      }

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
        planId: null, planNombre: null,
        metodoPago: null, montoPagado: null,
        fechaSolicitud: null, fechaActivacion: null, fechaVencimiento: null,
        creadoEn: serverTimestamp(),
      });
      navigate("/instructivo");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") setError("Ese email ya está registrado.");
      else if (err.code === "auth/invalid-email") setError("Email inválido.");
      else setError("Error al registrarse. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (emailLiberado) return (
    <div style={{ minHeight: "100vh", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#1a1a1a", borderRadius: 16, padding: 32, maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📧</div>
        <h2 style={{ color: "#F5C400", fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Revisá tu email</h2>
        <p style={{ color: "#ccc", fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
          Tu email ya estaba registrado en el sistema. Te enviamos un link para que elijas una nueva contraseña.
        </p>
        <p style={{ color: "#888", fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
          Una vez que cambies la contraseña, iniciá sesión normalmente y tu cuenta quedará activa.
        </p>
        <a href="/login" style={{ background: "#F5C400", color: "#111", borderRadius: 10, padding: "12px 28px",
          fontSize: 14, fontWeight: 600, textDecoration: "none", display: "inline-block" }}>
          Ir al login
        </a>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#111", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ marginBottom: 32 }}>
        <LtLogo size="lg" />
      </div>

      <div style={{ background: "#1a1a1a", borderRadius: 16, border: "1px solid #2a2a2a", padding: "32px 20px", width: "100%", maxWidth: 440 }}>
        <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 500, margin: "0 0 4px", textAlign: "center" }}>Crear cuenta</h2>
        <p style={{ color: "#555", fontSize: 13, textAlign: "center", margin: "0 0 24px" }}>Registrate para reservar tus turnos</p>

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          <p style={{ fontSize: 11, fontWeight: 500, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", margin: "4px 0 2px" }}>Datos personales</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Nombre *"   name="nombre"   value={form.nombre}   onChange={handleChange} placeholder="Juan" />
            <Field label="Apellido *" name="apellido" value={form.apellido} onChange={handleChange} placeholder="Pérez" />
          </div>
          <Field label="Email *"   name="email"    type="email" value={form.email}    onChange={handleChange} placeholder="tu@email.com" />
          <Field label="Teléfono *" name="telefono" type="tel"   value={form.telefono} onChange={handleChange} placeholder="2664XXXXXXX" />

          <p style={{ fontSize: 11, fontWeight: 500, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", margin: "8px 0 2px" }}>Contacto de emergencia</p>
          <Field label="Nombre del contacto *"    name="nombreEmergencia"    value={form.nombreEmergencia}    onChange={handleChange} placeholder="Ej: María Pérez (madre)" />
          <Field label="Teléfono del contacto *"  name="telefonoEmergencia"  type="tel" value={form.telefonoEmergencia}  onChange={handleChange} placeholder="2664XXXXXXX" />

          <p style={{ fontSize: 11, fontWeight: 500, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", margin: "8px 0 2px" }}>Acceso</p>
          <Field label="Contraseña *"         name="password" type="password" value={form.password} onChange={handleChange} placeholder="Mínimo 6 caracteres" />
          <Field label="Confirmar contraseña *" name="confirm"  type="password" value={form.confirm}  onChange={handleChange} placeholder="Repetí la contraseña" />

          {error && (
            <p style={{ fontSize: 13, color: "#fc8181", background: "#2d1515", borderRadius: 6, padding: "8px 12px", margin: 0 }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}
            style={{
              width: "100%", background: loading ? "#c9a000" : "#F5C400",
              color: "#111", border: "none", borderRadius: 10,
              padding: "14px", fontSize: 16, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", marginTop: 4,
            }}>
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#555" }}>
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" style={{ color: "#F5C400", textDecoration: "none", fontWeight: 500 }}>Iniciá sesión</Link>
        </p>
      </div>
    </div>
  );
}
