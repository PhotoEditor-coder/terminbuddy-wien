'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)

  const user = data.user
  if (user) {
    // Garantiza que exista Profile aunque el usuario venga “solo de Auth”
    await prisma.profile.upsert({
      where: { id: user.id },
      update: { email },
      create: { id: user.id, email, role: Role.CUSTOMER },
    })
  }

  redirect('/dashboard')
}

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const isBusinessAdmin = formData.get('isBusinessAdmin') === 'on'
  const businessName = String(formData.get('businessName') || '').trim()

  if (isBusinessAdmin && !businessName) {
    redirect(`/login?error=${encodeURIComponent('Business name is required for admin accounts')}`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)

  const user = data.user
  if (user) {
    const role = isBusinessAdmin ? Role.BUSINESS_ADMIN : Role.CUSTOMER

    // Profile
    await prisma.profile.upsert({
      where: { id: user.id },
      update: { email, role },
      create: { id: user.id, email, role },
    })

    // Si es admin, crea su Business + membership (solo si aún no tiene)
    if (role === Role.BUSINESS_ADMIN) {
      const hasMembership = await prisma.businessMember.findFirst({
        where: { profileId: user.id },
        select: { id: true },
      })

      if (!hasMembership) {
        await prisma.$transaction(async (tx) => {
          const business = await tx.business.create({
            data: { name: businessName, timezone: 'Europe/Vienna', locale: 'de' },
          })
          await tx.businessMember.create({
            data: { businessId: business.id, profileId: user.id },
          })
        })
      }
    }
  }

  // Si tienes “email confirmation” activado, quizá NO haya sesión aún
  if (!data.session) {
    redirect(`/login?msg=${encodeURIComponent('Check your email to confirm your account, then sign in.')}`)
  }

  redirect('/dashboard')
}
