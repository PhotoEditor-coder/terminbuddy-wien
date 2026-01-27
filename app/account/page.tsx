export const runtime = "nodejs";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export default async function AccountPage() {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();

    const user = data.user;
    if (!user) redirect("/login");

    await prisma.profile.upsert({
        where: { id: user.id },
        update: { email: user.email ?? "" },
        create: { id: user.id, email: user.email ?? "" },
    });

    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-black">
            <div className="w-full max-w-xl rounded-2xl border bg-white dark:bg-black p-6 space-y-4">
                <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Account</h1>

                <div className="rounded-xl border p-4">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Email</p>
                    <p className="text-black dark:text-zinc-50">{user.email}</p>

                    <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">User ID</p>
                    <p className="font-mono text-sm break-all text-black dark:text-zinc-50">
                        {user.id}
                    </p>
                </div>

                <form action="/auth/signout" method="post">
                    <button className="rounded-xl border px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10">
                        Logout
                    </button>
                </form>
            </div>
        </main>
    );
}
