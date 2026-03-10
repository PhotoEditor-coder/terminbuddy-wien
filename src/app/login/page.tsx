import { signIn, signUp } from './actions'

interface Props {
  searchParams: Promise<{ error?: string; msg?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: 'var(--bg)',
      position: 'relative',
    }}>

      {/* Background geometric ornament */}
      <div style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}>
        <svg
          viewBox="0 0 800 800"
          style={{ position: 'absolute', top: '-200px', right: '-200px', width: '700px', opacity: 0.04 }}
          fill="none"
        >
          <circle cx="400" cy="400" r="380" stroke="#C8922A" strokeWidth="1" />
          <circle cx="400" cy="400" r="300" stroke="#C8922A" strokeWidth="1" />
          <circle cx="400" cy="400" r="220" stroke="#C8922A" strokeWidth="1" />
          <line x1="400" y1="20" x2="400" y2="780" stroke="#C8922A" strokeWidth="0.5" />
          <line x1="20" y1="400" x2="780" y2="400" stroke="#C8922A" strokeWidth="0.5" />
          <line x1="130" y1="130" x2="670" y2="670" stroke="#C8922A" strokeWidth="0.5" />
          <line x1="670" y1="130" x2="130" y2="670" stroke="#C8922A" strokeWidth="0.5" />
          <rect x="200" y="200" width="400" height="400" stroke="#C8922A" strokeWidth="0.5" transform="rotate(45 400 400)" />
        </svg>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '420px',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '1rem',
          }}>
            <span style={{ color: 'var(--accent)', fontSize: '24px', lineHeight: 1 }}>✦</span>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              letterSpacing: '4px',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              fontWeight: 500,
            }}>Wien</span>
            <span style={{ color: 'var(--accent)', fontSize: '24px', lineHeight: 1 }}>✦</span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '3rem',
            fontWeight: 300,
            letterSpacing: '-0.5px',
            color: 'var(--fg)',
            lineHeight: 1.1,
            marginBottom: '0.5rem',
          }}>
            Termin<span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>Buddy</span>
          </h1>
          <p style={{
            color: 'var(--muted)',
            fontSize: '13px',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
          }}>
            Online-Terminbuchung
          </p>
        </div>

        {/* Messages */}
        {params?.error && (
          <div style={{
            background: '#FEF2F0',
            border: '1px solid #F0C0B8',
            borderLeft: '3px solid var(--danger)',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '1.5rem',
            fontSize: '13px',
            color: 'var(--danger)',
          }}>
            {decodeURIComponent(params.error)}
          </div>
        )}
        {params?.msg && (
          <div style={{
            background: '#F0F7F1',
            border: '1px solid #B8D8BF',
            borderLeft: '3px solid var(--success)',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '1.5rem',
            fontSize: '13px',
            color: 'var(--success)',
          }}>
            {decodeURIComponent(params.msg)}
          </div>
        )}

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(26,18,8,0.08)',
        }}>

          {/* Sign In */}
          <div style={{ padding: '2rem 2rem 1.5rem' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.4rem',
              fontWeight: 400,
              marginBottom: '1.25rem',
              color: 'var(--fg)',
            }}>
              Anmelden
            </h2>

            <form action={signIn} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                name="email"
                type="email"
                placeholder="E-Mail-Adresse"
                required
                style={inputStyle}
              />
              <input
                name="password"
                type="password"
                placeholder="Passwort"
                required
                style={inputStyle}
              />
              <button type="submit" style={primaryBtnStyle}>
                Anmelden
              </button>
            </form>
          </div>

          {/* Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '0 2rem',
            color: 'var(--accent)',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, var(--border))' }} />
            <span style={{ fontSize: '16px', opacity: 0.6 }}>✦</span>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, var(--border))' }} />
          </div>

          {/* Sign Up */}
          <div style={{ padding: '1.5rem 2rem 2rem' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.4rem',
              fontWeight: 400,
              marginBottom: '1.25rem',
              color: 'var(--fg)',
            }}>
              Konto erstellen
            </h2>

            <form action={signUp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                name="email"
                type="email"
                placeholder="E-Mail-Adresse"
                required
                style={inputStyle}
              />
              <input
                name="password"
                type="password"
                placeholder="Passwort"
                required
                style={inputStyle}
              />

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '13px',
                color: 'var(--muted)',
                cursor: 'pointer',
                padding: '8px 0',
              }}>
                <input
                  name="isBusinessAdmin"
                  type="checkbox"
                  style={{ accentColor: 'var(--accent)', width: '15px', height: '15px' }}
                />
                Ich vertrete ein Unternehmen (Admin)
              </label>

              <input
                name="businessName"
                type="text"
                placeholder="Name des Unternehmens (nur für Admins)"
                style={inputStyle}
              />

              <button type="submit" style={secondaryBtnStyle}>
                Konto erstellen
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          marginTop: '2rem',
          fontSize: '12px',
          color: 'var(--muted)',
          letterSpacing: '0.5px',
        }}>
          © TerminBuddy Wien — Alle Rechte vorbehalten
        </p>
      </div>
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg)',
  color: 'var(--fg)',
  fontSize: '14px',
  fontFamily: 'var(--font-body)',
  outline: 'none',
  transition: 'border-color 0.2s',
}

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  background: 'var(--fg)',
  color: 'var(--bg)',
  border: 'none',
  borderRadius: '8px',
  fontSize: '13px',
  fontFamily: 'var(--font-body)',
  fontWeight: 500,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  marginTop: '4px',
}

const secondaryBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: 'transparent',
  color: 'var(--fg)',
  border: '1px solid var(--border)',
}
