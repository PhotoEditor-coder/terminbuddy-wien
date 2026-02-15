// app/clients/[id]/edit/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function isValidEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

type PageProps = {
    params: { id: string };
    searchParams?: { message?: string };
};

export default async function EditClientPage({ params, searchParams }: PageProps) {
    const user = await getAuthedUserOrRedirect();
    const business = await getBusinessForUserOrRedirect(user.id);

    const message = typeof searchParams?.message === "string" ? searchParams.message : "";

    const client = await prisma.client.findFirst({
        where: { id: params.id, businessId: business.id },
        select: { id: true, name: true, email: true, phone: true, notes: true, createdAt: true },
    });

    if (!client) redirect(withQuery("/clients", { message: "Cliente no encontrado." }));

    const apptCount = await prisma.appointment.count({
        where: { businessId: business.id, clientId: client.id },
    });

    async function updateClient(formData: FormData) {
        "use server";

        const back = (msg: string) => redirect(withQuery(`/clients/${params.id}/edit`, { message: msg }));

        try {
            const user = await getAuthedUserOrRedirect();
            const business = await getBusinessForUserOrRedirect(user.id);

            const name = String(formData.get("name") ?? "").trim();
            const email = String(formData.get("email") ?? "").trim();
            const phone = String(formData.get("phone") ?? "").trim();
            const notes = String(formData.get("notes") ?? "").trim();

            if (!name) return back("El nombre es obligatorio.");
            if (email && !isValidEmail(email)) return back("Email inválido.");

            const res = await prisma.client.updateMany({
                where: { id: params.id, businessId: business.id },
                data: {
                    name,
                    email: email || null,
                    phone: phone || null,
                    notes: notes || null,
                },
            });

            if (res.count === 0) return back("No se pudo actualizar (cliente no encontrado).");

            redirect(withQuery("/clients", { message: "Cliente actualizado." }));
        } catch (err: any) {
            if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
            back("No se pudo actualizar el cliente.");
        }
    }

    async function deleteClient() {
        "use server";

        try {
            const user = await getAuthedUserOrRedirect();
            const business = await getBusinessForUserOrRedirect(user.id);

            const apptCount = await prisma.appointment.count({
                where: { businessId: business.id, clientId: params.id },
            });

            if (apptCount > 0) {
                redirect(withQuery(`/clients/${params.id}/edit`, { message: "No se puede eliminar: tiene citas asociadas." }));
            }

            const res = await prisma.client.deleteMany({
                where: { id: params.id, businessId: business.id },
            });

            if (res.count === 0) {
                redirect(withQuery("/clients", { message: "Cliente no encontrado." }));
            }

            redirect(withQuery("/clients", { message: "Cliente eliminado." }));
        } catch (err: any) {
            if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
            redirect(withQuery(`/clients/${params.id}/edit`, { message: "No se pudo eliminar." }));
        }
    }

    return (
        <div className="min-h-screen bg-zinc-50 px-6 py-16 text-black">
            <main className="mx-auto w-full max-w-3xl space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight">Editar cliente</h1>
                        <p className="mt-1 text-sm text-zinc-600">
                            Negocio: <span className="font-medium text-black">{business.name}</span>{" "}
                            <span className="text-zinc-500">({business.timezone})</span>
                        </p>
                    </div>
                    <div className="text-sm">
                        <Link className="underline" href="/clients">
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
                    <form action={updateClient} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Nombre *</label>
                            <input
                                name="name"
                                required
                                defaultValue={client.name}
                                className="mt-1 w-full rounded-xl border border-black/20 px-4 py-3"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Email (opcional)</label>
                            <input
                                name="email"
                                type="email"
                                defaultValue={client.email ?? ""}
                                className="mt-1 w-full rounded-xl border border-black/20 px-4 py-3"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Teléfono (opcional)</label>
                            <input
                                name="phone"
                                defaultValue={client.phone ?? ""}
                                className="mt-1 w-full rounded-xl border border-black/20 px-4 py-3"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Notas (opcional)</label>
                            <textarea
                                name="notes"
                                rows={4}
                                defaultValue={client.notes ?? ""}
                                className="mt-1 w-full rounded-xl border border-black/20 px-4 py-3"
                            />
                        </div>

                        <button
                            type="submit"
                            className="rounded-full border border-black/20 bg-black px-6 py-3 text-sm font-medium text-white hover:bg-black/90 transition-colors"
                        >
                            Guardar cambios
                        </button>
                    </form>

                    <div className="rounded-2xl border border-black/10 bg-zinc-50 p-4 text-sm text-zinc-700">
                        <div className="font-semibold">Info</div>
                        <div className="mt-1">
                            Este cliente tiene <span className="font-medium">{apptCount}</span> cita(s).
                            {apptCount > 0 ? " No se puede eliminar." : " Puedes eliminarlo si quieres."}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <form action={deleteClient}>
                            <button
                                type="submit"
                                className="rounded-full border border-black/20 bg-white px-6 py-3 text-sm font-medium hover:bg-zinc-50 transition-colors"
                                disabled={apptCount > 0}
                                title={apptCount > 0 ? "No se puede eliminar si tiene citas" : "Eliminar cliente"}
                            >
                                Eliminar cliente
                            </button>
                        </form>
                    </div>
                </section>
            </main>
        </div>
    );
}
