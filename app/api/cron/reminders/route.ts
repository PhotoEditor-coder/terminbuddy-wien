import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { reminderEmail } from "@/lib/emailTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function minutes(n: number) {
    return n * 60_000;
}

function getWindowMin() {
    const v = Number(process.env.REMINDER_WINDOW_MIN ?? 5);
    return Number.isFinite(v) && v > 0 ? v : 5;
}

function getBool(name: string, def = true) {
    const v = process.env[name];
    if (v == null) return def;
    return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

function unauthorized() {
    return new Response("Unauthorized", { status: 401 });
}

function sameSecret(a: string | null, b: string | undefined) {
    if (!a || !b) return false;
    return a === b;
}

function isUniqueError(err: any) {
    // Prisma unique constraint
    return err?.code === "P2002";
}

/** Lock row first (prevents duplicate sends in concurrent cron runs) */
async function tryLockNotification(args: {
    businessId: string;
    appointmentId: string;
    kind: string;
    toEmail: string;
}) {
    try {
        await prisma.notificationLog.create({
            data: {
                businessId: args.businessId,
                appointmentId: args.appointmentId,
                kind: args.kind,
                toEmail: args.toEmail,
            },
            select: { id: true },
        });
        return true;
    } catch (err: any) {
        if (isUniqueError(err)) return false;
        throw err;
    }
}

async function unlockNotification(appointmentId: string, kind: string) {
    await prisma.notificationLog.deleteMany({ where: { appointmentId, kind } });
}

async function processKind(kind: "REMINDER_24H" | "REMINDER_2H", deltaMin: number) {
    const windowMin = getWindowMin();
    const now = new Date();

    const start = new Date(now.getTime() + minutes(deltaMin - windowMin));
    const end = new Date(now.getTime() + minutes(deltaMin + windowMin));

    const appts = await prisma.appointment.findMany({
        where: {
            status: { not: "CANCELLED" },
            startsAt: { gte: start, lt: end },
            client: { email: { not: null } },
            notifications: { none: { kind } }, // usa NotificationLog relation
        },
        include: {
            client: { select: { name: true, email: true, phone: true } },
            business: { select: { id: true, name: true, timezone: true } },
        },
        take: 250,
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const a of appts) {
        const to = a.client?.email;
        if (!to) {
            skipped++;
            continue;
        }

        // lock (idempotencia)
        const locked = await tryLockNotification({
            businessId: a.businessId,
            appointmentId: a.id,
            kind,
            toEmail: to,
        });

        if (!locked) {
            skipped++;
            continue;
        }

        try {
            const tpl = reminderEmail(
                {
                    businessName: a.business.name,
                    timeZone: a.business.timezone,
                    clientName: a.client?.name ?? "Cliente",
                    clientEmail: to,
                    clientPhone: a.client?.phone ?? null,
                    startsAt: a.startsAt,
                    endsAt: a.endsAt,
                    notes: a.notes ?? null,
                },
                kind
            );

            await sendEmail({
                to,
                subject: tpl.subject,
                html: tpl.html,
            });

            sent++;
        } catch (err) {
            failed++;
            // libera lock para reintento en la próxima pasada
            await unlockNotification(a.id, kind);
        }
    }

    return { kind, windowMin, deltaMin, total: appts.length, sent, skipped, failed };
}

export async function GET(req: NextRequest) {
    const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
    if (!sameSecret(secret, process.env.CRON_SECRET)) return unauthorized();

    const enable24h = getBool("REMINDER_24H", true);
    const enable2h = getBool("REMINDER_2H", true);

    const results: any[] = [];

    if (enable24h) results.push(await processKind("REMINDER_24H", 24 * 60));
    if (enable2h) results.push(await processKind("REMINDER_2H", 2 * 60));

    return Response.json({
        ok: true,
        at: new Date().toISOString(),
        results,
    });
}
