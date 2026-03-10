'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { Role } from '@/generated/prisma/enums'

// ─── Helpers ────────────────────────────────────────────────────

function errorRedirect(msg: string): never {
  redirect(`/login?error=${encodeURIComponent(msg)}`)
}

function msgRedirect(msg: string): never {
  redirect(`/login?msg=${encodeURIComponent(msg)}`)
}

// Slugify business name: "Salon Anna Wien" → "salon-anna-wien"
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// ─── Sign In ────────────────────────────────────────────────────

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) errorRedirect('Email and password are required')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) errorRedirect(error.message)

  const user = data.user
  if (user) {
    // Sync profile (select only id to minimize data transfer)
    await prisma.profile.upsert({
      where: { id: user.id },
      update: { email: user.email ?? email },
      create: { id: user.id, email: user.email ?? email, role: Role.CUSTOMER },
      select: { id: true },
    })
  }

  redirect('/dashboard')
}

// ─── Sign Up ────────────────────────────────────────────────────

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const isBusinessAdmin = formData.get('isBusinessAdmin') === 'on'
  const businessName = String(formData.get('businessName') ?? '').trim()

  if (!email || !password) errorRedirect('Email and password are required')
  if (isBusinessAdmin && !businessName) errorRedirect('Business name is required for admin accounts')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) errorRedirect(error.message)

  const user = data.user
  if (user) {
    const role = isBusinessAdmin ? Role.BUSINESS_ADMIN : Role.CUSTOMER

    // Use a single transaction for all writes
    await prisma.$transaction(async (tx) => {
      await tx.profile.upsert({
        where: { id: user.id },
        update: { email: user.email ?? email, role },
        create: { id: user.id, email: user.email ?? email, role },
        select: { id: true },
      })

      if (role === Role.BUSINESS_ADMIN) {
        const existing = await tx.businessMember.findFirst({
          where: { profileId: user.id },
          select: { id: true },
        })

        if (!existing) {
          const slug = toSlug(businessName)
          // Ensure slug uniqueness by appending cuid suffix if needed
          const slugExists = await tx.business.findUnique({
            where: { slug },
            select: { id: true },
          })
          const finalSlug = slugExists ? `${slug}-${Date.now()}` : slug

          const business = await tx.business.create({
            data: {
              name: businessName,
              slug: finalSlug,
              timezone: 'Europe/Vienna',
              locale: 'de',
            },
            select: { id: true },
          })

          await tx.businessMember.create({
            data: {
              businessId: business.id,
              profileId: user.id,
              role: Role.BUSINESS_ADMIN,
            },
          })
        }
      }
    })
  }

  if (!data.session) {
    msgRedirect('Bitte bestätige deine E-Mail-Adresse, dann kannst du dich einloggen.')
  }

  redirect('/dashboard')
}
