import { useEffect, useState } from "react";
import { doc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { db } from "../../firebase";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const INSCRIPCION = 15000;

async function registrarActividad(db, addDoc, collection, serverTimestamp, quienUid, quienNombre, tipo, detalle) {
  try {
    await addDoc(collection(db, "actividad"), {
      quienUid, quienNombre, tipo, detalle,
      creadoEn: serverTimestamp(),
    });
  } catch(e) { console.error("Error registrando actividad:", e); }
}

export default function PagosPendientes() {
  const { alumnos: todosAlumnos }       = useData();
  const { perfil: miPerfil }            = useAuth();
  const miNombre = (miPerfil?.nombre || "") + " " + (miPerfil?.apellido || "");
  const esDueno  = miPerfil?.rol === "dueno";

  const pendientes                      = todosAlumnos.filter(a => a.estado === "pago_pendiente");
  const [procesando, setProcesando]     = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [rechazando, setRechazando]     = useState(null);
  const [mesVer, setMesVer]             = useState(new Date().getMonth());
  const [anioVer, setAnioVer]           = useState(new Date().getFullYear());
  const [descuentoModal, setDescuentoModal] = useState(null); // alumno con modal abierto
  const [motivoDescuento, setMotivoDescuento] = useState("");
  const [familiarModal, setFamiliarModal] = useState(null); // modal 15% familiar

  async function confirmar(alumno, descuentoExtra = 0, motivo = "") {
    setProcesando(alumno.uid);
    const _h = new Date();
    const vence = new Date(_h.getFullYear(), _h.getMonth() + 1, _h.getDate());
    
    // Calcular monto con descuentos
    let monto = alumno.montoPagado || 0;
    if (alumno.descuentoFutbol) monto = Math.round(monto * 0.85); // -15%
    if (descuentoExtra === 15)  monto = Math.round(monto * 0.85); // -15% familiar
    if (descuentoExtra === 50)  monto = Math.round(monto * 0.5);  // -50%
    
    // Agregar inscripción si es primera vez
    const montoFinal = monto + (alumno.inscripcionPagada ? 0 : INSCRIPCION);

    await updateDoc(doc(db, "usuarios", alumno.uid), {
      estado:           "activo",
      fechaActivacion:  serverTimestamp(),
      fechaVencimiento: vence,
      cuotaVencida:     false,
      montoPagado:      montoFinal,
      inscripcionPagada: true,
      ...(alumno.descuentoFutbol ? { descuentoAplicado: "15% familiar fútbol" } : {}),
      ...(descuentoExtra === 15   ? { descuentoAplicado: "15% familiar La Torre" } : {}),
      ...(descuentoExtra === 50   ? { descuentoEspecial: motivo }              : {}),
    });

    // Registro de actividad
    await registrarActividad(db, addDoc, collection, serverTimestamp,
      miPerfil?.uid || "", miNombre.trim(),
      "pago_confirmado",
      `Pago confirmado: ${alumno.nombre} ${alumno.apellido} — $${montoFinal.toLocaleString("es-AR")}${alumno.descuentoFutbol ? " (15% fútbol)" : ""}${descuentoExtra === 15 ? " (15% familiar)" : ""}${descuentoExtra === 50 ? " (50% especial: "+motivo+")" : ""}${!alumno.inscripcionPagada ? " + inscripción $15.000" : ""}`
    );

    setDescuentoModal(null); setMotivoDescuento(""); setFamiliarModal(null); setProcesando(null);
  }

  async function rechazar(alumno) {
    if (!motivoRechazo.trim()) return;
    setProcesando(alumno.uid);
    await updateDoc(doc(db, "usuarios", alumno.uid), {
      estado: "pendiente",
      planId: null, planNombre: null,
      metodoPago: null, montoPagado: null,
      motivoRechazo: motivoRechazo,
    });
    await registrarActividad(db, addDoc, collection, serverTimestamp,
      miPerfil?.uid || "", miNombre.trim(),
      "pago_rechazado",
      `Pago rechazado: ${alumno.nombre} ${alumno.apellido} — Motivo: ${motivoRechazo}`
    );
    setRechazando(null); setMotivoRechazo(""); setProcesando(null);
  }

  const pagosDelMes = todosAlumnos.filter(a => {
    if (!a.fechaActivacion || !a.montoPagado) return false;
    if (a.estado !== "activo") return false;
    const fecha = new Date(a.fechaActivacion.toDate?.() || a.fechaActivacion);
    return fecha.getMonth() === mesVer && fecha.getFullYear() === anioVer;
  });

  const totalEfectivo      = pagosDelMes.filter(a => a.metodoPago === "efectivo").reduce((s,a) => s+(a.montoPagado||0), 0);
  const totalTransferencia = pagosDelMes.filter(a => a.metodoPago === "transferencia").reduce((s,a) => s+(a.montoPagado||0), 0);
  const totalGeneral       = totalEfectivo + totalTransferencia;

  function cambiarMes(dir) {
    let m = mesVer + dir, a = anioVer;
    if (m < 0)  { m = 11; a--; }
    if (m > 11) { m = 0;  a++; }
    setMesVer(m); setAnioVer(a);
  }

  function calcularMonto(alumno) {
    let m = alumno.montoPagado || 0;
    if (alumno.descuentoFutbol) m = Math.round(m * 0.85);
    const total = m + (alumno.inscripcionPagada ? 0 : INSCRIPCION);
    return { cuota: m, inscripcion: alumno.inscripcionPagada ? 0 : INSCRIPCION, total };
  }

  return (
    <div>
      {/* ====== MODAL DESCUENTO 15% FAMILIAR ====== */}
      {familiarModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#fff",borderRadius:16,padding:24,maxWidth:400,width:"100%"}}>
            <h3 style={{fontSize:16,fontWeight:500,marginBottom:8}}>🏅 15% descuento familiar</h3>
            <p style={{fontSize:13,color:"#888",marginBottom:16,lineHeight:1.5}}>
              Aplicar 15% de descuento para papá/mamá de alumno de La Torre. El nuevo monto se calculará automáticamente.
            </p>
            <div style={{background:"#fffbea",border:"1px solid #fcd34d",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#92400e"}}>
              Monto original: <strong>${(familiarModal.montoPagado||0).toLocaleString("es-AR")}</strong>
              {" → "}
              Con descuento: <strong>${Math.round((familiarModal.montoPagado||0)*0.85).toLocaleString("es-AR")}</strong>
              {!familiarModal.inscripcionPagada && <div style={{marginTop:4}}>+ Inscripción: $15.000</div>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={() => confirmar(familiarModal, 15, "")}
                disabled={procesando === familiarModal?.uid}
                style={{flex:1,background:"#F5C400",color:"#111",border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:500,cursor:"pointer"}}>
                Confirmar con 15% off
              </button>
              <button onClick={() => setFamiliarModal(null)}
                style={{background:"transparent",border:"0.5px solid #e0e0e0",borderRadius:8,padding:"10px 16px",fontSize:13,cursor:"pointer",color:"#888"}}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL DESCUENTO 50% ====== */}
      {descuentoModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#fff",borderRadius:16,padding:24,maxWidth:400,width:"100%"}}>
            <h3 style={{fontSize:16,fontWeight:500,marginBottom:8}}>Descuento especial 50%</h3>
            <p style={{fontSize:13,color:"#888",marginBottom:16,lineHeight:1.5}}>
              Este descuento es excepcional. Ingresá el motivo para dejarlo registrado.
            </p>
            <input value={motivoDescuento} onChange={e => setMotivoDescuento(e.target.value)}
              placeholder="Motivo (ej: amigo del dueño)"
              style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"0.5px solid #e0e0e0",fontSize:13,marginBottom:16,boxSizing:"border-box"}} />
            <div style={{display:"flex",gap:8}}>
              <button onClick={() => motivoDescuento.trim() && confirmar(descuentoModal, 50, motivoDescuento)}
                disabled={!motivoDescuento.trim() || procesando === descuentoModal?.uid}
                style={{flex:1,background:"#dc2626",color:"#fff",border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:500,cursor:"pointer"}}>
                Confirmar con 50% off
              </button>
              <button onClick={() => { setDescuentoModal(null); setMotivoDescuento(""); }}
                style={{background:"transparent",border:"0.5px solid #e0e0e0",borderRadius:8,padding:"10px 16px",fontSize:13,cursor:"pointer",color:"#888"}}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== CAJA DEL MES ====== */}
      <div style={{marginBottom:32}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <h2 style={{fontSize:18,fontWeight:500,margin:0}}>Caja del mes</h2>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={() => cambiarMes(-1)} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:8,padding:"6px 12px",cursor:"pointer"}}>←</button>
            <span style={{fontSize:14,fontWeight:500,color:"#111",minWidth:130,textAlign:"center"}}>{MESES[mesVer]} {anioVer}</span>
            <button onClick={() => cambiarMes(1)} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:8,padding:"6px 12px",cursor:"pointer"}}>→</button>
          </div>
        </div>

        <div style={{background:"#111",borderRadius:16,padding:"24px 20px",marginBottom:12}}>
          <div style={{fontSize:12,color:"#888",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>
            Total ingresado — {MESES[mesVer]} {anioVer}
          </div>
          <div style={{fontSize:36,fontWeight:500,color:"#F5C400"}}>
            ${totalGeneral.toLocaleString("es-AR")}
          </div>
          <div style={{fontSize:13,color:"#666",marginTop:4}}>
            {pagosDelMes.length} pago{pagosDelMes.length!==1?"s":""} confirmado{pagosDelMes.length!==1?"s":""}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:16}}>
            <div style={{fontSize:11,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Efectivo</div>
            <div style={{fontSize:22,fontWeight:500,color:"#111"}}>${totalEfectivo.toLocaleString("es-AR")}</div>
            <div style={{fontSize:12,color:"#aaa",marginTop:4}}>{pagosDelMes.filter(a=>a.metodoPago==="efectivo").length} pagos</div>
          </div>
          <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:16}}>
            <div style={{fontSize:11,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Transferencia</div>
            <div style={{fontSize:22,fontWeight:500,color:"#111"}}>${totalTransferencia.toLocaleString("es-AR")}</div>
            <div style={{fontSize:12,color:"#aaa",marginTop:4}}>{pagosDelMes.filter(a=>a.metodoPago==="transferencia").length} pagos</div>
          </div>
        </div>

        {pagosDelMes.length > 0 && (
          <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"0.5px solid #f0f0f0"}}>
              <span style={{fontSize:13,fontWeight:500,color:"#111"}}>Detalle de pagos</span>
            </div>
            {pagosDelMes.sort((a,b) => new Date(b.fechaActivacion?.toDate?.() || b.fechaActivacion) - new Date(a.fechaActivacion?.toDate?.() || a.fechaActivacion))
              .map((a,i) => {
                const fecha = new Date(a.fechaActivacion?.toDate?.() || a.fechaActivacion);
                return (
                  <div key={a.uid} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",gap:12,borderBottom:i<pagosDelMes.length-1?"0.5px solid #f5f5f5":"none",background:i%2===0?"#fff":"#fafafa"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:30,height:30,borderRadius:"50%",background:"#F5C400",color:"#111",fontSize:11,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {(a.nombre||"?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:500,color:"#111"}}>{a.nombre} {a.apellido}</div>
                        <div style={{fontSize:11,color:"#aaa"}}>
                          {a.planNombre} · {fecha.toLocaleDateString("es-AR")}
                          {a.descuentoAplicado && <span style={{color:"#10b981",marginLeft:4}}>· {a.descuentoAplicado}</span>}
                          {a.descuentoEspecial && <span style={{color:"#dc2626",marginLeft:4}}>· 50% off</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,fontWeight:500,background:a.metodoPago==="transferencia"?"#FFF8DC":"#f0f0f0",color:a.metodoPago==="transferencia"?"#7a5c00":"#555"}}>
                        {a.metodoPago==="transferencia"?"Transf.":"Efectivo"}
                      </span>
                      <span style={{fontSize:14,fontWeight:500,color:"#111"}}>${(a.montoPagado||0).toLocaleString("es-AR")}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
        {pagosDelMes.length === 0 && (
          <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"32px",textAlign:"center",color:"#aaa"}}>
            <p style={{fontSize:13}}>No hay pagos en {MESES[mesVer]} {anioVer}.</p>
          </div>
        )}
      </div>

      {/* ====== PAGOS PENDIENTES ====== */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <h2 style={{fontSize:18,fontWeight:500,margin:0}}>Pagos pendientes</h2>
        <span style={{background:pendientes.length>0?"#F5C400":"#f0f0f0",color:pendientes.length>0?"#111":"#888",fontSize:13,fontWeight:500,padding:"4px 12px",borderRadius:20}}>
          {pendientes.length} {pendientes.length===1?"pendiente":"pendientes"}
        </span>
      </div>

      {pendientes.length === 0 ? (
        <div style={{textAlign:"center",padding:"32px 0",color:"#aaa"}}>
          <p style={{fontSize:14}}>No hay pagos pendientes</p>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {pendientes.map(alumno => {
            const { cuota, inscripcion, total } = calcularMonto(alumno);
            return (
              <div key={alumno.uid} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"16px 18px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                  <div style={{display:"flex",gap:12,alignItems:"center"}}>
                    <div style={{width:40,height:40,borderRadius:"50%",background:"#F5C400",color:"#111",fontSize:14,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {(alumno.nombre||"?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{fontSize:15,fontWeight:500,color:"#111"}}>{alumno.nombre} {alumno.apellido}</div>
                      <div style={{fontSize:12,color:"#888",marginTop:2}}>{alumno.email}</div>
                      {alumno.telefono && <div style={{fontSize:12,color:"#888"}}>{alumno.telefono}</div>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <span style={{background:"#f5f5f5",borderRadius:6,padding:"4px 10px",fontSize:12,color:"#555"}}>{alumno.planNombre}</span>
                    <span style={{background:alumno.metodoPago==="transferencia"?"#FFF8DC":"#f0f0f0",borderRadius:6,padding:"4px 10px",fontSize:12,color:alumno.metodoPago==="transferencia"?"#7a5c00":"#555",textTransform:"capitalize"}}>{alumno.metodoPago}</span>
                    {alumno.descuentoFutbol && <span style={{background:"#dcfce7",borderRadius:6,padding:"4px 10px",fontSize:12,color:"#065f46",fontWeight:500}}>⚽ -15% fútbol</span>}
                  </div>
                </div>

                {/* Desglose del monto */}
                <div style={{marginTop:12,background:"#f9f9f9",borderRadius:8,padding:"10px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#555",marginBottom:4}}>
                    <span>Cuota{alumno.descuentoFutbol?" (con -15%)":""}</span>
                    <span>${cuota.toLocaleString("es-AR")}</span>
                  </div>
                  {inscripcion > 0 && (
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#555",marginBottom:4}}>
                      <span>Inscripción (primera vez)</span>
                      <span>${inscripcion.toLocaleString("es-AR")}</span>
                    </div>
                  )}
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:600,color:"#111",borderTop:"0.5px solid #e0e0e0",paddingTop:6,marginTop:4}}>
                    <span>Total a cobrar</span>
                    <span>${total.toLocaleString("es-AR")}</span>
                  </div>
                </div>

                {rechazando === alumno.uid ? (
                  <div style={{marginTop:14,display:"flex",gap:8,flexWrap:"wrap"}}>
                    <input value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)}
                      placeholder="Motivo del rechazo"
                      style={{flex:1,minWidth:200,padding:"8px 12px",borderRadius:8,border:"0.5px solid #e0e0e0",fontSize:13}} />
                    <button onClick={() => rechazar(alumno)} disabled={procesando===alumno.uid}
                      style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:13,cursor:"pointer"}}>
                      Confirmar rechazo
                    </button>
                    <button onClick={() => { setRechazando(null); setMotivoRechazo(""); }}
                      style={{background:"transparent",border:"0.5px solid #e0e0e0",borderRadius:8,padding:"8px 14px",fontSize:13,cursor:"pointer",color:"#888"}}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div style={{marginTop:14,display:"flex",gap:8,flexWrap:"wrap"}}>
                    <button onClick={() => confirmar(alumno)} disabled={procesando===alumno.uid}
                      style={{background:"#F5C400",color:"#111",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:500,cursor:"pointer"}}>
                      {procesando===alumno.uid?"Procesando...":"✓ Confirmar pago"}
                    </button>
                    <button onClick={() => setFamiliarModal(alumno)}
                      style={{background:"#fffbea",border:"0.5px solid #fcd34d",color:"#92400e",borderRadius:8,padding:"9px 14px",fontSize:13,cursor:"pointer",fontWeight:500}}>
                      🏅 15% familiar
                    </button>
                    <button onClick={() => setDescuentoModal(alumno)}
                      style={{background:"#fff5f5",border:"0.5px solid #fca5a5",color:"#dc2626",borderRadius:8,padding:"9px 14px",fontSize:13,cursor:"pointer",fontWeight:500}}>
                      🎁 50% especial
                    </button>
                    <button onClick={() => setRechazando(alumno.uid)}
                      style={{background:"transparent",border:"0.5px solid #e0e0e0",borderRadius:8,padding:"9px 14px",fontSize:13,color:"#888",cursor:"pointer"}}>
                      ✗ Rechazar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
