import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SetupPage() {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) redirect("/login");

    const userId = data.user.id;

    // Si ya existe un Business, no vuelvas a crear otro
    const existing = await prisma.business.findFirst({
        where: { ownerId: userId },
        select: { id: true },
    });

    if (existing) redirect("/dashboard");

    async function createBusiness(formData: FormData) {
        "use server";

        // Re-validar auth dentro de la Server Action (recomendado)
        const supabase = await createClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) redirect("/login");

        const ownerId = data.user.id;

        const name = String(formData.get("name") || "").trim();
        const timezone = String(formData.get("timezone") || "Europe/Vienna").trim();

        if (!name) return;

        // Evitar duplicados si alguien dispara la action dos veces
        const already = await prisma.business.findFirst({
            where: { ownerId },
            select: { id: true },
        });

        if (already) redirect("/dashboard");

        await prisma.business.create({
            data: {
                ownerId,
                name,
                timezone,
            },
        });

        redirect("/dashboard");
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-black">
            <div className="w-full max-w-xl rounded-2xl border bg-white dark:bg-black p-6 space-y-4">
                <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
                    Configurar negocio
                </h1>
                <p className="text-zinc-600 dark:text-zinc-400">
                    Crea tu primer negocio para empezar a registrar citas.
                </p>

                <form action={createBusiness} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm text-zinc-700 dark:text-zinc-300">
                            Nombre del negocio
                        </label>
                        <input
                            name="name"
                            placeholder="Ej: Barbería Central"
                            className="w-full rounded-xl border px-3 py-2 bg-transparent"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-zinc-700 dark:text-zinc-300">
                            Zona horaria
                        </label>
                        <input
                            name="timezone"
                            defaultValue="Europe/Vienna"
                            className="w-full rounded-xl border px-3 py-2 bg-transparent"
                        />
                    </div>

                    <button className="rounded-xl border px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10">
                        Crear negocio
                    </button>
                </form>
            </div>
        </main>
    );
}
