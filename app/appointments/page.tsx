// app/appointments/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { AppointmentStatus } from "@prisma/client";

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

/** --------- Utils --------- */
function fmt(dt: Date, timeZone: string) {
    return new Intl.DateTimeFormat("es-ES", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(dt);
}

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
    for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;

    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        ymd: `${map.year}-${map.month}-${map.day}`,
    };
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
    const diffToMonday = (dow + 6) % 7; // Mon -> 0 ... Sun -> 6
    const mondayUTC = addDaysUTC(localAsUTC, -diffToMonday);

    return isoFromUTCDate(mondayUTC);
}

/** Week start (Monday) for a specific Date (appt.startsAt) in business TZ */
function getWeekStartISOFromDate(date: Date, timeZone: string) {
    const p = getZonedParts(date, timeZone);

    const wk = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = map[wk] ?? 1;

    const localAsUTC = new Date(Date.UTC(p.year, p.month - 1, p.day));
    const diffToMonday = (dow + 6) % 7;
    const mondayUTC = addDaysUTC(localAsUTC, -diffToMonday);

    return isoFromUTCDate(mondayUTC);
}

function isStatus(v: string): v is AppointmentStatus {
    return v === "BOOKED" || v === "CANCELLED" || v === "COMPLETED";
}

function withQuery(base: string, params: Record<string, string>) {
    const u = new URL(base, "http://local");
    for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
    return u.pathname + u.search;
}

type PageProps = {
    searchParams?: { status?: string; q?: string; order?: string };
};

