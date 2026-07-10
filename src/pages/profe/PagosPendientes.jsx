import { useState, useEffect } from "react";
import { doc, updateDoc, serverTimestamp, addDoc, collection, deleteField, runTransaction, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { generarReciboHTML, generarCajaHTML } from "../../utils/recibo";

const LOGO_URL = window.location.origin + "/logo.jpg";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const INSCRIPCION_DEFECTO = 15000;

async function registrarActividad(quienUid, quienNombre, tipo, detalle) {
  try {
    await addDoc(collection(db, "actividad"), { quienUid, quienNombre, tipo, detalle, creadoEn: serverTimestamp() });
  } catch(e) { console.error("Error registrando actividad:", e); }
}

/* ─── Card de pago pendiente ─── */
function PendingCard({ alumno, procesando, onConfirmar, onRechazar }) {
  const esEfectivo = alumno.metodoPago === "efectivo";
  const precioBase = alumno.montoPagado || 0;

  const [cobrarInscripcion,  setCobrarInscripcion]  = useState(!alumno.inscripcionPagada);
  const [montoInscripcion,   setMontoInscripcion]   = useState(INSCRIPCION_DEFECTO);
  const [inscripcionMetodo,  setInscripcionMetodo]  = useState("efectivo");
  const [descuentoPct,       setDescuentoPct]        = useState(esEfectivo && alumno.descuentoFutbol ? 15 : 0);

  const cuotaConDesc  = esEfectivo && descuentoPct > 0 ? Math.round(precioBase * (1 - descuentoPct / 100)) : precioBase;
  const inscMonto     = cobrarInscripcion ? (Number(montoInscripcion) || 0) : 0;
  const totalSugerido = cuotaConDesc + inscMonto;

  const [montoEfectivo,      setMontoEfectivo]      = useState(() => esEfectivo ? precioBase : 0);
  const [montoTransferencia, setMontoTransferencia] = useState(() => !esEfectivo ? precioBase : 0);

  // Totales incorporando método de inscripción
  const efTotal  = (Number(montoEfectivo)      || 0) + (cobrarInscripcion && inscripcionMetodo === "efectivo"      ? inscMonto : 0);
  const trTotal  = (Number(montoTransferencia) || 0) + (cobrarInscripcion && inscripcionMetodo === "transferencia" ? inscMonto : 0);
  const totalFinal = efTotal + trTotal;

  const [rechazando,    setRechazando]    = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");

  const inp = { padding:"8px 10px", borderRadius:8, border:"0.5px solid #e0e0e0", fontSize:13, boxSizing:"border-box", width:"100%" };

  return (
    <div style={{ background:"#fff", border:"0.5px solid #e0e0e0", borderRadius:12, padding:"16px 18px" }}>

      {/* Info alumno */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:"#F5C400", color:"#111", fontSize:14, fontWeight:500, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            {(alumno.nombre||"?").charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:500, color:"#111" }}>{alumno.nombre} {alumno.apellido}</div>
            <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{alumno.email}</div>
            {alumno.telefono && <div style={{ fontSize:12, color:"#888" }}>{alumno.telefono}</div>}
          </div>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          <span style={{ background:"#f5f5f5", borderRadius:6, padding:"4px 10px", fontSize:12, color:"#555" }}>{alumno.planNombre}</span>
          <span style={{ background:!esEfectivo?"#FFF8DC":"#f0f0f0", borderRadius:6, padding:"4px 10px", fontSize:12, color:!esEfectivo?"#7a5c00":"#555", textTransform:"capitalize" }}>{alumno.metodoPago}</span>
          {alumno.descuentoFutbol && <span style={{ background:"#dcfce7", borderRadius:6, padding:"4px 10px", fontSize:12, color:"#065f46", fontWeight:500 }}>⚽ -15% fútbol</span>}
        </div>
      </div>

      <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:10 }}>

        {/* Inscripción */}
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:13, color:"#555", flexShrink:0 }}>
              <input type="checkbox" checked={cobrarInscripcion} onChange={e => setCobrarInscripcion(e.target.checked)}
                style={{ width:15, height:15, accentColor:"#F5C400" }} />
              Inscripción $
            </label>
            <input type="number" value={montoInscripcion} onChange={e => setMontoInscripcion(e.target.value)}
              disabled={!cobrarInscripcion} min={0} placeholder="15000"
              style={{ ...inp, width:110, opacity: cobrarInscripcion ? 1 : 0.4 }} />
            {alumno.inscripcionPagada && (
              <span style={{ fontSize:11, color:"#10b981" }}>ya abonada</span>
            )}
          </div>
          {cobrarInscripcion && (
            <div style={{ display:"flex", gap:6, paddingLeft:22 }}>
              {["efectivo","transferencia"].map(m => (
                <button key={m} type="button" onClick={() => setInscripcionMetodo(m)}
                  style={{ padding:"4px 12px", borderRadius:20, fontSize:12, cursor:"pointer", fontWeight: inscripcionMetodo===m ? 600 : 400,
                    background: inscripcionMetodo===m ? "#F5C400" : "transparent",
                    border: inscripcionMetodo===m ? "none" : "0.5px solid #e0e0e0",
                    color: inscripcionMetodo===m ? "#111" : "#888" }}>
                  {m.charAt(0).toUpperCase()+m.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Descuento % (solo cuando el total es 100% efectivo) */}
        {(Number(montoTransferencia) || 0) === 0 ? (
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <label style={{ fontSize:13, color:"#555", flexShrink:0 }}>Descuento %</label>
            <input type="number" value={descuentoPct}
              onChange={e => setDescuentoPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              min={0} max={100} placeholder="0"
              style={{ ...inp, width:75, textAlign:"center" }} />
            {descuentoPct > 0 && (
              <span style={{ fontSize:12, color:"#888" }}>
                cuota {precioBase.toLocaleString("es-AR")} → {cuotaConDesc.toLocaleString("es-AR")}
              </span>
            )}
          </div>
        ) : (
          <div style={{ fontSize:12, color:"#aaa", background:"#f9f9f9", borderRadius:8, padding:"6px 10px" }}>
            Los descuentos solo aplican cuando el pago es 100% en efectivo.
          </div>
        )}

        {/* Montos efectivo / transferencia */}
        <div>
          <p style={{ fontSize:12, color:"#888", margin:"0 0 6px" }}>
            Monto cobrado <span style={{ color:"#aaa" }}>(cuota sin inscripción)</span>
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <div>
              <label style={{ fontSize:12, color:"#888", display:"block", marginBottom:4 }}>Efectivo $</label>
              <input type="number" value={montoEfectivo} onChange={e => setMontoEfectivo(e.target.value)}
                min={0} placeholder="0" style={inp} />
            </div>
            <div>
              <label style={{ fontSize:12, color:"#888", display:"block", marginBottom:4 }}>Transferencia $</label>
              <input type="number" value={montoTransferencia}
                onChange={e => { setMontoTransferencia(e.target.value); if (Number(e.target.value) > 0) setDescuentoPct(0); }}
                min={0} placeholder="0" style={inp} />
            </div>
          </div>
        </div>

        {/* Sugerido vs real */}
        {totalSugerido !== (Number(montoEfectivo)||0) + (Number(montoTransferencia)||0) && (
          <div style={{ fontSize:12, color:"#92400e", background:"#fffbea", border:"1px solid #fcd34d", borderRadius:8, padding:"6px 10px" }}>
            Calculado: ${totalSugerido.toLocaleString("es-AR")} · Ingresado: ${((Number(montoEfectivo)||0)+(Number(montoTransferencia)||0)).toLocaleString("es-AR")}
          </div>
        )}

        {/* Total final */}
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:14, fontWeight:600, color:"#111", background:"#f9f9f9", borderRadius:8, padding:"8px 12px" }}>
          <span>Total a cobrar</span>
          <span>${totalFinal.toLocaleString("es-AR")}</span>
        </div>
      </div>

      {/* Botones */}
      {rechazando ? (
        <div style={{ marginTop:12, display:"flex", gap:8, flexWrap:"wrap" }}>
          <input value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)}
            placeholder="Motivo del rechazo"
            style={{ flex:1, minWidth:200, padding:"8px 12px", borderRadius:8, border:"0.5px solid #e0e0e0", fontSize:13 }} />
          <button onClick={() => motivoRechazo.trim() && onRechazar(alumno, motivoRechazo)}
            disabled={procesando === alumno.uid}
            style={{ background:"#dc2626", color:"#fff", border:"none", borderRadius:8, padding:"8px 14px", fontSize:13, cursor:"pointer" }}>
            Confirmar rechazo
          </button>
          <button onClick={() => { setRechazando(false); setMotivoRechazo(""); }}
            style={{ background:"transparent", border:"0.5px solid #e0e0e0", borderRadius:8, padding:"8px 14px", fontSize:13, cursor:"pointer", color:"#888" }}>
            Cancelar
          </button>
        </div>
      ) : (
        <div style={{ marginTop:12, display:"flex", gap:8, flexWrap:"wrap" }}>
          <button
            onClick={() => onConfirmar(alumno, {
              montoEfectivo:      efTotal,
              montoTransferencia: trTotal,
              totalFinal,
              descuentoPct,
              cobrarInscripcion,
              montoInscripcion:   Number(montoInscripcion) || 0,
            })}
            disabled={procesando === alumno.uid}
            style={{ background:"#F5C400", color:"#111", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:500, cursor:"pointer" }}>
            {procesando === alumno.uid ? "Procesando..." : "✓ Confirmar pago"}
          </button>
          <button onClick={() => setRechazando(true)}
            style={{ background:"transparent", border:"0.5px solid #e0e0e0", borderRadius:8, padding:"9px 14px", fontSize:13, color:"#888", cursor:"pointer" }}>
            ✗ Rechazar
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Componente principal ─── */
export default function PagosPendientes() {
  const { alumnos: todosAlumnos } = useData();
  const { perfil: miPerfil }      = useAuth();
  const miNombre = (miPerfil?.nombre || "") + " " + (miPerfil?.apellido || "");

  const pendientes = todosAlumnos.filter(a => a.estado === "pago_pendiente");
  const [procesando, setProcesando] = useState(null);
  const [mesVer,  setMesVer]  = useState(new Date().getMonth());
  const [anioVer, setAnioVer] = useState(new Date().getFullYear());
  const [editModal,     setEditModal]     = useState(null);
  const [editGuardando, setEditGuardando] = useState(false);
  const [pagosDelMes,   setPagosDelMes]   = useState([]);
  const [cargandoCaja,  setCargandoCaja]  = useState(false);

  // La caja del mes se arma a partir del historial de pagos (colección "pagos"),
  // no del último pago guardado en la ficha del alumno: así un pago viejo sigue
  // apareciendo en su mes aunque el alumno ya haya renovado después.
  useEffect(() => {
    let vigente = true;
    setCargandoCaja(true);
    const inicio = new Date(anioVer, mesVer, 1);
    const fin    = new Date(anioVer, mesVer + 1, 1);
    getDocs(query(
      collection(db, "pagos"),
      where("fechaPago", ">=", inicio),
      where("fechaPago", "<", fin)
    )).then(snap => {
      if (!vigente) return;
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((x, y) => {
        const fx = x.fechaPago?.toDate?.() || new Date(x.fechaPago || 0);
        const fy = y.fechaPago?.toDate?.() || new Date(y.fechaPago || 0);
        return fy - fx;
      });
      setPagosDelMes(lista);
    }).finally(() => vigente && setCargandoCaja(false));
    return () => { vigente = false; };
  }, [mesVer, anioVer]);

  const totalEfectivo      = pagosDelMes.reduce((s, p) => s + (p.anulado ? 0 : (p.montoEfectivo || 0)), 0);
  const totalTransferencia = pagosDelMes.reduce((s, p) => s + (p.anulado ? 0 : (p.montoTransferencia || 0)), 0);
  const totalGeneral       = totalEfectivo + totalTransferencia;
  const pagosConfirmados   = pagosDelMes.filter(p => !p.anulado).length;

  function cambiarMes(dir) {
    let m = mesVer + dir, a = anioVer;
    if (m < 0)  { m = 11; a--; }
    if (m > 11) { m = 0;  a++; }
    setMesVer(m); setAnioVer(a);
  }

  async function obtenerNroRecibo() {
    const configRef = doc(db, "config", "gimnasio");
    let nro = 1;
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(configRef);
      nro = (snap.data()?.ultimoNroRecibo || 30000) + 1;
      tx.update(configRef, { ultimoNroRecibo: nro });
    });
    return nro;
  }

  function abrirRecibo(alumno, nro, { montoEfectivo, montoTransferencia, totalFinal }) {
    const html = generarReciboHTML({
      nro,
      nombre:            alumno.nombre,
      apellido:          alumno.apellido,
      planNombre:        alumno.planNombre,
      montoEfectivo:     montoEfectivo || 0,
      montoTransferencia: montoTransferencia || 0,
      total:             totalFinal,
      fecha:             new Date(),
      logoUrl:           LOGO_URL,
    });
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  }

  function imprimirCaja() {
    const titulo = `Caja ${MESES[mesVer]} ${anioVer}`;
    const html = generarCajaHTML({ pagos: pagosDelMes, titulo, logoUrl: LOGO_URL });
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  }

  async function confirmar(alumno, { montoEfectivo, montoTransferencia, totalFinal, descuentoPct, cobrarInscripcion, montoInscripcion }) {
    setProcesando(alumno.uid);
    const hoy = new Date();
    const vencAnterior = alumno.fechaVencimiento
      ? new Date(alumno.fechaVencimiento.toDate?.() || alumno.fechaVencimiento)
      : null;
    // Si paga antes de que venza el plan, se suma el mes al vencimiento actual (no a hoy)
    // para que no pierda los días restantes y mantenga siempre el mismo día de corte.
    const base = vencAnterior && vencAnterior > hoy ? vencAnterior : hoy;
    const vence = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate());

    const nroRecibo = await obtenerNroRecibo();

    const descuentoAplicado = descuentoPct > 0 ? `${descuentoPct}% de descuento` : null;

    await updateDoc(doc(db, "usuarios", alumno.uid), {
      estado:             "activo",
      fechaActivacion:    serverTimestamp(),
      fechaVencimiento:   vence,
      cuotaVencida:       false,
      montoPagado:        totalFinal,
      montoEfectivo,
      montoTransferencia,
      nroRecibo,
      inscripcionPagada:  cobrarInscripcion ? true : (alumno.inscripcionPagada || false),
      // Plan "suelta": cada pago habilita una clase nueva.
      ...(alumno.planId === "suelta" ? { sueltaUsada: false } : {}),
      ...(descuentoPct > 0 ? { descuentoAplicado } : { descuentoAplicado: deleteField() }),
    });

    // Registro permanente del pago: no se pisa con la próxima renovación,
    // es la fuente para el historial por alumno y para la caja de meses pasados.
    await addDoc(collection(db, "pagos"), {
      alumnoUid:          alumno.uid,
      alumnoNombre:       alumno.nombre || "",
      alumnoApellido:     alumno.apellido || "",
      planId:             alumno.planId || null,
      planNombre:         alumno.planNombre || null,
      montoEfectivo,
      montoTransferencia,
      montoTotal:         totalFinal,
      descuentoAplicado,
      inscripcionCobrada: !!cobrarInscripcion,
      montoInscripcion:   cobrarInscripcion ? (Number(montoInscripcion) || 0) : 0,
      nroRecibo,
      fechaVencimientoResultante: vence,
      fechaPago:          serverTimestamp(),
      confirmadoPorUid:   miPerfil?.uid || null,
      confirmadoPorNombre: miNombre.trim(),
    });

    const desc = descuentoPct > 0 ? ` (-${descuentoPct}%)` : "";
    const insc = cobrarInscripcion ? ` + inscripción $${montoInscripcion.toLocaleString("es-AR")}` : "";
    await registrarActividad(
      miPerfil?.uid || "", miNombre.trim(),
      "pago_confirmado",
      `Pago confirmado: ${alumno.nombre} ${alumno.apellido} — $${totalFinal.toLocaleString("es-AR")}${desc}${insc} — Recibo #${nroRecibo}`
    );

    abrirRecibo(alumno, nroRecibo, { montoEfectivo, montoTransferencia, totalFinal });
    setProcesando(null);
  }

  async function rechazar(alumno, motivo) {
    setProcesando(alumno.uid);
    await updateDoc(doc(db, "usuarios", alumno.uid), {
      estado: "pendiente", planId: null, planNombre: null,
      metodoPago: null, montoPagado: null, motivoRechazo: motivo,
    });
    await registrarActividad(
      miPerfil?.uid || "", miNombre.trim(), "pago_rechazado",
      `Pago rechazado: ${alumno.nombre} ${alumno.apellido} — Motivo: ${motivo}`
    );
    setProcesando(null);
  }

  async function guardarEdicion() {
    setEditGuardando(true);
    const pago = editModal.pago;
    const montoEfectivo      = Number(editModal.montoEfectivo)      || 0;
    const montoTransferencia = Number(editModal.montoTransferencia) || 0;
    const total = montoEfectivo + montoTransferencia;

    await updateDoc(doc(db, "pagos", pago.id), {
      montoEfectivo, montoTransferencia, montoTotal: total,
    });

    // Si este es el pago vigente del alumno (el que lo tiene activo hoy),
    // se sincroniza también su ficha para que no quede desactualizada.
    const alumnoActual = todosAlumnos.find(al => al.uid === pago.alumnoUid);
    if (alumnoActual && pago.nroRecibo && alumnoActual.nroRecibo === pago.nroRecibo) {
      await updateDoc(doc(db, "usuarios", pago.alumnoUid), {
        montoPagado: total, montoEfectivo, montoTransferencia,
      });
    }

    setPagosDelMes(prev => prev.map(p => p.id === pago.id ? { ...p, montoEfectivo, montoTransferencia, montoTotal: total } : p));

    await registrarActividad(
      miPerfil?.uid || "", miNombre.trim(), "pago_editado",
      `Pago editado: ${pago.alumnoNombre} ${pago.alumnoApellido} — total $${total.toLocaleString("es-AR")}`
    );
    setEditModal(null);
    setEditGuardando(false);
  }

  async function anularPago(pago) {
    // No se borra el registro: se marca como anulado para que quede
    // constancia de que existió y se dejó sin efecto (por si se equivocan).
    await updateDoc(doc(db, "pagos", pago.id), {
      anulado:          true,
      anuladoEn:        serverTimestamp(),
      anuladoPorUid:    miPerfil?.uid || null,
      anuladoPorNombre: miNombre.trim(),
    });

    // Solo se desactiva al alumno si el pago anulado es el que lo tiene activo
    // hoy. Si es un pago viejo ya reemplazado por una renovación posterior,
    // se anula el registro histórico nada más y no se toca su estado actual.
    const alumnoActual = todosAlumnos.find(al => al.uid === pago.alumnoUid);
    const esPagoVigente = alumnoActual && pago.nroRecibo && alumnoActual.nroRecibo === pago.nroRecibo;
    if (esPagoVigente) {
      await updateDoc(doc(db, "usuarios", pago.alumnoUid), {
        estado:             "inactivo",
        fechaActivacion:    deleteField(),
        fechaVencimiento:   deleteField(),
        montoPagado:        deleteField(),
        montoEfectivo:      deleteField(),
        montoTransferencia: deleteField(),
      });
    }

    setPagosDelMes(prev => prev.map(p => p.id === pago.id ? { ...p, anulado: true } : p));

    await registrarActividad(
      miPerfil?.uid || "", miNombre.trim(), "pago_anulado",
      `Pago anulado: ${pago.alumnoNombre} ${pago.alumnoApellido} — $${(pago.montoTotal||0).toLocaleString("es-AR")}${esPagoVigente ? " (el alumno pasó a inactivo)" : ""}`
    );
  }

  return (
    <div>

      {/* ===== MODAL EDITAR PAGO ===== */}
      {editModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={() => setEditModal(null)}>
          <div style={{ background:"#fff", borderRadius:16, padding:24, maxWidth:380, width:"100%" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize:16, fontWeight:500, margin:"0 0 4px" }}>Editar pago</h3>
            <p style={{ fontSize:13, color:"#888", margin:"0 0 16px" }}>{editModal.pago.alumnoNombre} {editModal.pago.alumnoApellido}</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              <div>
                <label style={{ fontSize:12, color:"#888", display:"block", marginBottom:4 }}>Efectivo $</label>
                <input type="number" value={editModal.montoEfectivo}
                  onChange={e => setEditModal(m => ({ ...m, montoEfectivo: e.target.value }))}
                  style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"0.5px solid #e0e0e0", fontSize:13, boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontSize:12, color:"#888", display:"block", marginBottom:4 }}>Transferencia $</label>
                <input type="number" value={editModal.montoTransferencia}
                  onChange={e => setEditModal(m => ({ ...m, montoTransferencia: e.target.value }))}
                  style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"0.5px solid #e0e0e0", fontSize:13, boxSizing:"border-box" }} />
              </div>
            </div>
            <div style={{ fontSize:13, fontWeight:600, color:"#111", marginBottom:16, textAlign:"right" }}>
              Total: ${((Number(editModal.montoEfectivo)||0)+(Number(editModal.montoTransferencia)||0)).toLocaleString("es-AR")}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={guardarEdicion} disabled={editGuardando}
                style={{ flex:1, background:"#F5C400", color:"#111", border:"none", borderRadius:8, padding:"10px", fontSize:13, fontWeight:500, cursor:"pointer" }}>
                {editGuardando ? "Guardando..." : "Guardar"}
              </button>
              <button onClick={() => setEditModal(null)}
                style={{ background:"transparent", border:"0.5px solid #e0e0e0", borderRadius:8, padding:"10px 16px", fontSize:13, cursor:"pointer", color:"#888" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CAJA DEL MES ===== */}
      <div style={{ marginBottom:32 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:0 }}>Caja del mes</h2>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <button onClick={imprimirCaja} disabled={pagosDelMes.length === 0}
              style={{ background:"#fff", border:"0.5px solid #e0e0e0", borderRadius:8, padding:"6px 14px", fontSize:13, cursor: pagosDelMes.length > 0 ? "pointer" : "not-allowed", color: pagosDelMes.length > 0 ? "#111" : "#bbb" }}>
              🖨 Imprimir caja
            </button>
            {cargandoCaja && <span style={{ fontSize:12, color:"#aaa" }}>Cargando...</span>}
            <button onClick={() => cambiarMes(-1)} style={{ background:"#fff", border:"0.5px solid #e0e0e0", borderRadius:8, padding:"6px 12px", cursor:"pointer" }}>←</button>
            <span style={{ fontSize:14, fontWeight:500, color:"#111", minWidth:130, textAlign:"center" }}>{MESES[mesVer]} {anioVer}</span>
            <button onClick={() => cambiarMes(1)}  style={{ background:"#fff", border:"0.5px solid #e0e0e0", borderRadius:8, padding:"6px 12px", cursor:"pointer" }}>→</button>
          </div>
        </div>

        <div style={{ background:"#111", borderRadius:16, padding:"24px 20px", marginBottom:12 }}>
          <div style={{ fontSize:12, color:"#888", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>
            Total ingresado — {MESES[mesVer]} {anioVer}
          </div>
          <div style={{ fontSize:36, fontWeight:500, color:"#F5C400" }}>
            ${totalGeneral.toLocaleString("es-AR")}
          </div>
          <div style={{ fontSize:13, color:"#666", marginTop:4 }}>
            {pagosConfirmados} pago{pagosConfirmados !== 1 ? "s" : ""} confirmado{pagosConfirmados !== 1 ? "s" : ""}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
          <div style={{ background:"#fff", border:"0.5px solid #e0e0e0", borderRadius:12, padding:16 }}>
            <div style={{ fontSize:11, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Efectivo</div>
            <div style={{ fontSize:22, fontWeight:500, color:"#111" }}>${totalEfectivo.toLocaleString("es-AR")}</div>
          </div>
          <div style={{ background:"#fff", border:"0.5px solid #e0e0e0", borderRadius:12, padding:16 }}>
            <div style={{ fontSize:11, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Transferencia</div>
            <div style={{ fontSize:22, fontWeight:500, color:"#111" }}>${totalTransferencia.toLocaleString("es-AR")}</div>
          </div>
        </div>

        {pagosDelMes.length > 0 ? (
          <div style={{ background:"#fff", border:"0.5px solid #e0e0e0", borderRadius:12, overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"0.5px solid #f0f0f0" }}>
              <span style={{ fontSize:13, fontWeight:500, color:"#111" }}>Detalle de pagos</span>
            </div>
            {pagosDelMes.map((p, i) => {
                const fecha = p.fechaPago?.toDate?.() || new Date(p.fechaPago);
                const ef = p.montoEfectivo || 0;
                const tr = p.montoTransferencia || 0;
                const alumnoActual = todosAlumnos.find(al => al.uid === p.alumnoUid);
                const esPagoVigente = alumnoActual && p.nroRecibo && alumnoActual.nroRecibo === p.nroRecibo;
                return (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", gap:12, borderBottom: i < pagosDelMes.length-1 ? "0.5px solid #f5f5f5" : "none", background: p.anulado ? "#fef2f2" : (i%2===0 ? "#fff" : "#fafafa"), opacity: p.anulado ? 0.7 : 1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:0 }}>
                      <div style={{ width:30, height:30, borderRadius:"50%", background:"#F5C400", color:"#111", fontSize:11, fontWeight:500, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        {(p.alumnoNombre||"?").charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:"#111", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", textDecoration: p.anulado ? "line-through" : "none" }}>
                          {p.alumnoNombre} {p.alumnoApellido}
                          {p.anulado && <span style={{ marginLeft:6, fontSize:11, fontWeight:700, color:"#dc2626", textDecoration:"none" }}>ANULADO</span>}
                        </div>
                        <div style={{ fontSize:11, color:"#aaa" }}>
                          {p.planNombre} · {fecha.toLocaleDateString("es-AR")}
                          {p.descuentoAplicado && <span style={{ color:"#10b981", marginLeft:4 }}>· {p.descuentoAplicado}</span>}
                          {!esPagoVigente && !p.anulado && <span style={{ marginLeft:4 }}>· pago anterior</span>}
                        </div>
                        {(ef > 0 || tr > 0) && (
                          <div style={{ fontSize:11, color:"#aaa", marginTop:1 }}>
                            {ef > 0 && <span>Efectivo ${ef.toLocaleString("es-AR")}</span>}
                            {ef > 0 && tr > 0 && <span> · </span>}
                            {tr > 0 && <span>Transf. ${tr.toLocaleString("es-AR")}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                      {p.nroRecibo && <span style={{ fontSize:11, color:"#aaa" }}>#{p.nroRecibo}</span>}
                      <span style={{ fontSize:14, fontWeight:500, color:"#111", textDecoration: p.anulado ? "line-through" : "none" }}>${(p.montoTotal||0).toLocaleString("es-AR")}</span>
                      <button
                        onClick={() => abrirRecibo({ nombre: p.alumnoNombre, apellido: p.alumnoApellido, planNombre: p.planNombre }, p.nroRecibo || "—", { montoEfectivo: ef, montoTransferencia: tr, totalFinal: p.montoTotal || 0 })}
                        title="Reimprimir recibo"
                        style={{ background:"transparent", border:"0.5px solid #e0e0e0", borderRadius:6, padding:"4px 8px", fontSize:12, color:"#888", cursor:"pointer" }}>
                        🖨
                      </button>
                      {!p.anulado && (
                        <>
                          <button
                            onClick={() => setEditModal({ pago: p, montoEfectivo: ef, montoTransferencia: tr })}
                            title="Editar pago"
                            style={{ background:"transparent", border:"0.5px solid #e0e0e0", borderRadius:6, padding:"4px 8px", fontSize:12, color:"#888", cursor:"pointer" }}>
                            ✏️
                          </button>
                          <button
                            onClick={() => {
                              const aviso = esPagoVigente
                                ? `¿Anular el pago de ${p.alumnoNombre} ${p.alumnoApellido}? El alumno pasará a inactivo. Va a quedar registrado como anulado, no se borra.`
                                : `¿Anular este pago anterior de ${p.alumnoNombre} ${p.alumnoApellido}? Es un pago viejo, no afecta su estado actual. Va a quedar registrado como anulado, no se borra.`;
                              if (window.confirm(aviso)) anularPago(p);
                            }}
                            title="Anular pago"
                            style={{ background:"transparent", border:"0.5px solid #fca5a5", borderRadius:6, padding:"4px 8px", fontSize:12, color:"#dc2626", cursor:"pointer" }}>
                            🚫
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            <div style={{ padding:"8px 16px", fontSize:11, color:"#bbb", borderTop:"0.5px solid #f0f0f0" }}>
              Anular pago: click en 🚫 y confirmar. Queda registrado como anulado, no se borra.
            </div>
          </div>
        ) : (
          <div style={{ background:"#fff", border:"0.5px solid #e0e0e0", borderRadius:12, padding:"32px", textAlign:"center", color:"#aaa" }}>
            <p style={{ fontSize:13 }}>No hay pagos en {MESES[mesVer]} {anioVer}.</p>
          </div>
        )}
      </div>

      {/* ===== PAGOS PENDIENTES ===== */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <h2 style={{ fontSize:18, fontWeight:500, margin:0 }}>Pagos pendientes</h2>
        <span style={{ background: pendientes.length > 0 ? "#F5C400" : "#f0f0f0", color: pendientes.length > 0 ? "#111" : "#888", fontSize:13, fontWeight:500, padding:"4px 12px", borderRadius:20 }}>
          {pendientes.length} {pendientes.length === 1 ? "pendiente" : "pendientes"}
        </span>
      </div>

      {pendientes.length === 0 ? (
        <div style={{ textAlign:"center", padding:"32px 0", color:"#aaa" }}>
          <p style={{ fontSize:14 }}>No hay pagos pendientes</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {pendientes.map(alumno => (
            <PendingCard
              key={alumno.uid}
              alumno={alumno}
              procesando={procesando}
              onConfirmar={confirmar}
              onRechazar={rechazar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
