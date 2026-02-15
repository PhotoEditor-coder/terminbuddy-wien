export const runtime = "nodejs";
export const dynamic = "force-dynamic";


import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";



export default async function AccountPage() {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    console.log("GET USER:", { hasUser: !!data?.user, error: error?.message });

    const user = data.user;
    if (!user) redirect("/login");

    console.log("USER:", user.id, user.email);

    await prisma.profile.upsert({
        where: { id: user.id },
        update: { email: user.email ?? "" },
        create: { id: user.id, email: user.email ?? "" },
    });
    const result = await prisma.profile.upsert({
        where: { id: user.id },
        update: { email: user.email ?? "" },
        create: { id: user.id, email: user.email ?? "" },
    });

    console.log("UPSERT OK:", result.id);

    const count = await prisma.profile.count();
    console.log("PROFILE COUNT:", count);

    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <div className="w-full max-w-xl rounded-2xl border p-6 space-y-4">
                <h1 className="text-2xl font-semibold">Account</h1>
                <div className="rounded-xl border p-4">
                    <p>Email: {user.email}</p>
                    <p className="font-mono text-sm break-all">ID: {user.id}</p>
                    <p className="text-sm opacity-70 mt-2">DB upsert: OK</p>
                </div>
            </div>
        </main>
    );
}
