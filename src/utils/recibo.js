/* ── Número a palabras (español AR) ── */
export function numToWords(n) {
  if (n === 0) return "CERO";
  const u = ["","UNO","DOS","TRES","CUATRO","CINCO","SEIS","SIETE","OCHO","NUEVE",
    "DIEZ","ONCE","DOCE","TRECE","CATORCE","QUINCE","DIECISÉIS","DIECISIETE","DIECIOCHO","DIECINUEVE","VEINTE"];
  const d = ["","","VEINTE","TREINTA","CUARENTA","CINCUENTA","SESENTA","SETENTA","OCHENTA","NOVENTA"];
  const c = ["","CIENTO","DOSCIENTOS","TRESCIENTOS","CUATROCIENTOS","QUINIENTOS",
    "SEISCIENTOS","SETECIENTOS","OCHOCIENTOS","NOVECIENTOS"];

  function grupo(x) {
    if (x === 0) return "";
    if (x === 100) return "CIEN";
    let s = "";
    if (x >= 100) { s += c[Math.floor(x / 100)] + " "; x %= 100; }
    if (x >= 21) { s += d[Math.floor(x / 10)] + (x % 10 > 0 ? " Y " + u[x % 10] : ""); }
    else if (x > 0) s += u[x];
    return s.trim();
  }

  const entero = Math.floor(n);
  const centavos = Math.round((n - entero) * 100);
  let result = "";
  let rest = entero;

  if (rest >= 1000000) {
    const m = Math.floor(rest / 1000000);
    result += (m === 1 ? "UN MILLÓN" : grupo(m) + " MILLONES") + " ";
    rest %= 1000000;
  }
  if (rest >= 1000) {
    const k = Math.floor(rest / 1000);
    result += (k === 1 ? "MIL" : grupo(k) + " MIL") + " ";
    rest %= 1000;
  }
  if (rest > 0) result += grupo(rest);

  result = result.trim() + " PESOS";
  if (centavos > 0) result += " CON " + centavos + "/100";
  return result;
}

