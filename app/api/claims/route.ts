import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { Resend } from "resend";

/* ----------------------------------------------------------
 * 🧠 Utility: Dev Bypass Helper
 * ---------------------------------------------------------- */
function isDevBypass(req: Request) {
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  const host = req.headers.get("host") || "";
  const headerSecret = req.headers.get("x-dev-admin") || "";

  const devEnv = process.env.NODE_ENV !== "production";
  const originIsLocal =
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    host.includes("localhost") ||
    host.includes("127.0.0.1");

  const secretOk =
    headerSecret &&
    process.env.DEV_ADMIN_SECRET &&
    headerSecret === process.env.DEV_ADMIN_SECRET;

  return (devEnv && originIsLocal) || secretOk;
}

/* ----------------------------------------------------------
 * 🧠 Utility: Create Admin Supabase Client (Service Key)
 * ---------------------------------------------------------- */
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false } }
  );
}

/* ----------------------------------------------------------
 * 🧠 Utility: Get Supabase User from Authorization Header
 * ---------------------------------------------------------- */
async function getSupabaseUserFromToken(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return { ...data.user, access_token: token };
}

/* ==========================================================
 * ✅ GET /api/claims → Fetch all claims (Admin)
 * ========================================================== */
export async function GET(req: Request) {
  try {
    const cookieClient = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await cookieClient.auth.getUser();

    const isBypass = isDevBypass(req);
    const supabase = !user && !isBypass ? createAdminClient() : cookieClient;

    const { data, error } = await supabase
      .from("claims")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error("🔥 GET /claims error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/* ==========================================================
 * ✅ POST /api/claims → Submit a new claim (User)
 * ========================================================== */
export async function POST(req: Request) {
  try {
    let user: any = await getSupabaseUserFromToken(req);

    const cookieClient = createRouteHandlerClient({ cookies });
    if (!user) {
      const { data, error } = await cookieClient.auth.getUser();
      if (error || !data?.user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized – no valid session" },
          { status: 401 }
        );
      }
      user = { ...data.user, access_token: "" };
    }

    const { item_id, message } = await req.json();
    if (!item_id) {
      return NextResponse.json(
        { success: false, error: "Missing item_id" },
        { status: 400 }
      );
    }

    const supabaseClient = user.access_token
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${user.access_token}` } },
          }
        )
      : cookieClient;

    const { error } = await supabaseClient.from("claims").insert([
      {
        item_id,
        claimed_by: user.id,
        message: message || "",
        status: "pending",
      },
    ]);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Claim submitted successfully!",
    });
  } catch (err: any) {
    console.error("🔥 POST /claims error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/* ==========================================================
 * ✅ PATCH /api/claims → Approve or reject a claim (Admin)
 * ========================================================== */
export async function PATCH(req: Request) {
  try {
    const cookieClient = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await cookieClient.auth.getUser();

    const isBypass = isDevBypass(req);
    const supabase = !user && !isBypass ? createAdminClient() : cookieClient;

    const { claim_id, status } = await req.json();
    if (!claim_id || !status)
      return NextResponse.json(
        { success: false, error: "Missing claim_id or status" },
        { status: 400 }
      );

    const normalizedStatus = String(status).toLowerCase();

    // ✅ Update claim
    const { error: updateError } = await supabase
      .from("claims")
      .update({ status: normalizedStatus })
      .eq("id", claim_id);

    if (updateError) throw updateError;

    // ✅ Update item status if approved
    if (normalizedStatus === "approved") {
      const { data: claimData } = await supabase
        .from("claims")
        .select("item_id")
        .eq("id", claim_id)
        .single();

      if (claimData?.item_id) {
        await supabase
          .from("items")
          .update({ status: "Claimed" })
          .eq("id", claimData.item_id);
      }
    }

    /* ----------------------------------------------------------
     * ✉️ Send Email Notification to the Claimant
     * ---------------------------------------------------------- */
    const { data: fullClaim } = await supabase
      .from("claims")
      .select(
        `
        id,
        status,
        message,
        items ( name ),
        profiles:claimed_by ( email, full_name )
      `
      )
      .eq("id", claim_id)
      .single();

    // 🔧 Fix: profiles can be an array
    const claimantProfile = Array.isArray(fullClaim?.profiles)
      ? fullClaim.profiles[0]
      : fullClaim.profiles;

    if (claimantProfile?.email && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY!);
        const claimantEmail = claimantProfile.email;
        const itemName = fullClaim.items?.name || "your claimed item";

        await resend.emails.send({
          from:
            process.env.RESEND_FROM_EMAIL ||
            "JaguarTrack <noreply@jaguartrack.com>",
          to: claimantEmail,
          subject: `Your claim for "${itemName}" has been ${normalizedStatus}`,
          html: `
            <h2>Jaguar Track Lost & Found</h2>
            <p>Hi ${claimantProfile.full_name || "there"},</p>
            <p>Your claim for <b>${itemName}</b> has been <b>${normalizedStatus}</b>.</p>
            ${
              normalizedStatus === "approved"
                ? "<p>🎉 You can now contact the admin to collect your item!</p>"
                : "<p>😞 Unfortunately, your claim was not approved.</p>"
            }
            <hr/>
            <p>Thank you for using Jaguar Track Lost & Found.</p>
          `,
        });
      } catch (mailErr: any) {
        console.warn("⚠️ Failed to send email via Resend:", mailErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Claim ${normalizedStatus} successfully! Email sent if applicable.`,
    });
  } catch (err: any) {
    console.error("🔥 PATCH /claims error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
