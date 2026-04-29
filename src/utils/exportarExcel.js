// utils/exportarExcel.js
// Exporta el listado de alumnos a Excel usando SheetJS

export async function exportarAlumnos(alumnos) {
  // Cargar SheetJS dinamicamente
  if (!window.XLSX) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  const XLSX = window.XLSX;

  const fecha = new Date().toLocaleDateString("es-AR");

  const filas = alumnos.map(a => ({
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
    "Clases usadas mes":     a.clasesUsadasMes ?? 0,
    "Recuperaciones usadas": a.recuperacionesUsadas ?? 0,
    "Turnos fijos estado":   a.turnosFijosEstado || "",
    "Turnos fijos":          (a.turnosFijos || []).map(t => t.dia.slice(0,3) + " " + t.hora).join(", "),
  }));

  const ws   = XLSX.utils.json_to_sheet(filas);
  const wb   = XLSX.utils.book_new();

  // Ancho de columnas
  ws["!cols"] = [
    { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 16 },
    { wch: 22 }, { wch: 16 }, { wch: 22 }, { wch: 14 },
    { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
    { wch: 10  }, { wch: 16 }, { wch: 28 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Alumnos");
  XLSX.writeFile(wb, "LaTorreGym_Alumnos_" + fecha.replace(/\//g, "-") + ".xlsx");
}

// Exporta la planilla del dia actual con alumnos y horarios
export async function exportarPlanillaDia(reservasHoy, fecha) {
  if (!window.XLSX) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  const XLSX = window.XLSX;

  // Ordenar por hora
  const ordenadas = [...reservasHoy].sort((a,b) => a.hora.localeCompare(b.hora));

  const filas = ordenadas.map(r => ({
    "Hora":      r.hora,
    "Alumno":    r.nombreAlumno || "",
    "Tipo":      r.esFijo ? "Turno fijo" : r.esRecuperacion ? "Recuperacion" : "Reserva",
    "Asistio":   r.asistio === true ? "Presente" : r.asistio === false ? "Ausente" : "",
  }));

  const ws  = XLSX.utils.json_to_sheet(filas);
  const wb  = XLSX.utils.book_new();
  ws["!cols"] = [{ wch:8 }, { wch:28 }, { wch:16 }, { wch:10 }];
  XLSX.utils.book_append_sheet(wb, ws, "Hoy");
  XLSX.writeFile(wb, "LaTorreGym_" + fecha + ".xlsx");
}
