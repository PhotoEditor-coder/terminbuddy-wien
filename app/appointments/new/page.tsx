// app/appointments/new/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
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

/** --------- Utils --------- */
function isValidWeek(v: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(v);
}
function isValidDate(v: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(v);
}
function isValidTime(v: string) {
    return /^\d{2}:\d{2}$/.test(v);
}
function isValidDateTimeLocal(v: string) {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v);
}

function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60_000);
}

function withQuery(base: string, params: Record<string, string>) {
    const u = new URL(base, "http://local");
    for (const [k, v] of Object.entries(params)) {
        if (v) u.searchParams.set(k, v);
    }
    return u.pathname + u.search;
}

/**
 * "YYYY-MM-DDTHH:mm" interpretado como hora local del negocio (timeZone) => Date UTC correcto.
 * Evita el bug típico de server en UTC (Vercel).
 */
function dateTimeLocalToUTC(value: string, timeZone: string): Date {
    if (!value || !isValidDateTimeLocal(value)) return new Date("invalid");

    const [datePart, timePart] = value.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm] = timePart.split(":").map(Number);

    if (![y, m, d, hh, mm].every(Number.isFinite)) return new Date("invalid");

    // guess en UTC con los mismos componentes
    const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));

    // cómo se vería ese "guess" en la TZ del negocio
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(guess);

    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;

    const asIfUTC = Date.UTC(
        Number(map.year),
        Number(map.month) - 1,
        Number(map.day),
        Number(map.hour),
        Number(map.minute),
        0
    );

    const diffMs = guess.getTime() - asIfUTC;
    return new Date(guess.getTime() + diffMs);
}

type PageProps = {
    searchParams?: {
        message?: string;
        week?: string;
        date?: string;
        time?: string;
        startsAt?: string; // "YYYY-MM-DDTHH:mm"
    };
};

