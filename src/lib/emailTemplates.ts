type ApptInfo = {
    businessName: string;
    timeZone: string;
    clientName: string;
    clientEmail: string;
    clientPhone?: string | null;
    startsAt: Date;
    endsAt: Date;
    notes?: string | null;
};

function fmtDate(dt: Date, timeZone: string) {
    return new Intl.DateTimeFormat("es-ES", {
        timeZone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "2-digit",
    }).format(dt);
}

function fmtTime(dt: Date, timeZone: string) {
    return new Intl.DateTimeFormat("es-ES", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(dt);
}

export function confirmationEmail(appt: ApptInfo) {
    const date = fmtDate(appt.startsAt, appt.timeZone);
    const start = fmtTime(appt.startsAt, appt.timeZone);
    const end = fmtTime(appt.endsAt, appt.timeZone);

    const subject = `Confirmación de cita — ${date} ${start}`;
    const html = `
  <div style="font-family: ui-sans-serif, system-ui; line-height:1.5">
    <h2 style="margin:0 0 12px">Cita confirmada ✅</h2>
    <p style="margin:0 0 10px"><b>${appt.businessName}</b></p>
    <p style="margin:0 0 10px"><b>Cliente:</b> ${appt.clientName}</p>
    <p style="margin:0 0 10px"><b>Fecha:</b> ${date}</p>
    <p style="margin:0 0 10px"><b>Hora:</b> ${start} → ${end}</p>
    ${appt.notes ? `<p style="margin:0 0 10px"><b>Notas:</b> ${appt.notes}</p>` : ""}
    <p style="margin:14px 0 0; color:#666; font-size:12px">Zona horaria: ${appt.timeZone}</p>
  </div>
  `;
    return { subject, html };
}

export function reminderEmail(appt: ApptInfo, kind: "REMINDER_24H" | "REMINDER_2H") {
    const date = fmtDate(appt.startsAt, appt.timeZone);
    const start = fmtTime(appt.startsAt, appt.timeZone);
    const end = fmtTime(appt.endsAt, appt.timeZone);

    const label = kind === "REMINDER_24H" ? "Recordatorio (24h)" : "Recordatorio (2h)";
    const subject = `${label} — ${date} ${start}`;

    const html = `
  <div style="font-family: ui-sans-serif, system-ui; line-height:1.5">
    <h2 style="margin:0 0 12px">${label} ⏰</h2>
    <p style="margin:0 0 10px"><b>${appt.businessName}</b></p>
    <p style="margin:0 0 10px"><b>Cliente:</b> ${appt.clientName}</p>
    <p style="margin:0 0 10px"><b>Fecha:</b> ${date}</p>
    <p style="margin:0 0 10px"><b>Hora:</b> ${start} → ${end}</p>
    ${appt.notes ? `<p style="margin:0 0 10px"><b>Notas:</b> ${appt.notes}</p>` : ""}
    <p style="margin:14px 0 0; color:#666; font-size:12px">Zona horaria: ${appt.timeZone}</p>
  </div>
  `;
    return { subject, html };
}
