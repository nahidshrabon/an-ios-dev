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
// Redirects here must be relative, and must not go through a Location header.
//
// Relative, because `new URL(request.url).origin` inside a Netlify function
// resolves to the deploy-specific domain (<hash>--<site>.netlify.app), not
// the production one. Sending the browser there after a successful exchange
// strands it on a domain the session cookies were never set for, so it
// arrives logged out. A relative path always resolves against the domain the
// browser is already on — the same one holding the cookies.
//
// Not a Location header, because Netlify's Next.js runtime re-appends the
// original request's query string (our one-time `code`) onto whatever a
// Route Handler redirects to (netlify/next-runtime#2209). Cookies are set by
// the time we respond, so a client-side bounce is equivalent and avoids it.
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function redirectResponse(path: string) {
  return new NextResponse(
    `<!doctype html><meta http-equiv="refresh" content="0;url=${escapeHtml(
      path
    )}"><script>location.replace(${JSON.stringify(path).replace(
      /</g,
      "\\u003c"
    )})</script>`,
    {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const errorCode = searchParams.get("error_code");

  // Only let internal, single-slash paths built from an unambiguous character
  // set through — never `//host`, `/\host`, or an absolute URL, which would
  // turn the link into an open redirect.
  const rawNext = searchParams.get("next");
  const next =
    rawNext && /^\/(?![/\\])[A-Za-z0-9\-._~/]*$/.test(rawNext)
      ? rawNext
      : "/roadmap";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as Parameters<typeof supabase.auth.verifyOtp>[0]["type"],
      token_hash: tokenHash,
    });
    if (!error) {
      return redirectResponse(next);
    }
    console.error("[auth/callback] verifyOtp failed:", error);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectResponse(next);
    }
    // A present-but-rejected code is almost always one of: already consumed
    // (an email link-scanner prefetched it), expired, or — for PKCE — opened
    // in a different browser than the one that requested it, so the matching
    // verifier cookie isn't here. The specific reason is logged server-side
    // for diagnosis; users get the actionable summary without the raw error.
    console.error("[auth/callback] exchangeCodeForSession failed:", error);
    return redirectResponse(
      `/login?error=${encodeURIComponent(
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
      `/login?error=${encodeURIComponent(
        "That link was already used (often by your email app scanning it for safety). If you just signed up, your email is likely already confirmed — try logging in."
      )}`
    );
  }

  return redirectResponse(
    `/login?error=${encodeURIComponent("Could not authenticate")}`
  );
}