/* ── HTML de un recibo (ORIGINAL + DUPLICADO) ── */
export function generarReciboHTML({ nro, nombre, apellido, planNombre, montoEfectivo, montoTransferencia, total, fecha, logoUrl }) {
  const fechaFmt = fecha ? new Date(fecha).toLocaleDateString("es-AR") : new Date().toLocaleDateString("es-AR");
  const enLetras = numToWords(total);

  function bloque(tipo) {
    return `
      <div class="recibo">
        <div class="header">
          <div class="logo-wrap">
            <img src="${logoUrl}" alt="La Torre Gym" style="height:54px; object-fit:contain;" />
          </div>
          <div class="header-right">
            <div class="fecha">Fecha: ${fechaFmt}</div>
            <div class="tipo">${tipo}</div>
          </div>
        </div>

        <div class="nro">RECIBO NRO: &nbsp;<strong>${String(nro).padStart(5,"0")}</strong></div>
        <hr class="linea" />

        <table class="info">
          <tr><td class="label">Recibi del Sr/Sra:</td><td><strong>${nombre} ${apellido}</strong></td></tr>
          <tr><td class="label">La suma de pesos:</td><td><strong>${enLetras}</strong></td></tr>
          <tr><td class="label">En Concepto de:</td><td>LA TORRE GYM${planNombre ? " — " + planNombre : ""}</td></tr>
        </table>

        <div class="metodos">
          <span>Efectivo:&nbsp;<strong>${montoEfectivo > 0 ? montoEfectivo.toLocaleString("es-AR") : "—"}</strong></span>
          <span>Transferencia:&nbsp;<strong>${montoTransferencia > 0 ? montoTransferencia.toLocaleString("es-AR") : "—"}</strong></span>
        </div>

        <div class="importe-row">
          <span class="importe-label">Importe:</span>
          <span class="importe-box">${total.toLocaleString("es-AR")}</span>
        </div>

        <div class="footer-row">
          <div class="no-factura">* El presente recibo no es válido como factura *</div>
          <div class="firma">____________________<br/>COMPLEJO LA TORRE</div>
        </div>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Recibo #${nro}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }

    .recibo {
      width: 100%;
      border: 1px solid #555;
      padding: 14px 18px;
      page-break-inside: avoid;
    }
    .separador {
      border: none;
      border-top: 2px dashed #999;
      margin: 10px 0;
    }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .header-right { text-align: right; }
    .fecha { font-size: 11px; color: #555; }
    .tipo { font-weight: bold; font-size: 13px; margin-top: 4px; letter-spacing: 1px; }

    /* NRO */
    .nro { font-size: 15px; text-align: center; margin-bottom: 8px; letter-spacing: 1px; }
    .linea { border: none; border-top: 1px solid #333; margin-bottom: 10px; }

    /* Info */
    .info { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .info tr td { padding: 3px 4px; vertical-align: top; }
    .info .label { white-space: nowrap; color: #555; width: 160px; }

    /* Métodos de pago */
    .metodos { display: flex; gap: 30px; margin-bottom: 10px; }
    .metodos span { font-size: 12px; }

    /* Importe */
    .importe-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .importe-label { font-size: 12px; color: #555; }
    .importe-box { border: 1px solid #333; padding: 3px 14px; font-weight: bold; font-size: 13px; min-width: 80px; text-align: center; }

    /* Footer */
    .footer-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 10px; }
    .no-factura { font-size: 10px; color: #888; font-style: italic; align-self: flex-end; }
    .firma { text-align: right; font-size: 11px; color: #555; line-height: 1.6; }
  </style>
</head>
<body>
  ${bloque("ORIGINAL")}
  <hr class="separador" />
  ${bloque("DUPLICADO")}
  <script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;
}

/* ── HTML de caja del día/mes para imprimir ── */
export function generarCajaHTML({ pagos, titulo, logoUrl }) {
  const totalEf = pagos.reduce((s, a) => s + (a.montoEfectivo      ?? (a.metodoPago === "efectivo"      ? a.montoPagado : 0)), 0);
  const totalTr = pagos.reduce((s, a) => s + (a.montoTransferencia ?? (a.metodoPago === "transferencia"  ? a.montoPagado : 0)), 0);
  const total   = totalEf + totalTr;

  const filas = pagos
    .sort((a, b) => new Date(a.fechaActivacion?.toDate?.() || a.fechaActivacion) - new Date(b.fechaActivacion?.toDate?.() || b.fechaActivacion))
    .map(a => {
      const ef = a.montoEfectivo      ?? (a.metodoPago === "efectivo"      ? a.montoPagado : 0);
      const tr = a.montoTransferencia ?? (a.metodoPago === "transferencia"  ? a.montoPagado : 0);
      const fecha = new Date(a.fechaActivacion?.toDate?.() || a.fechaActivacion).toLocaleDateString("es-AR");
      return `<tr>
        <td>${fecha}</td>
        <td>${a.nombre} ${a.apellido}</td>
        <td>${a.planNombre || "—"}</td>
        <td class="num">${ef > 0 ? "$" + ef.toLocaleString("es-AR") : "—"}</td>
        <td class="num">${tr > 0 ? "$" + tr.toLocaleString("es-AR") : "—"}</td>
        <td class="num"><strong>$${(a.montoPagado||0).toLocaleString("es-AR")}</strong></td>
      </tr>`;
    }).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${titulo}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 2px solid #111; padding-bottom: 10px; }
    h1 { font-size: 16px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #111; color: #fff; padding: 6px 8px; font-size: 11px; text-align: left; }
    td { padding: 5px 8px; border-bottom: 0.5px solid #e0e0e0; font-size: 12px; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .num { text-align: right; }
    .totales { display: flex; gap: 20px; justify-content: flex-end; margin-top: 8px; }
    .total-box { border: 1px solid #333; padding: 8px 16px; text-align: center; border-radius: 6px; }
    .total-box .lbl { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 3px; }
    .total-box .val { font-size: 16px; font-weight: bold; }
    .total-box.general { background: #111; color: #fff; border-color: #111; }
    .total-box.general .lbl { color: #aaa; }
    .no-factura { font-size: 10px; color: #aaa; text-align: center; margin-top: 14px; font-style: italic; }
  </style>
</head>
<body>
  <div class="header">
    <img src="${logoUrl}" alt="La Torre Gym" style="height:48px; object-fit:contain;" />
    <div style="text-align:right">
      <h1>${titulo}</h1>
      <div style="font-size:11px; color:#888;">Impreso: ${new Date().toLocaleDateString("es-AR")} ${new Date().toLocaleTimeString("es-AR", {hour:"2-digit",minute:"2-digit"})}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Fecha</th><th>Alumno</th><th>Plan</th><th class="num">Efectivo</th><th class="num">Transferencia</th><th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${filas || '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:16px;">Sin pagos</td></tr>'}</tbody>
  </table>

  <div class="totales">
    <div class="total-box">
      <div class="lbl">Efectivo</div>
      <div class="val">$${totalEf.toLocaleString("es-AR")}</div>
    </div>
    <div class="total-box">
      <div class="lbl">Transferencia</div>
      <div class="val">$${totalTr.toLocaleString("es-AR")}</div>
    </div>
    <div class="total-box general">
      <div class="lbl">Total</div>
      <div class="val">$${total.toLocaleString("es-AR")}</div>
    </div>
  </div>

  <div class="no-factura">* El presente documento no es válido como factura *</div>
  <script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;
}
