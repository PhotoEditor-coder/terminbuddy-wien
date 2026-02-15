// app/clients/page.tsx
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

function withQuery(base: string, params: Record<string, string>) {
    const u = new URL(base, "http://local");
    for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
    return u.pathname + u.search;
}

type PageProps = {
    searchParams?: { q?: string; message?: string };
};

export default async function ClientsPage({ searchParams }: PageProps) {
    const user = await getAuthedUserOrRedirect();
    const business = await getBusinessForUserOrRedirect(user.id);

    const q = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
    const message = typeof searchParams?.message === "string" ? searchParams.message : "";

    const clients = await prisma.client.findMany({
        where: {
            businessId: business.id,
            ...(q
                ? {
                    OR: [
                        { name: { contains: q, mode: "insensitive" } },
                        { email: { contains: q, mode: "insensitive" } },
                        { phone: { contains: q, mode: "insensitive" } },
                    ],
                }
                : {}),
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, phone: true, notes: true, createdAt: true },
        take: 400,
    });

    async function deleteClient(formData: FormData) {
        "use server";

        const user = await getAuthedUserOrRedirect();
        const business = await getBusinessForUserOrRedirect(user.id);

        const id = String(formData.get("id") ?? "").trim();
        const backQ = String(formData.get("q") ?? "").trim();

        if (!id) redirect(withQuery("/clients", { q: backQ, message: "Falta id del cliente." }));

        // Evitar borrar clientes con citas
        const apptCount = await prisma.appointment.count({
            where: { businessId: business.id, clientId: id },
        });

        if (apptCount > 0) {
            redirect(
                withQuery("/clients", {
                    q: backQ,
                    message: "No se puede eliminar: este cliente tiene citas asociadas.",
                })
            );
        }

        const res = await prisma.client.deleteMany({
            where: { id, businessId: business.id },
        });

        if (res.count === 0) {
            redirect(withQuery("/clients", { q: backQ, message: "Cliente no encontrado." }));
        }

        redirect(withQuery("/clients", { q: backQ, message: "Cliente eliminado." }));
    }

    return (
        <div className="flex min-h-screen items-start justify-center bg-zinc-50 px-6 py-16 text-black">
            <main className="w-full max-w-5xl space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        <Link className="underline" href="/dashboard">
                            Volver al dashboard
                        </Link>
                        <Link className="underline" href="/appointments">
                            Ver citas
                        </Link>
                        <Link
                            className="rounded-full border border-black/20 bg-white px-5 py-2 hover:bg-black hover:text-white transition-colors"
                            href="/clients/new"
                        >
                            + Nuevo cliente
                        </Link>
                    </div>
                </div>

                <section className="rounded-2xl border border-black/20 bg-white p-6 space-y-5">
                    <p className="text-sm text-zinc-600">
                        Negocio: <span className="font-medium text-black">{business.name}</span>{" "}
                        <span className="text-zinc-500">({business.timezone})</span>
                    </p>

                    {message ? (
                        <div className="rounded-2xl border border-black/10 bg-zinc-50 p-4 text-sm">
                            {message}
                        </div>
                    ) : null}

                    <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-black/10 bg-zinc-50 p-4">
                        <div className="min-w-[260px] flex-1">
                            <label className="block text-xs font-semibold text-zinc-700">Buscar</label>
                            <input
                                name="q"
                                defaultValue={q}
                                placeholder="Nombre, email o teléfono…"
                                className="mt-1 w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-sm"
                            />
                        </div>

                        <button
                            type="submit"
                            className="rounded-full border border-black/20 bg-white px-5 py-2 text-sm hover:bg-black hover:text-white transition-colors"
                        >
                            Buscar
                        </button>

                        <Link
                            href="/clients"
                            className="rounded-full border border-black/10 bg-white px-5 py-2 text-sm text-zinc-700 hover:bg-white/60 transition-colors"
                        >
                            Limpiar
                        </Link>
                    </form>

                    {clients.length === 0 ? (
                        <div className="text-sm text-zinc-600">
                            No hay clientes todavía.{" "}
                            <Link className="underline" href="/clients/new">
                                Crea el primero aquí
                            </Link>
                            .
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-black/10">
                            <div className="grid grid-cols-12 gap-3 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-700">
                                <div className="col-span-4">Nombre</div>
                                <div className="col-span-3">Contacto</div>
                                <div className="col-span-3">Notas</div>
                                <div className="col-span-2 text-right">Acciones</div>
                            </div>

                            <div className="divide-y divide-black/10">
                                {clients.map((c) => (
                                    <div key={c.id} className="grid grid-cols-12 gap-3 px-4 py-4 text-sm">
                                        <div className="col-span-4">
                                            <div className="font-medium">{c.name}</div>
                                            <div className="text-xs text-zinc-500">{c.id}</div>
                                        </div>

                                        <div className="col-span-3">
                                            <div className="text-sm">{c.email ?? "—"}</div>
                                            <div className="text-xs text-zinc-500">{c.phone ?? ""}</div>
                                        </div>

                                        <div className="col-span-3">
                                            {c.notes ? (
                                                <div className="text-xs text-zinc-600 line-clamp-2">{c.notes}</div>
                                            ) : (
                                                <div className="text-xs text-zinc-400">—</div>
                                            )}
                                        </div>

                                        <div className="col-span-2 flex justify-end">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/clients/${c.id}/edit`}
                                                    className="rounded-full border border-black/20 px-4 py-2 text-xs hover:bg-black hover:text-white transition-colors"
                                                >
                                                    Editar
                                                </Link>

                                                {/* Borrado “mínimo” (seguro: bloquea si hay citas) */}
                                                <form action={deleteClient}>
                                                    <input type="hidden" name="id" value={c.id} />
                                                    <input type="hidden" name="q" value={q} />
                                                    <button
                                                        type="submit"
                                                        className="rounded-full border border-black/20 px-4 py-2 text-xs hover:bg-black hover:text-white transition-colors"
                                                        title="Borra solo si no tiene citas"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