export default async function AppointmentsPage({ searchParams }: PageProps) {
    const user = await getAuthedUserOrRedirect();
    const business = await getBusinessForUserOrRedirect(user.id);

    const timeZone = business.timezone;
    const weekNow = getWeekStartISO(timeZone);

    const q = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
    const statusParam = typeof searchParams?.status === "string" ? searchParams.status.trim() : "ALL";
    const orderParam = typeof searchParams?.order === "string" ? searchParams.order.trim() : "asc";

    const statusFilter: AppointmentStatus | null = isStatus(statusParam) ? statusParam : null;
    const order: "asc" | "desc" = orderParam === "desc" ? "desc" : "asc";

    const returnTo = withQuery("/appointments", {
        status: statusParam !== "ALL" ? statusParam : "",
        q,
        order: order !== "asc" ? order : "",
    });

    const where: any = {
        businessId: business.id,
    };

    if (statusFilter) where.status = statusFilter;

    if (q) {
        where.client = {
            name: { contains: q, mode: "insensitive" },
        };
    }

    const appointments = await prisma.appointment.findMany({
        where,
        orderBy: { startsAt: order },
        include: {
            client: { select: { name: true, email: true, phone: true } },
        },
        take: 300,
    });

    async function cancelAppointment(formData: FormData) {
        "use server";

        const user = await getAuthedUserOrRedirect();
        const business = await getBusinessForUserOrRedirect(user.id);

        const id = String(formData.get("id") || "").trim();
        const back = String(formData.get("returnTo") || "/appointments").trim();

        if (!id) redirect("/appointments");

        await prisma.appointment.updateMany({
            where: { id, businessId: business.id },
            data: { status: "CANCELLED" },
        });

        // Seguridad: solo permitimos volver a /appointments...
        if (back.startsWith("/appointments")) redirect(back);
        redirect("/appointments");
    }

    return (
        <div className="flex min-h-screen items-start justify-center bg-zinc-50 px-6 py-16 text-black">
            <main className="w-full max-w-5xl space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h1 className="text-3xl font-semibold tracking-tight">Citas</h1>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        <Link className="underline" href="/dashboard">
                            Volver al dashboard
                        </Link>
                        <Link className="underline" href={`/calendar?week=${weekNow}`}>
                            Ver calendario
                        </Link>
                        <Link
                            className="rounded-full border border-black/20 bg-white px-5 py-2 hover:bg-black hover:text-white transition-colors"
                            href={`/appointments/new?week=${weekNow}`}
                        >
                            + Nueva cita
                        </Link>
                    </div>
                </div>

                <section className="rounded-2xl border border-black/20 bg-white p-6 space-y-5">
                    <p className="text-sm text-zinc-600">
                        Negocio: <span className="font-medium text-black">{business.name}</span>{" "}
                        <span className="text-zinc-500">({business.timezone})</span>
                    </p>

                    {/* Filters */}
                    <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-black/10 bg-zinc-50 p-4">
                        <div className="min-w-[180px]">
                            <label className="block text-xs font-semibold text-zinc-700">Estado</label>
                            <select
                                name="status"
                                defaultValue={statusParam}
                                className="mt-1 w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-sm"
                            >
                                <option value="ALL">Todos</option>
                                <option value="BOOKED">BOOKED</option>
                                <option value="COMPLETED">COMPLETED</option>
                                <option value="CANCELLED">CANCELLED</option>
                            </select>
                        </div>

                        <div className="min-w-[220px] flex-1">
                            <label className="block text-xs font-semibold text-zinc-700">Buscar cliente</label>
                            <input
                                name="q"
                                defaultValue={q}
                                placeholder="Ej: Ana…"
                                className="mt-1 w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="min-w-[170px]">
                            <label className="block text-xs font-semibold text-zinc-700">Orden</label>
                            <select
                                name="order"
                                defaultValue={order}
                                className="mt-1 w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-sm"
                            >
                                <option value="asc">Más antiguas primero</option>
                                <option value="desc">Más recientes primero</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            className="rounded-full border border-black/20 bg-white px-5 py-2 text-sm hover:bg-black hover:text-white transition-colors"
                        >
                            Aplicar
                        </button>

                        <Link
                            href="/appointments"
                            className="rounded-full border border-black/10 bg-white px-5 py-2 text-sm text-zinc-700 hover:bg-white/60 transition-colors"
                        >
                            Limpiar
                        </Link>
                    </form>

                    {appointments.length === 0 ? (
                        <div className="text-sm text-zinc-600">
                            No hay resultados.{" "}
                            <Link className="underline" href={`/appointments/new?week=${weekNow}`}>
                                Crea una cita
                            </Link>
                            .
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-black/10">
                            <div className="grid grid-cols-12 gap-3 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-700">
                                <div className="col-span-4">Cliente</div>
                                <div className="col-span-3">Fecha</div>
                                <div className="col-span-3">Estado</div>
                                <div className="col-span-2 text-right">Acciones</div>
                            </div>

                            <div className="divide-y divide-black/10">
                                {appointments.map((a) => {
                                    const weekForAppt = getWeekStartISOFromDate(a.startsAt, timeZone);

                                    return (
                                        <div key={a.id} className="grid grid-cols-12 gap-3 px-4 py-4 text-sm">
                                            <div className="col-span-4">
                                                <div className="font-medium">{a.client?.name ?? "—"}</div>
                                                <div className="text-xs text-zinc-500">
                                                    {a.client?.email ? a.client.email : ""}
                                                    {a.client?.email && a.client?.phone ? " · " : ""}
                                                    {a.client?.phone ? a.client.phone : ""}
                                                </div>
                                            </div>

                                            <div className="col-span-3">
                                                <div>{fmt(a.startsAt, timeZone)}</div>
                                                <div className="text-xs text-zinc-500">{a.endsAt ? `→ ${fmt(a.endsAt, timeZone)}` : ""}</div>
                                            </div>

                                            <div className="col-span-3">
                        <span className="inline-flex items-center rounded-full border border-black/20 px-3 py-1 text-xs">
                          {String(a.status)}
                        </span>
                                                {a.notes ? <div className="mt-1 text-xs text-zinc-500 line-clamp-2">{a.notes}</div> : null}
                                            </div>

                                            <div className="col-span-2 flex justify-end">
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={`/appointments/${a.id}/edit?week=${weekForAppt}`}
                                                        className="rounded-full border border-black/20 px-4 py-2 text-xs hover:bg-black hover:text-white transition-colors"
                                                    >
                                                        Editar
                                                    </Link>

                                                    {String(a.status) === "CANCELLED" ? (
                                                        <span className="text-xs text-zinc-400">—</span>
                                                    ) : (
                                                        <form action={cancelAppointment}>
                                                            <input type="hidden" name="id" value={a.id} />
                                                            <input type="hidden" name="returnTo" value={returnTo} />
                                                            <button
                                                                type="submit"
                                                                className="rounded-full border border-black/20 px-4 py-2 text-xs hover:bg-black hover:text-white transition-colors"
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </form>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
