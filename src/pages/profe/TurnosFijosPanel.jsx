import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, addDoc, serverTimestamp, collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useData } from "../../context/DataContext";
import { crearReservasFijas, borrarReservasFijas } from "../../reservasFijas";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const DIAS_FULL  = { LUNES:"Lunes", MARTES:"Martes", MIERCOLES:"Miercoles", JUEVES:"Jueves", VIERNES:"Viernes", SABADO:"Sabado" };
const DIAS_CORTO = { LUNES:"Lun", MARTES:"Mar", MIERCOLES:"Mie", JUEVES:"Jue", VIERNES:"Vie", SABADO:"Sab" };
const CUPO = 15;
const TURNOS_POR_PLAN = { "2dias":2, "3dias":3, "lv":6, "suelta":0 };

function getHorasDia(dia) {
  const [ini, fin] = dia === "SABADO" ? [8,13] : [7,22];
  return Array.from({length:fin-ini+1},(_,i)=>String(i+ini).padStart(2,"0")+":00");
}

export default function TurnosFijosPanel() {
  const { alumnos, config }       = useData();
  const planes                    = config?.planes || [];
  const [ocupacion, setOcupacion] = useState({});
  const [modal, setModal]         = useState(null);
  const [diaActivo, setDiaActivo] = useState("LUNES");
  const [selProfe, setSelProfe]   = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [formNuevo, setFormNuevo] = useState({ nombre:"", apellido:"", telefono:"", telefonoEmergencia:"", nombreEmergencia:"", planId:"" });

  // Ocupacion Ocupacion en tiempo real - semana actual
  useEffect(() => {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const dow = hoy.getDay();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1));
    const fechas = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      fechas.push(d.toISOString().split("T")[0]);
    }
    const q = query(collection(db, "reservas"), where("fecha", "in", fechas));
    const fn = onSnapshot(q, snap => {
      const cnt = {};
      snap.docs.forEach(d => {
        const r = d.data();
        const k = r.dia + "_" + r.hora.replace(":", "");
        cnt[k] = (cnt[k] || 0) + 1;
      });
      setOcupacion(cnt);
    }, err => console.error("ocupacion:", err.message));
    return () => fn();
  }, []);

  function cupoDisp(dia, hora) {
    return Math.max(0, CUPO - (ocupacion[dia + "_" + hora.replace(":", "")] || 0));
  }

  function toggleSel(dia, hora) {
    const esSel = selProfe.some(s => s.dia === dia && s.hora === hora);
    if (esSel) { setSelProfe(p => p.filter(s => !(s.dia === dia && s.hora === hora))); return; }
    if (cupoDisp(dia, hora) <= 0) { alert("Ese turno está lleno."); return; }
    const planId = modal?.planId || "";
    const max = TURNOS_POR_PLAN[planId] ?? 0;
    if (planId === "lv") { setSelProfe(p => [...p.filter(s => s.dia !== dia), { dia, hora }]); return; }
    if (selProfe.length >= max) { alert("Ya elegiste " + max + " turno" + (max !== 1 ? "s" : "") + "."); return; }
    setSelProfe(p => [...p, { dia, hora }]);
  }

  async function guardarAsignacion() {
    if (!modal || selProfe.length === 0) return;
    setGuardando(true);
    try {
      const nombre = (modal.nombre + " " + modal.apellido).trim();
      await borrarReservasFijas(modal.uid);
      await updateDoc(doc(db, "usuarios", modal.uid), {
        turnosFijos: selProfe,
        turnosFijosEstado: "aprobado",
        recuperacionesUsadas: 0,
      });
      await crearReservasFijas(modal.uid, nombre, selProfe, 4);
      setModal(null); setSelProfe([]);
    } catch (e) { console.error(e); alert("Error al guardar."); }
    setGuardando(false);
  }

  async function quitarFijos(alumno) {
    if (!confirm("Quitar los turnos fijos de " + alumno.nombre + "?")) return;
    await borrarReservasFijas(alumno.uid);
    await updateDoc(doc(db, "usuarios", alumno.uid), { turnosFijos: [], turnosFijosEstado: null });
  }

  async function crearAlumnoSinApp() {
    if (!formNuevo.nombre || !formNuevo.apellido || !formNuevo.planId) { alert("Completá nombre, apellido y plan."); return; }
    setGuardando(true);
    const plan = planes.find(p => p.id === formNuevo.planId);
    const vence = new Date(); vence.setMonth(vence.getMonth() + 1);
    const ref = await addDoc(collection(db, "usuarios"), {
      nombre: formNuevo.nombre, apellido: formNuevo.apellido,
      telefono: formNuevo.telefono, telefonoEmergencia: formNuevo.telefonoEmergencia,
      nombreEmergencia: formNuevo.nombreEmergencia,
      email: "", rol: "alumno", estado: "activo",
      planId: formNuevo.planId, planNombre: plan?.nombre || "",
      metodoPago: "efectivo", montoPagado: plan?.precioEfectivo || 0,
      fechaActivacion: null, // se registra cuando el profe aprueba el pago
      fechaVencimiento: null,
      turnosFijos: [], turnosFijosEstado: null,
      clasesUsadasMes: 0, recuperacionesUsadas: 0,
      creadoPorProfe: true, creadoEn: serverTimestamp(),
    });
    setModalNuevo(false);
    setFormNuevo({ nombre:"", apellido:"", telefono:"", telefonoEmergencia:"", nombreEmergencia:"", planId:"" });
    setModal({ uid: ref.id, nombre: formNuevo.nombre, apellido: formNuevo.apellido, planId: formNuevo.planId });
    setSelProfe([]);
    setGuardando(false);
  }

  // ---- MODAL ASIGNACION ----
  if (modal) {
    const planId = modal.planId || "";
    const max    = TURNOS_POR_PLAN[planId] ?? 0;
    const horas  = getHorasDia(diaActivo);
    const listo  = planId === "lv" ? selProfe.length > 0 : selProfe.length === max;

    return (
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{fontSize:15,fontWeight:500,color:"#111"}}>Asignar turnos — {modal.nombre} {modal.apellido}</div>
            <div style={{fontSize:13,color:"#888"}}>{selProfe.length}/{max} elegidos</div>
          </div>
          <button onClick={() => { setModal(null); setSelProfe([]); }}
            style={{background:"transparent",border:"0.5px solid #e0e0e0",borderRadius:8,padding:"7px 12px",fontSize:13,color:"#888",cursor:"pointer"}}>
            Cancelar
          </button>
        </div>

        {selProfe.length > 0 && (
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {selProfe.map((s,i) => (
              <span key={i} onClick={() => toggleSel(s.dia, s.hora)}
                style={{background:"#F5C400",color:"#111",fontSize:12,fontWeight:500,padding:"4px 12px",borderRadius:20,cursor:"pointer"}}>
                {DIAS_CORTO[s.dia]} {s.hora} ✕
              </span>
            ))}
          </div>
        )}

        <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
          {DIAS.map(dia => {
            const activo = diaActivo === dia;
            const tiene  = selProfe.some(s => s.dia === dia);
            return (
              <button key={dia} onClick={() => setDiaActivo(dia)}
                style={{flexShrink:0,background:activo?"#111":"#fff",color:activo?"#fff":"#555",
                  border:"0.5px solid "+(activo?"#111":"#e0e0e0"),borderRadius:10,padding:"8px 14px",
                  cursor:"pointer",fontSize:13,position:"relative"}}>
                {DIAS_CORTO[dia]}
                {tiene && <span style={{position:"absolute",top:4,right:4,width:6,height:6,borderRadius:"50%",background:"#F5C400"}}/>}
              </button>
            );
          })}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:20}}>
          {horas.map(hora => {
            const sel     = selProfe.some(s => s.dia === diaActivo && s.hora === hora);
            const c       = cupoDisp(diaActivo, hora);
            const ocupados = CUPO - c;
            const lleno   = c <= 0 && !sel;
            const maxSel  = selProfe.length >= max && planId !== "lv";
            const block   = lleno || (maxSel && !sel);
            return (
              <button key={hora} onClick={() => !block && toggleSel(diaActivo, hora)} disabled={block}
                style={{background:sel?"#FFFBEA":lleno?"#f9f9f9":"#fff",
                  border:"1.5px solid "+(sel?"#F5C400":lleno?"#f0f0f0":"#e0e0e0"),
                  borderRadius:10,padding:"12px 14px",cursor:block?"default":"pointer",
                  display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:16,fontWeight:500,color:block&&!sel?"#ccc":"#111",minWidth:52}}>{hora}</span>
                  <div style={{display:"flex",gap:3,flexWrap:"wrap",maxWidth:120}}>
                    {Array.from({length:CUPO},(_,i) => (
                      <span key={i} style={{width:7,height:7,borderRadius:"50%",flexShrink:0,
                        background:i<ocupados?(sel?"#F5C400":ocupados>=CUPO?"#f59e0b":"#10b981"):"#e8e8e8"}}/>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                  <span style={{fontSize:11,color:"#aaa"}}>{ocupados}/{CUPO}</span>
                  {sel    && <span style={{fontSize:11,fontWeight:500,color:"#7a5c00",background:"#FFF8DC",padding:"2px 8px",borderRadius:20}}>✓</span>}
                  {lleno  && <span style={{fontSize:11,color:"#92400e",background:"#fef3c7",padding:"2px 8px",borderRadius:20}}>Lleno</span>}
                  {!sel && !lleno && c <= 3 && <span style={{fontSize:11,color:"#92400e",background:"#fff7ed",padding:"2px 8px",borderRadius:20}}>{c} lugar{c!==1?"es":""}</span>}
                </div>
              </button>
            );
          })}
        </div>

        <button onClick={guardarAsignacion} disabled={!listo || guardando}
          style={{width:"100%",background:listo?"#F5C400":"#e0e0e0",color:listo?"#111":"#aaa",
            border:"none",borderRadius:10,padding:"13px",fontSize:15,fontWeight:700,cursor:listo?"pointer":"default"}}>
          {guardando ? "Reservando..." : "Guardar y reservar turnos →"}
        </button>
      </div>
    );
  }

  // ---- MODAL NUEVO ALUMNO SIN APP ----
  if (modalNuevo) {
    const inp = {width:"100%",padding:"9px 12px",borderRadius:8,border:"0.5px solid #e0e0e0",fontSize:13,boxSizing:"border-box"};
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:500}}>Nuevo alumno sin app</div>
          <button onClick={() => setModalNuevo(false)}
            style={{background:"transparent",border:"0.5px solid #e0e0e0",borderRadius:8,padding:"7px 12px",fontSize:13,color:"#888",cursor:"pointer"}}>
            Cancelar
          </button>
        </div>
        <p style={{fontSize:13,color:"#888",marginBottom:16,lineHeight:1.5}}>
          Cargás los datos del alumno, le asignás el plan y después elegís sus turnos fijos.
        </p>
        <div style={{marginBottom:14}}>
          <p style={{fontSize:11,fontWeight:500,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.07em",margin:"0 0 8px"}}>Datos personales</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>Nombre *</label>
              <input value={formNuevo.nombre} onChange={e => setFormNuevo(f => ({...f,nombre:e.target.value}))} style={inp}/>
            </div>
            <div>
              <label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>Apellido *</label>
              <input value={formNuevo.apellido} onChange={e => setFormNuevo(f => ({...f,apellido:e.target.value}))} style={inp}/>
            </div>
          </div>
          <label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>Teléfono</label>
          <input value={formNuevo.telefono} onChange={e => setFormNuevo(f => ({...f,telefono:e.target.value}))} placeholder="2664XXXXXXX" style={{...inp,marginBottom:10}}/>
        </div>
        <div style={{marginBottom:14}}>
          <p style={{fontSize:11,fontWeight:500,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.07em",margin:"0 0 8px"}}>Contacto de emergencia</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>Nombre</label>
              <input value={formNuevo.nombreEmergencia} onChange={e => setFormNuevo(f => ({...f,nombreEmergencia:e.target.value}))} placeholder="Ej: María (madre)" style={inp}/>
            </div>
            <div>
              <label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>Teléfono</label>
              <input value={formNuevo.telefonoEmergencia} onChange={e => setFormNuevo(f => ({...f,telefonoEmergencia:e.target.value}))} style={inp}/>
            </div>
          </div>
        </div>
        <div style={{marginBottom:20}}>
          <p style={{fontSize:11,fontWeight:500,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.07em",margin:"0 0 8px"}}>Plan</p>
          <select value={formNuevo.planId} onChange={e => setFormNuevo(f => ({...f,planId:e.target.value}))}
            style={{...inp,background:"#fff"}}>
            <option value="">Elegir plan...</option>
            {planes.map(p => <option key={p.id} value={p.id}>{p.nombre} — ${p.precioEfectivo?.toLocaleString("es-AR")}</option>)}
          </select>
        </div>
        <button onClick={crearAlumnoSinApp}
          disabled={guardando || !formNuevo.nombre || !formNuevo.apellido || !formNuevo.planId}
          style={{width:"100%",background:"#F5C400",color:"#111",border:"none",borderRadius:10,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer"}}>
          {guardando ? "Creando..." : "Crear y elegir turnos fijos →"}
        </button>
      </div>
    );
  }

  // ---- VISTA PRINCIPAL ----
  const conFijos = alumnos.filter(a => a.turnosFijosEstado === "aprobado" && (a.turnosFijos||[]).length > 0);
  const sinFijos = alumnos.filter(a => a.estado === "activo" && a.planId && a.planId !== "suelta" && a.turnosFijosEstado !== "aprobado");

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <h2 style={{fontSize:18,fontWeight:500,margin:0}}>Turnos fijos</h2>
        <button onClick={() => setModalNuevo(true)}
          style={{background:"#F5C400",color:"#111",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:500,cursor:"pointer"}}>
          + Alumno sin app
        </button>
      </div>

      {sinFijos.length > 0 && (
        <div style={{marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:500,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>
            Sin turnos fijos ({sinFijos.length})
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {sinFijos.map(a => (
              <div key={a.uid} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:34,height:34,borderRadius:"50%",background:"#F5C400",color:"#111",fontSize:12,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {(a.nombre||"?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{fontSize:14,fontWeight:500,color:"#111"}}>{a.nombre} {a.apellido}</div>
                    <div style={{fontSize:12,color:"#aaa"}}>{a.planNombre||"Sin plan"}</div>
                  </div>
                </div>
                <button onClick={() => { setModal({uid:a.uid,nombre:a.nombre,apellido:a.apellido,planId:a.planId}); setSelProfe([...(a.turnosFijos||[])]); }}
                  style={{background:"#F5C400",color:"#111",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:500,cursor:"pointer"}}>
                  Asignar turnos
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{fontSize:13,fontWeight:500,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>
          Turnos activos ({conFijos.length})
        </div>
        {conFijos.length === 0 ? (
          <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"32px",textAlign:"center",color:"#aaa"}}>
            <p style={{fontSize:13}}>Ningún alumno tiene turnos fijos activos.</p>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {conFijos.map(a => (
              <div key={a.uid} style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:"#F5C400",color:"#111",fontSize:12,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {(a.nombre||"?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{fontSize:14,fontWeight:500}}>{a.nombre} {a.apellido}</div>
                      <div style={{fontSize:11,color:"#aaa"}}>{a.planNombre} · Rec: {a.recuperacionesUsadas??0}/2</div>
                    </div>
                  </div>
                  <span style={{background:"#dcfce7",color:"#065f46",fontSize:11,fontWeight:500,padding:"3px 10px",borderRadius:20}}>Activo</span>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                  {(a.turnosFijos||[]).map((t,i) => (
                    <span key={i} style={{background:"#FFFBEA",color:"#7a5c00",fontSize:12,fontWeight:500,padding:"4px 12px",borderRadius:20}}>
                      {DIAS_FULL[t.dia]||t.dia} {t.hora}
                    </span>
                  ))}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={() => { setModal({uid:a.uid,nombre:a.nombre,apellido:a.apellido,planId:a.planId}); setSelProfe([...(a.turnosFijos||[])]); }}
                    style={{background:"#f5f5f5",border:"none",borderRadius:6,padding:"6px 12px",fontSize:12,color:"#555",cursor:"pointer"}}>
                    Editar turnos
                  </button>
                  <button onClick={() => quitarFijos(a)}
                    style={{background:"#fee2e2",border:"none",borderRadius:6,padding:"6px 12px",fontSize:12,color:"#dc2626",cursor:"pointer"}}>
                    Quitar fijos
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
