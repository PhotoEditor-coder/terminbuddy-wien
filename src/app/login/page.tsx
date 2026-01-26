import { signIn, signUp } from './actions'

export default function LoginPage({ searchParams }: { searchParams: { error?: string; msg?: string } }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4">
        <h1 className="text-2xl font-semibold">TerminBuddy Wien</h1>

        {searchParams?.error && (
          <p className="text-sm text-red-600">{decodeURIComponent(searchParams.error)}</p>
        )}
        {searchParams?.msg && (
          <p className="text-sm">{decodeURIComponent(searchParams.msg)}</p>
        )}

        <form action={signIn} className="space-y-3">
          <input name="email" type="email" placeholder="Email" className="w-full rounded-md border p-2" required />
          <input name="password" type="password" placeholder="Password" className="w-full rounded-md border p-2" required />
          <button className="w-full rounded-md border p-2 font-medium">Sign in</button>
        </form>

        <hr />

        <form action={signUp} className="space-y-3">
          <input name="email" type="email" placeholder="Email" className="w-full rounded-md border p-2" required />
          <input name="password" type="password" placeholder="Password" className="w-full rounded-md border p-2" required />

          <label className="flex items-center gap-2 text-sm">
            <input name="isBusinessAdmin" type="checkbox" />
            I’m a business (admin)
          </label>

          <input
            name="businessName"
            type="text"
            placeholder="Business name (only if admin)"
            className="w-full rounded-md border p-2"
          />

          <button className="w-full rounded-md border p-2 font-medium">Create account</button>
        </form>
      </div>
    </main>
  )
}
