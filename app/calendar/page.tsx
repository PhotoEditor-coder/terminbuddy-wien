// app/calendar/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NowLine } from "./NowLine";

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

/** --------- Date helpers (timezone-safe display/position) --------- */
function getZonedParts(date: Date, timeZone: string) {
    const dtf = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    });

    const parts = dtf.formatToParts(date);
    const map: Record<string, string> = {};
    for (const p of parts) {
        if (p.type !== "literal") map[p.type] = p.value;
    }

    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        hour: Number(map.hour),
        minute: Number(map.minute),
        ymd: `${map.year}-${map.month}-${map.day}`, // YYYY-MM-DD
    };
}

function formatTime(date: Date, timeZone: string) {
    return new Intl.DateTimeFormat("es-ES", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(date);
}

function formatDayHeader(isoDate: string, timeZone: string) {
    const d = new Date(isoDate + "T12:00:00.000Z");
    return new Intl.DateTimeFormat("es-ES", {
        timeZone,
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
    }).format(d);
}

function isoFromUTCDate(d: Date) {
    return d.toISOString().slice(0, 10);
}

function addDaysUTC(d: Date, days: number) {
    return new Date(d.getTime() + days * 86_400_000);
}

/** Week start (Monday) in business timezone, returned as YYYY-MM-DD */
function getWeekStartISO(timeZone: string, now = new Date()) {
    const p = getZonedParts(now, timeZone);

    const wk = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = map[wk] ?? 1;

    const localAsUTC = new Date(Date.UTC(p.year, p.month - 1, p.day));
    const diffToMonday = (dow + 6) % 7; // Mon -> 0, Tue -> 1, ..., Sun -> 6
    const mondayUTC = addDaysUTC(localAsUTC, -diffToMonday);

    return isoFromUTCDate(mondayUTC);
}

type PageProps = {
    searchParams?: { week?: string };
};

type CalendarAppt = {
    id: string;
    clientName: string;
    status: string;
    notes: string | null;
    startsAt: Date;
    endsAt: Date;
    dayKey: string;
    startMin: number;
    durationMin: number;
};

export default async function CalendarPage({ searchParams }: PageProps) {
    const user = await getAuthedUserOrRedirect();
    const business = await getBusinessForUserOrRedirect(user.id);

    const timeZone = business.timezone;
    const todayISO = getZonedParts(new Date(), timeZone).ymd;

    const weekStartISO =
        searchParams?.week && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.week)
            ? searchParams.week
            : getWeekStartISO(timeZone);

    const weekStartUTC = new Date(weekStartISO + "T00:00:00.000Z");
    const daysISO = Array.from({ length: 7 }, (_, i) => isoFromUTCDate(addDaysUTC(weekStartUTC, i)));

    // Rango un poco amplio para evitar fallos por TZ
    const rangeStart = addDaysUTC(weekStartUTC, -1);
    const rangeEnd = addDaysUTC(weekStartUTC, 8);

    const raw = await prisma.appointment.findMany({
        where: {
            businessId: business.id,
            startsAt: { gte: rangeStart, lt: rangeEnd },
        },
        orderBy: { startsAt: "asc" },
        include: { client: { select: { name: true } } },
        take: 500,
    });

    const appts: CalendarAppt[] = raw
        .map((a) => {
            const sp = getZonedParts(a.startsAt, timeZone);
            return {
                id: a.id,
                clientName: a.client?.name ?? "—",
                status: String(a.status),
                notes: a.notes ?? null,
                startsAt: a.startsAt,
                endsAt: a.endsAt,
                dayKey: sp.ymd,
                startMin: sp.hour * 60 + sp.minute,
                durationMin: Math.max(5, Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000)),
            };
        })
        .filter((x) => daysISO.includes(x.dayKey));

    const byDay: Record<string, CalendarAppt[]> = Object.fromEntries(daysISO.map((d) => [d, []]));
    for (const a of appts) byDay[a.dayKey].push(a);

    // Config rejilla
    const startHour = 7;
    const endHour = 21;

    // ✅ Slots cada 15 minutos
    const slotMinutes = 15;           // 15 min
    const slotsPerHour = 60 / slotMinutes; // 4
    const slotH = 56;                 // altura por HORA (se mantiene)
    const pxPerMinute = slotH / 60;   // px por minuto
    const slotPx = pxPerMinute * slotMinutes; // altura por slot de 15min

    const gridH = (endHour - startHour) * slotH;

    const prevWeek = isoFromUTCDate(addDaysUTC(weekStartUTC, -7));
    const nextWeek = isoFromUTCDate(addDaysUTC(weekStartUTC, 7));

    // Para click slots
    const totalSlots = (endHour - startHour) * slotsPerHour;

    return (
        <div className="min-h-screen bg-zinc-50 px-6 py-10 text-black">
            <main className="mx-auto w-full max-w-6xl space-y-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight">Calendario semanal</h1>
                        <p className="mt-1 text-sm text-zinc-600">
                            Negocio: <span className="font-medium text-black">{business.name}</span>{" "}
                            <span className="text-zinc-500">({business.timezone})</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                        <Link className="underline" href="/dashboard">
                            Volver al dashboard
                        </Link>
                        <Link
                            className="rounded-full border border-black/20 bg-white px-4 py-2 hover:bg-black hover:text-white transition-colors"
                            href={`/appointments/new?week=${weekStartISO}`}
                        >
                            + Nueva cita
                        </Link>
                    </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-black/20 bg-white px-4 py-3">
                    <div className="text-sm text-zinc-700">
                        Semana: <span className="font-medium">{weekStartISO}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            className="rounded-full border border-black/20 px-4 py-2 text-sm hover:bg-black hover:text-white transition-colors"
                            href={`/calendar?week=${prevWeek}`}
                        >
                            ← Anterior
                        </Link>
                        <Link
                            className="rounded-full border border-black/20 px-4 py-2 text-sm hover:bg-black hover:text-white transition-colors"
                            href={`/calendar?week=${nextWeek}`}
                        >
                            Siguiente →
                        </Link>
                    </div>
                </div>

                {/* Grid */}
                <section className="overflow-hidden rounded-2xl border border-black/20 bg-white">
                    {/* Header days */}
                    <div className="grid grid-cols-[88px_repeat(7,minmax(0,1fr))] border-b border-black/10 bg-zinc-50">
                        <div className="p-3 text-xs font-semibold text-zinc-600">Hora</div>

                        {daysISO.map((d) => {
                            const isToday = d === todayISO;
                            return (
                                <div
                                    key={d}
                                    className={[
                                        "p-3 text-xs font-semibold",
                                        isToday ? "bg-black text-white" : "text-zinc-700",
                                    ].join(" ")}
                                >
                                    {formatDayHeader(d, timeZone)}
                                </div>
                            );
                        })}
                    </div>

                    <div className="grid grid-cols-[88px_repeat(7,minmax(0,1fr))]">
                        {/* Left hours */}
                        <div className="border-r border-black/10">
                            <div style={{ height: gridH }} className="relative">
                                {Array.from({ length: endHour - startHour + 1 }, (_, i) => {
                                    const h = startHour + i;
                                    const top = i * slotH;
                                    return (
                                        <div key={h} className="absolute left-0 right-0" style={{ top }}>
                                            <div className="px-3 text-xs text-zinc-500">{String(h).padStart(2, "0")}:00</div>
                                            <div className="mt-2 border-t border-black/5" />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Day columns */}
                        {daysISO.map((dayISO) => {
                            const isToday = dayISO === todayISO;

                            return (
                                <div
                                    key={dayISO}
                                    className={[
                                        "border-r border-black/10 last:border-r-0",
                                        isToday ? "bg-zinc-50" : "bg-white",
                                    ].join(" ")}
                                >
                                    <div style={{ height: gridH }} className="relative">
                                        {/* Click slots (cada 15 min) */}
                                        {Array.from({ length: totalSlots }, (_, idx) => {
                                            const minutesFromStart = idx * slotMinutes;
                                            const hour = startHour + Math.floor(minutesFromStart / 60);
                                            const minute = minutesFromStart % 60;

                                            const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
                                            const top = idx * slotPx;

                                            return (
                                                <Link
                                                    key={idx}
                                                    href={`/appointments/new?week=${weekStartISO}&date=${dayISO}&time=${encodeURIComponent(time)}`}
                                                    className="absolute left-0 right-0 z-0 hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/60 transition-colors"
                                                    style={{ top, height: slotPx }}
                                                    aria-label={`Crear cita el ${dayISO} a las ${time}`}
                                                />
                                            );
                                        })}

                                        {/* Hour lines (no bloquean clicks) */}
                                        {Array.from({ length: endHour - startHour }, (_, i) => (
                                            <div
                                                key={i}
                                                className="pointer-events-none absolute left-0 right-0 z-10 border-t border-black/5"
                                                style={{ top: i * slotH }}
                                            />
                                        ))}

                                        {/* Quarter-hour lines (sutiles) */}
                                        {Array.from({ length: totalSlots }, (_, idx) => {
                                            // dibuja solo 15/30/45, no el 00 (ya existe la línea de hora)
                                            const minutes = (idx * slotMinutes) % 60;
                                            if (minutes === 0) return null;
                                            return (
                                                <div
                                                    key={idx}
                                                    className="pointer-events-none absolute left-0 right-0 z-10 border-t border-black/[0.04]"
                                                    style={{ top: idx * slotPx }}
                                                />
                                            );
                                        })}

                                        {/* Now line (solo en hoy) */}
                                        <NowLine
                                            dayISO={dayISO}
                                            timeZone={timeZone}
                                            startHour={startHour}
                                            endHour={endHour}
                                            slotH={slotH}   // slotH por hora (NowLine usa minutos→px)
                                            gridH={gridH}
                                        />

                                        {/* Events (clicables) */}
                                        {byDay[dayISO].map((a) => {
                                            const top = ((a.startMin - startHour * 60) / 60) * slotH;
                                            const height = (a.durationMin / 60) * slotH;

                                            if (top + height < 0 || top > gridH) return null;

                                            return (
                                                <Link
                                                    key={a.id}
                                                    href={`/appointments/${a.id}/edit`}
                                                    className="group absolute left-2 right-2 z-20 rounded-xl border border-black/20 bg-white px-3 py-2 shadow-sm hover:bg-black hover:text-white transition-colors"
                                                    style={{
                                                        top: Math.max(2, top),
                                                        height: Math.max(28, height),
                                                    }}
                                                    title={a.notes ?? ""}
                                                >
                                                    <div className="text-xs font-semibold">{a.clientName}</div>
                                                    <div className="text-[11px] text-zinc-600 group-hover:text-white">
                                                        {formatTime(a.startsAt, timeZone)} → {formatTime(a.endsAt, timeZone)}
                                                    </div>
                                                    {a.notes ? (
                                                        <div className="mt-1 text-[11px] text-zinc-500 line-clamp-2 group-hover:text-zinc-200">
                                                            {a.notes}
                                                        </div>
                                                    ) : null}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <p className="text-xs text-zinc-500">
                    Nota: el posicionamiento usa la zona horaria del negocio (
                    <span className="font-medium">{business.timezone}</span>).
                </p>
            </main>
        </div>
    );
}
