import { useEffect, useState } from "react";
import { collection, query, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "../../firebase";

export default function RegistroActividad() {
  const [actividad, setActividad] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // orderBy es imprescindible acá: sin él, Firestore devuelve un subconjunto
    // arbitrario/estable de 100 docs (por ID), no los 100 más recientes — pasado
    // ese volumen, la actividad nueva dejaba de aparecer.
    const q = query(collection(db, "actividad"), orderBy("creadoEn", "desc"), limit(100));
    const fn = onSnapshot(q, snap => {
      setActividad(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCargando(false);
    });
    return fn;
  }, []);

  const iconos = {
    pago_confirmado:   "✅",
    pago_rechazado:    "❌",
    alumno_eliminado:  "🗑️",
    turno_cancelado:   "🚫",
    config_actualizada:"⚙️",
  };

  if (cargando) return <p style={{color:"#888",padding:20}}>Cargando...</p>;

  return (
    <div>
      <h2 style={{fontSize:18,fontWeight:500,marginBottom:16}}>Registro de actividad</h2>
      {actividad.length === 0 ? (
        <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"32px",textAlign:"center",color:"#aaa"}}>
          <p style={{fontSize:13}}>No hay actividad registrada aún.</p>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {actividad.map(a => {
            const fecha = a.creadoEn ? new Date(a.creadoEn.toDate?.() || a.creadoEn) : null;
            return (
              <div key={a.id} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:"12px 16px",display:"flex",gap:12,alignItems:"flex-start"}}>
                <span style={{fontSize:18,flexShrink:0}}>{iconos[a.tipo] || "📝"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,color:"#111",lineHeight:1.5}}>{a.detalle}</div>
                  <div style={{fontSize:11,color:"#aaa",marginTop:3}}>
                    {a.quienNombre || "Sistema"} · {fecha ? fecha.toLocaleString("es-AR") : ""}
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
