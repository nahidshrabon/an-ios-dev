import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the redirect back from Google OAuth, email confirmation links,
// and password reset links — they all use the same code-exchange flow.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const errorCode = searchParams.get("error_code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Email scanners (e.g. Gmail's link-safety prefetch) sometimes visit
  // confirmation links before the user does, consuming the one-time code.
  // If that happened, the account is usually already confirmed — the code
  // just isn't valid for a second use.
  if (errorCode === "otp_expired") {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "That link was already used (often by your email app scanning it for safety). If you just signed up, your email is likely already confirmed — try logging in."
      )}`
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Could not authenticate")}`
  );
}
