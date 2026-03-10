import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { signOut } from './actions'
import { Role } from '@/generated/prisma/enums'

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Keine aktive Sitzung.</p>
      </main>
    )
  }

  // Optimized query — only select fields we need
  const profile = await prisma.profile.upsert({
    where: { id: user.id },
    update: { email: user.email ?? '' },
    create: { id: user.id, email: user.email ?? '', role: Role.CUSTOMER },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  })

  // Get business + upcoming appointments count in parallel
  const [memberships, upcomingCount] = await Promise.all([
    prisma.businessMember.findMany({
      where: { profileId: user.id },
      select: { business: { select: { id: true, name: true, district: true, slug: true } } },
    }),
    profile.role === Role.CUSTOMER
      ? prisma.appointment.count({
          where: {
            customerId: user.id,
            startsAt: { gte: new Date() },
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
        })
      : Promise.resolve(0),
  ])

  const business = memberships[0]?.business

  const roleLabels: Record<string, string> = {
    CUSTOMER: 'Kunde',
    BUSINESS_ADMIN: 'Administrator',
    STAFF: 'Mitarbeiter',
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Top nav */}
      <nav style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 2rem',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-card)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'var(--accent)', fontSize: '18px' }}>✦</span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.3rem',
            fontWeight: 400,
            color: 'var(--fg)',
          }}>
            Termin<span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>Buddy</span>
          </span>
        </div>

        <form action={signOut}>
          <button style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '7px 14px',
            fontSize: '12px',
            fontFamily: 'var(--font-body)',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            cursor: 'pointer',
          }}>
            Abmelden
          </button>
        </form>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 2rem' }}>

        {/* Page header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <p style={{ fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }}>
            Willkommen zurück
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2.8rem',
            fontWeight: 300,
            color: 'var(--fg)',
            lineHeight: 1.1,
          }}>
            {profile.name ?? profile.email.split('@')[0]}
          </h1>
        </div>

        {params?.error && (
          <div style={{
            background: '#FEF2F0',
            border: '1px solid #F0C0B8',
            borderLeft: '3px solid var(--danger)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '2rem',
            fontSize: '13px',
            color: 'var(--danger)',
          }}>
            {decodeURIComponent(params.error)}
          </div>
        )}

        {/* Stats grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          <StatCard label="Rolle" value={roleLabels[profile.role] ?? profile.role} />
          {profile.role === Role.CUSTOMER && (
            <StatCard label="Bevorstehende Termine" value={String(upcomingCount)} highlight />
          )}
          {business && (
            <StatCard label="Unternehmen" value={business.name} />
          )}
        </div>

        {/* Profile details */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          overflow: 'hidden',
          marginBottom: '1.5rem',
        }}>
          <div style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ color: 'var(--accent)', fontSize: '14px' }}>✦</span>
            <span style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Kontoinformationen
            </span>
          </div>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <InfoRow label="E-Mail" value={profile.email} />
            <InfoRow label="Rolle" value={roleLabels[profile.role] ?? profile.role} />
            <InfoRow label="Mitglied seit" value={new Date(profile.createdAt).toLocaleDateString('de-AT', { year: 'numeric', month: 'long', day: 'numeric' })} />
          </div>
        </div>

        {/* Business card for admins */}
        {business && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{ color: 'var(--accent)', fontSize: '14px' }}>✦</span>
              <span style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)' }}>
                Ihr Unternehmen
              </span>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <InfoRow label="Name" value={business.name} />
              <InfoRow label="Slug" value={`/${business.slug}`} mono />
              {business.district && <InfoRow label="Bezirk" value={business.district} />}
            </div>
          </div>
        )}

        {/* Prompt for admin without business */}
        {profile.role === Role.BUSINESS_ADMIN && !business && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--accent)',
            borderRadius: '12px',
            padding: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <span style={{ fontSize: '24px', color: 'var(--accent)' }}>◈</span>
            <div>
              <p style={{ fontWeight: 500, marginBottom: '4px' }}>Kein Unternehmen verknüpft</p>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Bitte erstellen Sie ein Unternehmen, um Termine verwalten zu können.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? 'var(--fg)' : 'var(--bg-card)',
      color: highlight ? 'var(--bg)' : 'var(--fg)',
      border: `1px solid ${highlight ? 'var(--fg)' : 'var(--border)'}`,
      borderRadius: '12px',
      padding: '1.25rem 1.5rem',
    }}>
      <p style={{
        fontSize: '11px',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        color: highlight ? 'rgba(247,244,239,0.6)' : 'var(--muted)',
        marginBottom: '8px',
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: '2rem',
        fontWeight: 400,
        lineHeight: 1,
        color: highlight ? 'var(--bg)' : 'var(--accent)',
      }}>
        {value}
      </p>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
      <span style={{ fontSize: '13px', color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: '14px',
        color: 'var(--fg)',
        fontFamily: mono ? 'var(--font-mono, monospace)' : 'inherit',
        textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
  )
}
