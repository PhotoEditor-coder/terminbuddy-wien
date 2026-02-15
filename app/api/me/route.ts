import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
        return Response.json({ ok: false, error: error?.message ?? "Not logged in" }, { status: 401 });
    }

    return Response.json({
        ok: true,
        user: {
            id: data.user.id,
            email: data.user.email,
            created_at: data.user.created_at,
        },
    });
}
