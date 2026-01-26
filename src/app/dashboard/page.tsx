import { createClient } from '@/lib/supabase/server'
import { signOut } from './actions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm">User: {user?.email}</p>

      <form action={signOut}>
        <button className="rounded-md border px-3 py-2">Sign out</button>
      </form>
    </main>
  )
}
