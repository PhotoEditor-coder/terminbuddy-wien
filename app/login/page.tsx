"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    async function signIn() {
        setLoading(true);
        setMsg(null);

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        setLoading(false);

        if (error) return setMsg(error.message);

        router.push("/account");
        router.refresh();
    }

    async function signUp() {
        setLoading(true);
        setMsg(null);

        const { error } = await supabase.auth.signUp({ email, password });

        setLoading(false);

        if (error) return setMsg(error.message);

        setMsg("Cuenta creada. Si Supabase requiere confirmación, revisa tu email.");
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-black">
            <div className="w-full max-w-md rounded-2xl border bg-white dark:bg-black p-6 space-y-4">
                <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Login</h1>

                <div className="space-y-2">
                    <label className="text-sm text-zinc-700 dark:text-zinc-300">Email</label>
                    <input
                        className="w-full rounded-xl border px-3 py-2 bg-transparent"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                        type="email"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm text-zinc-700 dark:text-zinc-300">Password</label>
                    <input
                        className="w-full rounded-xl border px-3 py-2 bg-transparent"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        type="password"
                    />
                </div>

                {msg && <p className="text-sm text-zinc-600 dark:text-zinc-400">{msg}</p>}

                <div className="flex gap-2">
                    <button
                        onClick={signIn}
                        disabled={loading}
                        className="flex-1 rounded-xl border px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                    >
                        {loading ? "..." : "Sign in"}
                    </button>

                    <button
                        onClick={signUp}
                        disabled={loading}
                        className="flex-1 rounded-xl border px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                    >
                        {loading ? "..." : "Sign up"}
                    </button>
                </div>
            </div>
        </main>
    );
}
