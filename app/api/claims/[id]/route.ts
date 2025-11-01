import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * Dev bypass helper (same as route.ts)
 * Allows localhost requests or requests with x-dev-admin header
 */
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

/**
 * ✅ PUT /api/claims/[id]
 * Update claim status (approve / reject)
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    let devBypassed = false;
    if (userError || !user) {
      if (!isDevBypass(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      } else {
        devBypassed = true;
        console.warn("⚠️ Dev bypass used for PUT /api/claims/[id]");
      }
    }

    const { status } = await req.json();
    if (!status)
      return NextResponse.json({ error: "Missing status field" }, { status: 400 });

    const normalized = String(status).toLowerCase();

    // ✅ Update claim
    const { error } = await supabase
      .from("claims")
      .update({ status: normalized })
      .eq("id", params.id);

    if (error) {
      console.error("Claim update error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // ✅ If approved, mark the item as claimed
    if (normalized === "approved") {
      const { data: claimData } = await supabase
        .from("claims")
        .select("item_id")
        .eq("id", params.id)
        .single();

      if (claimData?.item_id) {
        await supabase
          .from("items")
          .update({ status: "Claimed" })
          .eq("id", claimData.item_id);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Claim ${normalized} successfully.`,
    });
  } catch (err) {
    console.error("PUT /claims/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * ✅ DELETE /api/claims/[id]
 * Delete claim
 */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      if (!isDevBypass(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      } else {
        console.warn("⚠️ Dev bypass used for DELETE /api/claims/[id]");
      }
    }

    const { error } = await supabase.from("claims").delete().eq("id", params.id);

    if (error) {
      console.error("Claim delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Claim deleted" });
  } catch (err) {
    console.error("DELETE /claims/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
