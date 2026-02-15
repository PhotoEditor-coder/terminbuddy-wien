// app/clients/new/page.tsx
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
    // MVP: validación simple
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

type PageProps = {
    searchParams?: { message?: string };
};

export default async function NewClientPage({ searchParams }: PageProps) {
    const user = await getAuthedUserOrRedirect();
    const business = await getBusinessForUserOrRedirect(user.id);

    const message = typeof searchParams?.message === "string" ? searchParams.message : "";

    async function createNewClient(formData: FormData) {
        "use server";

        const back = (msg: string) => redirect(withQuery("/clients/new", { message: msg }));

        try {
            const user = await getAuthedUserOrRedirect();
            const business = await getBusinessForUserOrRedirect(user.id);

            const name = String(formData.get("name") ?? "").trim();
            const email = String(formData.get("email") ?? "").trim();
            const phone = String(formData.get("phone") ?? "").trim();
            const notes = String(formData.get("notes") ?? "").trim();

            if (!name) return back("El nombre es obligatorio.");
            if (email && !isValidEmail(email)) return back("Email inválido.");

            await prisma.client.create({
                data: {
                    businessId: business.id,
                    name,
                    email: email || null,
                    phone: phone || null,
                    notes: notes || null,
                },
                select: { id: true },
            });

            redirect(withQuery("/clients", { message: "Cliente creado." }));
        } catch (err: any) {
            if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
            back("No se pudo crear el cliente. Intenta de nuevo.");
        }
    }

    return (
        <div className="min-h-screen bg-zinc-50 px-6 py-16 text-black">
            <main className="mx-auto w-full max-w-3xl space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-semibold tracking-tight">Nuevo cliente</h1>
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
                    <p className="text-sm text-zinc-600">
                        Negocio: <span className="font-medium text-black">{business.name}</span>{" "}
                        <span className="text-zinc-500">({business.timezone})</span>
                    </p>

                    <form action={createNewClient} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Nombre *</label>
                            <input
                                name="name"
                                required
                                className="mt-1 w-full rounded-xl border border-black/20 px-4 py-3"
                                placeholder="Ej: Ana García"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Email (opcional)</label>
                            <input
                                name="email"
                                type="email"
                                className="mt-1 w-full rounded-xl border border-black/20 px-4 py-3"
                                placeholder="ana@email.com"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Teléfono (opcional)</label>
                            <input
                                name="phone"
                                className="mt-1 w-full rounded-xl border border-black/20 px-4 py-3"
                                placeholder="+43 ..."
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium">Notas (opcional)</label>
                            <textarea
                                name="notes"
                                rows={4}
                                className="mt-1 w-full rounded-xl border border-black/20 px-4 py-3"
                                placeholder="Preferencias, observaciones…"
                            />
                        </div>

                        <button
                            type="submit"
                            className="rounded-full border border-black/20 bg-black px-6 py-3 text-sm font-medium text-white hover:bg-black/90 transition-colors"
                        >
                            Crear cliente
                        </button>
                    </form>
                </section>
            </main>
        </div>
    );
}
