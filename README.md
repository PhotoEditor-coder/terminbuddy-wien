# TerminBuddy Wien

Online-Terminbuchungssystem für Wiener Unternehmen. Built with **Next.js 16**, **Prisma 7**, **Supabase Auth**, and **TypeScript**.

---

## Stack

| Layer | Technologie |
|---|---|
| Framework | Next.js 16 (App Router) |
| Auth | Supabase Auth + SSR |
| ORM | Prisma 7 |
| Database | PostgreSQL (via Supabase) |
| Styling | Tailwind CSS v4 + CSS Variables |
| Fonts | Cormorant Garamond + DM Sans |

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create a `.env.local` file:

```env
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="eyJ..."
```

### 3. Generate Prisma client & push schema

```bash
npm run db:generate
npm run db:push     # for development
# or
npm run db:migrate  # for production migrations
```

### 4. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Database Scripts

```bash
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:migrate   # Create and apply a migration
npm run db:push      # Push schema directly (dev only)
npm run db:studio    # Open Prisma Studio UI
```

---

## Project Structure

```
src/
  app/
    login/
      page.tsx      # Auth UI (sign in + sign up)
      actions.ts    # Server actions: signIn, signUp
    dashboard/
      page.tsx      # Protected dashboard
      actions.ts    # Server action: signOut
    layout.tsx      # Root layout with fonts + metadata
    globals.css     # Design system (CSS variables, art déco theme)
  lib/
    prisma.ts       # Singleton PrismaClient
    supabase/
      client.ts     # Browser Supabase client
      server.ts     # Server Supabase client
      proxy.ts      # Middleware session refresh
  middleware.ts     # Auth session middleware
prisma/
  schema.prisma     # Full booking system schema
```

---

## Data Model

```
Profile           — Users (synced with Supabase auth)
Business          — Businesses with slug, district, timezone
BusinessMember    — Profile ↔ Business join table (with role)
Service           — Services offered (duration, price)
OpeningHours      — Per-weekday hours per business
Appointment       — Bookings with status lifecycle
```

### Appointment Status Flow

```
PENDING → CONFIRMED → COMPLETED
                    → NO_SHOW
        → CANCELLED
```
