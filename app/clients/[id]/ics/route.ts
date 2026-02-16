// app/appointments/[id]/ics/route.ts
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** --------- Auth + Business --------- */
async function getAuthedUserOrRedirect() {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) redirect("/login");
    return data.user;
}

async function getBusinessForUserOrRedirect(userId: string) {
    const business = await prisma.business.findFirst({
        where: { ownerId: userId },
        select: { id: true, name: true, timezone: true },
    });

    if (!business) redirect("/setup");
    return business;
}

/** --------- ICS helpers --------- */
function formatICSDateUTC(d: Date) {
    // YYYYMMDDTHHMMSSZ
    const iso = d.toISOString(); // 2026-02-15T10:30:00.000Z
    const y = iso.slice(0, 4);
    const m = iso.slice(5, 7);
    const day = iso.slice(8, 10);
    const hh = iso.slice(11, 13);
    const mm = iso.slice(14, 16);
    const ss = iso.slice(17, 19);
    return `${y}${m}${day}T${hh}${mm}${ss}Z`;
}

function escapeICSText(input: string) {
    // RFC 5545: escape backslash, comma, semicolon, newline
    return input
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
}

function foldLine(line: string) {
    // Soft wrap at 75 chars (approx). Good enough for most clients.
    const max = 75;
    if (line.length <= max) return [line];

    const out: string[] = [];
    let i = 0;
    while (i < line.length) {
        const chunk = line.slice(i, i + max);
        out.push(i === 0 ? chunk : " " + chunk); // continuation starts with space
        i += max;
    }
    return out;
}

function buildICS(lines: string[]) {
    // Fold + CRLF
    const folded = lines.flatMap((l) => foldLine(l));
    return folded.join("\r\n") + "\r\n";
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const user = await getAuthedUserOrRedirect();
    const business = await getBusinessForUserOrRedirect(user.id);

    const appt = await prisma.appointment.findFirst({
        where: { id, businessId: business.id },
        include: { client: { select: { name: true, email: true, phone: true } } },
    });

    if (!appt) {
        return new Response("Not found", { status: 404 });
    }

    const now = new Date();
    const uid = `${appt.id}@terminbuddy-wien`;
    const dtstamp = formatICSDateUTC(now);
    const dtstart = formatICSDateUTC(appt.startsAt);
    const dtend = formatICSDateUTC(appt.endsAt);

    const clientName = appt.client?.name ?? "Cliente";
    const summary = escapeICSText(`Cita — ${clientName}`);

    const parts: string[] = [];
    if (appt.notes) parts.push(`Notas: ${appt.notes}`);
    if (appt.client?.email) parts.push(`Email: ${appt.client.email}`);
    if (appt.client?.phone) parts.push(`Tel: ${appt.client.phone}`);
    parts.push(`Negocio: ${business.name}`);
    parts.push(`TZ: ${business.timezone}`);

    const description = escapeICSText(parts.join("\n"));

    const statusLine =
        String(appt.status) === "CANCELLED" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED";

    const filenameSafeDate = appt.startsAt.toISOString().slice(0, 10);
    const filename = `cita-${filenameSafeDate}-${appt.id.slice(0, 8)}.ics`;

    const ics = buildICS([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TerminBuddy Wien//ES",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        `X-WR-TIMEZONE:${business.timezone}`,
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        statusLine,
        "END:VEVENT",
        "END:VCALENDAR",
    ]);

    return new Response(ics, {
        headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "private, no-store, max-age=0",
        },
    });
}
