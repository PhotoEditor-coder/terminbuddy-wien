import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { signOut } from './actions'
import { Role } from '@/generated/prisma/enums' // <-- aquí

export default async function DashboardPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="p-6">
        <p>No session</p>
      </main>
    )
  }

  const profile = await prisma.profile.upsert({
    where: { id: user.id },
    update: { email: user.email ?? '' },
    create: { id: user.id, email: user.email ?? '', role: Role.CUSTOMER },
  })

  const memberships = await prisma.businessMember.findMany({
    where: { profileId: user.id },
    include: { business: true },
  })

  const business = memberships[0]?.business

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {searchParams?.error && (
        <p className="text-sm text-red-600">{decodeURIComponent(searchParams.error)}</p>
      )}

      <div className="rounded-xl border p-4 space-y-1">
        <p className="text-sm">Email: {user.email}</p>
        <p className="text-sm">Role: {profile.role}</p>
        <p className="text-sm">Business: {business ? business.name : '—'}</p>
      </div>

      {profile.role === Role.BUSINESS_ADMIN && !business && (
        <div className="rounded-xl border p-4 space-y-3">
          <h2 className="font-medium">Create your business</h2>
          <p className="text-sm text-gray-600">
            (Ya lo creamos en el signup si marcaste admin; esto solo aparece si no existe.)
          </p>
        </div>
      )}

      <form action={signOut}>
        <button className="rounded-md border px-3 py-2">Sign out</button>
      </form>
    </main>
  )
}
