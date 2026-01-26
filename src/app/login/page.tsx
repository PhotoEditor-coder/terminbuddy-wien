import { signIn, signUp } from './actions'

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4">
        <h1 className="text-2xl font-semibold">TerminBuddy Wien</h1>

        {searchParams?.error && (
          <p className="text-sm text-red-600">{decodeURIComponent(searchParams.error)}</p>
        )}

        <form action={signIn} className="space-y-3">
          <input name="email" type="email" placeholder="Email" className="w-full rounded-md border p-2" required />
          <input name="password" type="password" placeholder="Password" className="w-full rounded-md border p-2" required />
          <button className="w-full rounded-md border p-2 font-medium">Sign in</button>
        </form>

        <form action={signUp} className="space-y-3">
          <input name="email" type="email" placeholder="Email" className="w-full rounded-md border p-2" required />
          <input name="password" type="password" placeholder="Password" className="w-full rounded-md border p-2" required />
          <button className="w-full rounded-md border p-2 font-medium">Create account</button>
        </form>
      </div>
    </main>
  )
}
