import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the redirect back from Google OAuth, email confirmation links, and
// password reset links. Two exchange styles are supported:
//
//   ?token_hash=<hash>&type=<type>  — works in any browser / on any device
//   ?code=<code>                    — PKCE; only works in the same browser
//                                     that started the flow (the matching
//                                     verifier is stored in a cookie there)
//
// The email templates decide which one the link carries. Prefer the
// token-hash form for the password-reset template so a link requested on a
// laptop still works when opened on a phone.
// A plain server-side NextResponse.redirect() is unusable here: Netlify's
// Next.js runtime has a bug (netlify/next-runtime#2209) where it re-appends
// the *original* request's query string (our one-time `code`) onto whatever
// Location header a Route Handler returns. The cookies are already set by
// the time we respond, so a client-side bounce is just as safe and sidesteps
// that bug entirely.
function redirectResponse(url: string) {
  return new NextResponse(
    `<!doctype html><meta http-equiv="refresh" content="0;url=${url}">` +
      `<script>location.replace(${JSON.stringify(url)})</script>`,
    { status: 200, headers: { "content-type": "text/html" } }
  );
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const errorCode = searchParams.get("error_code");

  // Only let internal, single-slash paths through — never `//host`, `/\host`,
  // or an absolute URL, which would turn the link into an open redirect.
  const rawNext = searchParams.get("next");
  const next =
    rawNext && /^\/(?![/\\])/.test(rawNext) ? rawNext : "/roadmap";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as Parameters<typeof supabase.auth.verifyOtp>[0]["type"],
      token_hash: tokenHash,
    });
    if (!error) {
      return redirectResponse(`${origin}${next}`);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectResponse(`${origin}${next}`);
    }
    // A present-but-rejected code is almost always one of: already consumed
    // (an email link-scanner prefetched it), expired, or — for PKCE — opened
    // in a different browser than the one that requested it, so the matching
    // verifier cookie isn't here.
    return redirectResponse(
      `${origin}/login?error=${encodeURIComponent(
        "That link couldn't be verified. It may have expired or already been used, or it was opened in a different browser than the one you requested it from. Request a new link and open it in the same browser."
      )}`
    );
  }

  // Email scanners (e.g. Gmail's link-safety prefetch) sometimes visit
  // confirmation links before the user does, consuming the one-time code.
  // If that happened, the account is usually already confirmed — the code
  // just isn't valid for a second use.
  if (errorCode === "otp_expired") {
    return redirectResponse(
      `${origin}/login?error=${encodeURIComponent(
        "That link was already used (often by your email app scanning it for safety). If you just signed up, your email is likely already confirmed — try logging in."
      )}`
    );
  }

  return redirectResponse(
    `${origin}/login?error=${encodeURIComponent("Could not authenticate")}`
  );
}
