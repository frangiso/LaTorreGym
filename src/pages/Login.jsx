import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import LtLayout from "../components/LtLayout";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch {
      setError("Email o contraseña incorrectos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LtLayout centrado>
      <div className="lt-card" style={{ maxWidth: 380, width: "100%", margin: "0 auto" }}>
        <h2 className="lt-heading">Iniciar sesión</h2>
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="lt-label">Email</label>
            <input className="lt-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" />
          </div>
          <div>
            <label className="lt-label">Contraseña</label>
            <input className="lt-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          {error && <p className="lt-error">{error}</p>}
          <button className="lt-btn-primary" type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#888" }}>
          ¿No tenés cuenta?{" "}
          <Link to="/register" style={{ color: "#F5C400", textDecoration: "none" }}>
            Registrate
          </Link>
        </p>
      </div>
    </LtLayout>
  );
}