export default async function NewAppointmentPage({ searchParams }: PageProps) {
    const user = await getAuthedUserOrRedirect();
    const business = await getBusinessForUserOrRedirect(user.id);

    const message = typeof searchParams?.message === "string" ? searchParams.message : "";
    const week = isValidWeek(String(searchParams?.week ?? "")) ? String(searchParams?.week) : "";

    // Prefill: prioridad startsAt, si no, date+time
    const startsAtParam = typeof searchParams?.startsAt === "string" ? searchParams.startsAt : "";
    const dateParam = typeof searchParams?.date === "string" ? searchParams.date : "";
    const timeParam = typeof searchParams?.time === "string" ? searchParams.time : "";

    const startsAtDefault = isValidDateTimeLocal(startsAtParam)
        ? startsAtParam
        : isValidDate(dateParam) && isValidTime(timeParam)
            ? `${dateParam}T${timeParam}`
            : "";

    const clients = await prisma.client.findMany({
        where: { businessId: business.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, phone: true },
    });

    async function createAppointment(formData: FormData) {
        "use server";

        const backToForm = (msg: string, weekVal: string, startsAtVal: string) => {
            const href = withQuery("/appointments/new", {
                week: isValidWeek(weekVal) ? weekVal : "",
                message: msg,
                startsAt: isValidDateTimeLocal(startsAtVal) ? startsAtVal : "",
            });
            redirect(href);
        };

        try {
            const user = await getAuthedUserOrRedirect();
            const business = await getBusinessForUserOrRedirect(user.id);

            const clientId = String(formData.get("clientId") ?? "").trim();
            const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
            const durationMinRaw = Number(formData.get("durationMin") ?? 30);
            const notesRaw = String(formData.get("notes") ?? "").trim();
            const weekFromForm = String(formData.get("week") ?? "").trim();

            if (!clientId) return backToForm("Selecciona un cliente.", weekFromForm, startsAtRaw);

            const client = await prisma.client.findFirst({
                where: { id: clientId, businessId: business.id },
                select: { id: true },
            });
            if (!client) return backToForm("Cliente no encontrado o no pertenece al negocio.", weekFromForm, startsAtRaw);

            const startsAt = dateTimeLocalToUTC(startsAtRaw, business.timezone);
            if (Number.isNaN(startsAt.getTime())) {
                return backToForm("Fecha/hora inválida.", weekFromForm, startsAtRaw);
            }

            const durationMin =
                Number.isFinite(durationMinRaw) && durationMinRaw > 0 ? durationMinRaw : 30;

            const endsAt = addMinutes(startsAt, durationMin);

            // ✅ Solapamientos (solo contra citas NO canceladas)
            const overlap = await prisma.appointment.findFirst({
                where: {
                    businessId: business.id,
                    status: { not: "CANCELLED" },
                    startsAt: { lt: endsAt },
                    endsAt: { gt: startsAt },
                },
                select: { startsAt: true, endsAt: true, client: { select: { name: true } } },
            });

            if (overlap) {
                const fmt = (dt: Date) =>
                    new Intl.DateTimeFormat("es-ES", {
                        timeZone: business.timezone,
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hourCycle: "h23",
                    }).format(dt);

                return backToForm(
                    `Horario ocupado: ${fmt(overlap.startsAt)} → ${fmt(overlap.endsAt)} (${overlap.client?.name ?? "otro cliente"}).`,
                    weekFromForm,
                    startsAtRaw
                );
            }

            await prisma.appointment.create({
                data: {
                    businessId: business.id,
                    clientId: client.id,
                    startsAt,
                    endsAt,
                    notes: notesRaw ? notesRaw : null,
                    // status default: BOOKED
                },
            });

            // ✅ volver a la misma semana si venías del calendario
            if (isValidWeek(weekFromForm)) redirect(`/calendar?week=${weekFromForm}`);
            redirect("/appointments");
        } catch (err: any) {
            // No atrapar redirects de Next
            if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
            redirect(
                withQuery("/appointments/new", {
                    message: "Ocurrió un error guardando la cita. Intenta de nuevo.",
                    week: week || "",
                    startsAt: startsAtDefault || "",
                })
            );
        }
    }

    return (
        <div className="min-h-screen bg-zinc-50 px-6 py-16 text-black">
            <main className="mx-auto w-full max-w-3xl space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-semibold tracking-tight">Nueva cita</h1>
                    <div className="text-sm">
                        <Link className="underline" href={week ? `/calendar?week=${week}` : "/appointments"}>
                            Volver
                        </Link>
                    </div>
                </div>

                {message ? (
                    <div className="rounded-2xl border border-black/20 bg-white p-4">
                        <div className="text-sm font-semibold">No se pudo guardar</div>
                        <div className="mt-1 text-sm text-zinc-700">{message}</div>
                    </div>
                ) : null}

                <section className="rounded-2xl border border-black/20 bg-white p-6">
                    <p className="text-sm text-zinc-600">
                        Negocio: <span className="font-medium text-black">{business.name}</span>{" "}
                        <span className="text-zinc-500">({business.timezone})</span>
                    </p>

                    {clients.length === 0 ? (
                        <div className="mt-6 rounded-xl border border-black/10 bg-zinc-50 p-4 text-sm">
                            No tienes clientes todavía. Crea uno primero en{" "}
                            <Link className="underline" href="/clients">
                                /clients
                            </Link>
                            .
                        </div>
                    ) : (
                        <form action={createAppointment} className="mt-6 space-y-4">
                            <input type="hidden" name="week" value={week} />

                            <div>
                                <label className="text-sm font-medium">Cliente *</label>
                                <select
                                    name="clientId"
                                    required
                                    className="mt-1 w-full rounded-xl border border-black/20 px-4 py-3"
                                    defaultValue=""
                                >
                                    <option value="" disabled>
                                        Selecciona un cliente…
                                    </option>
                                    {clients.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                            {c.email ? ` — ${c.email}` : ""}
                                            {c.phone ? ` — ${c.phone}` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium">Fecha y hora *</label>
                                <input
                                    name="startsAt"
                                    type="datetime-local"
                                    required
                                    defaultValue={startsAtDefault}
                                    className="mt-1 w-full rounded-xl border border-black/20 px-4 py-3"
                                />
                                <p className="mt-1 text-xs text-zinc-500">Zona horaria: {business.timezone}</p>
                            </div>

                            <div>
                                <label className="text-sm font-medium">Duración *</label>
                                <select
                                    name="durationMin"
                                    required
                                    className="mt-1 w-full rounded-xl border border-black/20 px-4 py-3"
                                    defaultValue="30"
                                >
                                    <option value="15">15 min</option>
                                    <option value="30">30 min</option>
                                    <option value="45">45 min</option>
                                    <option value="60">60 min</option>
                                    <option value="90">90 min</option>
                                    <option value="120">120 min</option>
                                </select>
                                <p className="mt-1 text-xs text-zinc-500">
                                    (Se usa para calcular <span className="font-medium">endsAt</span>.)
                                </p>
                            </div>

                            <div>
                                <label className="text-sm font-medium">Notas (opcional)</label>
                                <textarea
                                    name="notes"
                                    rows={3}
                                    className="mt-1 w-full rounded-xl border border-black/20 px-4 py-3"
                                    placeholder="Ej: Corte + barba…"
                                />
                            </div>

                            <button
                                type="submit"
                                className="rounded-full border border-black/20 bg-white px-6 py-3 text-sm font-medium hover:bg-black hover:text-white transition-colors"
                            >
                                Crear cita
                            </button>
                        </form>
                    )}
                </section>
            </main>
        </div>
    );
}
