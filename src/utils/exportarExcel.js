// utils/exportarExcel.js

async function cargarXLSX() {
  if (!window.XLSX) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return window.XLSX;
}

// Exporta alumnos + reservas del mes en dos hojas
export async function exportarBackupExcel(alumnos, reservas) {
  const XLSX  = await cargarXLSX();
  const fecha = new Date().toLocaleDateString("es-AR");
  const wb    = XLSX.utils.book_new();

  // ---- Hoja 1: Alumnos ----
  const filasAlumnos = alumnos
    .sort((a,b) => (a.apellido||"").localeCompare(b.apellido||""))
    .map(a => ({
      "Apellido":              a.apellido || "",
      "Nombre":                a.nombre   || "",
      "Email":                 a.email    || "",
      "Telefono":              a.telefono || "",
      "Contacto emergencia":   a.nombreEmergencia || "",
      "Tel. emergencia":       a.telefonoEmergencia || "",
      "Plan":                  a.planNombre || "Sin plan",
      "Estado":                a.estado || "",
      "Metodo pago":           a.metodoPago || "",
      "Monto":                 a.montoPagado ? "$" + Number(a.montoPagado).toLocaleString("es-AR") : "",
      "Vencimiento":           a.fechaVencimiento
        ? new Date(a.fechaVencimiento.toDate?.() || a.fechaVencimiento).toLocaleDateString("es-AR")
        : "",
      "Recuperaciones usadas": a.recuperacionesUsadas ?? 0,
      "Turnos fijos":          (a.turnosFijos || []).map(t => t.dia.slice(0,3) + " " + t.hora).join(", "),
    }));

  const wsAlumnos = XLSX.utils.json_to_sheet(filasAlumnos);
  wsAlumnos["!cols"] = [
    { wch:18 },{ wch:16 },{ wch:28 },{ wch:16 },
    { wch:22 },{ wch:16 },{ wch:22 },{ wch:14 },
    { wch:14 },{ wch:12 },{ wch:14 },{ wch:10 },
    { wch:28 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAlumnos, "Alumnos");

  // ---- Hoja 2: Reservas del mes ----
  const hoy   = new Date();
  const mes   = hoy.getMonth();
  const anio  = hoy.getFullYear();
  const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const reservasMes = reservas
    .filter(r => {
      const [y,m] = r.fecha.split("-").map(Number);
      return y === anio && (m-1) === mes;
    })
    .sort((a,b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));

  const filasReservas = reservasMes.map(r => ({
    "Fecha":    r.fecha,
    "Dia":      r.dia || "",
    "Hora":     r.hora,
    "Alumno":   r.nombreAlumno || "",
    "Tipo":     r.esFijo ? "Turno fijo" : r.esPorFeriado ? "Recuperacion feriado" : r.esRecuperacion ? "Recuperacion" : "Reserva",
    "Asistio":  r.asistio === true ? "Presente" : r.asistio === false ? "Ausente" : "Sin marcar",
  }));

  const wsReservas = XLSX.utils.json_to_sheet(
    filasReservas.length > 0 ? filasReservas : [{ Nota: "Sin reservas este mes" }]
  );
  wsReservas["!cols"] = [{ wch:12 },{ wch:12 },{ wch:8 },{ wch:28 },{ wch:18 },{ wch:12 }];
  XLSX.utils.book_append_sheet(wb, wsReservas, "Reservas " + MESES[mes]);

  XLSX.writeFile(wb, "LaTorreGym_Backup_" + fecha.replace(/\//g, "-") + ".xlsx");
}

// Exporta solo alumnos (usado en Dashboard)
export async function exportarAlumnos(alumnos) {
  const XLSX  = await cargarXLSX();
  const fecha = new Date().toLocaleDateString("es-AR");
  const wb    = XLSX.utils.book_new();

  const filas = alumnos
    .sort((a,b) => (a.apellido||"").localeCompare(b.apellido||""))
    .map(a => ({
      "Apellido":              a.apellido || "",
      "Nombre":                a.nombre   || "",
      "Email":                 a.email    || "",
      "Telefono":              a.telefono || "",
      "Contacto emergencia":   a.nombreEmergencia || "",
      "Tel. emergencia":       a.telefonoEmergencia || "",
      "Plan":                  a.planNombre || "Sin plan",
      "Estado":                a.estado || "",
      "Metodo pago":           a.metodoPago || "",
      "Monto":                 a.montoPagado ? "$" + Number(a.montoPagado).toLocaleString("es-AR") : "",
      "Vencimiento":           a.fechaVencimiento
        ? new Date(a.fechaVencimiento.toDate?.() || a.fechaVencimiento).toLocaleDateString("es-AR")
        : "",
      "Recuperaciones usadas": a.recuperacionesUsadas ?? 0,
      "Turnos fijos":          (a.turnosFijos || []).map(t => t.dia.slice(0,3) + " " + t.hora).join(", "),
    }));

  const ws = XLSX.utils.json_to_sheet(filas);
  ws["!cols"] = [
    { wch:18 },{ wch:16 },{ wch:28 },{ wch:16 },
    { wch:22 },{ wch:16 },{ wch:22 },{ wch:14 },
    { wch:14 },{ wch:12 },{ wch:14 },{ wch:10 },{ wch:28 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Alumnos");
  XLSX.writeFile(wb, "LaTorreGym_Alumnos_" + fecha.replace(/\//g, "-") + ".xlsx");
}

// Exporta planilla del dia
export async function exportarPlanillaDia(reservasHoy, fecha) {
  const XLSX = await cargarXLSX();
  const ordenadas = [...reservasHoy].sort((a,b) => a.hora.localeCompare(b.hora));
  const filas = ordenadas.map(r => ({
    "Hora":    r.hora,
    "Alumno":  r.nombreAlumno || "",
    "Tipo":    r.esFijo ? "Turno fijo" : r.esRecuperacion ? "Recuperacion" : "Reserva",
    "Asistio": r.asistio === true ? "Presente" : r.asistio === false ? "Ausente" : "",
  }));
  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  ws["!cols"] = [{ wch:8 },{ wch:28 },{ wch:16 },{ wch:10 }];
  XLSX.utils.book_append_sheet(wb, ws, "Hoy");
  XLSX.writeFile(wb, "LaTorreGym_" + fecha + ".xlsx");
}
