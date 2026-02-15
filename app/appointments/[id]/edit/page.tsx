// app/appointments/[id]/edit/page.tsx
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
function isValidWeek(v: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(v);
}
function isValidDateTimeLocal(v: string) {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v);
}
function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60_000);
}
function withQuery(base: string, params: Record<string, string>) {
    const u = new URL(base, "http://local");
    for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
    return u.pathname + u.search;
}

/**
 * "YYYY-MM-DDTHH:mm" interpretado como hora local del negocio (timeZone) => Date UTC correcto.
 */
function dateTimeLocalToUTC(value: string, timeZone: string): Date {
    if (!value || !isValidDateTimeLocal(value)) return new Date("invalid");

    const [datePart, timePart] = value.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm] = timePart.split(":").map(Number);
    if (![y, m, d, hh, mm].every(Number.isFinite)) return new Date("invalid");

    const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));

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

/** Date UTC -> "YYYY-MM-DDTHH:mm" en timeZone (para defaultValue en datetime-local) */
function toDateTimeLocalInTZ(date: Date, timeZone: string) {
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

    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

function isValidStatus(v: string): v is AppointmentStatus {
    return v === "BOOKED" || v === "CANCELLED" || v === "COMPLETED";
}

type PageProps = {
    params: { id: string };
    searchParams?: { week?: string; message?: string };
};

export default async function EditAppointmentPage({ params, searchParams }: PageProps) {
    const user = await getAuthedUserOrRedirect();
    const business = await getBusinessForUserOrRedirect(user.id);

    const week = isValidWeek(String(searchParams?.week ?? "")) ? String(searchParams?.week) : "";
    const message = typeof searchParams?.message === "string" ? searchParams.message : "";

    const appt = await prisma.appointment.findFirst({
        where: { id: params.id, businessId: business.id },
        include: { client: { select: { id: true, name: true, email: true, phone: true } } },
    });

    if (!appt) redirect(week ? `/calendar?week=${week}` : "/appointments");

    const clients = await prisma.client.findMany({
        where: { businessId: business.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, phone: true },
    });

    const durationDefault = Math.max(
        5,
        Math.round((appt.endsAt.getTime() - appt.startsAt.getTime()) / 60_000)
    );
    const startsAtDefault = toDateTimeLocalInTZ(appt.startsAt, business.timezone);

    async function updateAppointment(formData: FormData) {
        "use server";

        const backToForm = (msg: string, weekVal: string) => {
            redirect(
                withQuery(`/appointments/${params.id}/edit`, {
                    week: isValidWeek(weekVal) ? weekVal : "",
                    message: msg,
                })
            );
        };

        try {
            const user = await getAuthedUserOrRedirect();
            const business = await getBusinessForUserOrRedirect(user.id);

            const weekFromForm = String(formData.get("week") ?? "").trim();
            const clientId = String(formData.get("clientId") ?? "").trim();
            const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
            const durationMinRaw = Number(formData.get("durationMin") ?? durationDefault);
            const notesRaw = String(formData.get("notes") ?? "").trim();
            const statusRaw = String(formData.get("status") ?? "").trim();

            if (!clientId) return backToForm("Selecciona un cliente.", weekFromForm);

            const client = await prisma.client.findFirst({
                where: { id: clientId, businessId: business.id },
                select: { id: true },
            });
            if (!client) return backToForm("Cliente no válido para este negocio.", weekFromForm);

            if (!isValidStatus(statusRaw)) return backToForm("Estado inválido.", weekFromForm);

            const startsAt = dateTimeLocalToUTC(startsAtRaw, business.timezone);
            if (Number.isNaN(startsAt.getTime())) return backToForm("Fecha/hora inválida.", weekFromForm);

            const durationMin =
                Number.isFinite(durationMinRaw) && durationMinRaw > 0 ? durationMinRaw : durationDefault;

            const endsAt = addMinutes(startsAt, durationMin);

            // Overlap solo si NO está cancelada
            if (statusRaw !== "CANCELLED") {
                const overlap = await prisma.appointment.findFirst({
                    where: {
                        businessId: business.id,
                        id: { not: params.id },
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
                        `Horario ocupado: ${fmt(overlap.startsAt)} → ${fmt(overlap.endsAt)} (${
                            overlap.client?.name ?? "otro cliente"
                        }).`,
                        weekFromForm
                    );
                }
            }

            // ✅ update seguro: exige businessId
            const res = await prisma.appointment.updateMany({
                where: { id: params.id, businessId: business.id },
                data: {
                    clientId: client.id,
                    startsAt,
                    endsAt,
                    notes: notesRaw ? notesRaw : null,
                    status: statusRaw,
                },
            });

            if (res.count === 0) return backToForm("No se encontró la cita para actualizar.", weekFromForm);

            if (isValidWeek(weekFromForm)) redirect(`/calendar?week=${weekFromForm}`);
            redirect("/appointments");
        } catch (err: any) {
            if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
            redirect(
                withQuery(`/appointments/${params.id}/edit`, {
                    week: isValidWeek(week) ? week : "",
                    message: "Ocurrió un error guardando cambios.",
                })
            );
        }
    }

    async function cancelAppointment(formData: FormData) {
        "use server";

        const weekFromForm = String(formData.get("week") ?? "").trim();

        try {
            const user = await getAuthedUserOrRedirect();
            const business = await getBusinessForUserOrRedirect(user.id);

            const res = await prisma.appointment.updateMany({
                where: { id: params.id, businessId: business.id },
                data: { status: "CANCELLED" },
            });

            if (res.count === 0) {
                redirect(
                    withQuery(`/appointments/${params.id}/edit`, {
                        week: isValidWeek(weekFromForm) ? weekFromForm : "",
                        message: "No se encontró la cita para cancelar.",
                    })
                );
            }

            if (isValidWeek(weekFromForm)) redirect(`/calendar?week=${weekFromForm}`);
            redirect("/appointments");
        } catch (err: any) {
            if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
            redirect(
                withQuery(`/appointments/${params.id}/edit`, {
                    week: isValidWeek(weekFromForm) ? weekFromForm : "",
                    message: "No se pudo cancelar la cita.",
                })
            );
        }
    }

    async function deleteAppointment(formData: FormData) {
        "use server";

        const weekFromForm = String(formData.get("week") ?? "").trim();

        try {
            const user = await getAuthedUserOrRedirect();
            const business = await getBusinessForUserOrRedirect(user.id);

            // ✅ delete seguro: exige businessId
            const res = await prisma.appointment.deleteMany({
                where: { id: params.id, businessId: business.id },
            });

            if (res.count === 0) {
                redirect(
                    withQuery(`/appointments/${params.id}/edit`, {
                        week: isValidWeek(weekFromForm) ? weekFromForm : "",
                        message: "No se encontró la cita para eliminar.",
                    })
                );
            }

            if (isValidWeek(weekFromForm)) redirect(`/calendar?week=${weekFromForm}`);
            redirect("/appointments");
        } catch (err: any) {
            if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
            redirect(
                withQuery(`/appointments/${params.id}/edit`, {
                    week: isValidWeek(weekFromForm) ? weekFromForm : "",
                    message: "No se pudo eliminar la cita.",
                })
            );
        }
    }

    return (
        <div className="min-h-screen bg-zinc-50 px-6 py-16 text-black">
            <main className="mx-auto w-full max-w-3xl space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight">Editar cita</h1>
                        <p className="mt-1 text-sm text-zinc-600">
                            Negocio: <span className="font-medium text-black">{business.name}</span>{" "}
                            <span className="text-zinc-500">({business.timezone})</span>
                        </p>
                    </div>

                    <div className="text-sm">
                        <Link className="underline" href={week ? `/calendar?week=${week}` : "/appointments"}>
                            Volver
                        </Link>
                    </div>
                </div>

                {message ? (
                    <div className="rounded-2xl border border-black/20 bg-white p-4">
                        <div className="text-sm font-semibold">Atención</div>
                        <div className="mt-1 text-sm text-zinc-700">{message}</div>
                    </div>
                ) : null}

                <section className="rounded-2xl border border-black/20 bg-white p-6 space-y-6">
                    {/* ✅ Form principal SOLO para actualizar */}
                    <form action={updateAppointment} className="space-y-4">
                        <input type="hidden" name="week" value={week} />

                        <div>
                            <label className="text-sm font-medium">Cliente *</label>
                            <select
                                name="clientId"
                                required
                                className="mt-1 w-full rounded-xl border border-black/20 px-4 py-3"
                                defaultValue={appt.clientId}
                            >
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
                                defaultValue={String(durationDefault)}
                            >
                                <option value="15">15 min</option>
                                <option value="30">30 min</option>
                                <option value="45">45 min</option>
                                <option value="60">60 min</option>
                                <option value="90">90 min</option>
                                <option value="120">120 min</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Estado *</label>
                            <select
                                name="status"
                                required
                                className="mt-1 w-full rounded-xl border border-black/20 px-4 py-3"
                                defaultValue={String(appt.status)}
                            >
                                <option value="BOOKED">BOOKED</option>
                                <option value="COMPLETED">COMPLETED</option>
                                <option value="CANCELLED">CANCELLED</option>
                            </select>
                            <p className="mt-1 text-xs text-zinc-500">
                                (Si está en <span className="font-medium">CANCELLED</span>, no bloquea solapamientos.)
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Notas (opcional)</label>
                            <textarea
                                name="notes"
                                rows={3}
                                defaultValue={appt.notes ?? ""}
                                className="mt-1 w-full rounded-xl border border-black/20 px-4 py-3"
                                placeholder="Ej: Corte + barba…"
                            />
                        </div>

                        <button
                            type="submit"
                            className="rounded-full border border-black/20 bg-black px-6 py-3 text-sm font-medium text-white hover:bg-black/90 transition-colors"
                        >
                            Guardar cambios
                        </button>
                    </form>

                    {/* ✅ Acciones secundarias en forms SEPARADOS (sin anidar) */}
                    <div className="flex flex-wrap gap-3 pt-2">
                        <form action={cancelAppointment}>
                            <input type="hidden" name="week" value={week} />
                            <button
                                type="submit"
                                className="rounded-full border border-black/20 bg-white px-6 py-3 text-sm font-medium hover:bg-zinc-50 transition-colors"
                            >
                                Cancelar cita
                            </button>
                        </form>

                        <form action={deleteAppointment}>
                            <input type="hidden" name="week" value={week} />
                            <button
                                type="submit"
                                className="rounded-full border border-black/20 bg-white px-6 py-3 text-sm font-medium hover:bg-zinc-50 transition-colors"
                            >
                                Eliminar (dev)
                            </button>
                        </form>
                    </div>
                </section>
            </main>
        </div>
    );
}
