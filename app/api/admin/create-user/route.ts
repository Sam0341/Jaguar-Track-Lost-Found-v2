import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service Role client (full access)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, role, requesterId } = body;

    // 🔍 Validate body
    if (!email || !password || !role || !requesterId) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // Prevent role escalation
    if (role === "superadmin") {
      return NextResponse.json(
        { error: "Cannot assign superadmin role via UI." },
        { status: 403 }
      );
    }

    // 🔥 1. Validate requester is SUPERADMIN
    const { data: requesterProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("superadmin")
      .eq("id", requesterId)
      .maybeSingle();

    if (profileErr || !requesterProfile) {
      return NextResponse.json(
        { error: "Requester not found." },
        { status: 400 }
      );
    }

    if (!requesterProfile.superadmin) {
      return NextResponse.json(
        { error: "Only superadmins can create new accounts." },
        { status: 403 }
      );
    }

    // 🔥 2. Check if user already exists in Supabase Auth
    const { data: userList } = await supabase.auth.admin.listUsers();
    const existing = userList.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existing) {
      return NextResponse.json(
        { error: "User already exists." },
        { status: 409 }
      );
    }

    // 🔥 3. Create authentication user
    const { data: authData, error: authErr } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authErr) {
      return NextResponse.json(
        { error: authErr.message },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // 🔥 4. Create profile row
    const { error: profileCreateErr } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        email,
        role,
        full_name: null,
        phone: null,
        created_at: new Date().toISOString(),
        superadmin: false, // cannot create superadmin
      });

    if (profileCreateErr) {
      return NextResponse.json(
        { error: profileCreateErr.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      userId,
      message: "User created successfully.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error." },
      { status: 500 }
    );
  }
}
