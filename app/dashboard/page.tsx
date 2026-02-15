import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) redirect("/login");

    const business = await prisma.business.findFirst({
        where: { ownerId: user.id },
        select: { id: true, name: true, timezone: true },
    });

    if (!business) redirect("/setup");

    return (
        <main className="min-h-screen p-6 bg-zinc-50 dark:bg-black">
            <div className="mx-auto max-w-3xl space-y-4">
                <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
                    Dashboard
                </h1>

                <div className="flex items-center gap-4 text-sm">
                    <Link className="underline" href="/calendar">
                        Ver calendario semanal
                    </Link>
                    <Link className="underline" href="/appointments">
                        Ver citas
                    </Link>
                    <Link className="underline" href="/clients">
                        Ver clientes
                    </Link>
                </div>

                <div className="rounded-2xl border bg-white dark:bg-black p-6">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Negocio</p>
                    <p className="text-lg text-black dark:text-zinc-50">{business.name}</p>

                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                        Timezone: {business.timezone}
                    </p>

                    <p className="text-xs text-zinc-500 mt-2">Business ID: {business.id}</p>
                </div>
            </div>
        </main>
    );
}
