export default function Home() {
  return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black p-6">
        <div className="w-full max-w-xl rounded-2xl border bg-white dark:bg-black p-6 space-y-4">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            TerminBuddy Wien
          </h1>

          <p className="text-zinc-600 dark:text-zinc-400">
            Prueba rápida de navegación (Auth + SSR):
          </p>

          <div className="flex gap-3">
            <a
                href="/login"
                className="rounded-xl border px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10"
            >
              Ir a Login
            </a>

            <a
                href="/account"
                className="rounded-xl border px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10"
            >
              Ir a Account (protegida)
            </a>
          </div>
        </div>
      </main>
  );
}
