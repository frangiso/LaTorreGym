import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import LtLogo from "../components/LtLogo";

export default function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
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

  const inputStyle = {
    width: "100%", padding: "12px 14px", background: "#111",
    border: "1px solid #333", borderRadius: 8, fontSize: 16,
    color: "#fff", outline: "none", boxSizing: "border-box",
    WebkitAppearance: "none",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#111",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
    }}>
      <div style={{ marginBottom: 40 }}>
        <LtLogo size="lg" />
      </div>

      <div style={{
        background: "#1a1a1a", borderRadius: 16,
        border: "1px solid #2a2a2a", padding: "32px 20px",
        width: "100%", maxWidth: 380,
      }}>
        <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 500, margin: "0 0 24px", textAlign: "center" }}>
          Iniciar sesión
        </h2>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 5 }}>Email</label>
            <input
              type="email"
              name="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              autoComplete="email"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#F5C400"}
              onBlur={e => e.target.style.borderColor = "#333"}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 5 }}>Contraseña</label>
            <input
              type="password"
              name="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#F5C400"}
              onBlur={e => e.target.style.borderColor = "#333"}
            />
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
              padding: "14px", fontSize: 16, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", marginTop: 4,
            }}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#555" }}>
          ¿No tenés cuenta?{" "}
          <Link to="/register" style={{ color: "#F5C400", textDecoration: "none", fontWeight: 500 }}>
            Registrate
          </Link>
        </p>
      </div>
    </div>
  );
}
